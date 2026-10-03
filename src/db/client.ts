import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

/**
 * Neon's HTTP driver sends each query as one HTTPS request, with no open connections.
 * It works the same on Cloudflare Workers, Node, and scripts, needs no connection
 * pooling or Hyperdrive, and wakes a sleeping (scaled-to-zero) Neon database
 * automatically. Trade-off: no multi-statement transactions; the code uses
 * single-statement updates, unique constraints, and idempotent upserts instead.
 */
let instance: Database | null = null;

export function db(): Database {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}

export { schema };
