SeferSofer — Supabase Setup Guide

This document walks you through setting up SeferSofer with Supabase for production use.

## Overview

SeferSofer is a Hebrew OCR transcription platform built with:

- **Frontend:** React 19 + Tailwind CSS 4

- **Backend:** Express + tRPC

- **Database:** Supabase (PostgreSQL)

- **Auth:** Supabase Email/Password

- **Storage:** Supabase Storage (manuscripts bucket)

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)

1. Sign up or log in

1. Click **"New Project"**

1. Fill in:
  - **Project name:** `sefersofer` (or your preferred name)
  - **Database password:** Generate a strong password (save it securely)
  - **Region:** Choose the region closest to your users

1. Click **"Create new project"** and wait for it to initialize (2-3 minutes)

## Step 2: Get Your Credentials

Once your project is created:

1. Go to **Settings** → **API** (left sidebar)

1. Copy these values:
  - **Project URL** → `SUPABASE_URL`
  - **Service Role Key** (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`
  - **Anon Public Key** (under "Project API keys") → `VITE_SUPABASE_ANON_KEY`

1. In the Manus dashboard, add these as environment variables:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

## Step 3: Create the Database Schema

1. In Supabase Dashboard, go to **SQL Editor** (left sidebar )

1. Click **"New Query"**

1. Copy the entire contents of `/supabase/migrations/001_initial.sql`

1. Paste it into the SQL editor

1. Click **"Run"**

1. Wait for the migration to complete (you should see a success message)

### What This Creates:

- **profiles** — User profiles with roles (user, admin, gm, employee)

- **jobs** — OCR jobs created by users

- **pages** — Manuscript pages per job

- **text_regions** — Main text, margins, interlinear regions

- **words** — Individual words with confidence scores

- **word_corrections** — Correction history for adaptive learning

- **letter_confusion_pairs** — Letter confusions learned from corrections

- **letter_morphology_variants** — Visual morphology patterns

- **ocr_accuracy_metrics** — Accuracy tracking per page

All tables include:

- Row-Level Security (RLS) policies to protect user data

- Automatic timestamps (created_at, updated_at)

- Proper foreign key relationships

## Step 4: Create the Storage Bucket

1. In Supabase Dashboard, go to **Storage** (left sidebar)

1. Click **"Create a new bucket"**

1. Fill in:
  - **Name:** `manuscripts`
  - **Privacy:** Private (not public)

1. Click **"Create bucket"**

### Add RLS Policies to Storage:

1. Click on the `manuscripts` bucket

1. Go to the **Policies** tab

1. Click **"New policy"** and add these policies:

**Policy 1: Users can upload their own files**

```sql
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
```

**Policy 2: Users can read their own files**

```sql
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

**Policy 3: Users can delete their own files**

```sql
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## Step 5: Enable Email Authentication

1. In Supabase Dashboard, go to **Authentication** (left sidebar)

1. Click **"Providers"**

1. Find **Email** and make sure it's enabled (it should be by default)

1. Go to **Email Templates** tab

1. Customize the confirmation and password reset emails if desired

## Step 6: Start the Development Server

```bash
cd /home/ubuntu/sefersofer
pnpm install
pnpm dev
```

The server should now start without errors. You should see:

```
Server running on http://localhost:3000/
```

## Step 7: Test the Auth Flow

1. Open [http://localhost:3000/auth](http://localhost:3000/auth) in your browser

1. Click **"Sign up"**

1. Enter an email and password

1. Check your email for a confirmation link

1. Click the confirmation link

1. You should be redirected to the login page

1. Log in with your credentials

1. You should see the dashboard

## Troubleshooting

### "Missing Supabase env vars" Error

**Problem:** Server won't start because environment variables aren't set.

**Solution:**

1. Make sure you've added `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_SUPABASE_ANON_KEY` to the Manus dashboard

1. Restart the dev server: `pnpm dev`

### "RLS policy violation" Error

**Problem:** You get an error when trying to upload files or create jobs.

**Solution:**

1. Make sure RLS policies are enabled on all tables (they should be by default )

1. Check that your user is authenticated (logged in)

1. Verify that the RLS policies in the SQL migration were applied correctly

### "Email confirmation not received"

**Problem:** After signing up, you don't receive a confirmation email.

**Solution:**

1. Check your spam folder

1. In Supabase Dashboard → Authentication → Email Templates, verify the sender email is correct

1. For development, you can disable email confirmation:
  - Go to Authentication → Settings
  - Disable "Confirm email"
  - Users will be confirmed automatically

## Key Concepts

### User Roles

Users can have one of four roles:

- **user** — Regular transcriber (default)

- **employee** — Team member with extended permissions

- **gm** — General Manager with team oversight

- **admin** — Full system access

To change a user's role:

1. Go to Supabase Dashboard → SQL Editor

1. Run:

   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
   ```

### Adaptive Learning

Every time a user corrects a word during transcription:

1. The correction is saved to `word_corrections`

1. Letter confusions are recorded in `letter_confusion_pairs`

1. Visual morphologies are recorded in `letter_morphology_variants`

1. The next OCR transcription uses this data to improve accuracy

### Storage Path Structure

Files are stored in Supabase Storage under:

```
manuscripts/
  {user_id}/
    {job_id}/
      {timestamp}.jpg
```

This structure ensures:

- Users can only access their own files (via RLS)

- Files are organized by job

- No filename collisions

## Next Steps

1. **Set up your first job:** Go to [http://localhost:3000](http://localhost:3000) and create a new transcription job

1. **Upload a manuscript page:** Use the "New Transcription" page

1. **Review and correct:** Use the PageReview interface to correct OCR results

1. **Monitor analytics:** Check the OCR Analytics dashboard to see your accuracy trends

## API Reference

All tRPC procedures are available at `/api/trpc`. Common procedures:

- `auth.me` — Get current user info

- `jobs.list` — List user's jobs

- `jobs.create` — Create a new job

- `jobs.delete` — Archive a job

- `pages.getPage` — Get page with all regions and words

- `pages.create` — Create a new page

- `corrections.saveCorrection` — Save a word correction

- `ocr.getAccuracyTrend` — Get accuracy over time

- `ocr.getLearningPrompt` — Get adaptive learning prompt

## Support

For issues or questions:

1. Check the troubleshooting section above

1. Review the Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)

1. Check the project's README.md for development guidelines

## Security Notes

- **Never commit** `.env` files or credentials to version control

- **Service Role Key** is server-only and should never be exposed to the browser

- **Anon Key** is safe to expose to the browser

- All database access is protected by Row-Level Security (RLS )

- Users can only access their own data

---

**Last updated:** June 28, 2026**Version:** 1.0.0

