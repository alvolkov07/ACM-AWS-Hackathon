import { ZodError, z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { jsonError, jsonFromZodError, jsonOk, serialize } from "@/lib/api/http";
import { getBuyerProfileForUser } from "@/lib/db/repositories/buyer-profiles";
import {
  createServiceRequest,
  listServiceRequests,
} from "@/lib/db/repositories/service-requests";
import { serviceTypeSchema } from "@/lib/db/schemas/service-type";

const createRequestBodySchema = z.object({
  service: serviceTypeSchema,
  prompt: z.string().min(1),
  quantity: z.preprocess(
    (value) => (value === null || value === undefined ? undefined : value),
    z.number().positive().optional(),
  ),
  notes: z.string().optional(),
});

export async function GET() {
  const user = getCurrentUser();
  const requests = await listServiceRequests({ userId: user.userId });
  return jsonOk({ requests: serialize(requests) });
}

export async function POST(request: Request) {
  try {
    const user = getCurrentUser();
    const profile = await getBuyerProfileForUser(user.userId);
    if (!profile) {
      return jsonError(
        "PROFILE_REQUIRED",
        "Create a buyer profile before opening a request",
        400,
      );
    }

    const body = createRequestBodySchema.parse(await request.json());
    const created = await createServiceRequest({
      userId: user.userId,
      buyerProfileId: profile._id,
      service: body.service,
      prompt: body.prompt,
      quantity: body.quantity,
      notes: body.notes ?? "",
      status: "draft",
    });
    return jsonOk({ request: serialize(created) }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error);
    }
    throw error;
  }
}
