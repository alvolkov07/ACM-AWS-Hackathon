// Small fetch wrapper for the backend. Requests go to /api, which Next.js
// forwards to the FastAPI server (see next.config.ts).

const TOKEN_KEY = "token";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked (private mode); the session just won't persist.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** Thrown when the session is missing or expired; callers send the user to /login. */
export class AuthError extends Error {}

type ErrorItem = { loc?: unknown[]; msg?: string } | string;

// FastAPI returns errors as a string, a list of validation items, or an object.
function readableError(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return (detail as ErrorItem[])
      .map((item) => {
        if (typeof item === "string") return item;
        const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== "body").join(" → ") : "";
        return field && item.msg ? `${field}: ${item.msg}` : item.msg || JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    const d = detail as { message?: string; msg?: string };
    return d.message || d.msg || JSON.stringify(detail);
  }
  return fallback;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the Eagle server. Check your connection and try again.");
  }

  // Login and register return 401 for wrong credentials; that is not an expired session.
  if (res.status === 401 && token && path !== "/login") {
    clearToken();
    throw new AuthError("Your session expired. Please log in again.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(readableError((data as { detail?: unknown }).detail, res.statusText || "Something went wrong"));
  }
  return res.json() as Promise<T>;
}
