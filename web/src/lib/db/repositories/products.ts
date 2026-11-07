import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  PRODUCTS_COLLECTION,
  productCreateSchema,
  productSchema,
  type Product,
  type ProductCreate,
} from "@/lib/db/schemas/product";
import type { ServiceType } from "@/lib/db/schemas/service-type";

export type ProductListFilter = {
  companyId?: string | ObjectId;
  service?: ServiceType;
  inStock?: boolean;
};

export async function createProduct(input: ProductCreate): Promise<Product> {
  const data = productCreateSchema.parse(input);
  const db = await getDb();
  const result = await db.collection(PRODUCTS_COLLECTION).insertOne(data);
  return parseDocument(
    productSchema,
    { ...data, _id: result.insertedId },
    "Product",
  );
}

export async function getProductById(
  id: string | ObjectId,
): Promise<Product | null> {
  const db = await getDb();
  const doc = await db.collection(PRODUCTS_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(productSchema, doc, "Product");
}

export async function listProducts(
  filter: ProductListFilter = {},
): Promise<Product[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter.companyId) {
    query.companyId =
      typeof filter.companyId === "string"
        ? new ObjectId(filter.companyId)
        : filter.companyId;
  }
  if (filter.service) {
    query.service = filter.service;
  }
  if (filter.inStock !== undefined) {
    query.inStock = filter.inStock;
  }
  const docs = await db
    .collection(PRODUCTS_COLLECTION)
    .find(query)
    .sort({ name: 1 })
    .toArray();
  return docs.map((doc) => parseDocument(productSchema, doc, "Product"));
}
