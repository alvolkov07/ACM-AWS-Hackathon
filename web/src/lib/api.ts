export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

/**
 * Small typed helper for calling our own `/api/*` route handlers.
 * Throws ApiError when the response is not 2xx.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // TODO(Stage 4): attach the auth token (e.g. Authorization: Bearer …) here.

  const response = await fetch(path, {
    ...options,
    headers,
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      `API ${options.method ?? "GET"} ${path} failed with ${response.status}`,
      response.status,
      parsed,
    );
  }

  return parsed as T;
}
