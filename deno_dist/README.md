# ts-rest-hono

A [hono][hono] adapter for [ts-rest][ts-rest].

## Usage

```ts
import { createHonoEndpoints, initServer } from "ts-rest-hono"
import { contract } from "<project>/contract"

const app = new Hono()

const s = initServer()
const router = s.router(contract, {
  health: () => Promise.resolve({ status: 200, body: "ok" }),
})

createHonoEndpoints(contract, router, app)

export default app
```

Deno is also supported at [deno_dist](./deno_dist/).

[hono]: https://github.com/honojs/hono
[ts-rest]: https://www.ts-rest.com
