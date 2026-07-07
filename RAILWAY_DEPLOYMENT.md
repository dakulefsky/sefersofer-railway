# SeferSofer - Railway Deployment Guide

This document provides instructions for deploying SeferSofer to Railway.

## Prerequisites

1. **Railway Account** - Sign up at https://railway.app
2. **GitHub Repository** - This repository (dakulefsky/sefersofer-railway)
3. **Supabase Project** - Database and authentication
4. **Transkribus Account** - For OCR processing

## Deployment Steps

### 1. Connect Repository to Railway

1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `dakulefsky/sefersofer-railway`
4. Railway will auto-detect the Node.js project and create a service

### 2. Configure Environment Variables

Add these environment variables in Railway's dashboard (Project Settings → Variables):

#### Database
- `DATABASE_URL` - MySQL/TiDB connection string (format: `mysql://user:password@host:port/database`)

#### Supabase
- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key from Supabase dashboard
- `VITE_SUPABASE_ANON_KEY` - Anon key from Supabase dashboard

#### Authentication
- `JWT_SECRET` - A secure random string for session signing (generate with `openssl rand -base64 32`)

#### Transkribus OCR
- `TRANSKRIBUS_USER` - Your Transkribus username
- `TRANSKRIBUS_PASSWORD` - Your Transkribus password
- `TRANSKRIBUS_MODEL_ID` - Model ID for Hebrew cursive (default: `371705`)

#### LLM (Optional, for context correction)
- `BUILT_IN_FORGE_API_URL` - LLM API endpoint
- `BUILT_IN_FORGE_API_KEY` - LLM API key

#### Node Environment
- `NODE_ENV` - Set to `production`

### 3. Database Setup

After deployment, run the database migrations:

1. SSH into the Railway container or use Railway's CLI
2. Run: `npm run db:push`

Or manually execute the SQL from `supabase/migrations/001_initial.sql` in your database.

### 4. Supabase Storage Configuration

1. Go to your Supabase dashboard
2. Create a new storage bucket named `manuscripts`
3. Set the bucket to private (not public)
4. Configure RLS policies if needed

## Build & Start Process

Railway will automatically:

1. **Build**: Run `npm run build`
   - Vite compiles React frontend to `dist/public`
   - esbuild bundles Express server to `dist/index.js`

2. **Start**: Run `npm run start`
   - Starts Express server on `$PORT` (Railway sets this automatically)
   - Serves static assets from `dist/public`
   - Handles API routes at `/api/trpc`

## Monitoring

### Logs
- View real-time logs in Railway dashboard
- Check for startup errors and database connection issues

### Health Check
- Railway will monitor the `/` endpoint
- Ensure the server responds with 200 status

### Common Issues

**Port Binding Error**
- Railway automatically sets `$PORT` env var
- Server respects this via `process.env.PORT || 3000`

**Database Connection Failed**
- Verify `DATABASE_URL` is correct
- Check database credentials and network access
- Ensure database is running and accessible

**Supabase Auth Errors**
- Verify `SUPABASE_URL` and keys are correct
- Check JWKS endpoint is accessible: `https://{SUPABASE_URL}/.well-known/jwks.json`

**Storage Upload Errors**
- Verify `manuscripts` bucket exists in Supabase Storage
- Check bucket permissions and RLS policies
- Ensure `SUPABASE_SERVICE_ROLE_KEY` has storage permissions

## Scaling

Railway allows easy scaling:

1. Go to Project Settings
2. Adjust CPU, Memory, and replica count
3. Changes take effect immediately with zero downtime

## Custom Domain

1. In Railway dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

## Rollback

If a deployment fails:

1. Railway keeps previous deployments
2. Click "Deployments" → Select previous version
3. Click "Redeploy" to roll back

## Support

For Railway-specific issues, visit: https://docs.railway.app

For SeferSofer issues, check: ARCHITECTURE.md and SETUP.md
