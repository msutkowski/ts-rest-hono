import { z } from "zod";

export const error = z.object({
  title: z.string(),
  detail: z.string().nullish(),
  source: z.unknown(),
});

export const validationError = z.object({
  title: z.string(),
  detail: z.string().nullish(),
  source: z.object({
    pointer: z.string(),
  }),
});

export type ValidationError = z.infer<typeof validationError>;

export const errorFormat = z.array(z.union([error, validationError]));

export type ErrorFormat = z.infer<typeof errorFormat>;

export function formatZodErrors(zodError: z.ZodError): ErrorFormat {
  const errors = zodError.errors.map((issue): ValidationError => ({
    title: issue.message,
    detail: issue.code,
    source: {
      pointer: `/${issue.path.join("/")}`,
    },
  }));

  return errors;
}
