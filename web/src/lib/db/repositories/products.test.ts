import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { productSchema } from "@/lib/db/schemas/product";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { createCompany } from "./companies";
import { createProduct, getProductById, listProducts } from "./products";

describe("products repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads a product", async () => {
    const company = await createCompany({
      name: "Product Parent Co",
      description: "Owns test products",
      services: ["irrigation"],
      statesServed: ["OR"],
      contactEmail: "team+productparent@example.com",
      contactName: "Pat Parent",
      leadTimeDays: 3,
      rating: 4,
    });

    const created = await createProduct({
      companyId: company._id,
      name: "Drip starter kit",
      service: "irrigation",
      unit: "kit",
      pricePerUnit: 120,
      minOrder: 2,
      inStock: true,
    });

    const fetched = await getProductById(created._id);
    expect(fetched?.name).toBe("Drip starter kit");

    const listed = await listProducts({ companyId: company._id });
    expect(listed).toHaveLength(1);
  });

  it("rejects a bad document with zod", () => {
    const result = productSchema.safeParse({
      _id: new ObjectId(),
      companyId: "not-an-object-id",
      name: "",
      service: "irrigation",
      unit: "kit",
      pricePerUnit: -5,
      minOrder: -1,
      inStock: "yes",
    });
    expect(result.success).toBe(false);
  });
});
