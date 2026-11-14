// Sign-in without a password: a 6-digit code by email, and the same email
// carries a link that fills the code in. Sessions last 90 days.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import * as authSchema from "./db/auth-schema";

// The site's own address. Set BETTER_AUTH_URL on Railway; on Vercel it is worked out.
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);

export const auth = betterAuth({
  baseURL,
  // Vercel also serves each build at its own address; sign-in must work there too.
  trustedOrigins: process.env.VERCEL ? ["https://*.vercel.app"] : [],
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  session: { expiresIn: 60 * 60 * 24 * 90, updateAge: 60 * 60 * 24 },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      // Codes are created and sent by the club-aware sign-in action
      // (app/[club]/actions.ts), so the public send route does nothing.
      async sendVerificationOTP() {},
    }),
    nextCookies(), // keep last
  ],
});
