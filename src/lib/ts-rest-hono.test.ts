import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "./ts-rest-hono";
import { initContract } from "@ts-rest/core";
import { z } from "zod";

export type Bindings = {
  ENABLE_RESPONSE_VALIDATION: boolean;
};
const app = new Hono<{ Bindings: Bindings }>();

// Type tests

const c = initContract();

const server = initServer<Bindings>();

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
  getThing: async ({ params: { id } }, env) => {
    console.log(env.ENABLE_RESPONSE_VALIDATION);
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
