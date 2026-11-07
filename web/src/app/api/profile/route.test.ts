import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { GET, POST } from "./route";

describe("/api/profile", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and reads a buyer profile", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: "Valley Farms",
          address: "1 Main St",
          state: "ca",
          deliveryTarget: "2026-08-01",
        }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      profile: { companyName: string; state: string };
    };
    expect(created.profile.companyName).toBe("Valley Farms");
    expect(created.profile.state).toBe("CA");

    const getResponse = await GET();
    expect(getResponse.status).toBe(200);
    const body = (await getResponse.json()) as {
      profile: { companyName: string };
    };
    expect(body.profile.companyName).toBe("Valley Farms");
  });

  it("rejects invalid profile input", async () => {
    const response = await POST(
      new Request("http://localhost/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: "",
          address: "1 Main St",
          state: "California",
          deliveryTarget: "2026-08-01",
        }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
