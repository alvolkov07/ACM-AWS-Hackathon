import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { emailDraftSchema } from "@/lib/db/schemas/email-draft";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import {
  createEmailDraft,
  getEmailDraftById,
  listEmailDrafts,
} from "./email-drafts";

describe("email-drafts repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads an email draft", async () => {
    const requestId = new ObjectId();
    const created = await createEmailDraft({
      requestId,
      companyId: new ObjectId(),
      to: "team+supplier@example.com",
      subject: "Supply inquiry",
      body: "Hello, we need a quote for drip irrigation.",
      status: "draft",
    });

    const fetched = await getEmailDraftById(created._id);
    expect(fetched?.subject).toBe("Supply inquiry");

    const listed = await listEmailDrafts({ requestId, status: "draft" });
    expect(listed).toHaveLength(1);
  });

  it("rejects a bad document with zod", () => {
    const result = emailDraftSchema.safeParse({
      _id: new ObjectId(),
      requestId: new ObjectId(),
      companyId: new ObjectId(),
      to: "not-email",
      subject: "",
      body: "",
      status: "queued",
    });
    expect(result.success).toBe(false);
  });
});
