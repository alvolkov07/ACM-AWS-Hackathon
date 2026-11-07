import "server-only";

import { env } from "@/lib/env";

export type CurrentUser = {
  userId: string;
  email: string;
  name: string;
};

/**
 * Returns the signed-in user for the current request.
 * Dev mode uses a fixed placeholder until Cognito lands in Stage 8.
 */
export function getCurrentUser(): CurrentUser {
  if (env.AUTH_MODE === "dev") {
    return {
      userId: "dev-user",
      email: "dev@example.com",
      name: "Dev User",
    };
  }

  throw new Error("not implemented until Stage 8");
}
