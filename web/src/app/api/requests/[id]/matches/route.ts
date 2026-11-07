import { ObjectId } from "mongodb";
import { ZodError, z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { jsonError, jsonFromZodError, jsonOk, serialize } from "@/lib/api/http";
import { getCompanyById } from "@/lib/db/repositories/companies";
import {
  applyMatchSelections,
  listMatches,
} from "@/lib/db/repositories/matches";
import { listProducts } from "@/lib/db/repositories/products";
import { getServiceRequestById } from "@/lib/db/repositories/service-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const patchBodySchema = z.object({
  companyIds: z.array(z.string().min(1)),
  productIds: z.array(z.string().min(1)),
});

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

  const matches = await listMatches({ requestId: serviceRequest._id });
  const enriched = [];

  for (const match of matches) {
    const company = await getCompanyById(match.companyId);
    const products = await listProducts({
      companyId: match.companyId,
      service: serviceRequest.service,
    });
    const selectedProductIds = new Set(
      match.productIds.map((productId) => productId.toHexString()),
    );

    enriched.push({
      ...match,
      company,
      products: products.map((product) => ({
        ...product,
        checked: match.selected && selectedProductIds.has(product._id.toHexString()),
      })),
    });
  }

  return jsonOk({ matches: serialize(enriched) });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    const user = getCurrentUser();
    const serviceRequest = await getServiceRequestById(id, user.userId);
    if (!serviceRequest) {
      return jsonError("NOT_FOUND", "Service request not found", 404);
    }

    const body = patchBodySchema.parse(await request.json());
    const matches = await applyMatchSelections(
      serviceRequest._id,
      body.companyIds,
      body.productIds,
    );

    return jsonOk({ matches: serialize(matches) });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonFromZodError(error);
    }
    throw error;
  }
}
