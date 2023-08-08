/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AppRoute,
  AppRouteMutation,
  AppRouteQuery,
  AppRouter,
  checkZodSchema,
  extractZodObjectShape,
  GetFieldType,
  isAppRoute,
  isZodObject,
  parseJsonQueryObject,
  ServerInferRequest,
  ServerInferResponses,
  validateResponse,
  Without,
  ZodInferOrType,
} from "npm:@ts-rest/core@3.27.0";
import type { Context, Env as HonoEnv, Hono, Next } from "https://deno.land/x/hono@v3.4.0/mod.ts";
import { StatusCode } from "https://deno.land/x/hono@v3.4.0/utils/http-status.ts";
import type { IncomingHttpHeaders } from "node:http";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";
import { RequestValidationError } from "./request-validation-error.ts";
import { combinedRequestValidationErrorHandler } from "./validate-request.ts";
import { validateRequest } from "./validate-request.ts";

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

type AppRouteInput<T extends AppRoute> = ServerInferRequest<
  T,
  IncomingHttpHeaders
> & { req: Request };

type AppRouteQueryImplementation<
  T extends AppRouteQuery,
  Env extends HonoEnv
> = (
  input: AppRouteInput<T>,
  context: Context<Env, any>
) => Promise<ServerInferResponses<T>> | Response;

type WithoutFileIfMultiPart<T extends AppRouteMutation> =
  T["contentType"] extends "multipart/form-data"
    ? Without<ZodInferOrType<T["body"]>, File>
    : ZodInferOrType<T["body"]>;

type AppRouteMutationImplementation<
  T extends AppRouteMutation,
  Env extends HonoEnv
> = (
  input: AppRouteInput<T> & {
    files: unknown;
    file: unknown;
  },
  context: Context<Env, any>
) => Promise<ServerInferResponses<T>> | Response;

type AppRouteImplementation<
  T extends AppRoute,
  Env extends HonoEnv
> = T extends AppRouteMutation
  ? AppRouteMutationImplementation<T, Env>
  : T extends AppRouteQuery
  ? AppRouteQueryImplementation<T, Env>
  : never;

export type RecursiveRouterObj<T extends AppRouter, Env extends HonoEnv> = {
  [TKey in keyof T]: T[TKey] extends AppRouter
    ? RecursiveRouterObj<T[TKey], Env>
    : T[TKey] extends AppRoute
    ? AppRouteImplementation<T[TKey], Env>
    : never;
};

export type Options<E extends HonoEnv = HonoEnv> = {
  logInitialization?: boolean;
  jsonQuery?: boolean | ((c: Context<E, any>) => boolean);
  responseValidation?: boolean | ((c: Context<E, any>) => boolean);
  errorHandler?: (error: unknown, context?: Context<E, any>) => void;
  requestValidationErrorHandler?: (error: RequestValidationError) => {
    error: unknown;
    status: StatusCode;
  };
  responseValidationErrorHandler?: (error: z.ZodError<any>) => {
    error: unknown;
    status: StatusCode;
  };
};
type ResolvableOption = Options<HonoEnv>[keyof Pick<
  Options,
  "responseValidation" | "jsonQuery"
>];

export const initServer = <Env extends HonoEnv>() => {
  return {
    router: <T extends AppRouter>(
      router: T,
      args: RecursiveRouterObj<T, Env>
    ) => args,
  };
};

const recursivelyApplyHonoRouter = (
  router: RecursiveRouterObj<any, any> | AppRouteImplementation<any, any>,
  path: string[],
  routeTransformer: (
    route: AppRouteImplementation<any, any>,
    path: string[]
  ) => void
): void => {
  if (typeof router === "object") {
    for (const key in router) {
      recursivelyApplyHonoRouter(router[key], [...path, key], routeTransformer);
    }
  } else if (typeof router === "function") {
    routeTransformer(router, path);
  }
};

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

