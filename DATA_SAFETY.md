# Data Safety & Storage Documentation

## ✅ NO Database in This Project

**Your project does NOT use any database.** All data is stored in a simple JSON file.

## What Gets Modified

### Only File That Changes: `src/data/participants.json`

This is the **ONLY** file that your admin panel can modify. It contains participant data.

**Example structure:**

```json
[
  {
    "player": 1,
    "name": "Daniel Evensen",
    "study": "Informatikk",
    "class": "4. klasse",
    "status": "alive",
    "imageUrl": "/user-photos/1 - Daniel Evensen.jpeg"
  }
]
```

### What Can Be Changed

**Only the `status` field** can be modified:

- From `"alive"` to `"dead"`
- From `"dead"` to `"alive"`

**Nothing else can be changed** through the admin panel.

### What Cannot Be Changed

❌ Player ID  
❌ Name  
❌ Study program  
❌ Class  
❌ Image URL  
❌ Any other participant data

## Authentication System & Data Safety

### What the Auth System Does

The authentication system using TIHLDE API:

- ✅ Validates user credentials against TIHLDE API
- ✅ Stores auth **token** in browser cookie
- ✅ Checks user permissions

### What the Auth System Does NOT Do

❌ Does NOT modify any participant data  
❌ Does NOT write to any database  
❌ Does NOT modify `participants.json`  
❌ Does NOT store user data permanently (only cached in memory)

### Token Storage

**Where tokens are stored:**

1. **Browser cookies** - Temporary, per-user
2. **Server memory** - `tokenUserMap` (cleared on restart)

**What is NOT stored:**

- ❌ No passwords stored
- ❌ No user database
- ❌ No persistent auth data

## Data Flow Diagram

### When Admin Changes Participant Status:

```
User clicks participant
    ↓
Admin panel sends request to /api/participants
    ↓
Server checks: Does user have valid token?
    ↓
Server reads: src/data/participants.json
    ↓
Server updates: ONLY the "status" field
    ↓
Server writes: Back to src/data/participants.json
    ↓
Done
```

### When User Logs In:

```
User enters TIHLDE credentials
    ↓
Server forwards to: TIHLDE API (https://api.tihlde.org)
    ↓
TIHLDE API validates credentials
    ↓
TIHLDE returns: Token
    ↓
Server stores: Token in cookie + memory cache
    ↓
Server fetches: User data from TIHLDE API
    ↓
Server stores: User data in memory (temporary)
    ↓
Done - NO FILES MODIFIED
```

## Files Overview

### Files That CAN Be Modified

1. **`src/data/participants.json`** ⚠️
   - Only file that changes
   - Only `status` field can be updated
   - Requires valid admin authentication
   - Changes made through admin panel only

### Files That CANNOT Be Modified (By App)

✅ All source code files (`.ts`, `.tsx`)  
✅ Configuration files (`.env`, `next.config.js`)  
✅ Authentication files (`src/app/api/auth/*`)  
✅ User photos (`public/user-photos/*`)  
✅ All other files

## Safety Checks

### 1. Authentication Required

To modify `participants.json`, user must:

- ✅ Have valid TIHLDE credentials
- ✅ Be an Index leader OR username 'astaskj'
- ✅ Have valid token in cookie

### 2. Limited Operations

Admin can ONLY:

- ✅ View participant list
- ✅ Toggle status (alive ↔ dead)

Admin CANNOT:

- ❌ Delete participants
- ❌ Add participants
- ❌ Modify names, studies, classes
- ❌ Change images
- ❌ Access any other files

### 3. No Database Operations

The app has:

- ❌ No database connection
- ❌ No SQL queries
- ❌ No database credentials
- ❌ No database migrations
- ❌ No ORM (Prisma, Sequelize, etc.)

## Verifying Safety

### Check What Files Can Be Modified

Look at the PUT endpoint in `/src/app/api/participants/route.ts`:

```typescript
export async function PUT(request: NextRequest) {
  // ... auth checks ...

  const { playerId, status } = body; // Only accepts playerId and status

  // Find participant
  const participant = participants.find((p: any) => p.player === playerId);

  participant.status = status; // ONLY updates status field

  // Write back to SAME file
  writeFileSync(dataPath, JSON.stringify(participants, null, 2));
}
```

**Notice:**

