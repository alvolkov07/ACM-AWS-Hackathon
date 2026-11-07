import "server-only";

import { MongoClient, type Db } from "mongodb";

import { env } from "@/lib/env";

import { COMPANIES_COLLECTION } from "./schemas/company";
import { EMAIL_DRAFTS_COLLECTION } from "./schemas/email-draft";
import { MATCHES_COLLECTION } from "./schemas/match";
import { PRODUCTS_COLLECTION } from "./schemas/product";

type GlobalMongo = {
  client: MongoClient | null;
  connectPromise: Promise<MongoClient> | null;
  indexesPromise: Promise<void> | null;
  /** Test-only overrides so mongodb-memory-server can replace the real URI. */
  uriOverride: string | null;
  dbNameOverride: string | null;
};

// Cache the client on globalThis so Next.js hot reload in dev does not open a
// new MongoClient on every file change (which would exhaust connection limits).
const globalForMongo = globalThis as typeof globalThis & {
  __eagleMongo?: GlobalMongo;
};

function getMongoState(): GlobalMongo {
  if (!globalForMongo.__eagleMongo) {
    globalForMongo.__eagleMongo = {
      client: null,
      connectPromise: null,
      indexesPromise: null,
      uriOverride: null,
      dbNameOverride: null,
    };
  }
  return globalForMongo.__eagleMongo;
}

function mongoUri(): string {
  return getMongoState().uriOverride ?? env.MONGODB_URI;
}

function mongoDbName(): string {
  return getMongoState().dbNameOverride ?? env.MONGODB_DB_NAME;
}

async function connectClient(): Promise<MongoClient> {
  const state = getMongoState();
  if (state.client) {
    return state.client;
  }

  if (!state.connectPromise) {
    const client = new MongoClient(mongoUri());
    state.connectPromise = client.connect().then((connected) => {
      state.client = connected;
      return connected;
    });
  }

  return state.connectPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection(COMPANIES_COLLECTION).createIndex({ services: 1 }),
    db.collection(COMPANIES_COLLECTION).createIndex({ statesServed: 1 }),
    db.collection(PRODUCTS_COLLECTION).createIndex({ companyId: 1 }),
    db.collection(MATCHES_COLLECTION).createIndex({ requestId: 1 }),
    db.collection(EMAIL_DRAFTS_COLLECTION).createIndex({ requestId: 1 }),
  ]);
}

/** Returns the shared MongoClient (connected). Prefer getDb() in app code. */
export async function getMongoClient(): Promise<MongoClient> {
  return connectClient();
}

/** Returns the configured app database, creating indexes on first use. */
export async function getDb(): Promise<Db> {
  const client = await connectClient();
  const db = client.db(mongoDbName());

  const state = getMongoState();
  if (!state.indexesPromise) {
    state.indexesPromise = ensureIndexes(db);
  }
  await state.indexesPromise;

  return db;
}

/** Point the shared client at mongodb-memory-server for repository tests. */
export async function connectDbForTests(
  uri: string,
  dbName: string,
): Promise<void> {
  await closeDbForTests();
  const state = getMongoState();
  state.uriOverride = uri;
  state.dbNameOverride = dbName;
}

/** Test helper: wipe the cached client so the next call reconnects. */
export async function closeDbForTests(): Promise<void> {
  const state = getMongoState();
  if (state.client) {
    await state.client.close();
  }
  globalForMongo.__eagleMongo = {
    client: null,
    connectPromise: null,
    indexesPromise: null,
    uriOverride: null,
    dbNameOverride: null,
  };
}
