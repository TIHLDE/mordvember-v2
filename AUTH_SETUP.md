# Authentication System Documentation

This project uses a **React Query-based, cookie-stored JWT authentication system** adapted for Next.js.

## Overview

The authentication system provides:

- Cookie-based token persistence
- Centralized auth state with React Query
- Route-level protection via Next.js middleware
- Permission-based access control
- Automatic token attachment to API requests
- Redirect-to-login pattern for protected routes

## Architecture

### Core Dependencies

- `@tanstack/react-query` v5.90.2 - For data fetching and caching
- `universal-cookie` v8.0.1 - For cookie management
- `zod` v4.1.12 - For schema validation

### File Structure

```
src/
├── api/
│   ├── constants.ts          # Auth constants (token names, API URL)
│   ├── cookie.ts              # Cookie management utilities
│   ├── fetch.ts               # API fetch wrapper with auth
│   └── auth.ts                # Auth functions and React Query options
├── hooks/
│   └── auth.ts                # Auth hooks for components
├── providers/
│   └── QueryProvider.tsx      # React Query provider
├── types/
│   └── auth.ts                # Auth TypeScript types and Zod schemas
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts      # Login endpoint
│   │       ├── me/route.ts         # Get user data endpoint
│   │       └── permissions/route.ts # Get permissions endpoint
│   ├── login/
│   │   └── page.tsx           # Login page
│   └── admin/
│       └── page.tsx           # Protected admin panel
└── middleware.ts              # Route protection middleware
```

## How It Works

### 1. Cookie-Based Token Storage

- Token stored in cookie named `MORDVEMBER-AccessToken`
- Cookie expires in 30 days
- Helper functions: `setCookie()`, `getCookie()`, `removeCookie()`

### 2. API Fetch Wrapper

- Custom `IFetch` function wraps native fetch
- Automatically attaches token to request headers as `X-CSRF-Token`
- Supports `withAuth` parameter to control authentication
- Base API URL from `NEXT_PUBLIC_API_URL` env variable (defaults to `/api`)

### 3. Authentication State Management

- Uses React Query with custom `authQueryOptions`
- Query key: `['auth']`
- Stale time: 2 minutes
- Auth object structure:

```typescript
{
  user: {
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    image: string | null,
    groups: Array<{
      id: string,
      name: string,
      isLeader: boolean
    }>
  },
  permissions: Record<string, {
    write: boolean,
    read: boolean,
    write_all?: boolean,
    destroy?: boolean
  }>
}
```

### 4. Authentication Functions

**`authClient()`** - Core auth checker:

- Checks if `ACCESS_TOKEN` cookie exists
- If no token, returns `undefined`
- If token exists, fetches user data and permissions
- Returns formatted auth object or `null` on error

**`loginUser(username, password)`**:

- Calls `/api/auth/login` endpoint
- Receives token in response
- Sets token in cookie
- Clears all React Query caches
- Fetches auth object

**`logoutUser()`**:

- Removes token from cookie
- Clears all React Query caches

**`invalidateAuth()`**:

- Invalidates the auth query cache
- Forces refetch on next auth check

**`userHasWritePermission(permissions, app, some)`**:

- Checks if user has write or write_all permission for given app(s)
- Supports single app or array of apps

### 5. React Hooks

**`useOptionalAuth()`**:

- Uses `useSuspenseQuery(authQueryOptions)`
- Returns auth object or `null`
- Doesn't throw if not authenticated

**`useAuth()`**:

- Calls `useOptionalAuth()`
- Throws error if auth is `null`
- Use this when component requires authentication

**`useAuthQuery()`**:

- Uses regular `useQuery(authQueryOptions)` (non-suspense)
- Returns auth object, loading state, error state
- More flexible for conditional auth

### 6. Route Protection

**Middleware** (`middleware.ts`):

- Runs on all `/admin/*` routes
- Checks for `ACCESS_TOKEN` cookie
- Redirects to `/login?redirectTo={path}` if no token

**Component-level**:

```typescript
const { data: auth, isLoading } = useAuthQuery();

if (isLoading) return <LoadingSpinner />;
if (!auth) return <NotAuthorized />;

// Render protected content
```

## Usage Examples

### Protect a Route

