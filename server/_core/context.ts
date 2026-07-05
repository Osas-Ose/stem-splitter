import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Ensure dev user exists in the database
async function getOrCreateDevUser(): Promise<User> {
  const db = await getDb();
  if (!db) {
    return {
      id: 1,
      openId: "dev-user",
      name: "Dev User",
      email: "dev@stemsplitter.app",
      role: "user" as any,
      loginMethod: "dev",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.openId, "dev-user"))
    .limit(1);

  if (existing.length > 0) return existing[0] as User;

  await db.insert(users).values({
    openId: "dev-user",
    name: "Dev User",
    email: "dev@stemsplitter.app",
    role: "user" as any,
    loginMethod: "dev",
  });

  const created = await db
    .select()
    .from(users)
    .where(eq(users.openId, "dev-user"))
    .limit(1);

  return created[0] as User;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      user = await getOrCreateDevUser();
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