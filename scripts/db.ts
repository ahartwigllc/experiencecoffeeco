/** Database connection for command-line scripts. Neon's HTTP driver holds no open connections. */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
config();

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add your Neon connection string to .env.local.");
    process.exit(1);
  }
  return { db: drizzle(neon(url), { schema }), close: async () => {} };
}
