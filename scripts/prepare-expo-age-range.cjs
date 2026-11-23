const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const packagePath = require.resolve("expo-age-range/package.json");
const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
if (version !== "58.0.3") {
  throw new Error("Recheck expo-age-range Android autolinking before changing its pinned version.");
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
