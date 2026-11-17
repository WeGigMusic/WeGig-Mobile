const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const user = "11111111-1111-4111-8111-111111111111";
const pendingKey = "wegig.accountDeletionPending";
const cacheKey = "wegig:gigs:cache:v1";
const queueKey = "wegig:offline:gigQueue:v2";

function deferred() {
  let resolve;

  const promise = new Promise((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function setup() {
  const storage = new Map();
  const events = [];
  const scheduled = new Set();
  const modules = new Map();

  const state = {
    session: { user: { id: user } },
    failRequest: false,
    failCleanup: false,
    cacheStarted: null,
    cacheGate: null,
    scheduleStarted: null,
    scheduleGate: null,
    sendStarted: null,
    sendGate: null,
  };

  let notificationNumber = 0;

  const asyncStorage = {
    getItem: async (key) => storage.get(key) ?? null,

    setItem: async (key, value) => {
      storage.set(key, value);
    },

    removeItem: async (key) => {
      storage.delete(key);
    },

    multiGet: async (keys) =>
      keys.map((key) => [key, storage.get(key) ?? null]),

    multiSet: async (entries) => {
      if (state.cacheStarted) {
        state.cacheStarted.resolve();
      }

      if (state.cacheGate) {
        await state.cacheGate.promise;
      }

      for (const [key, value] of entries) {
        storage.set(key, value);
      }
    },

    multiRemove: async (keys) => {
      keys.forEach((key) => storage.delete(key));
    },
  };

  const notifications = {
    IosAuthorizationStatus: {
      PROVISIONAL: 3,
    },

    AndroidImportance: {
      DEFAULT: 3,
    },

    SchedulableTriggerInputTypes: {
      DATE: "date",
    },

    setNotificationHandler: () => {},

    setNotificationChannelAsync: async () => {},

    getPermissionsAsync: async () => ({
      granted: true,
    }),

    requestPermissionsAsync: async () => ({
      granted: true,
    }),

    scheduleNotificationAsync: async () => {
      notificationNumber += 1;
      const id = `notification-${notificationNumber}`;

      if (state.scheduleStarted) {
        state.scheduleStarted.resolve();
      }

      if (state.scheduleGate) {
        await state.scheduleGate.promise;
      }

      scheduled.add(id);
      events.push("scheduled");

      return id;
    },

    cancelScheduledNotificationAsync: async (id) => {
      scheduled.delete(id);
    },

    cancelAllScheduledNotificationsAsync: async () => {
      events.push("notifications");
      scheduled.clear();
    },

    dismissAllNotificationsAsync: async () => {
      events.push("dismiss");
    },
  };

  const dependencies = {
    "@react-native-async-storage/async-storage": {
      __esModule: true,
      default: asyncStorage,
    },

    "expo-notifications": notifications,

    "react-native": {
      Platform: {
        OS: "ios",
      },
    },

    "./api": {
      apiDelete: async (route, body) => {
        events.push(["delete", route, body]);

        if (route === "/account") {
          if (state.failRequest) {
            throw new Error("Test network failure");
          }

          return { deleted: true };
        }

        return {};
      },

      apiPost: async (route, body) => {
        events.push(["post", route, body]);

        if (state.sendStarted) {
          state.sendStarted.resolve();
        }

        if (state.sendGate) {
          await state.sendGate.promise;
        }

        return { id: "created-gig", ...body };
      },

      apiPatch: async () => ({}),
    },

    "./supabase": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: state.session },
            error: null,
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
      posthog: {
        reset: () => events.push("analytics"),
      },
    },

    "./localProfile": {
      deleteLocalProfile: async (id) => {
        events.push(["profile", id]);

        if (state.failCleanup) {
          throw new Error("Test cleanup failure");
        }
      },
    },
  };

  const allowedModules = new Set([
    "accountDeletion",
    "accountWork",
    "gigsCache",
    "notifications",
    "offlineQueue",
  ]);

  function load(name) {
    if (modules.has(name)) {
      return modules.get(name).exports;
    }

    assert.ok(allowedModules.has(name), `Unexpected module: ${name}`);

    const source = ts.transpileModule(
      fs.readFileSync(
        path.join(__dirname, "../src/lib", `${name}.ts`),
        "utf8",
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      },
    ).outputText;

    const loadedModule = { exports: {} };
    modules.set(name, loadedModule);

    vm.runInNewContext(source, {
      module: loadedModule,
      exports: loadedModule.exports,

      require(importName) {
        if (Object.hasOwn(dependencies, importName)) {
          return dependencies[importName];
        }

        if (importName.startsWith("./")) {
          return load(importName.slice(2));
        }

        throw new Error(`Unexpected import: ${importName}`);
      },
    });

    return loadedModule.exports;
  }

  function reload() {
    modules.delete("accountDeletion");
    return load("accountDeletion");
  }

  return {
    api: load("accountDeletion"),
    work: load("accountWork"),
    cache: load("gigsCache"),
    reminders: load("notifications"),
    queue: load("offlineQueue"),
    reload,
    storage,
    scheduled,
    events,
    state,
  };
}

function accountRequests(events) {
  return events.filter(
    (event) =>
      Array.isArray(event) &&
      event[0] === "delete" &&
      event[1] === "/account",
  );
}

test("deletion requires confirmation before any API request", async () => {
  const { api, events } = setup();

  await assert.rejects(() => api.deleteMyAccount());

  assert.equal(events.length, 0);
});

test("confirmed deletion clears local data and signs out", async () => {
  const { api, work, cache, storage, events, state } = setup();
  const oldToken = work.captureAccountWork();

  await cache.setCachedGigs([{ id: "old-gig" }]);
  storage.set("wegig.firstGigId", "old-gig");
  storage.set("wegig.favouriteGigId", "old-gig");

  await api.beginAccountDeletion();

  assert.equal(
    JSON.parse(storage.get(pendingKey)).userId,
    user,
  );

  await api.deleteMyAccount();

  const request = accountRequests(events)[0];

  assert.equal(request[1], "/account");
  assert.equal(request[2].confirmation, "DELETE");
  assert.ok(events.includes("notifications"));
  assert.ok(events.includes("dismiss"));
  assert.ok(events.includes("analytics"));
  assert.ok(events.includes("signOut"));
  assert.equal(state.session, null);
  assert.equal(storage.has(pendingKey), false);
  assert.equal(storage.has(cacheKey), false);
  assert.equal(storage.has(queueKey), false);
  assert.equal(storage.has("wegig.firstGigId"), false);
  assert.equal(storage.has("wegig.favouriteGigId"), false);
  assert.equal(cache.getCachedGigs().length, 0);
  assert.equal(cache.getCachedGigsMeta().lastUpdatedAt, 0);

  assert.equal(work.isAccountWorkCurrent(oldToken), false);
  assert.equal(
    work.isAccountWorkCurrent(work.captureAccountWork()),
    true,
  );
});

test("network failure keeps deletion pending and account work paused", async () => {
  const { api, work, storage, events, state } = setup();

  await api.beginAccountDeletion();

  state.failRequest = true;

  await assert.rejects(() => api.deleteMyAccount());

  assert.equal(
    JSON.parse(storage.get(pendingKey)).serverDeleted,
    false,
  );
  assert.equal(events.includes("signOut"), false);
  assert.equal(
    work.isAccountWorkCurrent(work.captureAccountWork()),
    false,
  );
});

test("restart resumes cleanup without deleting the server account twice", async () => {
  const { api, reload, storage, events, state } = setup();

  await api.beginAccountDeletion();

  state.failCleanup = true;

  await assert.rejects(() => api.deleteMyAccount());

  assert.equal(
    JSON.parse(storage.get(pendingKey)).serverDeleted,
    true,
  );

  state.failCleanup = false;
  state.session = null;

  await reload().deleteMyAccount();

  assert.equal(accountRequests(events).length, 1);
  assert.equal(storage.has(pendingKey), false);
});

test("a different signed-in account cannot continue server deletion", async () => {
  const { api, events, state } = setup();

  await api.beginAccountDeletion();

  state.session = {
    user: { id: "another-user" },
  };

  await assert.rejects(() => api.deleteMyAccount());

  assert.equal(accountRequests(events).length, 0);
});

test("deletion waits for an active cache write and stale writes stay blocked afterwards", async () => {
  const { api, work, cache, storage, events, state } = setup();

  const oldToken = work.captureAccountWork();
  state.cacheStarted = deferred();
  state.cacheGate = deferred();

  const saving = cache.setCachedGigs(
    [{ id: "old-gig" }],
    oldToken,
  );

  await state.cacheStarted.promise;
  await api.beginAccountDeletion();

  const deleting = api.deleteMyAccount();

  try {
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(accountRequests(events).length, 0);
  } finally {
    state.cacheGate.resolve();
  }

  await saving;
  await deleting;

  assert.equal(storage.has(cacheKey), false);
  assert.equal(cache.getCachedGigs().length, 0);

  await cache.setCachedGigs(
    [{ id: "stale-gig" }],
    oldToken,
  );

  assert.equal(storage.has(cacheKey), false);
  assert.equal(cache.getCachedGigs().length, 0);

  const newToken = work.captureAccountWork();

  await cache.setCachedGigs(
    [{ id: "new-gig" }],
    newToken,
  );

  assert.equal(
    JSON.parse(storage.get(cacheKey))[0].id,
    "new-gig",
  );
});

test("deletion waits for an active reminder and cancels it before finishing", async () => {
  const {
    api,
    work,
    reminders,
    scheduled,
    storage,
    events,
    state,
  } = setup();

  const oldToken = work.captureAccountWork();

  state.scheduleStarted = deferred();
  state.scheduleGate = deferred();

  const gigs = [
    {
      id: "future-gig",
      artist: "Test artist",
      venue: "Test venue",
      city: "Test city",
      date: "2099-12-31",
    },
  ];

  const syncing = reminders.syncGigReminderNotifications(
    gigs,
    oldToken,
  );

  await state.scheduleStarted.promise;
  await api.beginAccountDeletion();

  const deleting = api.deleteMyAccount();

  try {
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(accountRequests(events).length, 0);
  } finally {
    state.scheduleGate.resolve();
  }

  await syncing;
  await deleting;

  assert.equal(scheduled.size, 0);
  assert.equal(storage.has("wegig.notificationIds"), false);

  const scheduledBefore = events.filter(
    (event) => event === "scheduled",
  ).length;

  await reminders.syncGigReminderNotifications(
    gigs,
    oldToken,
  );

  assert.equal(
    events.filter((event) => event === "scheduled").length,
    scheduledBefore,
  );
  assert.equal(scheduled.size, 0);
});

test("deletion stops an active queue flush before it sends the next gig", async () => {
  const { api, work, queue, storage, events, state } = setup();

  const oldToken = work.captureAccountWork();

  await queue.enqueueGig({ artist: "First" }, oldToken);
  await queue.enqueueGig({ artist: "Second" }, oldToken);

  state.sendStarted = deferred();
  state.sendGate = deferred();

  const flushing = queue.flushGigQueue(oldToken);

  await state.sendStarted.promise;
  await api.beginAccountDeletion();

  const deleting = api.deleteMyAccount();

  try {
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(accountRequests(events).length, 0);
  } finally {
    state.sendGate.resolve();
  }

  await flushing;
  await deleting;

  const gigRequests = events.filter(
    (event) =>
      Array.isArray(event) &&
      event[0] === "post" &&
      event[1] === "/gigs",
  );

  assert.equal(gigRequests.length, 1);
  assert.equal(storage.has(queueKey), false);

  await assert.rejects(() =>
    queue.enqueueGig({ artist: "Stale" }, oldToken),
  );

  assert.equal(storage.has(queueKey), false);

  await queue.enqueueGig(
    { artist: "New account work" },
    work.captureAccountWork(),
  );

  assert.equal(
    JSON.parse(storage.get(queueKey)).length,
    1,
  );
});

test("queued changes cannot be added while deletion is awaiting retry", async () => {
  const { api, work, queue, storage, state } = setup();

  await api.beginAccountDeletion();

  state.failRequest = true;

  await assert.rejects(() => api.deleteMyAccount());

  await assert.rejects(() =>
    queue.enqueueGig(
      { artist: "Blocked" },
      work.captureAccountWork(),
    ),
  );

  assert.equal(storage.has(queueKey), false);
});