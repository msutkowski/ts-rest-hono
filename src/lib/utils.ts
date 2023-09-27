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
