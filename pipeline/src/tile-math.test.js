import assert from "node:assert/strict";
import test from "node:test";

import { lonLatToTile } from "./tile-math.js";

test("lonLatToTile computes the known z14 tile for Tokyo Station", () => {
  const { z, x, y } = lonLatToTile(139.7671, 35.6812, 14);
  assert.equal(z, 14);
  assert.equal(x, 14552);
  assert.equal(y, 6451);
});

test("lonLatToTile computes the top-left tile for the antimeridian/pole corner", () => {
  const { x, y } = lonLatToTile(-180, 85.05112877980659, 10);
  assert.equal(x, 0);
  assert.equal(y, 0);
});
