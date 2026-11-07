import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  EMAIL_DRAFTS_COLLECTION,
  emailDraftCreateSchema,
  emailDraftSchema,
  type EmailDraft,
  type EmailDraftCreate,
  type EmailDraftStatus,
} from "@/lib/db/schemas/email-draft";

export type EmailDraftListFilter = {
  requestId: string | ObjectId;
  status?: EmailDraftStatus;
};

export async function createEmailDraft(
  input: EmailDraftCreate,
): Promise<EmailDraft> {
  const data = emailDraftCreateSchema.parse(input);
  const db = await getDb();
  const result = await db.collection(EMAIL_DRAFTS_COLLECTION).insertOne(data);
  return parseDocument(
    emailDraftSchema,
    { ...data, _id: result.insertedId },
    "EmailDraft",
  );
}

export async function getEmailDraftById(
  id: string | ObjectId,
): Promise<EmailDraft | null> {
  const db = await getDb();
  const doc = await db.collection(EMAIL_DRAFTS_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(emailDraftSchema, doc, "EmailDraft");
}

export async function listEmailDrafts(
  filter: EmailDraftListFilter,
): Promise<EmailDraft[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {
    requestId:
      typeof filter.requestId === "string"
        ? new ObjectId(filter.requestId)
        : filter.requestId,
  };
  if (filter.status) {
    query.status = filter.status;
  }
  const docs = await db
    .collection(EMAIL_DRAFTS_COLLECTION)
    .find(query)
    .sort({ subject: 1 })
    .toArray();
  return docs.map((doc) => parseDocument(emailDraftSchema, doc, "EmailDraft"));
}
