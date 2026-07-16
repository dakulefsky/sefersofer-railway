# SeferSofer — Railway Environment Variables

Set these in your Railway project under **Settings → Variables**.

## Required

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | Supabase → Settings → Database → Connection string (URI) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | Supabase → Settings → API → service_role key |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o Vision | https://platform.openai.com/api-keys |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` (set automatically by Railway) |
| `PORT` | Port to listen on | `3000` (set automatically by Railway) |
| `KRAKEN_API_URL` | URL of self-hosted Kraken microservice | Not set (uses OpenAI fallback) |

## Supabase Storage Setup

Before deploying, create a storage bucket in Supabase:

1. Go to Supabase → Storage → New Bucket
2. Name: `manuscripts`
3. Public: **No** (private bucket)
4. Enable RLS policies for authenticated users

## Database Setup

Run the migration SQL against your Supabase database:

1. Go to Supabase → SQL Editor
2. Open and run `drizzle/0000_initial.sql`

Or use Drizzle Kit locally:

```bash
DATABASE_URL="your-connection-string" npx drizzle-kit push
```

## Local Development

Create a `.env.local` file in the project root (gitignored):

```
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
OPENAI_API_KEY=sk-...
```

Then run:

```bash
npm install
npm run dev
```
