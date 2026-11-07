import { z } from "zod";

import { objectIdSchema } from "./object-id";
import { serviceTypeSchema } from "./service-type";

export const PRODUCTS_COLLECTION = "products";

export const productSchema = z.object({
  _id: objectIdSchema,
  companyId: objectIdSchema,
  name: z.string().min(1),
  service: serviceTypeSchema,
  unit: z.string().min(1),
  pricePerUnit: z.number().nonnegative(),
  minOrder: z.number().nonnegative(),
  inStock: z.boolean(),
});

export type Product = z.infer<typeof productSchema>;

export const productCreateSchema = productSchema.omit({
  _id: true,
});

export type ProductCreate = z.infer<typeof productCreateSchema>;
