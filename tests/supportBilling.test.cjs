const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const vm=require("node:vm");
const path=require("node:path");
const compile=name=>ts.transpileModule(fs.readFileSync(path.join(__dirname,"../src/support",name),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
function setup(){
 const purchases={}; new Function("exports",compile("purchases.ts"))(purchases);
 let cursor=0,slots=[],effect,cleanup,updated,errors,requests=0,fail=false,unfinished=[],hold;
 const account={appleAppAccountToken:"a",googleObfuscatedAccountId:"b",isFoundingSupporter:false};
 const sku=purchases.supportId("apple","small");
 const react={
 useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return [slots[i],x=>{slots[i]=x;}];},
 useRef(v){const i=cursor++;if(!(i in slots))slots[i]={current:v};return slots[i];},
 useEffect(fn){if(!cleanup)effect=fn;},
 useCallback(fn){return fn;}
 };
 const native={
 ErrorCode:{UserCancelled:"cancel",DeferredPayment:"deferred",Pending:"pending"},
 purchaseUpdatedListener(fn){updated=fn;return {remove(){}};},
 purchaseErrorListener(fn){errors=fn;return {remove(){}};},
 initConnection:async()=>true,endConnection:async()=>true,
 fetchProducts:async()=>[{id:sku,type:"in-app",platform:"ios",displayPrice:"£1"}],
 getPendingTransactionsIOS:async()=>{if(hold)await hold;return unfinished;},
 requestPurchase:async()=>{requests++;},finishTransaction:async()=>{}
 };
 const deps={react,"react-native":{Platform:{OS:"ios"},AppState:{addEventListener(){return {remove(){}};}}},"expo-application":{applicationId:"com.wegig.mobile"},"expo-iap":native,"../lib/analytics":{posthog:{capture(){},flush:async()=>{}}},"./purchases":purchases,"./api":{getSupportStatus:async()=>account,verifySupportPurchase:async()=>{if(fail)throw Error("offline");return {verified:true,environment:"production",isFoundingSupporter:true};}}};
 const mod={exports:{}};
 vm.runInNewContext(compile("useSupportBilling.ts"),{module:mod,exports:mod.exports,require:n=>{assert.ok(Object.hasOwn(deps,n),n);return deps[n];},setTimeout,clearTimeout});
 function render(){cursor=0;const result=mod.exports.useSupportBilling("a");if(effect){const e=effect;effect=undefined;cleanup=e();}return result;}
 const settle=async()=>{await new Promise(r=>setImmediate(r));return render();};
 return {render,settle,requests:()=>requests,close:()=>cleanup?.(),fail:v=>{fail=v;},pending:()=>errors({code:"pending",productId:sku}),deliver:(id="1")=>updated({id,productId:sku,purchaseState:"purchased",appAccountToken:"a"}),hold:()=>{let release;hold=new Promise(r=>{release=r;});return ()=>{hold=undefined;release();};}};
}
test("stale payment handler cannot start a second contribution or bypass pending confirmation",async t=>{
 const h=setup();t.after(h.close);h.render();const p=await h.settle();assert.ok(p.onPurchase);
 const first=p.onPurchase("small");
 await assert.rejects(p.onPurchase("small"),/Payment unavailable/);
 h.pending();assert.equal(await first,"pending");
 await assert.rejects(p.onPurchase("small"),/Payment unavailable/);
 assert.equal(h.requests(),1);
});
test("failed verification blocks payment until successful reconciliation",async t=>{
 const h=setup();t.after(h.close);h.render();const p=await h.settle();
 h.fail(true);const first=p.onPurchase("small");const rejected=assert.rejects(first,/Confirmation delayed/);h.deliver();await rejected;
 await assert.rejects(p.onPurchase("small"),/Payment unavailable/);
 h.fail(false);let next=await h.settle();next.retry();next=await h.settle();assert.ok(next.onPurchase);
});
test("refresh blocks stale handlers and concurrent pending notifications survive recovery",async t=>{
 const h=setup();t.after(h.close);h.render();const p=await h.settle();
 const release=h.hold();p.retry();await h.settle();
 await assert.rejects(p.onPurchase("small"),/Payment unavailable/);
 h.pending();release();const next=await h.settle();
 assert.equal(next.confirmationOutstanding,true);assert.equal(next.onPurchase,undefined);
 assert.equal(h.requests(),0);
});
