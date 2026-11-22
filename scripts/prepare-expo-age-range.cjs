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
