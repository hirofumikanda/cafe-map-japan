import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createPrefectureCache } from "./prefecture-cache.js";

async function withTempCacheDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "prefecture-cache-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("read returns null when no cache entry exists", async (t) => {
  const dir = await withTempCacheDir(t);
  const cache = createPrefectureCache(dir);
  assert.equal(await cache.read("JP-13"), null);
});

test("write then read round-trips the cached elements", async (t) => {
  const dir = await withTempCacheDir(t);
  const cache = createPrefectureCache(dir);
  const elements = [{ type: "node", id: 1, lat: 1, lon: 2, tags: { amenity: "cafe" } }];

  await cache.write("JP-13", elements);

  assert.deepEqual(await cache.read("JP-13"), elements);
});

test("read treats a corrupt cache file as a cache miss", async (t) => {
  const dir = await withTempCacheDir(t);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "JP-13.json"), "{not valid json");
  const cache = createPrefectureCache(dir);

  assert.equal(await cache.read("JP-13"), null);
});

test("write does not leave a stale temp file behind", async (t) => {
  const dir = await withTempCacheDir(t);
  const cache = createPrefectureCache(dir);

  await cache.write("JP-13", []);

  assert.deepEqual(await readdir(dir), ["JP-13.json"]);
});

test("different prefecture codes are cached independently", async (t) => {
  const dir = await withTempCacheDir(t);
  const cache = createPrefectureCache(dir);

  await cache.write("JP-01", [{ id: "hokkaido" }]);
  await cache.write("JP-13", [{ id: "tokyo" }]);

  assert.deepEqual(await cache.read("JP-01"), [{ id: "hokkaido" }]);
  assert.deepEqual(await cache.read("JP-13"), [{ id: "tokyo" }]);
});
