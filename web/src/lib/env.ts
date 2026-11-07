import "server-only";

import { z } from "zod";

/**
 * Treat blank .env values as "not set" so defaults and .optional() work
 * when someone copies .env.example without filling everything in.
 */
const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined || value === null ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const requiredString = z.preprocess(
  emptyToUndefined,
  z.string().min(1, "is required"),
);

const optionalBooleanString = z.preprocess(
  emptyToUndefined,
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true",
    ),
);

/** Secrets and server-only config — never import this module from client components. */
const serverSchema = z.object({
  MONGODB_URI: requiredString,
  MONGODB_DB_NAME: requiredString,
  AUTH_MODE: z.preprocess(
    emptyToUndefined,
    z.enum(["dev", "cognito"]).default("dev"),
  ),
  AI_MODE: z.preprocess(
    emptyToUndefined,
    z.enum(["mock", "bedrock"]).default("mock"),
  ),
  BEDROCK_MODEL_ID: optionalString,
  EMAIL_MODE: z.preprocess(
    emptyToUndefined,
    z.enum(["log", "ses"]).default("log"),
  ),
  SES_FROM_ADDRESS: optionalString,
  AWS_REGION: z.preprocess(
    emptyToUndefined,
    z.string().default("us-west-2"),
  ),
  COGNITO_USER_POOL_ID: optionalString,
  COGNITO_CLIENT_ID: optionalString,
  COGNITO_DOMAIN: optionalString,
  APP_URL: optionalString,
  // Stretch goal — file uploads
  S3_UPLOAD_BUCKET: optionalString,
  S3_ENDPOINT: optionalString,
  S3_FORCE_PATH_STYLE: optionalBooleanString,
});

/**
 * Browser-safe values must use the NEXT_PUBLIC_ prefix.
 * None are required yet; this schema is ready for later stages.
 */
const publicSchema = z.object({
  // Example future key: NEXT_PUBLIC_APP_NAME: optionalString,
});

function formatZodError(label: string, error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");

  return `Invalid ${label} environment variables:\n${details}`;
}

function loadEnv() {
  const serverResult = serverSchema.safeParse(process.env);
  if (!serverResult.success) {
    throw new Error(formatZodError("server", serverResult.error));
  }

  const publicResult = publicSchema.safeParse({
    // Pull only NEXT_PUBLIC_* keys when we add them to publicSchema.
  });
  if (!publicResult.success) {
    throw new Error(formatZodError("public (NEXT_PUBLIC_*)", publicResult.error));
  }

  return {
    ...serverResult.data,
    public: publicResult.data,
  };
}

export const env = loadEnv();
export type Env = typeof env;
