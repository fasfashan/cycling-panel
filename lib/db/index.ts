import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Drizzle client over Neon's HTTP serverless driver — the right fit for
 * Vercel functions (no persistent TCP pool to babysit). Created lazily so
 * the build never touches DATABASE_URL.
 */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const sql = neon(env.databaseUrl);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export { schema };
