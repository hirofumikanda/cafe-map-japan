import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createServer } from "./serve.js";

async function withTestServer(t, files) {
  const dir = await mkdtemp(path.join(tmpdir(), "serve-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }

  const server = createServer(dir);
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  return `http://localhost:${port}`;
}

test("serve responds with a full file and Accept-Ranges when no Range header is sent", async (t) => {
  const content = "0123456789";
  const base = await withTestServer(t, { "cafe.pmtiles": content });

  const res = await fetch(`${base}/cafe.pmtiles`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("accept-ranges"), "bytes");
  assert.equal(await res.text(), content);
});

test("serve responds with 206 Partial Content and the requested byte range", async (t) => {
  const content = "0123456789";
  const base = await withTestServer(t, { "cafe.pmtiles": content });

  const res = await fetch(`${base}/cafe.pmtiles`, { headers: { Range: "bytes=2-4" } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), "bytes 2-4/10");
  assert.equal(res.headers.get("content-length"), "3");
  assert.equal(await res.text(), "234");
});

test("serve responds with 206 for a suffix range (last N bytes)", async (t) => {
  const content = "0123456789";
  const base = await withTestServer(t, { "cafe.pmtiles": content });

  const res = await fetch(`${base}/cafe.pmtiles`, { headers: { Range: "bytes=-3" } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), "bytes 7-9/10");
  assert.equal(await res.text(), "789");
});

test("serve responds with 416 for an out-of-range Range request", async (t) => {
  const base = await withTestServer(t, { "cafe.pmtiles": "0123456789" });

  const res = await fetch(`${base}/cafe.pmtiles`, { headers: { Range: "bytes=100-200" } });
  assert.equal(res.status, 416);
  assert.equal(res.headers.get("content-range"), "bytes */10");
});

test("serve returns 404 for a missing file and 400 for path traversal", async (t) => {
  const base = await withTestServer(t, { "cafe.pmtiles": "0123456789" });

  const missing = await fetch(`${base}/does-not-exist.pmtiles`);
  assert.equal(missing.status, 404);

  const traversal = await fetch(`${base}/..%2f..%2fserve.js`);
  assert.equal(traversal.status, 400);
});
