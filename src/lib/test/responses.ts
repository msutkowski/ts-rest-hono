import { initContract } from "@ts-rest/core";
import { initServer } from "../ts-rest-hono";
import { z } from "zod";

// response type tests

const c = initContract();
const contract = c.router(
  {
    get: {
      method: "GET",
      path: "/",
      responses: { 200: z.number(), 401: z.string() },
    },
    get2: {
      method: "GET",
      path: "/asfd",
      responses: { 200: z.number(), 401: z.string() },
    },
  },
  { strictStatusCodes: true }
);

const s = initServer();
const invalidStatus = s.router(contract, {
  // @ts-expect-error: invalid status code
  get: () => Promise.resolve({ status: 201, body: 123 } as const),
});

const invalidBody = s.router(contract, {
  // @ts-expect-error: invalid body
  get: () => Promise.resolve({ status: 200, body: "hello" } as const),
});
