import { relations } from "drizzle-orm";
import {
  users,
  jobs,
  pages,
  words,
  wordCorrections,
  letterConfusionPairs,
  letterMorphologyVariants,
  ocrAccuracyMetrics,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  jobs: many(jobs),
  wordCorrections: many(wordCorrections),
  letterConfusionPairs: many(letterConfusionPairs),
  letterMorphologyVariants: many(letterMorphologyVariants),
  ocrAccuracyMetrics: many(ocrAccuracyMetrics),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  user: one(users, { fields: [jobs.userId], references: [users.id] }),
  pages: many(pages),
  letterConfusionPairs: many(letterConfusionPairs),
  letterMorphologyVariants: many(letterMorphologyVariants),
  ocrAccuracyMetrics: many(ocrAccuracyMetrics),
}));

export const pagesRelations = relations(pages, ({ one, many }) => ({
  job: one(jobs, { fields: [pages.jobId], references: [jobs.id] }),
  words: many(words),
  ocrAccuracyMetrics: many(ocrAccuracyMetrics),
}));

export const wordsRelations = relations(words, ({ one, many }) => ({
  page: one(pages, { fields: [words.pageId], references: [pages.id] }),
  corrections: many(wordCorrections),
}));

export const wordCorrectionsRelations = relations(wordCorrections, ({ one }) => ({
  word: one(words, { fields: [wordCorrections.wordId], references: [words.id] }),
  user: one(users, { fields: [wordCorrections.userId], references: [users.id] }),
}));

export const letterConfusionPairsRelations = relations(letterConfusionPairs, ({ one }) => ({
  user: one(users, { fields: [letterConfusionPairs.userId], references: [users.id] }),
  job: one(jobs, { fields: [letterConfusionPairs.jobId], references: [jobs.id] }),
}));

export const letterMorphologyVariantsRelations = relations(letterMorphologyVariants, ({ one }) => ({
  user: one(users, { fields: [letterMorphologyVariants.userId], references: [users.id] }),
  job: one(jobs, { fields: [letterMorphologyVariants.jobId], references: [jobs.id] }),
}));

export const ocrAccuracyMetricsRelations = relations(ocrAccuracyMetrics, ({ one }) => ({
  user: one(users, { fields: [ocrAccuracyMetrics.userId], references: [users.id] }),
  job: one(jobs, { fields: [ocrAccuracyMetrics.jobId], references: [jobs.id] }),
  page: one(pages, { fields: [ocrAccuracyMetrics.pageId], references: [pages.id] }),
}));
