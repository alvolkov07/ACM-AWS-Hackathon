import { z } from "zod";

/** Catalog of agri-supply services the agent can match against. */
export const serviceTypeSchema = z.enum([
  "seeds",
  "fertilizer",
  "irrigation",
  "crop_protection",
  "equipment_rental",
  "harvesting",
  "cold_storage",
  "transport",
  "soil_testing",
]);

export type ServiceType = z.infer<typeof serviceTypeSchema>;

export const SERVICE_TYPES = serviceTypeSchema.options;
