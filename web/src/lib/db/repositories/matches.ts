import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  MATCHES_COLLECTION,
  matchCreateSchema,
  matchSchema,
  type Match,
  type MatchCreate,
} from "@/lib/db/schemas/match";

export type MatchListFilter = {
  requestId: string | ObjectId;
  selected?: boolean;
};

export async function createMatch(input: MatchCreate): Promise<Match> {
  const data = matchCreateSchema.parse(input);
  const db = await getDb();
  const result = await db.collection(MATCHES_COLLECTION).insertOne(data);
  return parseDocument(
    matchSchema,
    { ...data, _id: result.insertedId },
    "Match",
  );
}

export async function createMatches(inputs: MatchCreate[]): Promise<Match[]> {
  if (inputs.length === 0) {
    return [];
  }
  const data = inputs.map((input) => matchCreateSchema.parse(input));
  const db = await getDb();
  const result = await db.collection(MATCHES_COLLECTION).insertMany(data);
  return data.map((doc, index) =>
    parseDocument(
      matchSchema,
      { ...doc, _id: result.insertedIds[index] },
      "Match",
    ),
  );
}

export async function deleteMatchesForRequest(
  requestId: string | ObjectId,
): Promise<void> {
  const db = await getDb();
  await db.collection(MATCHES_COLLECTION).deleteMany({
    requestId:
      typeof requestId === "string" ? new ObjectId(requestId) : requestId,
  });
}

export async function getMatchById(
  id: string | ObjectId,
): Promise<Match | null> {
  const db = await getDb();
  const doc = await db.collection(MATCHES_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(matchSchema, doc, "Match");
}

export async function listMatches(filter: MatchListFilter): Promise<Match[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {
    requestId:
      typeof filter.requestId === "string"
        ? new ObjectId(filter.requestId)
        : filter.requestId,
  };
  if (filter.selected !== undefined) {
    query.selected = filter.selected;
  }
  const docs = await db
    .collection(MATCHES_COLLECTION)
    .find(query)
    .sort({ score: -1 })
    .toArray();
  return docs.map((doc) => parseDocument(matchSchema, doc, "Match"));
}

/**
 * Mark which companies (and which of their products) the user selected.
 * Unlisted companies are cleared back to selected=false.
 */
export async function applyMatchSelections(
  requestId: string | ObjectId,
  companyIds: string[],
  productIds: string[],
): Promise<Match[]> {
  const matches = await listMatches({ requestId });
  const selectedCompanies = new Set(companyIds);
  const selectedProducts = new Set(productIds);
  const db = await getDb();

  for (const match of matches) {
    const companyKey = match.companyId.toHexString();
    const nextSelected = selectedCompanies.has(companyKey);
    const nextProductIds = match.productIds.filter((id) =>
      selectedProducts.has(id.toHexString()),
    );

    await db.collection(MATCHES_COLLECTION).updateOne(
      { _id: match._id },
      {
        $set: {
          selected: nextSelected,
          productIds: nextProductIds,
        },
      },
    );
  }

  return listMatches({ requestId });
}
