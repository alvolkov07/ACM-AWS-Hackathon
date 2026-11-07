import type { z } from "zod";

/** Parse a DB document with its Zod schema; throw a clear error on mismatch. */
export function parseDocument<T>(
  schema: z.ZodType<T>,
  doc: unknown,
  label: string,
): T {
  const result = schema.safeParse(doc);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid ${label} document: ${details}`);
  }
  return result.data;
}
