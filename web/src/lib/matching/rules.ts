import type { ServiceType } from "@/lib/db/schemas/service-type";

export type MatchingRequest = {
  service: ServiceType;
};

export type MatchingProfile = {
  state: string;
  deliveryTarget: Date;
};

export type MatchingCompany = {
  id: string;
  name: string;
  services: ServiceType[];
  statesServed: string[];
  leadTimeDays: number;
  rating: number;
};

export type MatchingProduct = {
  id: string;
  companyId: string;
  service: ServiceType;
  inStock: boolean;
};

export type ScoredMatch = {
  companyId: string;
  productIds: string[];
  score: number;
  reasons: string[];
  source: "rules";
  selected: false;
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function canMeetDelivery(
  leadTimeDays: number,
  deliveryTarget: Date,
  asOf: Date,
): boolean {
  const arrival = startOfDay(asOf);
  arrival.setDate(arrival.getDate() + leadTimeDays);
  return arrival.getTime() <= startOfDay(deliveryTarget).getTime();
}

/**
 * Pure rule-based matcher. Companies that do not offer the requested service
 * are excluded. Score is out of 100.
 */
export function scoreMatches(
  request: MatchingRequest,
  profile: MatchingProfile,
  companies: MatchingCompany[],
  products: MatchingProduct[],
  asOf: Date = new Date(),
): ScoredMatch[] {
  const buyerState = profile.state.toUpperCase();
  const results: ScoredMatch[] = [];

  for (const company of companies) {
    if (!company.services.includes(request.service)) {
      continue;
    }

    const companyProducts = products.filter(
      (product) =>
        product.companyId === company.id &&
        product.service === request.service,
    );

    let score = 0;
    const reasons: string[] = [];

    reasons.push(`Offers ${request.service.replaceAll("_", " ")}`);

    const servesState = company.statesServed
      .map((state) => state.toUpperCase())
      .includes(buyerState);
    if (servesState) {
      score += 40;
      reasons.push(`Serves ${buyerState}`);
    }

    const onTime = canMeetDelivery(
      company.leadTimeDays,
      profile.deliveryTarget,
      asOf,
    );
    if (onTime) {
      score += 30;
      reasons.push("Can meet your delivery target");
    }

    const inStockProducts = companyProducts.filter((product) => product.inStock);
    if (inStockProducts.length > 0) {
      score += 20;
      reasons.push("Has in-stock products for this service");
    }

    // Map rating 1–5 onto 0–10 so a perfect company can reach 100.
    const ratingPoints = Math.round((company.rating / 5) * 10);
    score += ratingPoints;
    if (ratingPoints >= 8) {
      reasons.push(`Strong rating (${company.rating}/5)`);
    }

    results.push({
      companyId: company.id,
      productIds: companyProducts.map((product) => product.id),
      score: Math.min(100, score),
      reasons: reasons.slice(0, 3),
      source: "rules",
      selected: false,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
