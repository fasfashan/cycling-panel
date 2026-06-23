// Register (or inspect) the Strava webhook subscription.
//
//   node scripts/register-webhook.mjs <your-vercel-url>
//   node scripts/register-webhook.mjs https://pasabersepeda.vercel.app
//
// Run this ONCE after deploying to Vercel. Strava allows only one active
// subscription per app; re-running will show the existing one.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env.local");

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = parseEnv(readFileSync(ENV_PATH, "utf8"));
const CLIENT_ID = env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = env.STRAVA_CLIENT_SECRET;
const VERIFY_TOKEN = env.STRAVA_WEBHOOK_VERIFY_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !VERIFY_TOKEN) {
  console.error("Missing env vars in .env.local (CLIENT_ID / CLIENT_SECRET / WEBHOOK_VERIFY_TOKEN)");
  process.exit(1);
}

const baseUrl = (process.argv[2] ?? "").replace(/\/$/, "");
if (!baseUrl.startsWith("https://")) {
  console.error("Usage: node scripts/register-webhook.mjs <https://your-vercel-url>");
  process.exit(1);
}

const callbackUrl = `${baseUrl}/api/strava/webhook`;

// ── Check existing subscription ──────────────────────────────────────────────
console.log("\nChecking existing Strava webhook subscriptions...");
const listRes = await fetch(
  `https://www.strava.com/api/v3/push_subscriptions?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
);
const existing = await listRes.json();

if (Array.isArray(existing) && existing.length > 0) {
  console.log("\n⚠️  Active subscription already exists:");
  console.log(JSON.stringify(existing, null, 2));
  console.log("\nDelete it first if you want to change the callback URL:");
  console.log(`  curl -X DELETE "https://www.strava.com/api/v3/push_subscriptions/${existing[0].id}?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}"`);
  process.exit(0);
}

// ── Register new subscription ────────────────────────────────────────────────
console.log(`\nRegistering webhook → ${callbackUrl}`);
const body = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  callback_url: callbackUrl,
  verify_token: VERIFY_TOKEN,
});

const res = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
  method: "POST",
  body,
});
const data = await res.json();

if (res.ok) {
  console.log("\n✅ Webhook registered!");
  console.log("   Subscription ID:", data.id);
  console.log("   Callback URL:   ", callbackUrl);
  console.log("\nStrava will now push events to this URL for every new/updated/deleted activity.");
} else {
  console.error("\n❌ Registration failed:", JSON.stringify(data, null, 2));
  process.exit(1);
}
