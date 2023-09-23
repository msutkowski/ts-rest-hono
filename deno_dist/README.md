# ts-rest-hono

<p align="center">🔥 A <a href="https://hono.dev/">hono</a> adapter for <a href="https://www.ts-rest.com">ts-rest 🔥</a></p>

<p align="center">
  <a href="https://www.ts-rest.com">
    <img src="https://avatars.githubusercontent.com/u/109956939?s=400&u=8bf67b1281da46d64eab85f48255cd1892bf0885&v=4" height="150"></img>
  </a>
  <a href="https://hono.dev">
    <img src="https://avatars.githubusercontent.com/u/98495527?s=400&v=4" height="150">
  </a>
</p>

<p align="center">Incrementally adoptable RPC-like client and server helpers for a magical end to end typed experience + The small, simple, and ultrafast web framework for the Edges.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ts-rest-hono">
    <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/msutkowski/ts-rest-hono"/>
  </a>
  <a href="https://www.npmjs.com/package/ts-rest-hono">
    <img src="https://img.shields.io/npm/dm/ts-rest-hono"/>
  </a>
  <a href="https://www.npmjs.com/package/ts-rest-hono">
    <img alt="Bundle Size" src="https://img.shields.io/bundlephobia/minzip/ts-rest-hono?label=ts-rest-hono"/>
  </a>
</p>

### Set it up in 3 Steps!

#### 1. Define your Contract.

```typescript
// contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
});

export const contract = c.router({
  getTodos: {
    method: "GET",
    path: "/todos",
    responses: {
      201: TodoSchema.array(),
    },
    summary: "Create ",
  },
  createTodo: {
    method: "POST",
    path: "/todo",
    responses: {
      201: TodoSchema,
    },
    body: z.object({
      title: z.string(),
      completed: z.boolean(),
    }),
    summary: "Creates a todo.",
  },
});
```

#### 2. Initialize Server Router.

```ts
// router.ts
import { initServer } from "ts-rest-hono";
import { contract } from "./contract";
import { nanoid } from "nanoid";

const s = initServer();

type Todo = {
  id: string;
  title: string;
  completed: boolean;
};

// Database
const todos: Todo[] = [];

export const router = s.router(contract, {
  getTodos: async () => {
    return {
      status: 201,
      body: todos,
    };
  },
  createTodo: async ({ body: { completed, title } }) => {
    const newTodo = {
      id: nanoid(),
      title,
      completed,
    };

    todos.push(newTodo);

    return {
      status: 201,
      body: newTodo,
    };
  },
});
```

#### 3. Create Endpoints on App.

```ts
// app.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createHonoEndpoints } from "ts-rest-hono";
import { contract } from "./contract";
import { router } from "./router";

const app = new Hono();

app.get("/", (c) => {
  return c.text("🔥 Hello Hono!");
});

createHonoEndpoints(contract, router, app);

// Run the server!
try {
  serve(app, (info) => {
    console.log(`Listening on http://localhost:${info.port}`);
  });
} catch (err) {
  console.log(err);
  process.exit(1);
}
```

<br />

<p align="center">
    <p align="center">Finally just run <code>app.ts</code></p>
    <p align="center">It's that easy! Enjoy your ultra-fast typesafe API 🔥🚀</p>
</p>

Deno is also supported at [deno_dist](./deno_dist/).
