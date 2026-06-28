import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  role: mysqlEnum("role", ["user", "admin", "gm", "employee"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Jobs table: represents a transcription project/batch
 */
export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  archived: mysqlEnum("archived", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Pages table: individual pages within a job
 */
export const pages = mysqlTable("pages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  pageOrder: int("pageOrder").notNull(),
  pageLabel: varchar("pageLabel", { length: 255 }),
  imageUrl: text("imageUrl"),
  archived: mysqlEnum("archived", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;

/**
 * Words table: individual words transcribed from a page
 */
export const words = mysqlTable("words", {
  id: varchar("id", { length: 64 }).primaryKey(),
  pageId: varchar("pageId", { length: 64 }).notNull(),
  wordIndex: int("wordIndex").notNull(),
  text: text("text").notNull(),
  confidence: int("confidence"), // 0-100 percentage
  isFlagged: mysqlEnum("isFlagged", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Word = typeof words.$inferSelect;
export type InsertWord = typeof words.$inferInsert;

/**
 * Word corrections table: tracks corrections made by users
 */
export const wordCorrections = mysqlTable("wordCorrections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  wordId: varchar("wordId", { length: 64 }).notNull(),
  userId: int("userId").notNull(),
  originalText: text("originalText").notNull(),
  correctedText: text("correctedText").notNull(),
  isUserMarkedScribble: mysqlEnum("isUserMarkedScribble", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WordCorrection = typeof wordCorrections.$inferSelect;
export type InsertWordCorrection = typeof wordCorrections.$inferInsert;

/**
 * Letter confusion pairs: tracks which letters are confused
 */
export const letterConfusionPairs = mysqlTable("letterConfusionPairs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  originalLetter: varchar("originalLetter", { length: 1 }).notNull(),
  correctedLetter: varchar("correctedLetter", { length: 1 }).notNull(),
  count: int("count").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LetterConfusionPair = typeof letterConfusionPairs.$inferSelect;
export type InsertLetterConfusionPair = typeof letterConfusionPairs.$inferInsert;

/**
 * Letter morphology variants: tracks visual patterns of letters
 */
export const letterMorphologyVariants = mysqlTable("letterMorphologyVariants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  letter: varchar("letter", { length: 1 }).notNull(),
  morphology: varchar("morphology", { length: 255 }).notNull(), // e.g., "swirly", "looped"
  context: varchar("context", { length: 255 }), // e.g., "initial", "middle", "final"
  count: int("count").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LetterMorphologyVariant = typeof letterMorphologyVariants.$inferSelect;
export type InsertLetterMorphologyVariant = typeof letterMorphologyVariants.$inferInsert;

/**
 * OCR accuracy metrics: tracks accuracy over time
 */
export const ocrAccuracyMetrics = mysqlTable("ocrAccuracyMetrics", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  pageId: varchar("pageId", { length: 64 }).notNull(),
  totalWords: int("totalWords").notNull(),
  correctWords: int("correctWords").notNull(),
  accuracy: int("accuracy").notNull(), // 0-100 percentage
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OcrAccuracyMetric = typeof ocrAccuracyMetrics.$inferSelect;
export type InsertOcrAccuracyMetric = typeof ocrAccuracyMetrics.$inferInsert;