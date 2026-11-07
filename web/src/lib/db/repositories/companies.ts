import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  COMPANIES_COLLECTION,
  companyCreateSchema,
  companySchema,
  type Company,
  type CompanyCreate,
} from "@/lib/db/schemas/company";
import type { ServiceType } from "@/lib/db/schemas/service-type";

export type CompanyListFilter = {
  service?: ServiceType;
  state?: string;
};

export async function createCompany(input: CompanyCreate): Promise<Company> {
  const data = companyCreateSchema.parse(input);
  const db = await getDb();
  const doc = {
    ...data,
    createdAt: new Date(),
  };
  const result = await db
    .collection(COMPANIES_COLLECTION)
    .insertOne(doc);
  return parseDocument(
    companySchema,
    { ...doc, _id: result.insertedId },
    "Company",
  );
}

export async function getCompanyById(
  id: string | ObjectId,
): Promise<Company | null> {
  const db = await getDb();
  const doc = await db.collection(COMPANIES_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(companySchema, doc, "Company");
}

export async function listCompanies(
  filter: CompanyListFilter = {},
): Promise<Company[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter.service) {
    query.services = filter.service;
  }
  if (filter.state) {
    query.statesServed = filter.state.toUpperCase();
  }
  const docs = await db
    .collection(COMPANIES_COLLECTION)
    .find(query)
    .sort({ rating: -1, name: 1 })
    .toArray();
  return docs.map((doc) => parseDocument(companySchema, doc, "Company"));
}
