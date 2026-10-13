import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const appUrl = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? vercelUrl;

export const auth = betterAuth({
  appName: "Show Events",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET ?? "show-events-local-demo-secret-change-me",
  database: prisma
    ? prismaAdapter(prisma, {
        provider: "postgresql",
      })
    : undefined,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  advanced: {
    database: {
      joins: true,
    },
  },
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.NEXT_PUBLIC_APP_URL ?? "",
    process.env.BETTER_AUTH_URL ?? "",
    vercelUrl ?? "",
  ].filter(Boolean),
});
