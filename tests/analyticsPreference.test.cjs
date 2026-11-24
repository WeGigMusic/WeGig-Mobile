const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/components/AnalyticsPreference.tsx"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true }
}).outputText;

// Minimal hook harness: explicit rerenders and effect cleanup simulate remounts.
// Network and storage are mocked; the production preference component executes.
function setup() {
  const storage = new Map(), remote = new Map([["a", true], ["b", true]]);
  let retry, consentRead;
  let ageCheck = async () => true;
  let online = true, user = "a", starts = [], active = false, listener, cleanup, slots = [], cursor = 0, effect, component;
  const react = {
    createContext: () => ({ Provider: "provider" }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], v => { slots[i] = v; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(fn) { if (!cleanup) effect = fn; },
  };
  const appState = { currentState: "active", addEventListener(_, fn) { listener = fn; return { remove() { listener = undefined; } }; } };
  const deps = {
    react,
    "react-native": { AppState: appState, Alert: { alert() {} }, Modal: "modal", View: "view" },
    "@react-native-async-storage/async-storage": {
      getItem: async k => storage.get(k) ?? null,
      setItem: async (k,v) => { storage.set(k,v); },
      removeItem: async k => { storage.delete(k); },
    },
    "./AnalyticsConsent": () => null,
    "../lib/analyticsConsent": {
      readAnalyticsConsent: async id => { if (!online) throw Error("offline"); return consentRead ? consentRead() : remote.get(id) ?? null; },
      saveAnalyticsConsent: async (id,v) => { if (!online) throw Error("offline"); remote.set(id,v); },
    },
    "../lib/analytics": { analyticsEnabled: true, startAnalytics: async id => { starts.push(id); active = true; }, stopAnalytics: () => { active = false; } },
    "../lib/supabase": { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: user } } } }) } } },
  };
  const mod = { exports: {} };
  vm.runInNewContext(source, { setInterval: fn => { retry = fn; return 1; }, clearInterval: () => { retry = undefined; }, module: mod, exports: mod.exports, require: name => {
    assert.ok(Object.hasOwn(deps,name), name); return deps[name];
  } });
  function render() {
    cursor = 0;
    const outer = mod.exports.AnalyticsPreference({ userId: user, ageAllowsAnalytics: () => ageCheck() });
    component = outer.type(outer.props);
    if (effect) { const fn = effect; effect = undefined; cleanup = fn(); }
    return component.props.value;
  }
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); return render(); };
  function unmount() { cleanup?.(); cleanup = undefined; slots = []; }
  return { storage, remote, starts, render, settle, unmount,
    ageCheck(fn) { ageCheck = fn; },
    online(v) { online = v; },
    mockConsentRead(read) { consentRead = read; },
    tick() { retry?.(); },
    retryActive: () => !!retry,
    foreground() { listener("background"); listener("active"); },
    user(v) { user = v; },
    active: () => active };
}

test("offline withdrawal survives restart and overrides stale server grant", async () => {
  const h = setup();
  h.render(); let p = await h.settle();
  assert.equal(p.accepted,true);
  h.online(false); await p.choose(false);
  assert.equal(h.active(),false);
  assert.equal(h.storage.get("wegig.analytics.withdrawal.a"),"1");
  h.unmount(); h.render(); p = await h.settle();
  assert.equal(p.accepted,false);
  h.online(true); h.foreground(); p = await h.settle();
  assert.equal(p.accepted,false);
  assert.equal(h.remote.get("a"),false);
  assert.equal(h.active(),false);
  assert.equal(h.starts.length,1);
});
test("explicit successful opt-in clears local denial", async () => {
  const h = setup(); h.render(); let p = await h.settle();
  await p.choose(false); p = h.render();
  assert.equal(p.accepted,false);
  await p.choose(true); p = h.render();
  assert.equal(p.accepted,true);
  assert.equal(h.storage.has("wegig.analytics.withdrawal.a"),false);
  assert.equal(h.active(),true);
});
test("local denial is isolated by account on remount", async () => {
  const h = setup(); h.render(); let p = await h.settle();
  h.online(false); await p.choose(false); h.unmount();
  h.online(true); h.user("b"); h.render(); p = await h.settle();
  assert.equal(p.accepted,true);
  assert.equal(h.storage.get("wegig.analytics.withdrawal.a"),"1");
  assert.equal(h.starts.at(-1),"b");
});

