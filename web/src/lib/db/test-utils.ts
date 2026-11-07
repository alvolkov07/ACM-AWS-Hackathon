import { MongoMemoryServer } from "mongodb-memory-server";

import { closeDbForTests, connectDbForTests } from "@/lib/db/client";

let memoryServer: MongoMemoryServer | null = null;

/** Start an in-memory MongoDB and wire getDb() to it. */
export async function setupTestDb(): Promise<void> {
  memoryServer = await MongoMemoryServer.create();
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
