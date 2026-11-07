import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function jsonError(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function jsonFromZodError(error: ZodError): NextResponse<ApiErrorBody> {
  const message = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
  return jsonError("VALIDATION_ERROR", message, 400);
}

/** Turn ObjectIds / Dates into JSON-safe primitives for API responses. */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, inner: unknown) => {
      if (
        inner &&
        typeof inner === "object" &&
        "toHexString" in inner &&
        typeof (inner as { toHexString: () => string }).toHexString ===
          "function"
      ) {
        return (inner as { toHexString: () => string }).toHexString();
      }
      if (inner instanceof Date) {
        return inner.toISOString();
      }
      return inner;
    }),
  ) as T;
}
