import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { agentRunSchema } from "@/lib/db/schemas/agent-run";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { createAgentRun, getAgentRunById, listAgentRuns } from "./agent-runs";

describe("agent-runs repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads an agent run", async () => {
    const requestId = new ObjectId();
    const created = await createAgentRun({
      requestId,
      model: "mock-claude",
      inputSummary: "Buyer needs irrigation in CA",
      toolCalls: [
        {
          name: "list_companies",
          input: { service: "irrigation", state: "CA" },
          outputSummary: "Found 3 companies",
        },
      ],
      finalOutput: "Here are ranked suppliers…",
      tokensIn: 120,
      tokensOut: 80,
      durationMs: 450,
    });

    const fetched = await getAgentRunById(created._id);
    expect(fetched?.model).toBe("mock-claude");

    const listed = await listAgentRuns({ requestId });
    expect(listed).toHaveLength(1);
  });

  it("rejects a bad document with zod", () => {
    const result = agentRunSchema.safeParse({
      _id: new ObjectId(),
      requestId: new ObjectId(),
      model: "",
      inputSummary: "x",
      toolCalls: [{ name: "", input: {}, outputSummary: 1 }],
      finalOutput: "y",
      tokensIn: -1,
      tokensOut: -2,
      durationMs: -3,
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
