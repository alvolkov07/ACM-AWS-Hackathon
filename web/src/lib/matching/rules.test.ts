import { describe, expect, it } from "vitest";

import { scoreMatches, type MatchingCompany, type MatchingProduct } from "./rules";

const asOf = new Date("2026-03-01T12:00:00.000Z");
const deliveryTarget = new Date("2026-03-20T00:00:00.000Z");

const baseCompany: MatchingCompany = {
  id: "c1",
  name: "In-state Co",
  services: ["irrigation"],
  statesServed: ["CA"],
  leadTimeDays: 5,
  rating: 4,
};

const baseProduct: MatchingProduct = {
  id: "p1",
  companyId: "c1",
  service: "irrigation",
  inStock: true,
};

describe("scoreMatches", () => {
  it("returns no matches when no company offers the service", () => {
    const scored = scoreMatches(
      { service: "irrigation" },
      { state: "CA", deliveryTarget },
      [
        {
          ...baseCompany,
          services: ["seeds"],
        },
      ],
      [baseProduct],
      asOf,
    );
    expect(scored).toEqual([]);
  });

  it("scores out-of-state companies without the state bonus", () => {
    const scored = scoreMatches(
      { service: "irrigation" },
      { state: "CA", deliveryTarget },
      [
        {
          ...baseCompany,
          id: "out",
          statesServed: ["OR"],
        },
      ],
      [{ ...baseProduct, companyId: "out" }],
      asOf,
    );

    expect(scored).toHaveLength(1);
    expect(scored[0]?.score).toBe(30 + 20 + Math.round((4 / 5) * 10));
    expect(scored[0]?.reasons.join(" ")).not.toContain("Serves CA");
  });

  it("omits the delivery bonus when lead time is too late", () => {
    const scored = scoreMatches(
      { service: "irrigation" },
      { state: "CA", deliveryTarget },
      [
        {
          ...baseCompany,
          leadTimeDays: 60,
        },
      ],
      [baseProduct],
      asOf,
    );

    expect(scored).toHaveLength(1);
    expect(scored[0]?.score).toBe(40 + 20 + Math.round((4 / 5) * 10));
    expect(scored[0]?.reasons.join(" ")).not.toContain("delivery target");
  });

  it("can reach 100 for a perfect in-state, on-time, in-stock, 5-star company", () => {
    const scored = scoreMatches(
      { service: "irrigation" },
      { state: "CA", deliveryTarget },
      [
        {
          ...baseCompany,
          rating: 5,
        },
      ],
      [baseProduct],
      asOf,
    );

    expect(scored[0]?.score).toBe(100);
    expect(scored[0]?.reasons.length).toBeGreaterThanOrEqual(1);
    expect(scored[0]?.reasons.length).toBeLessThanOrEqual(3);
  });
});
