import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function setup() {
  const values = new Map<string, string>();
  const files = new Set<string>();
  const fs = {
    documentDirectory: "file:///old/Documents/",
    cacheDirectory: "file:///old/Library/Caches/",
    async makeDirectoryAsync() {},
    async getInfoAsync(uri: string) { return { exists: files.has(uri) }; },
    async copyAsync({ from, to }: { from: string; to: string }) {
      if (!files.has(from)) throw new Error("Missing source");
      files.add(to);
    },
    async deleteAsync(uri: string) { files.delete(uri); },
  };
  const storage = {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
  };
  const module = { exports: {} as Record<string, any> };
  const code = ts.transpileModule(readFileSync("src/lib/localProfile.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports: module.exports, module,
    require(name: string) {
      if (name.includes("async-storage")) return storage;
      if (name.includes("file-system")) return fs;
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return { api: module.exports, values, files, fs, storage };
}

test("profile names and avatar selections are isolated between accounts and survive reloads", async () => {
  const { api } = setup();
  await api.saveLocalProfile("apple", { displayName: "Nowar", avatarPreset: "guitar", avatarFile: "" });
  assert.equal((await api.loadLocalProfile("apple")).displayName, "Nowar");
  assert.equal((await api.loadLocalProfile("apple")).avatarPreset, "guitar");
  assert.equal((await api.loadLocalProfile("google")).displayName, "Music Fan");
  assert.equal((await api.loadLocalProfile("google")).avatarPreset, "");
});

test("a removed avatar stays blank when the profile is loaded again", async () => {
  const { api } = setup();
  await api.saveLocalProfile("a", { displayName: "Name", avatarPreset: "", avatarFile: "" });
  const profile = await api.loadLocalProfile("a");
  assert.equal(profile.avatarPreset, "");
  assert.equal(profile.avatarFile, "");
});

test("photos are copied out of cache and their paths follow the current app container", async () => {
  const { api, files, fs } = setup();
  files.add("file:///cache/photo.png");
  const name = await api.copyProfilePhoto("a", "file:///cache/photo.png");
  const oldUri = api.profilePhotoUri("a", name);
  assert.match(oldUri, /Documents\/profiles\/a\//);
  files.delete("file:///cache/photo.png");
  assert.equal(await api.existingProfilePhoto("a", name), oldUri);
  fs.documentDirectory = "file:///new/Documents/";
  const movedUri = api.profilePhotoUri("a", name);
  files.add(movedUri);
  files.delete(oldUri);
  assert.equal(await api.existingProfilePhoto("a", name), movedUri);
});

test("missing photos return a placeholder without resetting the saved name", async () => {
  const { api } = setup();
  await api.saveLocalProfile("a", { displayName: "Keep me", avatarPreset: "", avatarFile: "missing.jpg" });
  assert.equal(await api.existingProfilePhoto("a", "missing.jpg"), "");
  assert.equal((await api.loadLocalProfile("a")).displayName, "Keep me");
});

test("legacy details are not read into new profiles until explicitly imported", async () => {
  const { api, values } = setup();
  values.set("wegig.displayName", "Legacy name");
  assert.equal(await api.hasLegacyProfile("a"), true);
  assert.equal((await api.loadLocalProfile("a")).displayName, "Music Fan");
  await api.importLegacyProfile("a");
  assert.equal((await api.loadLocalProfile("a")).displayName, "Legacy name");
  assert.equal(await api.hasLegacyProfile("b"), false);
  await assert.rejects(api.importLegacyProfile("b"), /another account/);
});

test("legacy photos with old sandbox paths can be recovered from the current cache", async () => {
  const { api, files, values } = setup();
  values.set("wegig.avatarUri", "file:///previous/Library/Caches/ImagePicker/photo.jpg");
  files.add("file:///old/Library/Caches/ImagePicker/photo.jpg");
  const { profile, photoMissing } = await api.importLegacyProfile("a");
  assert.equal(photoMissing, false);
  assert.ok(await api.existingProfilePhoto("a", profile.avatarFile));
});

test("a missing legacy photo does not prevent name recovery", async () => {
  const { api, values } = setup();
  values.set("wegig.displayName", "Saved name");
  values.set("wegig.avatarUri", "file:///gone/photo.jpg");
  const { profile, photoMissing } = await api.importLegacyProfile("a");
  assert.equal(photoMissing, true);
  assert.equal(profile.displayName, "Saved name");
  assert.equal(profile.avatarFile, "");
});

test("storage failures reject rather than reporting a successful save", async () => {
  const { api, storage } = setup();
  storage.setItem = async () => { throw new Error("Storage full"); };
  await assert.rejects(api.saveLocalProfile("a", { displayName: "Name" }), /Storage full/);
});

test("filenames cannot escape the per-account photo directory", () => {
  const { api } = setup();
  assert.equal(api.profilePhotoUri("a", "../../other.jpg"), "");
  assert.equal(api.profilePhotoUri("a", "file:///other.jpg"), "");
});

test("a failed legacy save can be retried only by the same account", async () => {
  const { api, storage, values } = setup();
  values.set("wegig.displayName", "Recovered");
  const original = storage.setItem;
  storage.setItem = async (key, value) => {
    if (key.startsWith("wegig.profile.v1")) throw new Error("Storage full");
    return original(key, value);
  };
  await assert.rejects(api.importLegacyProfile("a"), /Storage full/);
  assert.equal(await api.hasLegacyProfile("a"), true);
  assert.equal(await api.hasLegacyProfile("b"), false);
});
