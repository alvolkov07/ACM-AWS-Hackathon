import { ZodError, z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { jsonError, jsonFromZodError, jsonOk, serialize } from "@/lib/api/http";
import {
  createBuyerProfile,
  getBuyerProfileForUser,
} from "@/lib/db/repositories/buyer-profiles";
import { usStateCodeSchema } from "@/lib/db/schemas/object-id";

const createProfileBodySchema = z.object({
  companyName: z.string().min(1),
  address: z.string().min(1),
  state: usStateCodeSchema,
  deliveryTarget: z.coerce.date(),
});

export async function GET() {
  const user = getCurrentUser();
  const profile = await getBuyerProfileForUser(user.userId);
  if (!profile) {
    return jsonError("NOT_FOUND", "Buyer profile not found", 404);
  }
  return jsonOk({ profile: serialize(profile) });
}

export async function POST(request: Request) {
  try {
    const body = createProfileBodySchema.parse(await request.json());
    const user = getCurrentUser();
    const existing = await getBuyerProfileForUser(user.userId);
    if (existing) {
      return jsonError(
        "CONFLICT",
        "A buyer profile already exists for this user",
        409,
      );
    }

    const profile = await createBuyerProfile({
      userId: user.userId,
      ...body,
    });
    return jsonOk({ profile: serialize(profile) }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error);
    }
    throw error;
  }
}
