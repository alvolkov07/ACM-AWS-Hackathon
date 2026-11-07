import { MongoClient, ObjectId } from "mongodb";

import {
  COMPANIES_COLLECTION,
  companyCreateSchema,
} from "../src/lib/db/schemas/company";
import {
  PRODUCTS_COLLECTION,
  productCreateSchema,
} from "../src/lib/db/schemas/product";
import { SEED_COMPANIES } from "./seed-data";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example into web/.env.local (or pass --env-file) before seeding.`,
    );
  }
  return value;
}

function plusAddress(base: string, slug: string): string {
  const at = base.indexOf("@");
  if (at <= 0) {
    throw new Error(
      `SEED_CONTACT_EMAIL_BASE must look like name@domain, got: ${base}`,
    );
  }
  return `${base.slice(0, at)}+${slug}${base.slice(at)}`;
}

/** Idempotent catalog seed: clears companies/products, then inserts fictional suppliers. */
export async function seedCatalog(options?: {
  uri?: string;
  dbName?: string;
  emailBase?: string;
}): Promise<{ companies: number; products: number }> {
  const uri = options?.uri ?? requireEnv("MONGODB_URI");
  const dbName = options?.dbName ?? requireEnv("MONGODB_DB_NAME");
  const emailBase =
    options?.emailBase ?? requireEnv("SEED_CONTACT_EMAIL_BASE");

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);

    // Catalog data is owned by this script — clear it so re-runs stay idempotent.
    await db.collection(PRODUCTS_COLLECTION).deleteMany({});
    await db.collection(COMPANIES_COLLECTION).deleteMany({});

    let productCount = 0;
    const now = new Date();

    for (const entry of SEED_COMPANIES) {
      const { emailSlug, products, ...companyFields } = entry;
      const companyInput = companyCreateSchema.parse({
        ...companyFields,
        contactEmail: plusAddress(emailBase, emailSlug),
      });

      const companyId = new ObjectId();
      await db.collection(COMPANIES_COLLECTION).insertOne({
        _id: companyId,
        ...companyInput,
        createdAt: now,
      });

      for (const product of products) {
        const productInput = productCreateSchema.parse({
          ...product,
          companyId,
        });
        await db.collection(PRODUCTS_COLLECTION).insertOne(productInput);
        productCount += 1;
      }
    }

    return { companies: SEED_COMPANIES.length, products: productCount };
  } finally {
    await client.close();
  }
}
