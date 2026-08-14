import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const system = await readFile(new URL("../SYSTEM.md", import.meta.url), "utf8");

test("repository bootstrap follows the host-managed workspace contract", () => {
  assert.match(system, /host-provided managed workspace inventory/);
  assert.match(system, /gh repo clone OWNER\/REPO/);
  assert.match(system, /managed path it reports/);
  assert.doesNotMatch(system, /\/workspace\/repos/);
  assert.doesNotMatch(system, /gh repo view <owner\/name>/);
});

test("inspection-only requests do not require a pull request", () => {
  assert.match(system, /answer inspection-only requests directly/);
  assert.match(system, /do not create a branch, commit, or pull request/);
});
