import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app.js";

test("health endpoint responds", async () => {
  const app = await createApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  await app.close();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "hotel-os-api" });
});

test("new /api routes are registered and protected", async () => {
  const app = await createApp();
  const response = await app.inject({ method: "GET", url: "/api/rooms" });
  await app.close();

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
});

test("legacy routes remain temporarily available", async () => {
  const app = await createApp();
  const response = await app.inject({ method: "GET", url: "/rooms" });
  await app.close();

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, "AUTH_REQUIRED");
});

