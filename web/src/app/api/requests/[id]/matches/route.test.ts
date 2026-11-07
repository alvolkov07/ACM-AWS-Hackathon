import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBuyerProfile } from "@/lib/db/repositories/buyer-profiles";
import { createCompany } from "@/lib/db/repositories/companies";
import { createProduct } from "@/lib/db/repositories/products";
import { createServiceRequest } from "@/lib/db/repositories/service-requests";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { POST as runMatch } from "../match/route";
import { GET, PATCH } from "./route";

describe("/api/requests/[id]/matches", () => {
  let requestId = "";
  let companyId = "";
  let productId = "";

  beforeAll(async () => {
    await setupTestDb();
    const profile = await createBuyerProfile({
      userId: "dev-user",
      companyName: "Select Buyer",
      address: "4 Grove",
      state: "CA",
      deliveryTarget: new Date("2026-11-01"),
      defaultService: "irrigation",
    });
    const company = await createCompany({
      name: "Select Co",
      description: "Irrigation",
      services: ["irrigation"],
      statesServed: ["CA"],
      contactEmail: "team+select@example.com",
      contactName: "Sam",
      leadTimeDays: 3,
      rating: 4,
    });
    companyId = company._id.toHexString();
    const product = await createProduct({
      companyId: company._id,
      name: "Emitter pack",
      service: "irrigation",
      unit: "box",
      pricePerUnit: 40,
      minOrder: 2,
      inStock: true,
    });
    productId = product._id.toHexString();
    const created = await createServiceRequest({
      userId: "dev-user",
      buyerProfileId: profile._id,
      service: "irrigation",
      prompt: "Need emitters",
      notes: "",
      status: "draft",
    });
    requestId = created._id.toHexString();
    await runMatch(new Request("http://localhost"), {
      params: Promise.resolve({ id: requestId }),
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns matches joined with company and products", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: requestId }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      matches: Array<{ company: { name: string }; products: unknown[] }>;
    };
    expect(body.matches[0]?.company.name).toBe("Select Co");
    expect(body.matches[0]?.products.length).toBeGreaterThan(0);
  });

  it("rejects invalid selection payloads", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyIds: [1], productIds: "nope" }),
      }),
      { params: Promise.resolve({ id: requestId }) },
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("stores company and product selections", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyIds: [companyId],
          productIds: [productId],
        }),
      }),
      { params: Promise.resolve({ id: requestId }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      matches: Array<{ selected: boolean; companyId: string }>;
    };
    expect(body.matches.some((match) => match.selected)).toBe(true);
  });
});
