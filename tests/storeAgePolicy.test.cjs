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
for (const status of ["not-required", "unavailable", "verification-required", "not-shared"]) {
  test(status + " does not establish adult eligibility", () => assert.equal(allows({status}), false));
}
for (const [lowerBound, upperBound, expected] of [[18,null,true],[18,25,true],[13,17,false],[null,17,false],[null,null,false],[18,17,false],[NaN,null,false],[Infinity,null,false]]) {
  test("range " + lowerBound + " to " + upperBound, () => assert.equal(allows({status:"shared",ageRange:{lowerBound,upperBound}}), expected));
}
