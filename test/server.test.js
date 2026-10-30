import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 4318;
const base = `http://127.0.0.1:${port}`;
let child;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(base + "/api/v1/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("World Pack test server did not start");
}

test("read-only API prototype", async t => {
  child = spawn(process.execPath, ["src/server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, WORLD_PACK_PORT: String(port), WORLD_PACK_UI_ORIGIN: "http://127.0.0.1:5173" },
    stdio: "ignore"
  });
  t.after(() => child?.kill("SIGTERM"));
  await waitForServer();

  await t.test("health endpoint reports read-only prototype", async () => {
    const response = await fetch(base + "/api/v1/health");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.mode, "read-only-prototype");
  });

  await t.test("platform endpoint reports installation disabled", async () => {
    const response = await fetch(base + "/api/v1/platform");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.adapters.installationEnabled, false);
    assert.equal(body.adapters.serviceChangesEnabled, false);
    assert.ok(body.platform);
  });

  await t.test("services endpoint is explicitly read-only", async () => {
    const response = await fetch(base + "/api/v1/services");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.readOnly, true);
    assert.ok(Array.isArray(body.services));
  });

  await t.test("package catalog contains only supported metadata", async () => {
    const response = await fetch(base + "/api/v1/packages");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.readOnly, true);
    assert.equal(body.installationEnabled, false);
    assert.ok(Array.isArray(body.packages));
    for (const item of body.packages) {
      assert.ok(item.id);
      assert.ok(item.packageId);
      assert.ok(["apt", "winget"].includes(item.manager));
    }
  });

  await t.test("install plan is preview-only and validates package IDs", async () => {
    const catalogResponse = await fetch(base + "/api/v1/packages");
    const catalog = await catalogResponse.json();
    if (catalog.packages.length) {
      const id = catalog.packages[0].id;
      const response = await fetch(base + "/api/v1/install-plan?ids=" + encodeURIComponent(id));
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.readOnly, true);
      assert.equal(body.executable, false);
      assert.equal(body.installationEnabled, false);
      assert.equal(body.packages.length, 1);
      assert.ok(body.commandPreview);
    }
    const invalid = await fetch(base + "/api/v1/install-plan?ids=not-a-real-package");
    assert.equal(invalid.status, 400);
  });

  await t.test("unknown routes return 404", async () => {
    const response = await fetch(base + "/api/v1/not-a-route");
    assert.equal(response.status, 404);
  });

  await t.test("write methods are rejected", async () => {
    const response = await fetch(base + "/api/v1/services", { method: "POST" });
    assert.equal(response.status, 405);
  });
});
