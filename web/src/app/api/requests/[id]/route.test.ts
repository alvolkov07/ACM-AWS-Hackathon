import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBuyerProfile } from "@/lib/db/repositories/buyer-profiles";
import { createServiceRequest } from "@/lib/db/repositories/service-requests";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { GET } from "./route";

describe("GET /api/requests/[id]", () => {
  let requestId = "";

  beforeAll(async () => {
    await setupTestDb();
    const profile = await createBuyerProfile({
      userId: "dev-user",
      companyName: "Detail Co",
      address: "2 Lane",
      state: "WA",
      deliveryTarget: new Date("2026-10-01"),
    });
    const created = await createServiceRequest({
      userId: "dev-user",
      buyerProfileId: profile._id,
      service: "transport",
      prompt: "Need a reefer hop",
      notes: "",
      status: "draft",
    });
    requestId = created._id.toHexString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns the current user's request", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: requestId }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      request: { prompt: string };
    };
    expect(body.request.prompt).toContain("reefer");
  });

  it("returns 404 for an unknown id", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: new ObjectId().toHexString() }),
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
