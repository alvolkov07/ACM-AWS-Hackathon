import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Next.js replaces this package at build time; Vitest needs a no-op stub.
vi.mock("server-only", () => ({}));

// env.ts validates at import time — placeholders are fine for unit tests.
// Repository tests override the real connection via connectDbForTests().
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/?replicaSet=rs0";
process.env.MONGODB_DB_NAME ??= "agri_supply_test";
process.env.AUTH_MODE ??= "dev";
process.env.AI_MODE ??= "mock";
process.env.EMAIL_MODE ??= "log";
process.env.AWS_REGION ??= "us-west-2";
