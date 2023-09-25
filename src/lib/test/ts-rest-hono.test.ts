import { it, expect, describe, afterAll } from "vitest";
import type { UnstableDevOptions } from "wrangler";

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
    await setupWorker();

    const res = await worker.fetch(
      encodeURI(
        "/things/12?array=1&array=2&snake_case=a&camelCase=b&kebab-case=c&not_array=1&array_brackets[]=1&array_brackets[]=2"
      )
    );
    expect.soft(res.status).toBe(200);
    expect(await res.json()).toMatchInlineSnapshot(`
      {
        "env": {
          "ENABLE_RESPONSE_VALIDATION": "true",
        },
        "id": "12",
        "operationId": "getThing",
        "pathParams": {
          "id": "12",
        },
        "rawQueries": {
          "array": [
            "1",
            "2",
          ],
          "array_brackets[]": [
            "1",
            "2",
          ],
          "camelCase": [
            "b",
          ],
          "kebab-case": [
            "c",
          ],
          "not_array": [
            "1",
          ],
          "snake_case": [
            "a",
          ],
        },
        "rawQuery": {
          "array": "1",
          "array_brackets[]": "1",
          "camelCase": "b",
          "kebab-case": "c",
          "not_array": "1",
          "snake_case": "a",
        },
        "status": "ok",
        "validatedQueryParams": {
          "array": [
            "1",
            "2",
          ],
          "array_brackets[]": [
            "1",
            "2",
          ],
          "not_array": "1",
        },
      }
    `);
  });

  it("should let a handler synchronously return", async () => {
    await setupWorker();

    const res = await worker.fetch("/sync");
    const json = await res.json();

    expect(json).toMatchInlineSnapshot(`
      {
        "auth_token": "lul",
        "env": {
          "ENABLE_RESPONSE_VALIDATION": "true",
        },
        "id": "sync",
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

  it("should support zodErrorTransformer", async () => {
    await setupWorker();

    const res = await worker.fetch("/things", {
      method: "POST",
      body: JSON.stringify({ bad: "key" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchInlineSnapshot(`
      {
        "errors": {
          "body": [
            {
              "detail": "invalid_type",
              "source": {
                "pointer": "/data",
              },
              "title": "Required",
            },
          ],
          "headers": null,
          "pathParams": null,
          "query": null,
        },
      }
    `);
  });

  describe("validate headers schema in contract", async () => {
    it("should work for correct headers", async () => {
      await setupWorker();

      const res = await worker.fetch("/headers", {
        headers: { "x-thing": "thing" },
      });
      expect.soft(res.status).toBe(200);
      expect(await res.text()).toBe('"ok"');
    });
    it("should fail if headers aren't given", async () => {
      await setupWorker();

      const res = await worker.fetch("/headers");
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "errors": {
            "body": null,
            "headers": [
              {
                "detail": "invalid_type",
                "source": {
                  "pointer": "/x-thing",
                },
                "title": "Required",
              },
            ],
            "pathParams": null,
            "query": null,
          },
        }
      `);
    });
  });

  describe("responseValidation", () => {
    it("should return validation errors when enabled and the response type is invalid", async () => {
      await setupWorker();

      const res = await worker.fetch("/invalid-response");
      const json = await res.json();

      expect(json).toMatchInlineSnapshot(`
        {
          "errors": [
            {
              "detail": "invalid_type",
              "source": {
                "pointer": "/ok",
              },
              "title": "Expected boolean, received string",
            },
          ],
        }
      `);
    });
  });
});
