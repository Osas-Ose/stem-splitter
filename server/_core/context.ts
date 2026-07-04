import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Dev bypass user — only used when NODE_ENV=development and auth fails
const DEV_USER: User = {
  id: 1,
  openId: "dev-user",
  name: "Dev User",
  email: "dev@stemsplitter.app",
  role: "user",
  loginMethod: "dev",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // In development, use a bypass user so you can test without OAuth
    if (process.env.NODE_ENV === "development") {
      user = DEV_USER;
    } else {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}