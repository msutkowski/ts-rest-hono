import { Hono } from "hono";
import {
  createHonoEndpoints,
  initServer,
  type RecursiveRouterObj,
} from "../ts-rest-hono";
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { formatZodErrors } from "./format-errors";

export type Bindings = {
  ENABLE_RESPONSE_VALIDATION: boolean;
};
export type Variables = {
  auth_token?: string;
};

type HonoEnv = { Bindings: Bindings; Variables: Variables };
const app = new Hono<HonoEnv>();

// Type tests

const c = initContract();

const server = initServer<HonoEnv>();

export const router = c.router({
  getThing: {
    method: "GET",
    path: "/things/:id",
    summary: "Get inventory facility balances",
    query: z.object({
      "array_brackets[]": z.array(z.string()).optional(),
      not_array: z.string().optional(),
      array: z.array(z.string()).optional(),
    }),
    responses: {
      200: z.object({
        id: z.string(),
        env: z.any().optional(),
        auth_token: z.string().optional(),
        status: z.string(),
        validatedQueryParams: z.any().optional(),
        rawQuery: z.any().optional(),
        rawQueries: z.any().optional(),
        pathParams: z.any().optional(),
      }),
    },
  },
  getEarlyReturn: {
    method: "GET",
    path: "/early",
    summary: "Sometimes you gotta return early",
    responses: {
      200: z.object({
        id: z.string(),
        env: z.any().optional(),
        auth_token: z.string().optional(),
        status: z.string(),
      }),
    },
  },
  createThing: {
    method: "POST",
    path: "/things",
    summary: "Create a thing",
    body: z.object({
      data: z.array(
        z.object({
          name: z.string(),
          other: z.number(),
        })
      ),
    }),
    responses: {
      200: z.object({
        ok: z.boolean(),
      }),
      400: z.object({
        message: z.string(),
        banana: z.string(),
      }),
    },
  },
});

export const createRouter = c.router({
  createThing: {
    method: "POST",
    path: "/things",
    summary: "Create a thing",
    body: z.object({
      data: z.array(
        z.object({
          name: z.string(),
          other: z.number(),
        })
      ),
    }),
    responses: {
      200: z.object({
        ok: z.boolean(),
      }),
      400: z.object({
        message: z.string(),
        banana: z.string(),
      }),
    },
  },
});

const args: RecursiveRouterObj<typeof router, HonoEnv> = {
  getThing: async ({ params: { id }, query }, c) => {
    const auth_token = c.get("auth_token");
    console.log(c.env.ENABLE_RESPONSE_VALIDATION);

    c.set("auth_token", "lul");
    // @ts-expect-error
    c.set("missing", 1);
    return {
      status: 200,
      body: {
        id,
        env: c.env,
        auth_token,
        status: "ok",
        validatedQueryParams: query,
        rawQuery: c.req.query(),
        rawQueries: c.req.queries(),
        pathParams: c.req.param(),
      },
    };
  },
  getEarlyReturn: (_, c) => {
    c.set("auth_token", "lul");
    return c.json({
      id: "early",
      env: c.env,
      auth_token: c.get("auth_token"),
      status: "ok",
    });
  },
  createThing: async (_, c) => {
    return { status: 200, body: { ok: true } };
  },
};

const handlers = server.router(router, args);

createHonoEndpoints(router, handlers, app, {
  logInitialization: true,
  responseValidation(c) {
    return c.env.ENABLE_RESPONSE_VALIDATION;
  },
  zodErrorHandler(error) {
    return { error: formatZodErrors(error), status: 400 };
  },
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ message: err.message }, 500);
});

export default app;
