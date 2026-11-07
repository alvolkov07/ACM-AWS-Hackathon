import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  BUYER_PROFILES_COLLECTION,
  buyerProfileCreateSchema,
  buyerProfileSchema,
  type BuyerProfile,
  type BuyerProfileCreate,
} from "@/lib/db/schemas/buyer-profile";

export type BuyerProfileListFilter = {
  userId: string;
};

export async function createBuyerProfile(
  input: BuyerProfileCreate,
): Promise<BuyerProfile> {
  const data = buyerProfileCreateSchema.parse(input);
  const db = await getDb();
  const doc = {
    ...data,
    createdAt: new Date(),
  };
  const result = await db.collection(BUYER_PROFILES_COLLECTION).insertOne(doc);
  return parseDocument(
    buyerProfileSchema,
    { ...doc, _id: result.insertedId },
    "BuyerProfile",
  );
}

export async function getBuyerProfileById(
  id: string | ObjectId,
  userId: string,
): Promise<BuyerProfile | null> {
  const db = await getDb();
  const doc = await db.collection(BUYER_PROFILES_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
    userId,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(buyerProfileSchema, doc, "BuyerProfile");
}

/** Most recent profile for a user (hackathon assumes one active profile). */
export async function getBuyerProfileForUser(
  userId: string,
): Promise<BuyerProfile | null> {
  const db = await getDb();
  const doc = await db
    .collection(BUYER_PROFILES_COLLECTION)
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  if (!doc) {
    return null;
  }
  return parseDocument(buyerProfileSchema, doc, "BuyerProfile");
}

export async function listBuyerProfiles(
  filter: BuyerProfileListFilter,
): Promise<BuyerProfile[]> {
  const db = await getDb();
  const docs = await db
    .collection(BUYER_PROFILES_COLLECTION)
    .find({ userId: filter.userId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) =>
    parseDocument(buyerProfileSchema, doc, "BuyerProfile"),
  );
}
