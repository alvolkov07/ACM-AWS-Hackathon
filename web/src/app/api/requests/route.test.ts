import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createBuyerProfile } from "@/lib/db/repositories/buyer-profiles";
import { setupTestDb, teardownTestDb } from "@/lib/db/test-utils";

import { GET, POST } from "./route";

describe("/api/requests", () => {
  beforeAll(async () => {
    await setupTestDb();
    await createBuyerProfile({
      userId: "dev-user",
      companyName: "Request Co",
      address: "9 Farm Rd",
      state: "OR",
      deliveryTarget: new Date("2026-09-01"),
      defaultService: "seeds",
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates and lists service requests", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "seeds",
          prompt: "Need cover crop seed for 20 acres",
          quantity: 20,
        }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      request: { prompt: string; status: string };
    };
    expect(created.request.prompt).toContain("cover crop");
    expect(created.request.status).toBe("draft");

    const listResponse = await GET();
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      requests: Array<{ prompt: string }>;
    };
    expect(listed.requests.length).toBeGreaterThan(0);
  });

  it("rejects a missing prompt", async () => {
    const response = await POST(
      new Request("http://localhost/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "seeds",
          prompt: "",
        }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
