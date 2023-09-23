import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

/** {@link https://github.com/ts-rest/ts-rest/blob/16501dd6b98bdbfa61c4b371fa23d507088d3213/libs/ts-rest/express/src/lib/request-validation-error.ts | reference} */
export class RequestValidationError extends Error {
  constructor(
    public pathParams: z.ZodError | null,
    public headers: z.ZodError | null,
    public query: z.ZodError | null,
    public body: z.ZodError | null
  ) {
    super("[ts-rest] request validation failed");
  }
}
