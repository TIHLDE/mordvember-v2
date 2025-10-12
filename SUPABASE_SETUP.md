# Supabase Setup Guide

This guide will help you set up Supabase as the database for Mordvember.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: `mordvember` (or any name you prefer)
   - **Database Password**: Choose a strong password (save it somewhere safe!)
   - **Region**: Choose the closest region to your users (e.g., `Europe (North EU)`)
4. Click **"Create new project"** and wait for it to initialize (~2 minutes)

## Step 2: Run the Database Schema

1. In your Supabase project dashboard, go to the **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from your project root
4. Copy the entire contents and paste it into the SQL Editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. You should see: `Success. No rows returned`

This creates the `participants` table with all necessary fields, indexes, and security policies.

## Step 3: Get Your API Keys

1. In your Supabase project, go to **Settings** → **API** (left sidebar)
2. You'll see three important values:

   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon/public key**: `eyJhbGc...` (long string)
   - **service_role key**: `eyJhbGc...` (different long string)

3. Copy these values - you'll need them in the next step

## Step 4: Configure Environment Variables

Create a file called `.env` in your project root with the following content:

```env
# TIHLDE API Configuration (keep this)
NEXT_PUBLIC_TIHLDE_API_URL=https://api.tihlde.org

# Supabase Configuration
# Replace with your actual values from Step 3

# Public keys (safe to expose in client-side code)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side only key (NEVER commit this to git!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:**

- Replace the placeholder values with your actual keys from Step 3
- The `.env` file is already in `.gitignore` and will NOT be committed to git
- Never share or commit the `SUPABASE_SERVICE_ROLE_KEY`!

## Step 5: Migrate Your Data

Now migrate your existing participant data from the JSON file to Supabase:

```bash
node migrate-to-supabase.js
```

You should see output like:

```
🚀 Starting migration to Supabase...
📊 Found 60 participants in JSON file
✅ Inserted: Daniel Evensen (player 1)
✅ Inserted: Mathilde Klungland (player 2)
...
🎉 Migration complete!
```

## Step 6: Configure Production Environment Variables

If you're deploying to **Vercel**:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add these four variables:
   - `NEXT_PUBLIC_TIHLDE_API_URL` = `https://api.tihlde.org`
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
4. Make sure to select **All** environments (Production, Preview, Development)
5. Click **Save**

If you're deploying to another platform (Netlify, Railway, etc.), add the same environment variables in their respective settings.

## Step 7: Redeploy

After adding environment variables:

1. **Vercel**: Redeploy by pushing to your git repository or clicking "Redeploy" in the Vercel dashboard
2. **Other platforms**: Trigger a new deployment

## Testing

Once deployed, test the following:

1. ✅ **View participants**: Visit your site homepage - participants should load
2. ✅ **Login**: Go to `/login` and log in with your TIHLDE credentials
3. ✅ **Toggle status**: In the admin panel, click a participant to mark them as dead/alive
4. ✅ **Add participant**: Use the "Legg til deltaker" form to add a new participant
5. ✅ **Verify changes persist**: Refresh the page - changes should be saved

## Troubleshooting

### Error: "Missing Supabase environment variables"

- Make sure all three environment variables are set in `.env` (local) or your hosting platform (production)
- Restart your dev server after adding environment variables

### Error: "Failed to fetch participants"

- Check that you ran the `supabase-schema.sql` script in the SQL Editor
- Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct

### Error: "Failed to update participant" (500 error)

- Verify your `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check the Supabase logs: **Logs** → **API** in your Supabase dashboard

### Migration script errors

- Make sure you have all three environment variables set in `.env`
- Verify the `participants.json` file exists in `src/data/`
- Check that the schema was created successfully (Step 2)

## Security Notes

1. **Row Level Security (RLS)** is enabled on the participants table
2. Public users can only **read** participant data (for the homepage)
3. **Admin operations** (insert, update, delete) use the service role key, which bypasses RLS
4. Authentication is still handled via your existing TIHLDE API system
5. The service role key should **never** be exposed to the client

## Database Management

### Viewing Data

Go to **Table Editor** in your Supabase dashboard to view and manually edit participants.

### Backups

Supabase automatically backs up your database daily. You can also create manual backups from **Database** → **Backups**.

### SQL Queries

Use the **SQL Editor** to run custom queries:

```sql
-- See all participants
SELECT * FROM participants ORDER BY player;

-- Count alive vs dead
SELECT status, COUNT(*) FROM participants GROUP BY status;

-- Find a specific participant
SELECT * FROM participants WHERE name ILIKE '%Daniel%';
```

## What Changed?

- ✅ **Removed file system writes** - no more `participants.json` updates
- ✅ **Added Supabase database** - data persists in PostgreSQL
- ✅ **Works in production** - serverless-friendly, no read-only filesystem issues
- ✅ **Same frontend code** - no changes needed to React components
- ✅ **Same auth system** - still uses TIHLDE API authentication
- ✅ **Faster queries** - database indexes for better performance

## Need Help?

- 📖 [Supabase Documentation](https://supabase.com/docs)
- 💬 [Supabase Discord Community](https://discord.supabase.com)
- 🐛 Check the browser console and server logs for error messages
