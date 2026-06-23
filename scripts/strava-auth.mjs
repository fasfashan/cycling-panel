// One-time Strava OAuth helper (single-user).
//
// Starts a tiny local server, prints an authorize URL for you to open, catches
// the redirect, exchanges the code for tokens, and writes the new (correctly
// scoped) refresh token back into .env.local.
//
//   node scripts/strava-auth.mjs
//
// Strava app setting required: "Authorization Callback Domain" = localhost

import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", ".env.local");
const PORT = 8721;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPE = "read,activity:read_all";

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const raw = readFileSync(ENV_PATH, "utf8");
const env = parseEnv(raw);
const CLIENT_ID = env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = env.STRAVA_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const authorizeUrl =
  "https://www.strava.com/oauth/authorize?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    approval_prompt: "force",
    scope: SCOPE,
  });

function patchRefreshToken(token) {
  const next = raw.replace(
    /^STRAVA_REFRESH_TOKEN=.*$/m,
    `STRAVA_REFRESH_TOKEN=${token}`
  );
  writeFileSync(ENV_PATH, next, "utf8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end("not found");
    return;
  }

  const error = url.searchParams.get("error");
  if (error) {
    res.writeHead(400).end(`Authorization failed: ${error}`);
    console.error("\n❌ Authorization denied:", error);
    server.close();
    process.exit(1);
  }

  const code = url.searchParams.get("code");
  const grantedScope = url.searchParams.get("scope") ?? "";

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      }),
    });
    const data = await tokenRes.json();

    if (!data.refresh_token) {
      res.writeHead(500).end("Token exchange failed. Check the terminal.");
      console.error("\n❌ Token exchange failed:", JSON.stringify(data));
      server.close();
      process.exit(1);
    }

    patchRefreshToken(data.refresh_token);

    res
      .writeHead(200, { "Content-Type": "text/html" })
      .end(
        "<h2>✅ Done. Refresh token saved to .env.local.</h2>" +
          "<p>You can close this tab and return to the terminal.</p>"
      );

    console.log("\n✅ Success!");
    console.log("   Granted scope:", grantedScope);
    console.log("   Refresh token written to .env.local");
    if (!grantedScope.includes("activity:read_all")) {
      console.log(
        "\n⚠️  activity:read_all was NOT granted — re-run and tick the box."
      );
    }
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500).end("Error: " + e.message);
    console.error(e);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("\n🔑 Strava OAuth helper running.");
  console.log("\n→ Open this URL in your browser and click Authorize:\n");
  console.log(authorizeUrl.toString());
  console.log("\n(Waiting for the redirect on " + REDIRECT_URI + " ...)\n");
});
