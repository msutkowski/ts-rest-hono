/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApiRouteServerResponse,
  AppRoute,
  AppRouteMutation,
  AppRouteQuery,
  AppRouter,
  checkZodSchema,
  GetFieldType,
  isAppRoute,
  parseJsonQueryObject,
  PathParamsWithCustomValidators,
  validateResponse,
  Without,
  ZodInferOrType,
} from "@ts-rest/core";
import type { Context, Next, Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import type { IncomingHttpHeaders } from "http";

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

type AppRouteQueryImplementation<
  T extends AppRouteQuery,
  Env extends object
> = (
  input: Without<
    {
      params: PathParamsWithCustomValidators<T>;
      query: ZodInferOrType<T["query"]>;
      headers: IncomingHttpHeaders;
      req: Request;
    },
    never
  >,
  env: Env
) => Promise<ApiRouteServerResponse<T["responses"]>>;

type WithoutFileIfMultiPart<T extends AppRouteMutation> =
  T["contentType"] extends "multipart/form-data"
    ? Without<ZodInferOrType<T["body"]>, File>
    : ZodInferOrType<T["body"]>;

type AppRouteMutationImplementation<
  T extends AppRouteMutation,
  Env extends object
> = (
  input: Without<
    {
      params: PathParamsWithCustomValidators<T>;
      query: ZodInferOrType<T["query"]>;
      body: WithoutFileIfMultiPart<T>;
      headers: IncomingHttpHeaders;
      files: unknown;
      file: unknown;
      req: Request;
    },
    never
  >,
  env: Env
) => Promise<ApiRouteServerResponse<T["responses"]>>;

type AppRouteImplementation<
  T extends AppRoute,
  Env extends object
> = T extends AppRouteMutation
  ? AppRouteMutationImplementation<T, Env>
  : T extends AppRouteQuery
  ? AppRouteQueryImplementation<T, Env>
  : never;

type RecursiveRouterObj<T extends AppRouter, Env extends object> = {
  [TKey in keyof T]: T[TKey] extends AppRouter
    ? RecursiveRouterObj<T[TKey], Env>
    : T[TKey] extends AppRoute
    ? AppRouteImplementation<T[TKey], Env>
    : never;
};

type Options = {
  logInitialization?: boolean;
  jsonQuery?: boolean;
  responseValidation?: boolean;
  errorHandler?: (error: unknown) => void;
};

export const initServer = <Env extends object>() => {
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
    const query = options.jsonQuery
      ? parseJsonQueryObject(c.req.query() as any as Record<string, string>)
      : c.req.query();

    const queryResult = checkZodSchema(query, schema.query);

    if (!queryResult.success) {
      return c.json(queryResult.error, 400);
    }

    const paramsResult = checkZodSchema(c.req.param(), schema.pathParams, {
      passThroughExtraKeys: true,
    });

    if (!paramsResult.success) {
      return c.json(paramsResult.error, 400);
    }

    try {
      const result = await route(
        {
          params: paramsResult.data,
          query: queryResult.data,
          headers: c.req.header(),
          req: c.req.raw,
        },
        c.env
      );
      const statusCode = Number(result.status) as StatusCode;

      if (options.responseValidation) {
        try {
          const response = validateResponse({
            responseType: schema.responses[statusCode],
            response: {
              status: statusCode,
              body: result.body,
            },
          });

          return c.json(response.body, statusCode);
        } catch (err) {
          return c.json(err, 400);
        }
      }

      return c.json(result.body, statusCode);
    } catch (e) {
      console.log(
        `[ts-rest] error processing handler for handler: ${route.name}, path: ${schema.path}`
      );
      console.error(e);

      options.errorHandler?.(e);

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
    const query = options.jsonQuery
      ? parseJsonQueryObject(c.req.query())
      : c.req.query();

    const queryResult = checkZodSchema(query, schema.query);

    if (!queryResult.success) {
      return c.json(queryResult.error, 400);
    }

    const bodyResult = checkZodSchema(await c.req.json(), schema.body);

    if (!bodyResult.success) {
      return c.json(bodyResult.error, 400);
    }

    const paramsResult = checkZodSchema(c.req.param(), schema.pathParams, {
      passThroughExtraKeys: true,
    });

    if (!paramsResult.success) {
      return c.json(paramsResult.error, 400);
    }

    try {
      const result = await route(
        {
          params: paramsResult.data,
          body: bodyResult.data,
          query: queryResult.data,
          headers: c.req.header(),
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          files: c.req.files, // TODO: map this?
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          file: c.req.file, // TODO: map this?
          req: c.req.raw,
        },
        c.env
      );

      const statusCode = Number(result.status) as StatusCode;

      if (options.responseValidation) {
        try {
          const response = validateResponse({
            responseType: schema.responses[statusCode],
            response: {
              status: statusCode,
              body: result.body,
            },
          });

          return c.json(response.body, statusCode);
        } catch (err) {
          return c.json(err, 400);
        }
      }

      return c.json(result.body, statusCode);
    } catch (e) {
      console.log(
        `[ts-rest] error processing handler for handler: ${route.name}, path: ${schema.path}`
      );
      console.error(e);

      options.errorHandler?.(e);

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

export const createHonoEndpoints = <
  T extends RecursiveRouterObj<TRouter, any>,
  TRouter extends AppRouter,
  H extends Hono<any, any>
>(
  schema: TRouter,
  router: T,
  app: H,
  options: Options = {
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
          route as AppRouteQueryImplementation<any, any>,
          routerViaPath,
          app,
          options
        );
      } else {
        transformAppRouteMutationImplementation(
          route,
          routerViaPath,
          app,
          options
        );
      }
    } else {
      throw new Error(
        "Could not find schema route implementation for " + path.join(".")
      );
    }
  });
};
