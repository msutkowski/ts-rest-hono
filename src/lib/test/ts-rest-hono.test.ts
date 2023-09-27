import { it, expect, describe } from "vitest";

import app from "./app";

// Note: app.request doesn't support injected the execution context, so we're not testing that behavior. we can trust that it "Just works"
// or we can rewrite using app.fetch and hooking up the miniflare bindings.

describe("tests", () => {
  it("should return things", async () => {
    const res = await app.request(
      "/things/12?array=1&array=2&snake_case=a&camelCase=b&kebab-case=c&not_array=1&array_brackets[]=1&array_brackets[]=2"
    );
    expect.soft(res.status).toBe(200);
    expect(await res.json()).toMatchInlineSnapshot(`
      {
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
    const res = await app.request("/sync");
    const json = await res.json();

    expect(json).toMatchInlineSnapshot(`
      {
        "auth_token": "lul",
        "id": "sync",
        "status": "ok",
      }
    `);
  });

  it("should let a handler early return from a c.json() call", async () => {
    const res = await app.request("/early");
    const json = await res.json();

    expect(json).toMatchInlineSnapshot(`
      {
        "auth_token": "lul",
        "id": "early",
        "status": "ok",
      }
    `);
  });

  it("should support zodErrorTransformer", async () => {
    const res = await app.request("/things", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
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
      const res = await app.request("/headers", {
        headers: { "x-thing": "thing" },
      });

      expect.soft(res.status).toBe(200);
      expect(await res.text()).toBe('"ok"');
    });
    it("should fail if headers aren't given", async () => {
      const res = await app.request("/headers");
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

  describe("requests", () => {
    it("should return validation errors when the request payload is wrong and missing a parent key", async () => {
      const res = await app.request("/things", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ bad: "should've been data key" }),
      });

      const json = await res.json();

      expect(json).toMatchInlineSnapshot(`
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
    it("should return validation errors when the request payload is wrong", async () => {
      const res = await app.request("/things", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ data: [{ invalid_key: "banana" }] }),
      });
      const json = await res.json();

      expect(json).toMatchInlineSnapshot(`
        {
          "errors": {
            "body": [
              {
                "detail": "invalid_type",
                "source": {
                  "pointer": "/data/0/name",
                },
                "title": "Required",
              },
              {
                "detail": "invalid_type",
                "source": {
                  "pointer": "/data/0/other",
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
    it("should allow a delete request to go through", async () => {
      const res = await app.request("/things/1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });
  });

  describe("responseValidation", () => {
    it("should return validation errors when enabled and the response type is invalid", async () => {
      const res = await app.request("/invalid-response");
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
