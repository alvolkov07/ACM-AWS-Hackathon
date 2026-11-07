import { z } from "zod";

import { objectIdSchema } from "./object-id";

export const AGENT_RUNS_COLLECTION = "agent_runs";

export const agentToolCallSchema = z.object({
  name: z.string().min(1),
  input: z.unknown(),
  outputSummary: z.string(),
});

export type AgentToolCall = z.infer<typeof agentToolCallSchema>;

export const agentRunSchema = z.object({
  _id: objectIdSchema,
  requestId: objectIdSchema,
  model: z.string().min(1),
  inputSummary: z.string(),
  toolCalls: z.array(agentToolCallSchema),
  finalOutput: z.string(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
});

export type AgentRun = z.infer<typeof agentRunSchema>;

export const agentRunCreateSchema = agentRunSchema.omit({
  _id: true,
  createdAt: true,
});

export type AgentRunCreate = z.infer<typeof agentRunCreateSchema>;
