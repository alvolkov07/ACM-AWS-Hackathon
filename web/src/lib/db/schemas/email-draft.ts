import { z } from "zod";

import { objectIdSchema } from "./object-id";

export const EMAIL_DRAFTS_COLLECTION = "email_drafts";

export const emailDraftStatusSchema = z.enum([
  "draft",
  "approved",
  "sent",
  "failed",
]);

export type EmailDraftStatus = z.infer<typeof emailDraftStatusSchema>;

export const emailDraftSchema = z.object({
  _id: objectIdSchema,
  requestId: objectIdSchema,
  companyId: objectIdSchema,
  to: z.email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  status: emailDraftStatusSchema,
  approvedAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
  sesMessageId: z.string().optional(),
  error: z.string().optional(),
});

export type EmailDraft = z.infer<typeof emailDraftSchema>;

export const emailDraftCreateSchema = emailDraftSchema.omit({
  _id: true,
});

export type EmailDraftCreate = z.infer<typeof emailDraftCreateSchema>;