- Only reads from `participants.json`
- Only modifies `status` field
- Only writes back to `participants.json`
- No database operations
- No other files touched

### Check Auth Files

All auth files in `/src/app/api/auth/`:

- `login/route.ts` - Calls TIHLDE API, stores token in memory
- `me/route.ts` - Fetches from TIHLDE API
- `permissions/route.ts` - Checks permissions from cached data

**None of these files:**

- ❌ Write to disk
- ❌ Modify any files
- ❌ Touch database
- ❌ Modify participants.json

## Backup Recommendations

Since `participants.json` is the only file that changes:

### Before Deployment

1. **Backup `participants.json`:**

   ```bash
   cp src/data/participants.json src/data/participants.backup.json
   ```

2. **Use version control:**
   ```bash
   git add src/data/participants.json
   git commit -m "Backup participants before deployment"
   ```

### Regular Backups

Create a backup script (optional):

```bash
#!/bin/bash
# backup-participants.sh
DATE=$(date +%Y%m%d_%H%M%S)
cp src/data/participants.json backups/participants_$DATE.json
echo "Backup created: participants_$DATE.json"
```

### Restore from Backup

If needed, simply replace the file:

```bash
cp backups/participants_20250112_120000.json src/data/participants.json
```

## Production Safety

### What Happens in Production

1. **On Vercel/Netlify:**

   - Each deployment gets a fresh copy of `participants.json`
   - File changes are stored in the deployed instance
   - File resets on each new deployment

2. **To Persist Changes Across Deployments:**
   - Consider moving to a database (MongoDB, PostgreSQL)
   - Or use persistent file storage (S3, Google Cloud Storage)
   - Current setup: Changes lost on redeploy ⚠️

### Production Warning

⚠️ **Important:** With JSON file storage:

- Changes persist during runtime
- Changes are LOST on new deployment
- Consider database for production if you need persistence

## Summary

### What You Can Be Confident About:

✅ **No database exists** - Impossible to modify database  
✅ **Only `participants.json` can change** - One file, one field  
✅ **Auth is read-only** - Only validates, never modifies data  
✅ **All changes logged** - Can see in admin panel messages  
✅ **Changes are reversible** - Toggle status back anytime  
✅ **Source code untouched** - App cannot modify its own code  
✅ **TIHLDE data safe** - Only reads from TIHLDE API, never writes

### The Complete Truth:

**There is NO database in this project. Period.**

The only thing that can be modified is:

- **File:** `src/data/participants.json`
- **Field:** `status` only
- **Values:** `"alive"` or `"dead"`
- **Who:** Index leaders or 'astaskj' only
- **How:** Through admin panel only

Everything else is completely safe and untouched.

## Testing Data Safety

### Test 1: Verify Only Status Changes

1. Note a participant's current data:

   ```json
   {
     "player": 1,
     "name": "Daniel Evensen",
     "study": "Informatikk",
     "class": "4. klasse",
     "status": "alive"
   }
   ```

2. Toggle status in admin panel

3. Check file - only status changed:
   ```json
   {
     "player": 1,
     "name": "Daniel Evensen",
     "study": "Informatikk",
     "class": "4. klasse",
     "status": "dead" // ← Only this changed
   }
   ```

### Test 2: Verify No Database Connections

Search your entire codebase:

```bash
# Search for database keywords
grep -r "database" src/
grep -r "prisma" src/
grep -r "mongoose" src/
grep -r "sequelize" src/
grep -r "mongodb" src/
grep -r "postgresql" src/
grep -r "mysql" src/

# Result: Should find nothing (or only in comments/docs)
```

### Test 3: Check Dependencies

```bash
cat package.json | grep -E "(prisma|mongoose|pg|mysql|mongodb)"

# Result: Should find nothing
```

## Questions?

**Q: Can the auth system modify participant data?**  
A: No. Auth only validates users and stores tokens temporarily.

**Q: What if someone hacks the admin panel?**  
A: They can only toggle status fields. No other data can be changed.

**Q: Is TIHLDE database safe?**  
A: Yes. Your app only **reads** from TIHLDE API, never writes.

**Q: Can I accidentally delete participants?**  
A: No. There's no delete functionality in the admin panel.

**Q: What if participants.json gets corrupted?**  
A: Restore from backup or git history.

**Q: Can this affect my production database elsewhere?**  
A: Impossible. This project has no database connections at all.
