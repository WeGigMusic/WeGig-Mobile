const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const source = readFileSync(resolve(__dirname, "../src/lib/storeAgeSignals.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadReader(platform, { eligibility, access, requestRange } = {}) {
  const calls = [];
  const module = { exports: {} };
  const modules = {
    expo: {
      requireOptionalNativeModule: () => ({
        isMandatorySharingAsync: async () => {
          calls.push("eligibility");
          return eligibility;
        },
      }),
    },
    "expo-age-range": {
      isEligibleForAgeFeaturesAsync: async () => {
        calls.push("eligibility");
        return eligibility;
      },
      requestAgeSignalsAccessAsync: async () => {
        calls.push("access");
        return access;
      },
      requestAgeRangeAsync: async () => {
        calls.push("range");
        return requestRange();
      },
    },
    "react-native": { Platform: { OS: platform } },
  };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    require: name => modules[name],
  });
  return { calls, read: module.exports.readStoreAgeSignal };
}

for (const platform of ["ios", "android"]) {
  test(`${platform} skips store sharing when no age check is required`, async () => {
    const { calls, read } = loadReader(platform, { eligibility: false });
    assert.equal((await read()).status, "not-required");
    assert.deepEqual(calls, ["eligibility"]);
  });
}

test("iOS distinguishes a declined request from an unavailable signal", async () => {
  const refused = loadReader("ios", {
    eligibility: true,
    requestRange: () => { throw { code: "ERR_AGE_RANGE_USER_DECLINED" }; },
  });
  assert.equal((await refused.read()).status, "not-shared");
  const unavailable = loadReader("ios", { eligibility: null });
  const result = await unavailable.read();
  assert.equal(result.status, "unavailable");
  assert.equal(result.required, false);
  assert.deepEqual(unavailable.calls, ["eligibility"]);
});

test("Google Play verification required does not request an age range", async () => {
  const { calls, read } = loadReader("android", {
    eligibility: true,
    access: "VERIFICATION_REQUIRED",
  });
  assert.equal((await read()).status, "verification-required");
  assert.deepEqual(calls, ["eligibility", "access"]);
});

test("required sharing with no returned age range stays unavailable", async () => {
  const { calls, read } = loadReader("android", {
    eligibility: true,
    access: "SHARED",
    requestRange: () => ({ lowerBound: null, upperBound: null }),
  });
  const result = await read();
  assert.equal(result.status, "unavailable");
  assert.equal(result.required, true);
  assert.deepEqual(calls, ["eligibility", "access", "range"]);
});
