import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serviceRequestSchema } from "@/lib/db/schemas/service-request";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { createBuyerProfile } from "./buyer-profiles";
import {
  createServiceRequest,
  getServiceRequestById,
  listServiceRequests,
} from "./service-requests";

describe("service-requests repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads a service request", async () => {
    const userId = "dev-user";
    const profile = await createBuyerProfile({
      userId,
      companyName: "Request Farm",
      address: "22 Ridge Ave",
      state: "WA",
      deliveryTarget: new Date("2026-07-15"),
    });

    const created = await createServiceRequest({
      userId,
      buyerProfileId: profile._id,
      service: "irrigation",
      prompt: "We need drip irrigation for 40 acres",
      quantity: 40,
      notes: "Prefer low-flow emitters",
      status: "draft",
    });

    const fetched = await getServiceRequestById(created._id, userId);
    expect(fetched?.prompt).toContain("drip irrigation");

    const listed = await listServiceRequests({ userId, status: "draft" });
    expect(listed.some((r) => r._id.equals(created._id))).toBe(true);
  });

  it("rejects a bad document with zod", () => {
    const result = serviceRequestSchema.safeParse({
      _id: new ObjectId(),
      userId: "dev-user",
      buyerProfileId: new ObjectId(),
      service: "telepathy",
      prompt: "",
      notes: "x",
      status: "nope",
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
