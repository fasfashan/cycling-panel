import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load local secrets for CLI commands (db:push / db:studio).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
