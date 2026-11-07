import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { companySchema } from "@/lib/db/schemas/company";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { createCompany, getCompanyById, listCompanies } from "./companies";

describe("companies repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads a company", async () => {
    const created = await createCompany({
      name: "Test Valley Supply",
      description: "Test-only supplier",
      services: ["seeds", "fertilizer"],
      statesServed: ["CA"],
      contactEmail: "team+testvalley@example.com",
      contactName: "Ada Test",
      leadTimeDays: 4,
      rating: 4.2,
    });

    const fetched = await getCompanyById(created._id);
    expect(fetched?.name).toBe("Test Valley Supply");

    const listed = await listCompanies({ service: "seeds", state: "CA" });
    expect(listed.some((c) => c._id.equals(created._id))).toBe(true);
  });

  it("rejects a bad document with zod", () => {
    const bad = {
      _id: new ObjectId(),
      name: "Bad Co",
      description: "Missing required fields",
      services: ["not-a-real-service"],
      statesServed: ["California"],
      contactEmail: "not-an-email",
      contactName: "X",
      leadTimeDays: -1,
      rating: 9,
      createdAt: new Date(),
    };

    const result = companySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
