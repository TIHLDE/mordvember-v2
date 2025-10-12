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

The app is pre-configured with TIHLDE API authentication. The `.env.local` file contains:

```env
NEXT_PUBLIC_API_URL=https://api.tihlde.org
```

This connects to the production TIHLDE API for authentication and user data.

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
- Only Index leaders with `membership_type: "LEADER"` OR the user 'astaskj' will be granted access
- All other users will receive an "Access denied" message

## Authentication System

This project uses a comprehensive authentication system. For detailed documentation, see [AUTH_SETUP.md](./AUTH_SETUP.md).

Key features:

- Cookie-based token storage
- React Query for auth state management
- Next.js middleware for route protection
- Permission-based access control
- Automatic token attachment to API requests

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

- Participant data is stored in `src/data/participants.json`
- Authentication uses cookies and React Query
- The API routes handle authentication and participant updates
- Middleware protects the admin routes
- Changes made in the admin panel persist across sessions
- **Real-time updates:** The home page auto-refreshes every 5 seconds using React Query
- Changes appear for all viewers within 5 seconds
- No database needed - everything is stored in JSON

### Live Updates

The app uses **React Query with automatic polling** for real-time updates:

- Home page refreshes every 5 seconds
- Admin changes appear instantly in admin panel
- All viewers see updates within 5 seconds
- See [REALTIME_UPDATES.md](./REALTIME_UPDATES.md) for details and alternatives

## Development Notes

- Mock API endpoints are provided for authentication (see `src/app/api/auth/`)
- To integrate with a real backend, set `NEXT_PUBLIC_API_URL` and update the auth endpoints
- See [AUTH_SETUP.md](./AUTH_SETUP.md) for detailed authentication documentation
