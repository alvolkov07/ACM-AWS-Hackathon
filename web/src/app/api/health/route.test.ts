import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns status ok and an ISO timestamp", async () => {
    const response = await GET();
    const body = (await response.json()) as { status: string; time: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(() => new Date(body.time)).not.toThrow();
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
