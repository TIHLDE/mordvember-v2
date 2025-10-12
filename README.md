# Mordvember 2025

A participant tracking application for the Mordvember 2025 event with secure authentication and admin panel.

## Features

- **Home Page**: View all participants with their status (alive/dead)
- **Admin Panel (`/admin`)**: Secure admin panel with authentication
  - Login with username and password
  - View all participants in a grid layout
  - Click any participant to toggle their status between alive/dead
  - Changes are persisted to the JSON file
- **Authentication System**: React Query-based cookie authentication
  - Protected routes with middleware
  - Permission-based access control
  - Automatic token management

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# TIHLDE API for authentication
NEXT_PUBLIC_TIHLDE_API_URL=https://api.tihlde.org

# Supabase Database Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed setup instructions.

### 3. Run the development server

```bash
pnpm dev
```

### 4. Open the application

Navigate to [http://localhost:3000](http://localhost:3000)

## Admin Login

To access the admin panel, go to [http://localhost:3000/admin](http://localhost:3000/admin)

**Login credentials:**

Use your **TIHLDE credentials** (same as you use for tihlde.org).

**Access Requirements:**

- You must be a **leader of Index** to access the admin panel
- OR have the username **'astaskj'** (special admin access)
- The system checks your TIHLDE memberships via the API
- Only Index leaders with `membership_type: "LEADER"` OR the user 'aastaks' will be granted access
- All other users will receive an "Access denied" message

## Authentication System

This project uses a comprehensive authentication system. For detailed documentation, see [AUTH_SETUP.md](./AUTH_SETUP.md).

Key features:

- Cookie-based token storage
- React Query for auth state management
- Next.js middleware for route protection
- Permission-based access control
- Automatic token attachment to API requests

## Database Setup

This project uses **Supabase** (PostgreSQL) for data storage. This ensures:

- ✅ **Production compatibility** - works on serverless platforms (Vercel, Netlify, etc.)
- ✅ **Persistent storage** - no more read-only filesystem issues
- ✅ **Scalability** - handles any number of participants
- ✅ **Real-time queries** - fast database operations with indexes

**To set up the database, follow the guide in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).**

Quick steps:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the schema from `supabase-schema.sql` in the SQL Editor
3. Add environment variables to `.env`
4. Run `node migrate-to-supabase.js` to migrate existing data

## Git Workflow

After making changes:

1. Stage your changes:

```bash
git add .
```

2. Commit with a descriptive message:

```bash
git commit -m "beskrivelse av endringene"
```

3. Push to repository:

```bash
git push
```

## Project Structure

```
src/
├── api/          # API utilities (auth, fetch, cookies)
├── app/          # Next.js app directory
│   ├── api/      # API routes
│   ├── admin/    # Admin panel (protected)
│   └── login/    # Login page
├── components/   # React components
├── hooks/        # Custom hooks (auth)
├── providers/    # React providers (QueryProvider)
├── types/        # TypeScript types
└── data/         # JSON data storage
```

## How It Works

- Participant data is stored in **Supabase (PostgreSQL database)**
- Authentication uses cookies and React Query with TIHLDE API
- The API routes handle authentication and participant updates
- Middleware protects the admin routes
- Changes made in the admin panel persist in the database
- **Real-time updates:** The home page auto-refreshes every 5 seconds using React Query
- Changes appear for all viewers within 5 seconds
- Production-ready with proper database storage

### Live Updates

The app uses **React Query with automatic polling** for real-time updates:

- Home page refreshes every 5 seconds
- Admin changes appear instantly in admin panel
- All viewers see updates within 5 seconds
- See [REALTIME_UPDATES.md](./REALTIME_UPDATES.md) for details and alternatives

## Development Notes

- Authentication uses the TIHLDE API (see `src/app/api/auth/`)
- Participant data is stored in Supabase (PostgreSQL)
- The app uses server-side API routes (`/api/participants`) to interact with the database
- See [AUTH_SETUP.md](./AUTH_SETUP.md) for authentication documentation
- See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for database setup

## Deployment Notes

When deploying to production (Vercel, Netlify, etc.):

1. ✅ **Set environment variables** - Add all Supabase and TIHLDE API variables
2. ✅ **Run database migration** - Use `node migrate-to-supabase.js` to populate the database
3. ✅ **Test the deployment** - Verify read/write operations work
4. ℹ️ **The old `participants.json` file is kept for reference** but no longer used in production
