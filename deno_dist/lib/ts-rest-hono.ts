/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AppRoute,
  AppRouteMutation,
  AppRouteQuery,
  AppRouter,
  isAppRoute,
  ResponseValidationError,
  ServerInferRequest,
  ServerInferResponses,
  validateResponse,
} from "npm:@ts-rest/core@3.27.0";
import type { Context, Hono, Env as HonoEnv, Next } from "https://deno.land/x/hono@v3.4.0/mod.ts";
import { StatusCode } from "https://deno.land/x/hono@v3.4.0/utils/http-status.ts";
import type { IncomingHttpHeaders } from "node:http";
import { RequestValidationError } from "./request-validation-error.ts";
import { getValue, resolveOption } from "./utils.ts";
import {
  combinedRequestValidationErrorHandler,
  validateRequest,
} from "./validate-request.ts";

export type WithTsRestHonoVariables<
  T extends Record<string, unknown> = Record<string, unknown>
> = T & {
  ts_rest_hono_operationId: string;
};

export type AppRouteImplementationReturn<
  T extends AppRouteQuery | AppRouteMutation
> = Promise<ServerInferResponses<T>> | ServerInferResponses<T> | Response;

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
) => AppRouteImplementationReturn<T>;

type AppRouteMutationImplementation<
  T extends AppRouteMutation,
  Env extends HonoEnv
> = (
  input: AppRouteInput<T> & {
    files: unknown;
    file: unknown;
  },
  context: Context<Env, any>
) => AppRouteImplementationReturn<T>;

export type AppRouteImplementation<
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
  responseValidationErrorHandler?: (error: ResponseValidationError) => {
    error: unknown;
    status: StatusCode;
  };
};
export type ResolvableOption = Options<HonoEnv>[keyof Pick<
  Options,
  "responseValidation" | "jsonQuery"
>];

export const initServer = <Env extends HonoEnv>() => {
  return {
    router: <T extends AppRouter>(
      _router: T,
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

const transformAppRouteQueryImplementation = ({
  route,
  schema,
  app,
  options,
  operationId,
}: {
  route: AppRouteQueryImplementation<any, any>;
  schema: AppRouteQuery;
  app: Hono<any>;
  options: Options;
  operationId: string;
}) => {
  if (options.logInitialization) {
    console.log(`[ts-rest] Initialized ${schema.method} ${schema.path}`);
  }

  app.get(schema.path, async (c: Context<any>, next: Next) => {
    c.set("ts_rest_hono_operationId", operationId);
    const validationResult = await validateRequest(c, schema, options);
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
          if (err instanceof ResponseValidationError) {
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

const transformAppRouteMutationImplementation = ({
  route,
  schema,
  app,
  options,
  operationId,
}: {
  route: AppRouteMutationImplementation<any, any>;
  schema: AppRouteMutation;
  app: Hono<any>;
  options: Options;
  operationId: string;
}) => {
  if (options.logInitialization) {
    console.log(`[ts-rest] Initialized ${schema.method} ${schema.path}`);
  }

  const method = schema.method;

  const reqHandler = async (c: Context, next: Next) => {
    c.set("ts_rest_hono_operationId", operationId);

    const validationResult = await validateRequest(c, schema, options);
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
          if (err instanceof ResponseValidationError) {
            if (options.responseValidationErrorHandler) {
              const { error, status } =
                options.responseValidationErrorHandler(err);
              return c.json(error, status);
            }

            return c.json(err.cause, 400);
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
    // This will be the value of the last key in the path, which is the operationId (or the name of the key of the entry in the contract)
    const operationId = path.at(-1)!;

    if (!routerViaPath) {
      throw new Error(`[ts-rest] No router found for path ${path.join(".")}`);
    }

    if (isAppRoute(routerViaPath)) {
      if (routerViaPath.method === "GET") {
        transformAppRouteQueryImplementation({
          route: route as AppRouteQueryImplementation<any, ExtractEnv<H>>,
          schema: routerViaPath,
          app,
          options: options as any,
          operationId,
        });
      } else {
        transformAppRouteMutationImplementation({
          route,
          schema: routerViaPath,
          app,
          options: options as any,
          operationId,
        });
      }
    } else {
      throw new Error(
        "Could not find schema route implementation for " + path.join(".")
      );
    }
  });
};
