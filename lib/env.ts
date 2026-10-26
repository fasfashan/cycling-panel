/**
 * Server-only environment access.
 *
 * Reads are lazy and validated at call time (not module load) so the build
 * never fails just because a secret is absent in a given environment.
 * NEVER import this from a client component.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See .env.example and set it in .env.local (or Vercel project settings).`
    );
  }
  return value;
}

export const env = {
  get stravaClientId() {
    return required("STRAVA_CLIENT_ID");
  },
  get stravaClientSecret() {
    return required("STRAVA_CLIENT_SECRET");
  },
  get stravaRefreshToken() {
    return required("STRAVA_REFRESH_TOKEN");
  },
  get stravaWebhookVerifyToken() {
    return required("STRAVA_WEBHOOK_VERIFY_TOKEN");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get syncSecret() {
    return required("SYNC_SECRET");
  },
};
