/**
 * Drops the app database, then re-seeds the supplier catalog.
 * Run: npm run reset-db (from web/) or make reset-db (from repo root).
 */
import { MongoClient } from "mongodb";

import { seedCatalog } from "./seed-catalog";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example into web/.env.local (or pass --env-file) before reset-db.`,
    );
  }
  return value;
}

async function main() {
  const uri = requireEnv("MONGODB_URI");
  const dbName = requireEnv("MONGODB_DB_NAME");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    await client.db(dbName).dropDatabase();
    console.log(`Dropped database "${dbName}".`);
  } finally {
    await client.close();
  }

  const result = await seedCatalog({ uri, dbName });
  console.log(
    `Reset complete: ${result.companies} companies, ${result.products} products.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
