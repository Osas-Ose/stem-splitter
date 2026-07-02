import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Audio tracks table - stores uploaded audio files and their metadata
 */
export const tracks = mysqlTable("tracks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  artist: varchar("artist", { length: 255 }),
  fileSize: int("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  duration: int("duration").default(0), // in seconds
  status: mysqlEnum("status", ["uploaded", "processing", "completed", "failed"]).default("uploaded"),
  isFavorite: boolean("isFavorite").default(false),
  fileUrl: varchar("fileUrl", { length: 1024 }), // S3 URL
  separationJobId: varchar("separationJobId", { length: 255 }), // Replicate prediction ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;

/**
 * Separated stems table - stores individual audio stems (vocals, drums, bass, etc.)
 */
export const stems = mysqlTable("stems", {
  id: int("id").autoincrement().primaryKey(),
  trackId: int("trackId").notNull(),
  stemType: mysqlEnum("stemType", ["vocals", "drums", "bass", "piano", "guitar", "other", "master"]),
  fileUrl: varchar("fileUrl", { length: 1024 }), // S3 URL
  fileSize: int("fileSize").default(0),
  duration: int("duration").default(0), // in seconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Stem = typeof stems.$inferSelect;
export type InsertStem = typeof stems.$inferInsert;

/**
 * Mix presets table - stores user-created mixing presets
 */
export const mixPresets = mysqlTable("mixPresets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trackId: int("trackId").notNull(),
  presetName: varchar("presetName", { length: 255 }).notNull(),
  stemLevels: json("stemLevels"), // JSON object with stem volumes
  panValues: json("panValues"), // JSON object with pan values (optional)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MixPreset = typeof mixPresets.$inferSelect;
export type InsertMixPreset = typeof mixPresets.$inferInsert;
