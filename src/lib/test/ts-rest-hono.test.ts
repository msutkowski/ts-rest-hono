import { it, expect, beforeAll, describe, afterAll } from "vitest";

import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";

describe("Wrangler", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev(__dirname + "/app.ts", {
      vars: {
        ENABLE_RESPONSE_VALIDATION: "true",
      },
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it("should return things", async () => {
    const res = await worker.fetch("/things/12");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchInlineSnapshot(`
      {
        "env": {
          "ENABLE_RESPONSE_VALIDATION": "true",
        },
        "id": "12",
        "status": "ok",
      }
    `);
  });

  it("should let a handler early return from a c.json() call", async () => {
    const res = await worker.fetch("/early");
    const json = await res.json();

    expect(json).toMatchInlineSnapshot(`
      {
        "auth_token": "lul",
        "env": {
          "ENABLE_RESPONSE_VALIDATION": "true",
        },
        "id": "early",
        "status": "ok",
      }
    `);
  });
});
