import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buyerProfileSchema } from "@/lib/db/schemas/buyer-profile";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import {
  createBuyerProfile,
  getBuyerProfileById,
  listBuyerProfiles,
} from "./buyer-profiles";

describe("buyer-profiles repository", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads a buyer profile for a user", async () => {
    const userId = "dev-user";
    const created = await createBuyerProfile({
      userId,
      companyName: "Sunrise Farm",
      address: "100 Orchard Rd",
      state: "CA",
      deliveryTarget: new Date("2026-06-01"),
      defaultService: "irrigation",
    });

    const fetched = await getBuyerProfileById(created._id, userId);
    expect(fetched?.companyName).toBe("Sunrise Farm");

    const listed = await listBuyerProfiles({ userId });
    expect(listed.some((p) => p._id.equals(created._id))).toBe(true);

    const otherUser = await getBuyerProfileById(created._id, "someone-else");
    expect(otherUser).toBeNull();
  });

  it("rejects a bad document with zod", () => {
    const result = buyerProfileSchema.safeParse({
      _id: new ObjectId(),
      userId: "",
      companyName: "X",
      address: "Y",
      state: "California",
      deliveryTarget: "not-a-date",
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
