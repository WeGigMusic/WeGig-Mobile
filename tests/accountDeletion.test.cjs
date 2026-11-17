const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const user = "11111111-1111-4111-8111-111111111111";
const pendingKey = "wegig.accountDeletionPending";
const source = ts.transpileModule(
  fs.readFileSync(
    path.join(__dirname, "../src/lib/accountDeletion.ts"), "utf8"
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }
).outputText;

function setup() {
  const storage = new Map();
  const events = [];
  const state = {
    session: { user: { id: user } },
    failRequest: false,
    failCleanup: false,
  };

  const dependencies = {
    "@react-native-async-storage/async-storage": {
      __esModule: true,
      default: {
        getItem: async key => storage.get(key) ?? null,
        setItem: async (key, value) => storage.set(key, value),
        removeItem: async key => storage.delete(key),
        multiRemove: async keys => {
          keys.forEach(key => storage.delete(key));
        },
      },
    },
    "expo-notifications": {
      cancelAllScheduledNotificationsAsync: async () => events.push("notifications"),
      dismissAllNotificationsAsync: async () => events.push("dismiss"),
    },
    "./api": {
      apiDelete: async (route, body) => {
        events.push(["delete", route, body]);
        if (state.failRequest) throw new Error("Test network failure");
        return { deleted: true };
      },
    },
    "./supabase": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: state.session }, error: null,
          }),
          signOut: async () => {
            events.push("signOut");
            state.session = null;
            return { error: null };
          },
        },
      },
    },
    "./analytics": {
      posthog: { reset: () => events.push("analytics") },
    },
    "./localProfile": {
      deleteLocalProfile: async id => {
        events.push(["profile", id]);
        if (state.failCleanup) throw new Error("Test cleanup failure");
      },
    },
    "./gigsCache": {
      setCachedGigs: async gigs => {
        assert.equal(gigs.length, 0);
        events.push("cache");
      },
    },
    "./offlineQueue": {
      clearQueue: async () => events.push("clearQueue"),
      pauseGigQueueForDeletion: async () => events.push("pause"),
      resumeGigQueueAfterDeletion: () => events.push("resume"),
    },
  };

  function reload() {
    const module = { exports: {} };
    vm.runInNewContext(source, {
      module,
      exports: module.exports,
      require(name) {
        if (!(name in dependencies)) throw new Error("Unexpected import: " + name);
        return dependencies[name];
      },
    });
    return module.exports;
  }

  return { api: reload(), reload, storage, events, state };
}

test("deletion requires confirmation before any API request", async () => {
  const { api, events } = setup();
  await assert.rejects(() => api.deleteMyAccount());
  assert.equal(events.length, 0);
});

test("confirmed deletion clears local data and signs out", async () => {
  const { api, storage, events, state } = setup();
  await api.beginAccountDeletion();
  assert.equal(JSON.parse(storage.get(pendingKey)).userId, user);

  await api.deleteMyAccount();

  const request = events.find(event => Array.isArray(event) && event[0] === "delete");
  assert.equal(request[1], "/account");
  assert.equal(request[2].confirmation, "DELETE");
  assert.ok(events.includes("clearQueue"));
  assert.ok(events.includes("notifications"));
  assert.ok(events.includes("cache"));
  assert.equal(state.session, null);
  assert.equal(storage.has(pendingKey), false);
  assert.equal(events[events.length - 1], "resume");
});

test("network failure keeps deletion pending and does not sign out", async () => {
  const { api, storage, events, state } = setup();
  await api.beginAccountDeletion();
  state.failRequest = true;
  await assert.rejects(() => api.deleteMyAccount());
  assert.equal(JSON.parse(storage.get(pendingKey)).serverDeleted, false);
  assert.equal(events.includes("signOut"), false);
  assert.equal(events.includes("resume"), false);
});

test("restart resumes cleanup without deleting the server account twice", async () => {
  const { api, reload, storage, events, state } = setup();
  await api.beginAccountDeletion();
  state.failCleanup = true;
  await assert.rejects(() => api.deleteMyAccount());
  assert.equal(JSON.parse(storage.get(pendingKey)).serverDeleted, true);

  state.failCleanup = false;
  state.session = null;
  await reload().deleteMyAccount();

  assert.equal(
    events.filter(event => Array.isArray(event) && event[0] === "delete").length,
    1
  );
  assert.equal(storage.has(pendingKey), false);
});

test("a different signed-in account cannot continue server deletion", async () => {
  const { api, events, state } = setup();
  await api.beginAccountDeletion();
  state.session = { user: { id: "another-user" } };
  await assert.rejects(() => api.deleteMyAccount());
  assert.equal(
    events.some(event => Array.isArray(event) && event[0] === "delete"),
    false
  );
});