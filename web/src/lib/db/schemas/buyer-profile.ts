import { z } from "zod";

import { objectIdSchema, usStateCodeSchema } from "./object-id";
import { serviceTypeSchema } from "./service-type";

export const BUYER_PROFILES_COLLECTION = "buyer_profiles";

export const buyerProfileSchema = z.object({
  _id: objectIdSchema,
  userId: z.string().min(1),
  companyName: z.string().min(1),
  address: z.string().min(1),
  state: usStateCodeSchema,
  deliveryTarget: z.coerce.date(),
  defaultService: serviceTypeSchema,
  createdAt: z.coerce.date(),
});

export type BuyerProfile = z.infer<typeof buyerProfileSchema>;

export const buyerProfileCreateSchema = buyerProfileSchema.omit({
  _id: true,
  createdAt: true,
});

export type BuyerProfileCreate = z.infer<typeof buyerProfileCreateSchema>;
