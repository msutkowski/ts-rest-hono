import { Hono } from "hono";
import {
  createHonoEndpoints,
  initServer,
  type RecursiveRouterObj,
} from "../ts-rest-hono";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

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
  getThing: async ({ params: { id } }, c) => {
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
      },
    };
  },
  getEarlyReturn: (_, c) => {
    c.set("auth_token", "lul");
    const thing = c.jsonT({
      id: "early",
      banana: "ExtraKeysAreFine",
      thing: 1,
      env: c.env,
      auth_token: c.get("auth_token"),
      status: "ok", // Error because ok is missing
    });

    return thing;
  },
};

const handlers = server.router(router, args);

createHonoEndpoints(router, handlers, app, {
  logInitialization: true,
  responseValidation(c) {
    return c.env.ENABLE_RESPONSE_VALIDATION;
  },
});

export default app;
