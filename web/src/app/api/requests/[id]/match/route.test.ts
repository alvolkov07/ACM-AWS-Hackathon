import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBuyerProfile } from "@/lib/db/repositories/buyer-profiles";
import { createCompany } from "@/lib/db/repositories/companies";
import { createProduct } from "@/lib/db/repositories/products";
import { createServiceRequest } from "@/lib/db/repositories/service-requests";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { POST } from "./route";

describe("POST /api/requests/[id]/match", () => {
  let requestId = "";

  beforeAll(async () => {
    await setupTestDb();
    const profile = await createBuyerProfile({
      userId: "dev-user",
      companyName: "Match Buyer",
      address: "3 Field",
      state: "CA",
      deliveryTarget: new Date("2026-12-01"),
      defaultService: "irrigation",
    });
    const company = await createCompany({
      name: "Drip Co",
      description: "Irrigation parts",
      services: ["irrigation"],
      statesServed: ["CA"],
      contactEmail: "team+drip@example.com",
      contactName: "Dana",
      leadTimeDays: 4,
      rating: 4.5,
    });
    await createProduct({
      companyId: company._id,
      name: "Drip kit",
      service: "irrigation",
      unit: "kit",
      pricePerUnit: 100,
      minOrder: 1,
      inStock: true,
    });
    const created = await createServiceRequest({
      userId: "dev-user",
      buyerProfileId: profile._id,
      service: "irrigation",
      prompt: "Need drip for 10 acres",
      notes: "",
      status: "draft",
    });
    requestId = created._id.toHexString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("stores rule-based matches", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: requestId }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      matches: Array<{ source: string; score: number }>;
    };
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.matches[0]?.source).toBe("rules");
    expect(body.matches[0]?.score).toBeGreaterThan(0);
  });

  it("returns 404 for a bad request id", async () => {
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(response.status).toBe(404);
  });
});
