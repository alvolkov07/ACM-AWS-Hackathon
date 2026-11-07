/**
 * Idempotent catalog seed for local demos.
 * Run: npm run seed (from web/) or make seed (from repo root).
 */
import { seedCatalog } from "./seed-catalog";

async function main() {
  const result = await seedCatalog();
  console.log(
    `Seed complete: ${result.companies} companies, ${result.products} products.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
