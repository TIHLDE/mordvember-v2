
## Authentication System Architecture

### Core Dependencies
- `@tanstack/react-query` v5.90.2 - For data fetching and caching
- `universal-cookie` v8.0.1 - For cookie management
- `react-router` v7.9.3 - For routing and navigation
- `zod` v4.1.12 - For schema validation

### Authentication Flow

**1. Cookie-Based Token Storage**
- Uses `universal-cookie` library
- Token stored in cookie named `TIHLDE-AccessToken` (from `ACCESS_TOKEN` constant)
- Cookie expires in 30 days (3600 * 24000 * 30 seconds)
- Helper functions in `src/api/cookie.tsx`:
  - `setCookie(key, value, duration)` - stores cookie with path '/'
  - `getCookie(key)` - retrieves cookie value
  - `removeCookie(key)` - removes cookie

**2. API Fetch Wrapper**
- Custom `IFetch` function in `src/api/fetch.tsx`
- Attaches token to request headers as `X-CSRF-Token` (from `TOKEN_HEADER_NAME` constant)
- Uses `withAuth` parameter (defaults to `true`) to control authentication
- For authenticated requests: reads token from cookie via `getCookie(ACCESS_TOKEN)` and adds to header
- Base API URL from environment variable `VITE_API_URL`

**3. Authentication State Management**
- Uses React Query with custom `authQueryOptions` in `src/api/auth.ts`
- Query key: `['auth']`
- Stale time: 2 minutes (frequent checking)
- Auth object structure (validated with Zod):
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
  }>,
  tihldeUser: User // full user object
}
```

**4. Root Loader Pattern**
- In `src/root.tsx`, the `clientLoader` function calls `authClient()` on app initialization
- This pre-populates the auth query cache on app load
- Does not block rendering - auth is optional at root level

**5. Authentication Functions**

`authClient()` - Core auth checker:
- Checks if `ACCESS_TOKEN` cookie exists
- If no token, returns `undefined`
- If token exists, calls `ensureQueryData(authQueryOptions)` which:
  - Fetches user data via `API.getUserData()`
  - Fetches permissions via `API.getUserPermissions()`
  - Fetches memberships via `API.getUserMemberships()`
  - Returns formatted auth object or `null` on error
- On error, invalidates auth cache

`loginUser(username, password)`:
- Calls `API.authenticate(username, password)` endpoint (`POST /auth/login/`)
- Receives token in response
- Sets token in cookie via `setCookie(ACCESS_TOKEN, token)`
- Clears all React Query caches via `getQueryClient().removeQueries()`
- Calls `authClient()` to fetch auth object
- Throws error if auth fetch fails

`authClientWithRedirect(request)` - Protected route helper:
- Calls `authClient()`
- If not authenticated, throws redirect to login page with `redirectTo` query param
- Login URL: `/logg-inn?redirectTo={currentPath}`
- Returns auth object if authenticated

`userHasWritePermission(permissions, app, some)`:
- Checks if user has write or write_all permission for given app(s)
- Supports single app or array of apps
- `some` parameter: if true, user needs permission for at least one app; if false, needs all

`invalidateAuth()`:
- Invalidates the auth query cache
- Forces refetch on next `authClient()` call

**6. React Hooks**

In `src/hooks/auth.ts`:

`useOptionalAuth()`:
- Uses `useSuspenseQuery(authQueryOptions)`
- Returns auth object or `null`
- Always succeeds (doesn't throw if not authenticated)

`useAuth()`:
- Calls `useOptionalAuth()`
- Throws error if auth is `null` (enforces authentication at component level)
- Use this when component requires authentication

`useAuthQuery()`:
- Uses regular `useQuery(authQueryOptions)` (non-suspense)
- Returns auth object, loading state, error state
- More flexible for conditional auth

**7. Route Protection Patterns**

Pattern A - Optional auth (Profile example):
```typescript
export async function clientLoader({ params, request }) {
  const auth = await authClient();
  if (!params.userId && !auth) {
    // Only redirect if accessing own profile without auth
    return redirect(createLoginRedirectUrl(request));
  }
}
```

Pattern B - Required auth with permission check:
```typescript
export async function clientLoader({ request }) {
  const auth = await authClientWithRedirect(request);
  
  if (!userHasWritePermission(auth.permissions, PermissionApp.EVENT)) {
    return redirect(href('/'));
  }
  return { /* loader data */ };
}
```

**8. Login Page**
- Located at `src/pages/LogIn/index.tsx`
- Uses React Router `clientAction` for form submission
- Validates credentials with Zod schema
- Calls `loginUser(username, password)`
- Redirects to `redirectTo` query param or '/' on success
- Returns error object on failure

**9. Query Client Configuration**
- Singleton pattern: one client for browser, new client per request on server
- Query defaults in `src/queryClient.tsx`:
  - `staleTime: 5 minutes` (default)
  - `gcTime: Infinity` (never garbage collect)
- Auth query overrides staleTime to 2 minutes for frequent checking

**10. API Endpoints**
- Authentication: `POST /auth/login/` (username/password, returns token)
- User data: `GET /users/me/`
- Permissions: `GET /users/me/permissions/`
- Memberships: `GET /users/me/memberships/`

**11. Key Constants** (from `src/constant.tsx`):
- `TIHLDE_API_URL` - Backend URL from env
- `ACCESS_TOKEN = 'TIHLDE-AccessToken'` - Cookie name
- `TOKEN_HEADER_NAME = 'X-CSRF-Token'` - Auth header name

**12. Environment Variables Required**:
- `VITE_API_URL` - Backend API base URL

---

This is a **React Query-based, cookie-stored JWT authentication system** with:
- Centralized auth state in React Query cache
- Cookie-based token persistence
- Route-level protection via loaders
- Permission-based access control
- Automatic token attachment to API requests
- Redirect-to-login pattern for protected routes

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
  }>,
  tihldeUser: User // full user object
}
```

```typescript
export async function clientLoader({ params, request }) {
  const auth = await authClient();
  if (!params.userId && !auth) {
    // Only redirect if accessing own profile without auth
    return redirect(createLoginRedirectUrl(request));
  }
}
```

```typescript
export async function clientLoader({ request }) {
  const auth = await authClientWithRedirect(request);
  
  if (!userHasWritePermission(auth.permissions, PermissionApp.EVENT)) {
    return redirect(href('/'));
  }
  return { /* loader data */ };
}
```

