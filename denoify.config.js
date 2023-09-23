// @ts-check

/** @type { import('denoify/lib/config/parseParams').DenoifyParams } */
const config = {
  out: 'deno_dist',
  index: './src/index.ts',
  ports: {
    zod: 'https://deno.land/x/zod/mod.ts',
    hono: 'https://deno.land/x/hono/mod.ts',
  },
}

module.exports = config
