import { z } from "zod";

import { objectIdSchema, usStateCodeSchema } from "./object-id";
import { serviceTypeSchema } from "./service-type";

export const COMPANIES_COLLECTION = "companies";

export const companySchema = z.object({
  _id: objectIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  services: z.array(serviceTypeSchema).min(1),
  statesServed: z.array(usStateCodeSchema).min(1),
  contactEmail: z.email(),
  contactName: z.string().min(1),
  leadTimeDays: z.number().int().nonnegative(),
  rating: z.number().min(1).max(5),
  createdAt: z.coerce.date(),
});

export type Company = z.infer<typeof companySchema>;

export const companyCreateSchema = companySchema.omit({
  _id: true,
  createdAt: true,
});

export type CompanyCreate = z.infer<typeof companyCreateSchema>;
