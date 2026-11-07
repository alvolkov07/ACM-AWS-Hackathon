import { ObjectId } from "mongodb";
import { z } from "zod";

/** Accept a Mongo ObjectId instance (what the driver returns from the DB). */
export const objectIdSchema = z.custom<ObjectId>(
  (value) => value instanceof ObjectId,
  { message: "Expected a MongoDB ObjectId" },
);

/** Two-letter US state / territory code, e.g. CA. */
export const usStateCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Expected a 2-letter US state code");
