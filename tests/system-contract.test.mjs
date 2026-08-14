import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const system = await readFile(new URL("../SYSTEM.md", import.meta.url), "utf8");

test("repository setup remains platform-owned", () => {
  assert.match(system, /If that choice is materially ambiguous, ask which repository to use/);
  assert.doesNotMatch(system, /managed workspace/);
  assert.doesNotMatch(system, /marked `ready`/);
  assert.doesNotMatch(system, /marked `available`/);
  assert.doesNotMatch(system, /marked `unavailable`/);
  assert.doesNotMatch(system, /gh repo clone/);
  assert.doesNotMatch(system, /\/workspace\/repos/);
  assert.doesNotMatch(system, /granted to this runtime/);
});

test("inspection-only requests do not require a pull request", () => {
  assert.match(system, /answer inspection-only requests directly/);
  assert.match(system, /do not create a branch, commit, or pull request/);
});
