# TIHLDE API Integration

## Overview

This project is fully integrated with the **TIHLDE API** for authentication and authorization. It uses the production TIHLDE API at `https://api.tihlde.org` to:

1. Authenticate users with their TIHLDE credentials
2. Fetch user profile data
3. Check group memberships and leadership status
4. Authorize Index leaders for admin access

## How It Works

### 1. Authentication Flow

```
User enters credentials → Login page (/login)
    ↓
POST /api/auth/login
    ↓
Forward to TIHLDE API: POST /auth/login/
    ↓
TIHLDE returns token
    ↓
Fetch user data: GET /users/me/
    ↓
Fetch memberships: GET /users/me/memberships/
    ↓
Check if user is Index leader OR username is 'astaskj'
    ↓
If yes: Store token in cookie, grant access
If no: Return 403 Access Denied
```

### 2. Admin Access Check

The system verifies admin access by checking two conditions:

**Condition 1: Index Leader**

```typescript
function isIndexLeader(memberships: any[]): boolean {
  return memberships.some((membership: any) => {
    const groupName = membership.group?.name || membership.name;
    const isLeader = membership.membership_type === "LEADER";
    return groupName?.toUpperCase() === "INDEX" && isLeader;
  });
}
```

**Condition 2: Special Admin User**

```typescript
const hasAccess = isIndexLeader(memberships) || userData.user_id === "astaskj";
```

If **either** condition is true, the user is granted admin access.

### 3. Token Management

- Token received from TIHLDE API is stored in cookie: `MORDVEMBER-AccessToken`
- Cookie expires in 30 days
- Token is automatically attached to all API requests via `X-CSRF-Token` header
- Token maps to cached user data in `tokenStore`

### 4. API Endpoints

#### POST `/api/auth/login`

Authenticates user with TIHLDE API.

**Request:**

```json
{
  "username": "user_id",
  "password": "password"
}
```

**Success Response (200):**

```json
{
  "token": "abc123...",
  "user": {
    "id": "user_id",
    "firstName": "First",
    "lastName": "Last",
    "email": "user@example.com",
    "image": "https://...",
    "groups": [
      {
        "id": "index",
        "name": "Index",
        "isLeader": true
      }
    ]
  },
  "isIndexLeader": true
}
```

**Error Responses:**

- `401` - Invalid credentials
- `403` - Not an Index leader
- `500` - Server error

#### GET `/api/auth/me`

Fetches current user data (requires valid token).

**Response:**

```json
{
  "id": "user_id",
  "firstName": "First",
  "lastName": "Last",
  "email": "user@example.com",
  "image": "https://...",
  "groups": [...]
}
```

#### GET `/api/auth/permissions`

Fetches user permissions (requires valid token and Index leader status).

**Success Response (200):**

```json
{
  "participants": {
    "read": true,
    "write": true,
    "write_all": true,
    "destroy": true
  },
  "admin": {
    "read": true,
    "write": true,
    "write_all": true,
    "destroy": true
  }
}
```

**Error Response:**

- `403` - Not an Index leader

## Environment Configuration

The TIHLDE API URL is configured via environment variable:

```env
NEXT_PUBLIC_API_URL=https://api.tihlde.org
```

This is set in `.env.local` and used throughout the application.

## Data Transformation

TIHLDE API data is transformed to match our internal schema:

### TIHLDE User Format → Our Format

```typescript
// TIHLDE API
{
  user_id: "string",
  first_name: "string",
  last_name: "string",
  email: "string",
  image: "string"
}

// Our format
{
  id: "string",
  firstName: "string",
  lastName: "string",
  email: "string",
  image: "string"
}
```

### TIHLDE Membership Format → Our Format

```typescript
// TIHLDE API
{
  id: number,
  group: {
    slug: "string",
    name: "string"
  },
  membership_type: "LEADER" | "MEMBER"
}

// Our format
{
  id: "string",
  name: "string",
  isLeader: boolean
}
```

## Caching Strategy

To reduce API calls to TIHLDE:

1. **On Login:**

   - Fetch user data and memberships
   - Store in `tokenUserMap` with token as key
   - Cache persists in memory while server is running

2. **On Subsequent Requests:**

   - Check `tokenUserMap` first
   - If found, use cached data
   - If not found, fetch from TIHLDE API and cache

3. **Cache Invalidation:**
   - Clearing cookies invalidates the cache
   - Server restart clears all cached data

## Testing

### Test with Real TIHLDE Credentials

1. Make sure you're an Index leader on TIHLDE
2. Run the development server: `pnpm dev`
3. Navigate to: `http://localhost:3000/admin`
4. Login with your TIHLDE credentials
5. You should be redirected to the admin panel

### Test Access Denial

1. Login with TIHLDE credentials of a non-Index leader
2. You should see: "Access denied. You must be an Index leader to access the admin panel."

## Debugging

### Enable API Logging

Check the terminal/server logs for TIHLDE API calls:

```
TIHLDE auth error: [error details]
Login error: [error details]
Get user data error: [error details]
Get permissions error: [error details]
```

### Check Token

In browser DevTools → Application → Cookies:

- Look for `MORDVEMBER-AccessToken`
- Value should be a long hex string

### Test TIHLDE API Directly

```bash
# Test login
curl -X POST https://api.tihlde.org/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"user_id":"your_user_id","password":"your_password"}'

# Test user data (with token)
curl https://api.tihlde.org/users/me/ \
  -H "X-CSRF-Token: YOUR_TOKEN"

# Test memberships (with token)
curl https://api.tihlde.org/users/me/memberships/ \
  -H "X-CSRF-Token: YOUR_TOKEN"
```

## Security Considerations

### ✅ What's Secure

- No passwords stored locally
- All authentication delegated to TIHLDE API
- Tokens are HTTP-only cookies (in production)
- Authorization checked on every request
- No local user database to breach

### ⚠️ Production Recommendations

1. **Use HTTPS only** - Set secure cookie flags
2. **Rate limiting** - Prevent brute force attacks
3. **Token expiration** - Implement refresh token mechanism
4. **CORS configuration** - Restrict to allowed origins
5. **Monitoring** - Log failed auth attempts
6. **Input validation** - Sanitize all inputs

## Troubleshooting Common Issues

### "Failed to fetch user data from TIHLDE API"

- Check network connectivity
- Verify TIHLDE API is online: https://api.tihlde.org
- Check if token is valid
- Look for CORS errors in browser console

### "Access denied. You must be an Index leader."

- Verify user is a leader of Index on TIHLDE
- Check membership data in server logs
- Ensure membership_type is "LEADER" not "MEMBER"

### Token expired errors

- TIHLDE tokens may expire
- User needs to login again
- Consider implementing token refresh

## API Documentation

Full TIHLDE API documentation: https://api.tihlde.org/docs/

Key endpoints used:

- `POST /auth/login/` - Authenticate user
- `GET /users/me/` - Get current user profile
- `GET /users/me/memberships/` - Get user's group memberships
