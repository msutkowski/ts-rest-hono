import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "./ts-rest-hono";
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
      200: {
        id: "1234",
        status: "ok",
      },
    },
  },
});

const handlers = server.router(router, {
  getThing: async ({ params: { id } }, c) => {
    c.get("auth_token");
    console.log(c.env.ENABLE_RESPONSE_VALIDATION);
    c.set("auth_token", "lul");
    // @ts-expect-error
    c.set("missing", 1);
    return {
      status: 200,
      body: {
        id,
        status: "ok",
      },
    };
  },
});

createHonoEndpoints(router, handlers, app, {
  logInitialization: true,
  responseValidation(c) {
    return c.env.ENABLE_RESPONSE_VALIDATION;
  },
});
