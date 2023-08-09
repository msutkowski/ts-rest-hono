import {
  checkZodSchema,
  parseJsonQueryObject,
  type AppRoute,
} from "@ts-rest/core";
import type { Context } from "hono";
import {
  type Options,
  resolveOption,
  maybeTransformQueryFromSchema,
} from "./ts-rest-hono";
import { RequestValidationError } from "./request-validation-error";

/**
 * @throws - {@link RequestValidationError}
 *
 * {@link https://github.com/ts-rest/ts-rest/blob/16501dd6b98bdbfa61c4b371fa23d507088d3213/libs/ts-rest/express/src/lib/ts-rest-express.ts#L71-L116 | reference}
 */
export const validateRequest = (
  c: Context,
  schema: AppRoute,
  options: Options
) => {
  const isJsonQueryEnabled = resolveOption(options.jsonQuery, c);
  const query = isJsonQueryEnabled
    ? parseJsonQueryObject(c.req.query())
    : c.req.query();

  const finalQuery = maybeTransformQueryFromSchema(schema, query, c);
  const queryResult = checkZodSchema(finalQuery, schema.query);

  const paramsResult = checkZodSchema(c.req.param(), schema.pathParams, {
    passThroughExtraKeys: true,
  });

  // throw new Error(`Headers are ${JSON.stringify(c.req.header(), null, 2)}`);
  const headersResult = checkZodSchema(c.req.header(), schema.headers, {
    passThroughExtraKeys: true,
  });

  const bodyResult = checkZodSchema(
    c.req.body,
    "body" in schema ? schema.body : null
  );

  if (
    !paramsResult.success ||
    !headersResult.success ||
    !queryResult.success ||
    !bodyResult.success
  ) {
    return new RequestValidationError(
      !paramsResult.success ? paramsResult.error : null,
      !headersResult.success ? headersResult.error : null,
      !queryResult.success ? queryResult.error : null,
      !bodyResult.success ? bodyResult.error : null
    );
  }

  return {
    params: paramsResult.data,
    headers: headersResult.data,
    query: queryResult.data,
    body: bodyResult.data,
  };
};

export const combinedRequestValidationErrorHandler = ({
  pathParams: pathParamsErrors,
  headers: headersErrors,
  query: queryErrors,
  body: bodyErrors,
}: RequestValidationError) => ({
  error: { pathParamsErrors, headersErrors, queryErrors, bodyErrors },
  status: 400,
});
