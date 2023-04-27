import { it, expect, describe, afterAll } from "vitest";
import { UnstableDevOptions } from "wrangler";

import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";

let worker: UnstableDevWorker;

const setupWorker = async (options: UnstableDevOptions = {}) => {
  worker = await unstable_dev(__dirname + "/app.ts", {
    ...options,
    vars: {
      ENABLE_RESPONSE_VALIDATION: "true",
      ...options.vars,
    },
    logLevel: "log",
    experimental: {
      disableExperimentalWarning: true,
      ...options.experimental,
    },
  });
};

describe("Wrangler", () => {
  afterAll(async () => {
    await worker.stop();
  });

  it("should return things", async () => {
    await setupWorker({
      vars: {
        USE_QUERIES_FOR_ARRAY_BRACKET_QUERY_PARAMS: "true",
      },
    });

    const res = await worker.fetch(
      "/things/12?array[]=1&array[]=2&snake_case=a&camelCase=b&kebab-case=c"
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchInlineSnapshot(`
      {
        "env": {
          "ENABLE_RESPONSE_VALIDATION": "true",
          "USE_QUERIES_FOR_ARRAY_BRACKET_QUERY_PARAMS": "true",
        },
        "id": "12",
        "pathParams": {
          "id": "12",
        },
        "queryParams": {
          "array[]": [
            "1",
            "2",
          ],
          "camelCase": "b",
          "kebab-case": "c",
          "snake_case": "a",
        },
        "rawQueries": {
          "array[]": [
            "1",
            "2",
          ],
          "camelCase": [
            "b",
          ],
          "kebab-case": [
            "c",
          ],
          "snake_case": [
            "a",
          ],
        },
        "rawQuery": {
          "array[]": "1",
          "camelCase": "b",
          "kebab-case": "c",
          "snake_case": "a",
        },
        "status": "ok",
      }
    `);
  });

  it("should let a handler early return from a c.json() call", async () => {
    await setupWorker();

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
