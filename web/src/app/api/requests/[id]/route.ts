import { ObjectId } from "mongodb";

import { getCurrentUser } from "@/lib/auth/current-user";
import { jsonError, jsonOk, serialize } from "@/lib/api/http";
import { getServiceRequestById } from "@/lib/db/repositories/service-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return jsonError("NOT_FOUND", "Service request not found", 404);
  }

  const user = getCurrentUser();
  const serviceRequest = await getServiceRequestById(id, user.userId);
  if (!serviceRequest) {
    return jsonError("NOT_FOUND", "Service request not found", 404);
  }

  return jsonOk({ request: serialize(serviceRequest) });
}
