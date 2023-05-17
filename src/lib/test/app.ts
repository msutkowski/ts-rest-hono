import { Hono } from "hono";
import {
  createHonoEndpoints,
  initServer,
  type RecursiveRouterObj,
} from "../ts-rest-hono";
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";

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
  getSyncReturn: {
    method: "GET",
    path: "/sync",
    summary: "Sometimes you don't need to wait",
    responses: {
      200: z.object({
        id: z.string(),
        env: z.any().optional(),
        auth_token: z.string().optional(),
        status: z.string(),
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
  getSyncReturn: (_, c) => {
    c.set("auth_token", "lul");
    return {
      status: 200,
      body: {
        id: "sync",
        env: c.env,
        auth_token: c.get("auth_token"),
        status: "ok",
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
};

const handlers = server.router(router, args);

createHonoEndpoints(router, handlers, app, {
  logInitialization: true,
  responseValidation(c) {
    return c.env.ENABLE_RESPONSE_VALIDATION;
  },
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ message: err.message }, 500);
});

export default app;
