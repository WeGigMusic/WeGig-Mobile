const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Compile only the pure transaction coordinator. No native module or credentials.
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/support/purchases.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const exportsObject = {};
new Function('exports', compiled.outputText)(exportsObject);
const { createPurchaseProcessor, SupportApiError, supportId } = exportsObject;
const account = { appleAppAccountToken: 'user-1', googleObfuscatedAccountId: 'account-hash', isFoundingSupporter: false, isTestSupporter: false };
const purchase = () => ({ id: '123', productId: supportId('apple','small'), purchaseState: 'purchased', appAccountToken: 'user-1' });
const verdict = { verified: true, environment: 'production', isFoundingSupporter: true, isTestSupporter: false };
function processor(overrides = {}) {
 const calls = [];
 const process = createPurchaseProcessor({ store: 'apple', account,
  verify: async () => { calls.push('verify'); return verdict; },
  onVerified: () => calls.push('grant'), finish: async () => { calls.push('finish'); }, ...overrides });
 return { process, calls };
}
test('verification precedes grant and finishing; duplicate events process once', async () => {
 const {process,calls} = processor(); const results = await Promise.all([process(purchase()),process(purchase())]);
 assert.deepEqual(results,['verified','verified']); assert.deepEqual(calls,['verify','grant','finish']);
 await process(purchase()); assert.equal(calls.length,3);
});
test('server failure never finishes and the purchase can be retried', async () => {
 let attempts=0; const {process,calls} = processor({verify:async()=>{if(++attempts===1) throw new Error('offline'); return verdict;}});
 await assert.rejects(process(purchase())); assert.deepEqual(calls,[]);
 assert.equal(await process(purchase()),'verified'); assert.deepEqual(calls,['grant','finish']);
});
test('pending, unknown, wrong account and foreign products never grant or finish', async () => {
 const {process,calls}=processor();
 assert.equal(await process({...purchase(),purchaseState:'pending'}),'pending');
 for (const patch of [{purchaseState:'unknown'}, {appAccountToken:'another-user'}, {appAccountToken:null}, {productId:'unrelated'}]) assert.equal(await process({...purchase(),...patch}),undefined);
 assert.deepEqual(calls,[]);
});
test('sandbox uses a separate result and cannot impersonate a paid purchase', async () => {
 const {process}=processor({verify:async()=>({...verdict,environment:'sandbox',isFoundingSupporter:false,isTestSupporter:true})});
 assert.equal(await process(purchase()),'test-verified');
});
test('finish failure can be recovered without losing the verified transaction', async () => {
 let attempts=0; const {process}=processor({finish:async()=>{if(++attempts===1) throw new Error('store offline');}});
 await assert.rejects(process(purchase())); assert.equal(await process(purchase()),'verified'); assert.equal(attempts,2);
});
test('Google requires the bound account and purchase token', async () => {
 const {process,calls}=processor({store:'google'});
 const google={...purchase(),productId:supportId('google','small'),obfuscatedAccountIdAndroid:'account-hash',purchaseToken:'token'};
 assert.equal(await process({...google,obfuscatedAccountIdAndroid:'wrong'}),undefined);
 await assert.rejects(process({...google,purchaseToken:null}));
 assert.equal(await process(google),'verified'); assert.deepEqual(calls,['verify','grant','finish']);
});
test('malformed verification never grants or finishes', async () => {
 const {process,calls}=processor({verify:async()=>({verified:false,environment:'production'})});
 await assert.rejects(process(purchase())); assert.deepEqual(calls,[]);
});

test('concurrent failed verification is retried only once per transaction', async () => {
 let attempts=0;
 const {process,calls}=processor({verify:async()=>{if(++attempts===1) throw Error('offline'); return verdict;}});
 const failed=await Promise.allSettled([process(purchase()),process(purchase())]);
 assert.ok(failed.every(result=>result.status==='rejected'));
 assert.equal(attempts,1);
 assert.deepEqual(await Promise.all([process(purchase()),process(purchase())]),['verified','verified']);
 assert.equal(attempts,2);
 assert.deepEqual(calls,['grant','finish']);
});

test('server-confirmed refunds are terminal without granting or consuming', async () => {
 const {process,calls}=processor({verify:async transaction=>{
   if (transaction.id !== '123') return verdict;
   throw new SupportApiError('PURCHASE_REFUNDED');
 }});
 assert.deepEqual(await Promise.all([process(purchase()),process(purchase())]),['cancelled','cancelled']);
 assert.equal(await process(purchase()),'cancelled');
 assert.deepEqual(calls,[]);
 assert.equal(await process({...purchase(),id:'another'}),'verified');
 assert.deepEqual(calls,['grant','finish']);
});

test('explicit provider pending and cancellation responses neither grant nor consume', async () => {
 for (const [code, result] of [['PAYMENT_PENDING', 'pending'], ['PAYMENT_CANCELLED', 'cancelled']]) {
   const {process,calls}=processor({verify:async()=>{ throw new SupportApiError(code); }});
   assert.equal(await process(purchase()), result);
   assert.deepEqual(calls, []);
 }
});