const transformAppRouteQueryImplementation = (
  route: AppRouteQueryImplementation<any, any>,
  schema: AppRouteQuery,
  app: Hono<any>,
  options: Options
) => {
  if (options.logInitialization) {
    console.log(`[ts-rest] Initialized ${schema.method} ${schema.path}`);
  }

  app.get(schema.path, async (c: Context<any>, next: Next) => {
    const validationResult = validateRequest(c, schema, options);
    if (validationResult instanceof RequestValidationError) {
      const { error, status } = (
        options.requestValidationErrorHandler ??
        combinedRequestValidationErrorHandler
      )(validationResult);
      return c.json(error, status);
    }

    try {
      const { headers, params, query } = validationResult;
      const result = await route(
        {
          params: params as any,
          query: query as any,
          headers: headers as any,
          req: c.req.raw as any,
        },
        c
      );

      // If someone just calls `return c.(json|jsonT|text)` or returns a `Response` directly, just skip everything else we'd do here as they're taking ownership of the response
      if (result instanceof Response) {
        return result;
      }

      const statusCode = Number(result.status) as StatusCode;

      if (resolveOption(options.responseValidation, c)) {
        try {
          const response = validateResponse({
            appRoute: schema,
            response: {
              status: statusCode,
              body: result.body,
            },
          });

          return c.json(response.body, statusCode);
        } catch (err) {
          if (err instanceof z.ZodError) {
            if (options.responseValidationErrorHandler) {
              const { error, status } =
                options.responseValidationErrorHandler(err);
              return c.json(error, status);
            }
          }

          return c.json(err, 400);
        }
      }

      return c.json(result.body, statusCode);
    } catch (e) {
      console.log(
        `[ts-rest] error processing handler for: ${route.name}, path: ${schema.path}`
      );
      console.error(e);

      options.errorHandler?.(e, c);

      return next();
    }
  });
};

const transformAppRouteMutationImplementation = (
  route: AppRouteMutationImplementation<any, any>,
  schema: AppRouteMutation,
  app: Hono<any>,
  options: Options
) => {
  if (options.logInitialization) {
    console.log(`[ts-rest] Initialized ${schema.method} ${schema.path}`);
  }

  const method = schema.method;

  const reqHandler = async (c: Context, next: Next) => {
    const validationResult = validateRequest(c, schema, options);
    if (validationResult instanceof RequestValidationError) {
      const { error, status } = (
        options.requestValidationErrorHandler ??
        combinedRequestValidationErrorHandler
      )(validationResult);
      return c.json(error, status);
    }

    try {
      const { headers, params, query, body } = validationResult;
      const result = await route(
        {
          params: params as any,
          body: body as any,
          query: query as any,
          headers: headers as any,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          files: c.req.files, // TODO: map this?
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          file: c.req.file, // TODO: map this?
          req: c.req.raw as any,
        },
        c
      );

      // If someone just calls `return c.(json|jsonT|text)` or returns a `Response` directly, just skip everything else we'd do here as they're taking ownership of the response
      if (result instanceof Response) {
        return result;
      }

      const statusCode = Number(result.status) as StatusCode;

      if (resolveOption(options.responseValidation)) {
        try {
          const response = validateResponse({
            appRoute: schema,
            response: {
              status: statusCode,
              body: result.body,
            },
          });

          return c.json(response.body, statusCode);
        } catch (err) {
          if (err instanceof z.ZodError) {
            if (options.responseValidationErrorHandler) {
              const { error, status } =
                options.responseValidationErrorHandler(err);
              return c.json(error, status);
            }
          }

          return c.json(err, 400);
        }
      }

      return c.json(result.body, statusCode);
    } catch (e) {
      console.log(
        `[ts-rest] error processing handler for: ${route.name}, path: ${schema.path}`
      );
      console.error(e);

      options.errorHandler?.(e, c);

      return next();
    }
  };

  switch (method) {
    case "DELETE":
      app.delete(schema.path, reqHandler);
      break;
    case "POST":
      app.post(schema.path, reqHandler);
      break;
    case "PUT":
      app.put(schema.path, reqHandler);
      break;
    case "PATCH":
      app.patch(schema.path, reqHandler);
      break;
  }
};

type ExtractEnv<T> = T extends Hono<infer Env, any> ? Env : never;

export type CreateHonoEndpointsOptions<HonoApp> = Options<ExtractEnv<HonoApp>>;

export const createHonoEndpoints = <
  T extends RecursiveRouterObj<TRouter, any>,
  TRouter extends AppRouter,
  H extends Hono<any, any>
>(
  schema: TRouter,
  router: T,
  app: H,
  options: CreateHonoEndpointsOptions<H> = {
    logInitialization: true,
    jsonQuery: false,
    responseValidation: false,
    errorHandler: undefined,
  }
) => {
  recursivelyApplyHonoRouter(router, [], (route, path) => {
    const routerViaPath = getValue(schema, path.join("."));

    if (!routerViaPath) {
      throw new Error(`[ts-rest] No router found for path ${path.join(".")}`);
    }

    if (isAppRoute(routerViaPath)) {
      if (routerViaPath.method === "GET") {
        transformAppRouteQueryImplementation(
          route as AppRouteQueryImplementation<any, ExtractEnv<H>>,
          routerViaPath,
          app,
          options as any
        );
      } else {
        transformAppRouteMutationImplementation(
          route,
          routerViaPath,
          app,
          options as any
        );
      }
    } else {
      throw new Error(
        "Could not find schema route implementation for " + path.join(".")
      );
    }
  });
};
