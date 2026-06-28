# SeferSofer Architecture

## System Overview

SeferSofer is a full-stack Hebrew OCR transcription platform built on Supabase with a React frontend and Express backend.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Auth.tsx (Login/Register) → Home → NewTranscription      │   │
│  │ PageReview → OcrAnalytics → AdminClients                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│                    Supabase Auth (JWT)                            │
│                    Supabase Storage (Images)                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Express + tRPC)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/trpc → tRPC Router                                  │   │
│  │   - auth.me                                              │   │
│  │   - jobs.* (list, create, delete)                        │   │
│  │   - pages.* (getPage, create, saveOcrResult)             │   │
│  │   - corrections.* (saveCorrection, markScribble)         │   │
│  │   - ocr.* (getAccuracyTrend, getLearningPrompt)          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│                    Supabase Client (Service Role)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Supabase (PostgreSQL + Storage)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Tables:                                                  │   │
│  │  - profiles (users + roles)                              │   │
│  │  - jobs (OCR jobs)                                       │   │
│  │  - pages (manuscript pages)                              │   │
│  │  - text_regions (main, margins, interlinear)             │   │
│  │  - words (individual words with confidence)              │   │
│  │  - word_corrections (correction history)                 │   │
│  │  - letter_confusion_pairs (adaptive learning)            │   │
│  │  - letter_morphology_variants (visual patterns)          │   │
│  │  - ocr_accuracy_metrics (accuracy tracking)              │   │
│  │                                                          │   │
│  │ Storage:                                                 │   │
│  │  - manuscripts bucket (user images)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Registration & Login

```
User → Auth.tsx (email/password)
     → Supabase Auth.signUp() / signIn()
     → JWT token stored in localStorage
     → Supabase Auth session created
     → Redirect to Home
```

### 2. Create & Upload Job

```
User → NewTranscription.tsx
     → trpc.jobs.create({ name, description })
     → Backend creates job record
     → User selects image file
     → trpc.pages.getUploadUrl({ jobId, filename })
     → Backend returns signed URL
     → Browser uploads image directly to Supabase Storage
     → trpc.pages.create({ jobId, pageOrder, storagePath })
     → Backend creates page record
```

### 3. OCR Transcription

```
User → NewTranscription.tsx (image upload complete)
     → Backend calls LLM with:
       - Image URL (from Supabase Storage)
       - Adaptive learning prompt (from db.buildLearningPrompt)
     → LLM returns JSON with regions and words
     → trpc.pages.saveOcrResult({ pageId, regions })
     → Backend creates text_regions and words records
     → Redirect to PageReview
```

### 4. Review & Correct

```
User → PageReview.tsx
     → trpc.pages.getPage({ pageId })
     → Backend returns page + regions + words
     → User corrects words, marks scribbles
     → trpc.corrections.saveCorrection({ wordId, correctedText })
     → Backend:
       1. Saves correction to word_corrections
       2. Records letter confusion (if single letter)
       3. Updates word record
     → User completes page
     → trpc.corrections.completePage({ pageId, totalWords, correctedWords })
     → Backend records accuracy metrics
```

### 5. Adaptive Learning

```
Every correction:
  1. Letter confusion recorded in letter_confusion_pairs
  2. Visual morphology recorded in letter_morphology_variants
  3. Accuracy metric recorded in ocr_accuracy_metrics

Next OCR transcription:
  1. trpc.ocr.getLearningPrompt({ jobId })
  2. Backend queries top confusions and morphologies
  3. Builds enhanced prompt with learned patterns
  4. LLM uses prompt to improve accuracy
```

## Database Schema

### profiles
```sql
id (UUID, PK)
email (varchar)
name (varchar, nullable)
role (enum: user, admin, gm, employee)
created_at (timestamp)
updated_at (timestamp)
last_signed_in (timestamp)
```

### jobs
```sql
id (UUID, PK)
user_id (UUID, FK → profiles.id)
name (varchar)
description (text, nullable)
archived (boolean, default: false)
created_at (timestamp)
updated_at (timestamp)
```