The middleware automatically protects `/admin/*` routes. To protect additional routes, update `middleware.ts`:

```typescript
export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*", // Add more protected routes
  ],
};
```

### Use Auth in Component

```typescript
"use client";

import { useAuth } from "@/hooks/auth";

export default function ProtectedComponent() {
  const auth = useAuth(); // Throws if not authenticated

  return (
    <div>
      <h1>Welcome, {auth.user.firstName}!</h1>
      <p>Email: {auth.user.email}</p>
    </div>
  );
}
```

### Optional Auth

```typescript
"use client";

import { useOptionalAuth } from "@/hooks/auth";

export default function OptionalAuthComponent() {
  const auth = useOptionalAuth();

  if (!auth) {
    return <p>Please log in to see your profile.</p>;
  }

  return <p>Welcome, {auth.user.firstName}!</p>;
}
```

### Check Permissions

```typescript
import { useAuth } from "@/hooks/auth";
import { userHasWritePermission } from "@/api/auth";

export default function AdminPanel() {
  const auth = useAuth();

  const canEditParticipants = userHasWritePermission(
    auth.permissions,
    "participants"
  );

  if (!canEditParticipants) {
    return <p>You don't have permission to edit participants.</p>;
  }

  return <EditForm />;
}
```

### Make Authenticated API Calls

```typescript
import { IFetch } from "@/api/fetch";

// Authenticated request (default)
const data = await IFetch("/api/participants", {
  method: "PUT",
  body: JSON.stringify({ playerId: 1, status: "dead" }),
});

// Unauthenticated request
const publicData = await IFetch("/api/public", {
  withAuth: false,
});
```

## Mock API Endpoints

The project includes mock authentication endpoints for testing:

- **POST `/api/auth/login`** - Login with username/password

  - Mock credentials: `username: "admin"`, `password: "admin123"`
  - Returns: `{ token: string, user: User }`

- **GET `/api/auth/me`** - Get current user data

  - Requires: Valid token in cookie
  - Returns: `User` object

- **GET `/api/auth/permissions`** - Get user permissions
  - Requires: Valid token in cookie
  - Returns: `Permission` object

### Customizing Mock Users

Edit `/src/app/api/auth/login/route.ts` to add more users:

```typescript
const MOCK_USERS = [
  {
    username: "admin",
    password: "admin123",
    id: "1",
    firstName: "Admin",
    lastName: "User",
    email: "admin@mordvember.no",
    // ... other fields
  },
  {
    username: "user2",
    password: "password123",
    id: "2",
    firstName: "Regular",
    lastName: "User",
    email: "user@mordvember.no",
    // ... other fields
  },
];
```

## Environment Variables

Create a `.env.local` file:

```env
# Optional: Use external API
NEXT_PUBLIC_API_URL=http://localhost:3001

# If not set, defaults to /api (uses local API routes)
```

## Integration with Backend

To integrate with a real backend API:

1. Set `NEXT_PUBLIC_API_URL` to your backend URL
2. Update the API endpoints in your backend to match:
   - `POST /auth/login` - Returns `{ token: string }`
   - `GET /auth/me` - Returns user data (requires token in `X-CSRF-Token` header)
   - `GET /auth/permissions` - Returns permissions (requires token)
3. Remove or update the mock API routes in `/src/app/api/auth/`

## Login Credentials (Development)

For testing with the mock API:

- **Username:** `admin`
- **Password:** `admin123`

The default admin user is an **Index leader**, which means they have full access to all admin features.

## Index Leader Access

Users who are members of a group named **"Index"** (case-insensitive) with `isLeader: true` will **automatically receive full permissions** to all admin features.

The system checks for Index leaders by:

1. Looking through all user groups
2. Checking if `group.name.toUpperCase() === "INDEX"`
3. Checking if `group.isLeader === true`
4. If both conditions are met, the user gets complete admin access

To add more users or modify access, see [ADDING_USERS.md](./ADDING_USERS.md).

⚠️ **Security Note:** This is a mock authentication system for development. In production:

- Use proper JWT token verification
- Hash passwords securely
- Implement token refresh mechanism
- Use HTTPS only
- Add CSRF protection
- Implement rate limiting on login endpoint
