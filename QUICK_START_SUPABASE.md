# Quick Start: Supabase Migration

## ⚡ TL;DR - Get Running Fast

### Local Development

1. **Create Supabase project** at [supabase.com](https://supabase.com)

2. **Run the schema**:

   - Open SQL Editor in Supabase
   - Paste contents of `supabase-schema.sql`
   - Click Run

3. **Add environment variables** (create `.env`):

   ```env
   NEXT_PUBLIC_TIHLDE_API_URL=https://api.tihlde.org
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   ```

   (Get the keys from Supabase: Settings → API)

4. **Migrate your data**:

   ```bash
   node migrate-to-supabase.js
   ```

5. **Start dev server**:
   ```bash
   pnpm dev
   ```

### Production Deployment (Vercel)

1. **Add environment variables** in Vercel project settings:

   - `NEXT_PUBLIC_TIHLDE_API_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Redeploy** your app

3. **Test** that everything works!

## 🎯 What This Fixes

- ❌ **Before**: 500 errors in production (read-only filesystem)
- ✅ **After**: Full read/write database access in production

## 📋 Files Changed

### New Files

- `src/lib/supabase.ts` - Supabase client (public)
- `src/lib/supabase-server.ts` - Supabase admin client
- `supabase-schema.sql` - Database schema
- `migrate-to-supabase.js` - Migration script
- `SUPABASE_SETUP.md` - Detailed setup guide

### Modified Files

- `src/app/api/participants/route.ts` - Now uses Supabase instead of file system
- `README.md` - Updated with Supabase info
- `package.json` - Added `@supabase/supabase-js` and `dotenv`

### Unchanged

- All React components work the same
- Authentication system unchanged
- Frontend code unchanged

## 🔍 Verify Setup

Test these after setup:

- [ ] Homepage loads participants
- [ ] Can login to `/admin`
- [ ] Can mark participant as dead
- [ ] Can mark participant as alive ("Gjør levende igjen")
- [ ] Can add new participant
- [ ] Changes persist after page refresh

## 🆘 Common Issues

**"Missing Supabase environment variables"**
→ Check `.env` exists with all 3 Supabase variables

**"Failed to fetch participants"**
→ Make sure you ran the schema SQL in Supabase

**500 error on update**
→ Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

**Migration fails**
→ Ensure schema is created first, then run migration

## 📚 More Details

For the complete guide, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
