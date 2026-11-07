import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  SERVICE_REQUESTS_COLLECTION,
  serviceRequestCreateSchema,
  serviceRequestSchema,
  type ServiceRequest,
  type ServiceRequestCreate,
  type ServiceRequestStatus,
} from "@/lib/db/schemas/service-request";

export type ServiceRequestListFilter = {
  userId: string;
  status?: ServiceRequestStatus;
};

export async function createServiceRequest(
  input: ServiceRequestCreate,
): Promise<ServiceRequest> {
  const data = serviceRequestCreateSchema.parse(input);
  const db = await getDb();
  // Omit unset quantity so Mongo does not persist null for an optional field.
  const doc = {
    userId: data.userId,
    buyerProfileId: data.buyerProfileId,
    service: data.service,
    prompt: data.prompt,
    notes: data.notes,
    status: data.status,
    ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
    createdAt: new Date(),
  };
  const result = await db
    .collection(SERVICE_REQUESTS_COLLECTION)
    .insertOne(doc);
  return parseDocument(
    serviceRequestSchema,
    { ...doc, _id: result.insertedId },
    "ServiceRequest",
  );
}

export async function getServiceRequestById(
  id: string | ObjectId,
  userId: string,
): Promise<ServiceRequest | null> {
  const db = await getDb();
  const doc = await db.collection(SERVICE_REQUESTS_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
    userId,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(serviceRequestSchema, doc, "ServiceRequest");
}

export async function listServiceRequests(
  filter: ServiceRequestListFilter,
): Promise<ServiceRequest[]> {
  const db = await getDb();
  const query: Record<string, unknown> = { userId: filter.userId };
  if (filter.status) {
    query.status = filter.status;
  }
  const docs = await db
    .collection(SERVICE_REQUESTS_COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) =>
    parseDocument(serviceRequestSchema, doc, "ServiceRequest"),
  );
}

export async function updateServiceRequestStatus(
  id: string | ObjectId,
  userId: string,
  status: ServiceRequestStatus,
): Promise<ServiceRequest | null> {
  const db = await getDb();
  const objectId = typeof id === "string" ? new ObjectId(id) : id;
  const result = await db.collection(SERVICE_REQUESTS_COLLECTION).findOneAndUpdate(
    { _id: objectId, userId },
    { $set: { status } },
    { returnDocument: "after" },
  );
  if (!result) {
    return null;
  }
  return parseDocument(serviceRequestSchema, result, "ServiceRequest");
}
