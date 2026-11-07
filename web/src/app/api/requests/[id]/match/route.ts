import { ObjectId } from "mongodb";

import { getCurrentUser } from "@/lib/auth/current-user";
import { jsonError, jsonOk, serialize } from "@/lib/api/http";
import { getBuyerProfileById } from "@/lib/db/repositories/buyer-profiles";
import { listCompanies } from "@/lib/db/repositories/companies";
import {
  createMatches,
  deleteMatchesForRequest,
} from "@/lib/db/repositories/matches";
import { listProducts } from "@/lib/db/repositories/products";
import {
  getServiceRequestById,
  updateServiceRequestStatus,
} from "@/lib/db/repositories/service-requests";
import { scoreMatches } from "@/lib/matching/rules";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return jsonError("NOT_FOUND", "Service request not found", 404);
  }

  const user = getCurrentUser();
  const serviceRequest = await getServiceRequestById(id, user.userId);
  if (!serviceRequest) {
    return jsonError("NOT_FOUND", "Service request not found", 404);
  }

  const profile = await getBuyerProfileById(
    serviceRequest.buyerProfileId,
    user.userId,
  );
  if (!profile) {
    return jsonError("PROFILE_REQUIRED", "Buyer profile not found", 400);
  }

  await updateServiceRequestStatus(id, user.userId, "matching");

  const companies = await listCompanies({ service: serviceRequest.service });
  const products = await listProducts({ service: serviceRequest.service });

  const scored = scoreMatches(
    { service: serviceRequest.service },
    {
      state: profile.state,
      deliveryTarget: profile.deliveryTarget,
    },
    companies.map((company) => ({
      id: company._id.toHexString(),
      name: company.name,
      services: company.services,
      statesServed: company.statesServed,
      leadTimeDays: company.leadTimeDays,
      rating: company.rating,
    })),
    products.map((product) => ({
      id: product._id.toHexString(),
      companyId: product.companyId.toHexString(),
      service: product.service,
      inStock: product.inStock,
    })),
  );

  await deleteMatchesForRequest(serviceRequest._id);
  const matches = await createMatches(
    scored.map((match) => ({
      requestId: serviceRequest._id,
      companyId: new ObjectId(match.companyId),
      productIds: match.productIds.map((productId) => new ObjectId(productId)),
      score: match.score,
      reasons: match.reasons,
      source: "rules" as const,
      selected: false,
    })),
  );

  await updateServiceRequestStatus(
    id,
    user.userId,
    matches.length > 0 ? "matched" : "draft",
  );

  return jsonOk({ matches: serialize(matches) });
}
