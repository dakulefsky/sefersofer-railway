import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// Define Postgres Enums instead of MySQL Enums
export const roleEnum = pgEnum("role", ["user", "admin", "gm", "employee"]);
export const booleanStringEnum = pgEnum("boolean_string", ["true", "false"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  archived: booleanStringEnum("archived").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

export const pages = pgTable("pages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  pageOrder: integer("pageOrder").notNull(),
  pageLabel: varchar("pageLabel", { length: 255 }),
  imageUrl: text("imageUrl"),
  archived: booleanStringEnum("archived").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;

export const words = pgTable("words", {
  id: varchar("id", { length: 64 }).primaryKey(),
  pageId: varchar("pageId", { length: 64 }).notNull(),
  wordIndex: integer("wordIndex").notNull(),
  text: text("text").notNull(),
  confidence: integer("confidence"),
  isFlagged: booleanStringEnum("isFlagged").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Word = typeof words.$inferSelect;
export type InsertWord = typeof words.$inferInsert;

export const wordCorrections = pgTable("wordCorrections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  wordId: varchar("wordId", { length: 64 }).notNull(),
  userId: integer("userId").notNull(),
  originalText: text("originalText").notNull(),
  correctedText: text("correctedText").notNull(),
  isUserMarkedScribble: booleanStringEnum("isUserMarkedScribble").default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WordCorrection = typeof wordCorrections.$inferSelect;
export type InsertWordCorrection = typeof wordCorrections.$inferInsert;

export const letterConfusionPairs = pgTable("letterConfusionPairs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  originalLetter: varchar("originalLetter", { length: 1 }).notNull(),
  correctedLetter: varchar("correctedLetter", { length: 1 }).notNull(),
  count: integer("count").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LetterConfusionPair = typeof letterConfusionPairs.$inferSelect;
export type InsertLetterConfusionPair = typeof letterConfusionPairs.$inferInsert;

export const letterMorphologyVariants = pgTable("letterMorphologyVariants", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  letter: varchar("letter", { length: 1 }).notNull(),
  morphology: varchar("morphology", { length: 255 }).notNull(),
  context: varchar("context", { length: 255 }),
  count: integer("count").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LetterMorphologyVariant = typeof letterMorphologyVariants.$inferSelect;
export type InsertLetterMorphologyVariant = typeof letterMorphologyVariants.$inferInsert;

export const ocrAccuracyMetrics = pgTable("ocrAccuracyMetrics", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  pageId: varchar("pageId", { length: 64 }).notNull(),
  totalWords: integer("totalWords").notNull(),
  correctWords: integer("correctWords").notNull(),
  accuracy: integer("accuracy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OcrAccuracyMetric = typeof ocrAccuracyMetrics.$inferSelect;
export type InsertOcrAccuracyMetric = typeof ocrAccuracyMetrics.$inferInsert;