### pages
```sql
id (UUID, PK)
job_id (UUID, FK → jobs.id)
page_order (integer)
storage_path (varchar) -- path in Supabase Storage
page_label (varchar, nullable)
created_at (timestamp)
updated_at (timestamp)
```

### text_regions
```sql
id (UUID, PK)
page_id (UUID, FK → pages.id)
region_type (enum: main, margin_right, margin_left, margin_top, margin_bottom, interlinear)
anchor_word_index (integer, nullable) -- for interlinear regions
bbox_x, bbox_y, bbox_w, bbox_h (float, nullable) -- bounding box
created_at (timestamp)
updated_at (timestamp)
```

### words
```sql
id (UUID, PK)
page_id (UUID, FK → pages.id)
region_id (UUID, FK → text_regions.id, nullable)
word_index (integer) -- order within page
text (varchar)
confidence (float, nullable) -- OCR confidence 0-1
is_flagged (boolean, default: false)
is_scribble (boolean, default: false)
is_insertion (boolean, default: false)
created_at (timestamp)
updated_at (timestamp)
```

### word_corrections
```sql
id (UUID, PK)
word_id (UUID, FK → words.id)
user_id (UUID, FK → profiles.id)
original_text (varchar)
corrected_text (varchar)
is_user_marked_scribble (boolean, default: false)
created_at (timestamp)
```

### letter_confusion_pairs
```sql
id (UUID, PK)
user_id (UUID, FK → profiles.id)
job_id (UUID, FK → jobs.id)
original_letter (varchar)
corrected_letter (varchar)
count (integer, default: 1)
created_at (timestamp)
updated_at (timestamp)
```

### letter_morphology_variants
```sql
id (UUID, PK)
user_id (UUID, FK → profiles.id)
job_id (UUID, FK → jobs.id)
letter (varchar)
morphology (varchar) -- description of visual variant
context (varchar, nullable) -- e.g., "word_initial", "word_final"
count (integer, default: 1)
created_at (timestamp)
updated_at (timestamp)
```

### ocr_accuracy_metrics
```sql
id (UUID, PK)
user_id (UUID, FK → profiles.id)
job_id (UUID, FK → jobs.id)
page_id (UUID, FK → pages.id)
total_words (integer)
correct_words (integer)
accuracy (integer) -- percentage 0-100
created_at (timestamp)
```

## Authentication Flow

### Client-Side (Supabase Auth)

```typescript
// Sign up
const { error } = await supabaseBrowser.auth.signUp({
  email: "user@example.com",
  password: "password123",
});

// Sign in
const { error } = await supabaseBrowser.auth.signInWithPassword({
  email: "user@example.com",
  password: "password123",
});

// Get JWT token
const { data: { session } } = await supabaseBrowser.auth.getSession();
const token = session?.access_token; // JWT token
```

### Server-Side (JWT Verification)

```typescript
// In context.ts
const authHeader = req.headers.authorization;
const token = authHeader?.replace("Bearer ", "");

if (token) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (user) {
    // User is authenticated
    ctx.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || "user",
    };
  }
}
```

### tRPC Procedures

```typescript
// Public procedure (no auth required)
publicProcedure.query(() => {
  // Accessible to anyone
});

// Protected procedure (auth required)
protectedProcedure.query(({ ctx }) => {
  // Only accessible if ctx.user is set
  const userId = ctx.user!.id;
});

// Admin procedure (admin role required)
adminProcedure.mutation(({ ctx }) => {
  // Only accessible if ctx.user.role === "admin"
});
```

## File Storage

### Upload Flow

```
1. Client calls trpc.pages.getUploadUrl({ jobId, filename })
2. Server generates path: {userId}/{jobId}/{timestamp}.ext
3. Server calls supabase.storage.createSignedUploadUrl(path)
4. Server returns { signedUrl, path, token }
5. Client PUTs image to signedUrl
6. Client calls trpc.pages.create({ storagePath: path })
7. Server creates page record with storagePath
```

### Access Flow

