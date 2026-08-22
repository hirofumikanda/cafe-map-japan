import { test } from "node:test";
import assert from "node:assert/strict";

import { buildQuery, queryOverpass, OverpassFetchError } from "./overpass-client.js";

const TOTTORI = { code: "JP-31", name: "鳥取県" };

test("buildQuery scopes the query to the given prefecture and amenity=cafe", () => {
  const query = buildQuery("JP-13");
  assert.match(query, /ISO3166-2"="JP-13"/);
  assert.match(query, /amenity"="cafe"/);
});

test("queryOverpass retries on failure and returns elements once it succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) {
      return { ok: false, status: 504 };
    }
    return {
      ok: true,
      json: async () => ({ elements: [{ type: "node", id: 1, lat: 1, lon: 2, tags: {} }] }),
    };
  };

  const elements = await queryOverpass(TOTTORI, {
    fetchImpl,
    maxAttempts: 3,
    initialRetryDelayMs: 1,
  });

  assert.equal(calls, 3);
  assert.equal(elements.length, 1);
});

test("queryOverpass throws OverpassFetchError after exhausting retries", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500 });

  await assert.rejects(
    () =>
      queryOverpass(TOTTORI, {
        fetchImpl,
        maxAttempts: 2,
        initialRetryDelayMs: 1,
      }),
    OverpassFetchError,
  );
});

test("queryOverpass surfaces a malformed response as a failure", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });

  await assert.rejects(
    () =>
      queryOverpass(TOTTORI, {
        fetchImpl,
        maxAttempts: 1,
        initialRetryDelayMs: 1,
      }),
    OverpassFetchError,
  );
});
