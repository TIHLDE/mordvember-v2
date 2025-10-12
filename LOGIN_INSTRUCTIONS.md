# Login Instructions

## ✅ Login is Ready with TIHLDE API!

The authentication system is fully integrated with the TIHLDE API and ready to use.

## How to Login

1. **Start the development server:**

   ```bash
   pnpm dev
   ```

2. **Navigate to the admin panel:**

   - Go to: `http://localhost:3000/admin`
   - You'll be automatically redirected to the login page

3. **Login with your TIHLDE credentials:**

   - **Username:** Your TIHLDE user ID (same as tihlde.org)
   - **Password:** Your TIHLDE password

4. **Access Requirements:**

   - ⚠️ You **MUST** be a **leader of Index** to access the admin panel
   - OR have the username **'astaskj'** (special admin access)
   - The system will check your TIHLDE memberships
   - If you don't meet the requirements, you'll see: "Access denied. You must be an Index leader to access the admin panel."

5. **After successful login (if you have admin access):**
   - You'll be redirected back to the admin panel
   - You can manage participants (toggle alive/dead status)
   - Click "Logg ut" in the top-right to logout

## Admin Access ⭐

**Admins** get complete access, which includes:

- ✅ Full read access to all participants
- ✅ Full write access to modify participant status
- ✅ Complete admin panel access
- ✅ All permissions automatically granted

### What Makes Someone an Admin?

You have admin access if **either** of these conditions is true:

**Option 1: Index Leader**

- You are a member of the **Index** group on TIHLDE
- Your `membership_type` is **"LEADER"**

**Option 2: Special Admin User**

- Your TIHLDE username is **'astaskj'** (hardcoded admin access)

The system automatically:

- Fetches your user data from `https://api.tihlde.org/users/me/`
- Fetches your memberships from `https://api.tihlde.org/users/me/memberships/`
- Checks if any membership has:
  - Group name = "Index" (case-insensitive)
  - Membership type = "LEADER"
- OR checks if your user_id is 'astaskj'

If you don't meet any of these criteria, you'll receive an access denied error.

## Managing Access

Access is controlled through **TIHLDE's membership system**:

- To grant someone admin access, make them a **leader of Index** on TIHLDE
- To revoke access, remove their Index leader status on TIHLDE
- No code changes needed - the system checks memberships on every login

The system does **NOT** use a local user database - all authentication and authorization is done through the TIHLDE API.

## Troubleshooting

### "Feil brukernavn eller passord" Error

- Make sure you're using your correct TIHLDE credentials
- Verify your username and password work on tihlde.org
- Check that the development server is running
- Check that the TIHLDE API is accessible (https://api.tihlde.org)

### "Access denied. You must be an Index leader" Error

- This means you successfully logged in, but you're not a leader of Index
- Contact an Index administrator to be made a leader
- Verify your Index membership status on tihlde.org

### Can't Access Admin Panel After Login

- Check the browser console for errors
- Make sure cookies are enabled
- Try clearing your browser cookies and logging in again
- Verify the TIHLDE API is responding

### Token Issues

- If you get "Unauthorized" errors after logging in, try:
  1. Logout (click "Logg ut")
  2. Clear browser cookies
  3. Login again

## Technical Details

The authentication system uses:

- **TIHLDE API Integration** - Authenticates against https://api.tihlde.org
- **Cookie-based authentication** - Token stored in `MORDVEMBER-AccessToken` cookie
- **React Query** - For auth state management
- **Next.js Middleware** - For route protection
- **Shared token storage** - Token-to-user mapping in `tokenStore.ts`

When you login:

1. Username/password sent to `/api/auth/login`
2. System forwards credentials to TIHLDE API (`/auth/login/`)
3. TIHLDE API validates and returns a token
4. System fetches user data (`/users/me/`) and memberships (`/users/me/memberships/`)
5. Checks if user is an Index leader
6. If yes, stores token in cookie and caches user data
7. If no, returns access denied error
8. All API requests automatically include the token
9. Middleware checks token for protected routes

## Security Note ⚠️

This system uses **production TIHLDE API authentication**:

- ✅ All authentication is handled by TIHLDE's secure API
- ✅ No passwords are stored locally
- ✅ Tokens are managed securely in cookies
- ✅ Authorization is verified on every request

For production deployment:

- Deploy with HTTPS only
- Set secure cookie flags in production
- Implement rate limiting on login attempts
- Monitor for suspicious activity

## Questions?

- Full auth documentation: [AUTH_SETUP.md](./AUTH_SETUP.md)
- Project overview: [README.md](./README.md)
- TIHLDE API documentation: https://api.tihlde.org/docs/
