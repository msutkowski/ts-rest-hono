import {
  isZodObject,
  type AppRouteMutation,
  type AppRouteQuery,
  extractZodObjectShape,
  GetFieldType,
} from "@ts-rest/core";
import type { Context } from "hono";
import { ResolvableOption } from "./ts-rest-hono";
import { z } from "zod";

export function getValue<
  TData,
  TPath extends string,
  TDefault = GetFieldType<TData, TPath>
>(
  data: TData,
  path: TPath,
  defaultValue?: TDefault
): GetFieldType<TData, TPath> | TDefault {
  const value = path
    .split(/[.[\]]/)
    .filter(Boolean)
    .reduce<GetFieldType<TData, TPath>>(
      (value, key) => (value as any)?.[key],
      data as any
    );

  return value !== undefined ? value : (defaultValue as TDefault);
}

export function resolveOption(
  option: ResolvableOption,
  c: Context<any> = {} as any
) {
  return typeof option === "function" ? option(c) : option;
}

/**
 * This function leverages a Zod schema to determine if we should call the
 * c.queries method for a given key so that we can support arrays.
 *
 * @param schema the ts-rest schema
 * @param query a record of query parameters as parsed by hono c.query
 * @param c hono context
 * @returns object
 */
export function maybeTransformQueryFromSchema(
  schema: AppRouteQuery | AppRouteMutation,
  query: Record<string, any>,
  c: Context<any>
) {
  let result = Object.assign({}, query);

  if (isZodObject(schema.query)) {
    Object.entries(extractZodObjectShape(schema.query)).forEach(
      ([key, zodSchema]) => {
        if (
          zodSchema instanceof z.ZodArray ||
          (zodSchema instanceof z.ZodOptional &&
            zodSchema._def.innerType instanceof z.ZodArray)
        ) {
          // We need to call .queries() for known array keys, otherwise they come back as one string even if there are multiple entries
          result[key] = c.req.queries(key);
        }
      }
    );
  }

  return result;
}

export const isJsonContentType = (contentType = "") =>
  /*applicat*/ /ion\/(vnd\.api\+)?json/.test(contentType);

export interface IncomingHttpHeaders {
  accept?: string | undefined;
  'accept-language'?: string | undefined;
  'accept-patch'?: string | undefined;
  'accept-ranges'?: string | undefined;
  'access-control-allow-credentials'?: string | undefined;
  'access-control-allow-headers'?: string | undefined;
  'access-control-allow-methods'?: string | undefined;
  'access-control-allow-origin'?: string | undefined;
  'access-control-expose-headers'?: string | undefined;
  'access-control-max-age'?: string | undefined;
  'access-control-request-headers'?: string | undefined;
  'access-control-request-method'?: string | undefined;
  age?: string | undefined;
  allow?: string | undefined;
  'alt-svc'?: string | undefined;
  authorization?: string | undefined;
  'cache-control'?: string | undefined;
  connection?: string | undefined;
  'content-disposition'?: string | undefined;
  'content-encoding'?: string | undefined;
  'content-language'?: string | undefined;
  'content-length'?: string | undefined;
  'content-location'?: string | undefined;
  'content-range'?: string | undefined;
  'content-type'?: string | undefined;
  cookie?: string | undefined;
  date?: string | undefined;
  etag?: string | undefined;
  expect?: string | undefined;
  expires?: string | undefined;
  forwarded?: string | undefined;
  from?: string | undefined;
  host?: string | undefined;
  'if-match'?: string | undefined;
  'if-modified-since'?: string | undefined;
  'if-none-match'?: string | undefined;
  'if-unmodified-since'?: string | undefined;
  'last-modified'?: string | undefined;
  location?: string | undefined;
  origin?: string | undefined;
  pragma?: string | undefined;
  'proxy-authenticate'?: string | undefined;
  'proxy-authorization'?: string | undefined;
  'public-key-pins'?: string | undefined;
  range?: string | undefined;
  referer?: string | undefined;
  'retry-after'?: string | undefined;
  'sec-websocket-accept'?: string | undefined;
  'sec-websocket-extensions'?: string | undefined;
  'sec-websocket-key'?: string | undefined;
  'sec-websocket-protocol'?: string | undefined;
  'sec-websocket-version'?: string | undefined;
  'set-cookie'?: string[] | undefined;
  'strict-transport-security'?: string | undefined;
  tk?: string | undefined;
  trailer?: string | undefined;
  'transfer-encoding'?: string | undefined;
  upgrade?: string | undefined;
  'user-agent'?: string | undefined;
  vary?: string | undefined;
  via?: string | undefined;
  warning?: string | undefined;
  'www-authenticate'?: string | undefined;
}
