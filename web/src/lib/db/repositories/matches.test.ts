import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { matchSchema } from "@/lib/db/schemas/match";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { createMatch, getMatchById, listMatches } from "./matches";

describe("matches repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads a match", async () => {
    const requestId = new ObjectId();
    const created = await createMatch({
      requestId,
      companyId: new ObjectId(),
      productIds: [new ObjectId(), new ObjectId()],
      score: 82,
      reasons: ["Serves buyer state", "Offers requested service"],
      source: "rules",
      selected: false,
    });

    const fetched = await getMatchById(created._id);
    expect(fetched?.score).toBe(82);

    const listed = await listMatches({ requestId });
    expect(listed).toHaveLength(1);
  });

  it("rejects a bad document with zod", () => {
    const result = matchSchema.safeParse({
      _id: new ObjectId(),
      requestId: new ObjectId(),
      companyId: new ObjectId(),
      productIds: ["bad"],
      score: 150,
      reasons: [],
      source: "magic",
      selected: "yes",
    });
    expect(result.success).toBe(false);
  });
});
