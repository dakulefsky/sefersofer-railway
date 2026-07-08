import { integer, pgEnum, pgTable, text, timestamp, varchar, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin", "gm", "employee"]);
export const booleanStringEnum = pgEnum("boolean_string", ["true", "false"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  archived: booleanStringEnum("archived").default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

export const pages = pgTable("pages", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: varchar("job_id", { length: 64 }).notNull(),
  pageOrder: integer("page_order").notNull(),
  pageLabel: varchar("page_label", { length: 255 }),
  storagePath: text("storage_path"),
  archived: booleanStringEnum("archived").default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;

export const words = pgTable("words", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  pageId: varchar("page_id", { length: 64 }).notNull(),
  wordIndex: integer("word_index").notNull(),
  text: text("text").notNull(),
  confidence: integer("confidence"),
  isFlagged: booleanStringEnum("is_flagged").default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Word = typeof words.$inferSelect;
export type InsertWord = typeof words.$inferInsert;

export const wordCorrections = pgTable("word_corrections", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  wordId: varchar("word_id", { length: 64 }).notNull(),
  userId: uuid("user_id").notNull(),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  isUserMarkedScribble: booleanStringEnum("is_user_marked_scribble").default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WordCorrection = typeof wordCorrections.$inferSelect;
export type InsertWordCorrection = typeof wordCorrections.$inferInsert;

export const letterConfusionPairs = pgTable("letter_confusion_pairs", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id").notNull(),
  jobId: varchar("job_id", { length: 64 }).notNull(),
  originalLetter: varchar("original_letter", { length: 1 }).notNull(),
  correctedLetter: varchar("corrected_letter", { length: 1 }).notNull(),
  count: integer("count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type LetterConfusionPair = typeof letterConfusionPairs.$inferSelect;
export type InsertLetterConfusionPair = typeof letterConfusionPairs.$inferInsert;

export const letterMorphologyVariants = pgTable("letter_morphology_variants", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id").notNull(),
  jobId: varchar("job_id", { length: 64 }).notNull(),
  letter: varchar("letter", { length: 1 }).notNull(),
  morphology: varchar("morphology", { length: 255 }).notNull(),
  context: varchar("context", { length: 255 }),
  count: integer("count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type LetterMorphologyVariant = typeof letterMorphologyVariants.$inferSelect;
export type InsertLetterMorphologyVariant = typeof letterMorphologyVariants.$inferInsert;

export const ocrAccuracyMetrics = pgTable("ocr_accuracy_metrics", {
  id: varchar("id", { length: 64 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id").notNull(),
  jobId: varchar("job_id", { length: 64 }).notNull(),
  pageId: varchar("page_id", { length: 64 }).notNull(),
  totalWords: integer("total_words").notNull(),
  correctWords: integer("correct_words").notNull(),
  accuracy: integer("accuracy").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OcrAccuracyMetric = typeof ocrAccuracyMetrics.$inferSelect;
export type InsertOcrAccuracyMetric = typeof ocrAccuracyMetrics.$inferInsert;
