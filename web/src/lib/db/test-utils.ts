import { MongoMemoryServer } from "mongodb-memory-server";

import { closeDbForTests, connectDbForTests } from "@/lib/db/client";

let memoryServer: MongoMemoryServer | null = null;

/** Start an in-memory MongoDB and wire getDb() to it. */
export async function setupTestDb(): Promise<void> {
  // Pin to 7.x to match docker-compose mongo:7 (DocumentDB-compatible surface).
  memoryServer = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
  });
  await connectDbForTests(memoryServer.getUri(), "agri_supply_test");
}

/** Stop the in-memory server and clear the shared client cache. */
export async function teardownTestDb(): Promise<void> {
  await closeDbForTests();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