```
1. Backend queries page.storage_path
2. Backend calls supabase.storage.getPublicUrl(storagePath)
3. Backend returns URL to frontend
4. Frontend displays image via <img src={url} />
```

### RLS Policies

```sql
-- Users can only upload to their own folder
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Users can only read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Users can only delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## Adaptive Learning Pipeline

### Step 1: Record Corrections

When a user corrects a word during PageReview:

```typescript
await db.saveWordCorrection(
  wordId,
  userId,
  jobId,
  originalText,    // "א" (aleph)
  correctedText     // "ל" (lamed)
);
```

This function:
1. Saves correction to `word_corrections` table
2. Detects letter confusions (if single letter or character-by-character)
3. Calls `recordLetterConfusion(userId, jobId, "א", "ל")`
4. Updates `letter_confusion_pairs` with count++

### Step 2: Build Learning Prompt

Before the next OCR transcription:

```typescript
const prompt = await db.buildLearningPrompt(userId, jobId);
```

This function:
1. Queries top 15 letter confusions for this user
2. Queries top 15 morphology variants for this user
3. Builds a prompt like:

```
You are transcribing a Hebrew manuscript. Based on corrections made to earlier pages:

Letter confusions seen in this hand:
- What looks like א is often actually ל (seen 8×)
- What looks like ש is often actually ס (seen 5×)

Visual patterns in this manuscript:
- The letter ל often appears with a long tail (12×)
- The letter ד often appears with a curved top (7×)

Annotation types to recognize:
- MAIN TEXT: the primary text block, read right-to-left
- MARGIN NOTES: text written in margins
- INTERLINEAR: words written between lines
- SCRIBBLE: random strokes, cross-outs, ink blots

Return a JSON structure with regions, each containing their word list and region_type.
```

### Step 3: Improve OCR

The LLM uses this prompt to:
1. Recognize common confusions and correct them
2. Understand visual patterns in the manuscript
3. Properly categorize text regions
4. Achieve higher accuracy on the next page

## Performance Considerations

### Query Optimization

- **Indexes:** All foreign keys and frequently queried columns are indexed
- **Pagination:** Large result sets should use LIMIT/OFFSET
- **Caching:** tRPC client caches queries automatically

### Storage Optimization

- **Image compression:** Frontend should compress images before upload
- **Path structure:** Organized by user → job → file for efficient queries
- **Cleanup:** Archived jobs' images can be deleted after retention period

### Database Optimization

- **RLS:** Automatically filters queries to user's own data
- **Triggers:** Automatic timestamps and soft deletes
- **Relationships:** Foreign keys maintain referential integrity

## Security

### Authentication
- JWT tokens issued by Supabase Auth
- Tokens verified on every tRPC call
- Tokens expire after 1 hour (configurable)

### Authorization
- Row-Level Security (RLS) on all tables
- Users can only access their own data
- Admin procedures check role before executing

### Data Protection
- All data encrypted in transit (HTTPS)
- All data encrypted at rest (Supabase default)
- Passwords hashed with bcrypt (Supabase Auth)

### Storage Security
- Storage bucket is private (not public)
- RLS policies restrict access to user's own files
- Signed URLs expire after 1 hour

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm exec tsc --noEmit
```

### Database Migrations

```bash
# Create migration
pnpm drizzle-kit generate

# Apply migration
# (Use Supabase SQL Editor to run migration file)
```

### Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Troubleshooting

### "RLS policy violation" Error

**Cause:** User doesn't have permission to access data

**Solution:**
1. Verify user is authenticated
2. Check RLS policies are enabled
3. Verify user ID matches data owner

### "Signature verification failed" Error

**Cause:** JWT token is invalid or expired

**Solution:**
1. Clear browser localStorage
2. Log out and log back in
3. Check Supabase credentials are correct

### "Storage bucket not found" Error

**Cause:** `manuscripts` bucket doesn't exist

**Solution:**
1. Create bucket in Supabase Dashboard → Storage
2. Name it `manuscripts`
3. Set to private
4. Add RLS policies

---

**Last updated:** June 28, 2026
**Version:** 1.0.0
