import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const pageStatusEnum = pgEnum("page_status", [
  "pending",
  "processing",
  "transcribed",
  "reviewed",
]);

// ─── Jobs ─────────────────────────────────────────────────────────────────────
// A "job" is a transcription project (e.g. a notebook, a letter collection)

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(), // Supabase Auth UUID (text)
  name: text("name").notNull(),
  description: text("description"),
  status: jobStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ─── Pages ────────────────────────────────────────────────────────────────────
// A "page" is a single manuscript image within a job

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull().default(1),
  label: text("label"),
  imageUrl: text("image_url"),          // Supabase Storage URL
  storagePath: text("storage_path"),    // e.g. "userId/jobId/pageId.jpg"
  status: pageStatusEnum("status").default("pending").notNull(),
  wordCount: integer("word_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;

// ─── Text Regions ─────────────────────────────────────────────────────────────
// A region is a logical section of a page (main body, margin, interlinear note)

export const textRegions = pgTable("text_regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  regionType: text("region_type").notNull().default("main"), // main | margin_right | margin_left | interlinear
  regionOrder: integer("region_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TextRegion = typeof textRegions.$inferSelect;

// ─── Words ────────────────────────────────────────────────────────────────────
// Individual words extracted by OCR

export const words = pgTable("words", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  regionId: uuid("region_id").references(() => textRegions.id, { onDelete: "set null" }),
  wordIndex: integer("word_index").notNull(),
  text: text("text").notNull(),
  confidence: real("confidence"),       // 0.0 – 1.0
  isFlagged: boolean("is_flagged").default(false).notNull(),
  isScribble: boolean("is_scribble").default(false).notNull(),
  isInsertion: boolean("is_insertion").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Word = typeof words.$inferSelect;
export type InsertWord = typeof words.$inferInsert;

// ─── Word Corrections ─────────────────────────────────────────────────────────
// Tracks every human correction — used for adaptive learning

export const wordCorrections = pgTable("word_corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  wordId: uuid("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type WordCorrection = typeof wordCorrections.$inferSelect;

// ─── Relations ────────────────────────────────────────────────────────────────

export const jobsRelations = relations(jobs, ({ many }) => ({
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  job: one(jobs, { fields: [pages.jobId], references: [jobs.id] }),
  textRegions: many(textRegions),
  words: many(words),
}));

export const textRegionsRelations = relations(textRegions, ({ one, many }) => ({
  page: one(pages, { fields: [textRegions.pageId], references: [pages.id] }),
  words: many(words),
}));

export const wordsRelations = relations(words, ({ one, many }) => ({
  page: one(pages, { fields: [words.pageId], references: [pages.id] }),
  region: one(textRegions, { fields: [words.regionId], references: [textRegions.id] }),
  corrections: many(wordCorrections),
}));

export const wordCorrectionsRelations = relations(wordCorrections, ({ one }) => ({
  word: one(words, { fields: [wordCorrections.wordId], references: [words.id] }),
}));