test("acknowledged withdrawal does not overwrite a later remote opt-in", async () => {
  const h = setup(); h.render(); let p = await h.settle();
  await p.choose(false);
  assert.equal(h.remote.get("a"),false);
  assert.equal(h.storage.has("wegig.analytics.withdrawal.a"),false);
  h.remote.set("a",true);
  h.foreground(); p = await h.settle();
  assert.equal(p.accepted,true);
  assert.equal(h.remote.get("a"),true);
  assert.equal(h.active(),true);
});
test("offline withdrawal is cleared after successful foreground synchronization", async () => {
  const h = setup(); h.render(); let p = await h.settle();
  h.online(false); await p.choose(false);
  h.online(true); h.foreground(); p = await h.settle();
  assert.equal(p.accepted,false);
  assert.equal(h.remote.get("a"),false);
  assert.equal(h.storage.has("wegig.analytics.withdrawal.a"),false);
});

test("pending withdrawal retries without app restart and timer is cleaned up", async () => {
  const h = setup(); h.render(); let p = await h.settle();
  h.online(false); await p.choose(false);
  h.online(true); h.tick(); p = await h.settle();
  assert.equal(p.accepted,false);
  assert.equal(h.remote.get("a"),false);
  assert.equal(h.storage.has("wegig.analytics.withdrawal.a"),false);
  h.remote.set("a",true); h.tick(); await h.settle();
  assert.equal(h.remote.get("a"),true);
  h.unmount(); assert.equal(h.retryActive(),false);
});


test("withdrawal during a preference refresh ignores a stale server grant", async () => {
  const h = setup();
  h.render();
  let preference = await h.settle();
  assert.equal(preference.accepted, true);

  let finishRead;
  const pendingRead = new Promise(resolve => { finishRead = resolve; });
  let markReadStarted;
  const readStarted = new Promise(resolve => { markReadStarted = resolve; });
  h.mockConsentRead(() => {
    markReadStarted();
    return pendingRead;
  });
  h.foreground();
  await readStarted;
  preference = h.render();
  assert.equal(preference.busy, true);
  assert.equal(preference.canWithdraw, true);

  const withdrawal = preference.choose(false);
  assert.equal(h.render().accepted, false);
  assert.equal(h.active(), false);
  finishRead(true);
  await withdrawal;

  assert.equal(h.render().accepted, false);
  assert.equal(h.remote.get("a"), false);
  assert.equal(h.active(), false);
  assert.deepEqual(h.starts, ["a"]);
});


test("a stale consent read cannot start analytics after an account switch", async () => {
  const h = setup();
  let finishRead;
  const pendingRead = new Promise(resolve => { finishRead = resolve; });
  let markReadStarted;
  const readStarted = new Promise(resolve => { markReadStarted = resolve; });
  h.mockConsentRead(() => {
    markReadStarted();
    return pendingRead;
  });
  h.render();
  await readStarted;

  h.unmount();
  h.user("b");
  h.remote.set("b", false);
  h.mockConsentRead(undefined);
  h.render();
  assert.equal((await h.settle()).accepted, false);

  finishRead(true);
  assert.equal((await h.settle()).accepted, false);
  assert.equal(h.active(), false);
  assert.deepEqual(h.starts, []);
});

test("age restrictions pause opted-in analytics and leave withdrawal available", async () => {
  const h = setup();
  h.render();
  assert.equal((await h.settle()).eligible, true);
  assert.equal(h.active(), true);

  h.ageCheck(async () => false);
  h.foreground();
  const preference = await h.settle();
  assert.equal(preference.eligible, false);
  assert.equal(preference.canWithdraw, true);
  assert.equal(h.active(), false);
  await preference.choose(false);
  assert.equal(h.remote.get("a"), false);
});

test("pending age checks cannot enable analytics and ineligible accounts cannot opt in", async () => {
  const h = setup();
  h.remote.delete("a");
  let resolveAge;
  h.ageCheck(() => new Promise(resolve => { resolveAge = resolve; }));
  h.render();
  let preference = await h.settle();
  assert.equal(h.active(), false);
  await preference.choose(true);
  assert.equal(h.remote.has("a"), false);

  resolveAge(false);
  preference = await h.settle();
  await preference.choose(true);
  assert.equal(preference.eligible, false);
  assert.equal(h.remote.has("a"), false);
  assert.deepEqual(h.starts, []);
});
