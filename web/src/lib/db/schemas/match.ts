import { z } from "zod";

import { objectIdSchema } from "./object-id";

export const MATCHES_COLLECTION = "matches";

export const matchSourceSchema = z.enum(["rules", "agent"]);

export type MatchSource = z.infer<typeof matchSourceSchema>;

export const matchSchema = z.object({
  _id: objectIdSchema,
  requestId: objectIdSchema,
  companyId: objectIdSchema,
  productIds: z.array(objectIdSchema),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string().min(1)),
  source: matchSourceSchema,
  selected: z.boolean(),
});

export type Match = z.infer<typeof matchSchema>;

export const matchCreateSchema = matchSchema.omit({
  _id: true,
});

export type MatchCreate = z.infer<typeof matchCreateSchema>;
