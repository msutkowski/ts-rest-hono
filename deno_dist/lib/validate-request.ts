import { checkZodSchema, parseJsonQueryObject } from "npm:@ts-rest/core@3.27.0";
import type { AppRoute } from "npm:@ts-rest/core@3.27.0";
import type { Context } from "https://deno.land/x/hono@v3.4.0/mod.ts";
import type { Options } from "./ts-rest-hono.ts";
import { RequestValidationError } from "./request-validation-error.ts";
import {
  isJsonContentType,
  maybeTransformQueryFromSchema,
  resolveOption,
} from "./utils.ts";

/**
 * @throws - {@link RequestValidationError}
 *
 * {@link https://github.com/ts-rest/ts-rest/blob/16501dd6b98bdbfa61c4b371fa23d507088d3213/libs/ts-rest/express/src/lib/ts-rest-express.ts#L71-L116 | reference}
 */
export const validateRequest = async (
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

  let content;
  let shouldValidateBody = false;

  const hasBodySchema = "body" in schema && Boolean(schema.body);

  if (hasBodySchema) {
    if (isJsonContentType(c.req.header("content-type"))) {
      shouldValidateBody = true;
      content = await c.req.json();
    } else {
      const text = await c.req.text();
      try {
        content = JSON.parse(text);
        shouldValidateBody = true;
      } catch (err) {
        throw new Error(
          "Error parsing the body contents. Please set the content-type header."
        );
      }
    }
  }

  const bodyResult = shouldValidateBody
    ? checkZodSchema(content, hasBodySchema && schema.body)
    : { success: true, error: null, data: null };

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
