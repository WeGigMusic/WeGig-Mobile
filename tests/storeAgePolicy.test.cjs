const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const source = readFileSync(resolve(__dirname, "../src/lib/storeAgePolicy.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports });
const allows = moduleExports.allowsOptionalAnalytics;
test("outside mandatory sharing existing opt-in applies", () => assert.equal(allows({status:"not-required"}), true));
for (const status of ["unavailable", "verification-required", "not-shared"]) {
  test(status + " does not establish adult eligibility", () => assert.equal(allows({status}), false));
}
for (const [lowerBound, upperBound, expected] of [[18,null,true],[18,25,true],[13,17,false],[null,17,false],[null,null,false],[18,17,false],[NaN,null,false],[Infinity,null,false]]) {
  test("range " + lowerBound + " to " + upperBound, () => assert.equal(allows({status:"shared",ageRange:{lowerBound,upperBound}}), expected));
}

const accessMessage = moduleExports.ageAccessMessage;
test("known mandatory regions remain gated when a later eligibility check is unavailable", () => {
  const unknown = { status: "unavailable", required: false };
  assert.equal(accessMessage(unknown), null);
  assert.match(accessMessage(unknown, true), /try again/i);
});

test("minimum age and existing Play significant-change flags gate app access", () => {
  const signal = (upperBound, significantChangeStatus) => ({
    status: "shared",
    ageRange: { upperBound, significantChangeStatus },
  });
  assert.match(accessMessage(signal(12)), /13 or older/);
  assert.equal(accessMessage(signal(17, "APPROVED")), null);
  assert.match(accessMessage(signal(17, "PENDING")), /parent or guardian/);
  assert.match(accessMessage(signal(17, "DECLINED")), /parent or guardian/);
});
