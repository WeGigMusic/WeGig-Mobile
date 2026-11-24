const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const packagePath = require.resolve("expo-age-range/package.json");
const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
if (version !== "58.0.3") {
  throw new Error("Recheck the expo-age-range compatibility patches before changing its pinned version.");
}

const configPath = join(dirname(packagePath), "expo-module.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

// SDK 54 cannot read the newer publication metadata. Link the Android source.
if (config.android.publication) {
  delete config.android.publication;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

// SDK 54 supports ordinary Expo records, but not the newer optimization annotation.
const recordsPath = join(dirname(packagePath), "android/src/main/java/expo/modules/agerange/AgeRangeRecords.kt");
const records = readFileSync(recordsPath, "utf8");
const compatible = records.replace(/^import .*\.OptimizedRecord\s*$/gm, "").replace(/^\s*@OptimizedRecord\s*$/gm, "");
if (compatible.includes("OptimizedRecord")) {
  throw new Error("Unexpected expo-age-range record annotation; review compatibility patch.");
}
if (compatible !== records) writeFileSync(recordsPath, compatible);

// Keep the app's SDK 54 deployment target. The module guards every Age Range API
// by OS version, and weak-linking lets the app launch without that framework.
const podspecPath = join(dirname(packagePath), "ios/ExpoAgeRange.podspec");
const podspec = readFileSync(podspecPath, "utf8");
const originalTarget = "    :ios => '16.4'";
const compatibleTarget = "    :ios => '15.1'";
const weakFramework = "  s.weak_frameworks = 'DeclaredAgeRange'";
if (podspec.includes(originalTarget)) {
  const frameworkAnchor = "  s.dependency 'ExpoModulesCore'";
  if (!podspec.includes(frameworkAnchor)) throw new Error("Unexpected expo-age-range podspec.");
  writeFileSync(podspecPath, podspec
    .replace(originalTarget, compatibleTarget)
    .replace(frameworkAnchor, frameworkAnchor + "\n" + weakFramework));
} else if (!podspec.includes(compatibleTarget) || !podspec.includes(weakFramework)) {
  throw new Error("Unexpected expo-age-range iOS deployment target or framework linkage.");
}
