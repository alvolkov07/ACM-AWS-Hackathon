import { z } from "zod";

import { objectIdSchema } from "./object-id";
import { serviceTypeSchema } from "./service-type";

export const SERVICE_REQUESTS_COLLECTION = "service_requests";

export const serviceRequestStatusSchema = z.enum([
  "draft",
  "matching",
  "matched",
  "contacting",
  "done",
]);

export type ServiceRequestStatus = z.infer<typeof serviceRequestStatusSchema>;

/** Mongo often stores missing optionals as null; treat that as "unset". */
const optionalPositiveNumber = z.preprocess(
  (value) => (value === null || value === undefined ? undefined : value),
  z.number().positive().optional(),
);

export const serviceRequestSchema = z.object({
  _id: objectIdSchema,
  userId: z.string().min(1),
  buyerProfileId: objectIdSchema,
  service: serviceTypeSchema,
  prompt: z.string().min(1),
  quantity: optionalPositiveNumber,
  notes: z.string(),
  status: serviceRequestStatusSchema,
  createdAt: z.coerce.date(),
});

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;

export const serviceRequestCreateSchema = serviceRequestSchema.omit({
  _id: true,
  createdAt: true,
});

export type ServiceRequestCreate = z.infer<typeof serviceRequestCreateSchema>;
