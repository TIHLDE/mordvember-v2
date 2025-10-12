# Admin Panel Features

## ✨ New Features Added

### 1. Add Participants ✅

### 2. Confirmation Modal ✅

---

## Feature Details

### 1. Add New Participants

Admins can now add new participants directly from the admin panel.

**How to Use:**

1. **Click "Legg til deltaker" button** in the top-right corner
2. **Fill out the form:**
   - **Navn\*** (required) - Participant's full name
   - **Studie\*** (required) - Study program (e.g., "Informatikk")
   - **Klasse\*** (required) - Year/class (e.g., "1. klasse")
   - **Bilde URL** (optional) - Path to profile photo (e.g., "/user-photos/navn.jpg")
3. **Click "Legg til"** to add the participant
4. **Or click "Avbryt"** to cancel

**What Happens:**

- New participant is created with auto-incrementing player ID
- Status is automatically set to "alive"
- If no image URL provided, uses default placeholder
- Participant appears immediately in the grid
- All viewers see the new participant within 5 seconds

**Example:**

```
Name: Ola Nordmann
Study: Informatikk
Class: 3. klasse
Image URL: /user-photos/61 - Ola Nordmann.jpg
```

**Validation:**

- ✅ Name, study, and class are required
- ✅ Must be logged in as admin (Index leader or 'astaskj')
- ✅ Empty fields will show error
- ✅ Whitespace is automatically trimmed

### 2. Confirmation Modal for Status Changes

When clicking a participant to change their status, a confirmation popup appears.

**Flow:**

1. **Click on any participant card**
2. **Confirmation modal appears** with message:
   ```
   "Er du sikker på at du vil endre status for [Navn]
   fra [levende/død] til [død/levende]?"
   ```
3. **Choose:**
   - **"Ja, endre status"** - Confirms the change
   - **"Avbryt"** - Cancels, no change made

**Benefits:**

- ✅ Prevents accidental clicks
- ✅ Clear feedback about what will happen
- ✅ Easy to cancel if clicked by mistake
- ✅ Better UX for mobile users

**Example Confirmation:**

```
Title: "Bekreft statusendring"
Message: "Er du sikker på at du vil endre status for Daniel Evensen
         fra levende til død?"
Buttons: [Avbryt] [Ja, endre status]
```

---

## API Endpoints

### POST `/api/participants` - Add New Participant

**Request:**

```json
{
  "name": "Ola Nordmann",
  "study": "Informatikk",
  "class": "3. klasse",
  "imageUrl": "/user-photos/61 - Ola Nordmann.jpg"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "participant": {
    "player": 61,
    "name": "Ola Nordmann",
    "study": "Informatikk",
    "class": "3. klasse",
    "status": "alive",
    "imageUrl": "/user-photos/61 - Ola Nordmann.jpg"
  }
}
```

**Error Responses:**

- `401` - Unauthorized (no valid token)
- `400` - Missing required fields
- `500` - Server error

### PUT `/api/participants` - Update Participant Status

_(No changes - still works the same)_

**Request:**

```json
{
  "playerId": 1,
  "status": "dead"
}
```

---

## Admin Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│  Admin Panel - Mordvember 2025                          │
│  Klikk på en deltaker for å endre status                │
│  Innlogget som: Admin User                              │
│                                  [Legg til] [Logg ut]   │
├─────────────────────────────────────────────────────────┤
│  ✅ Success message appears here                        │
├─────────────────────────────────────────────────────────┤
│  📝 Add Participant Form (when visible)                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Legg til ny deltaker                           │   │
│  │  [Navn*] [Studie*]                              │   │
│  │  [Klasse*] [Bilde URL]                          │   │
│  │  [Legg til] [Avbryt]                            │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │ Card 1 │  │ Card 2 │  │ Card 3 │  │ Card 4 │       │
│  │ ✅ Alive│  │ 💀 Dead │  │ ✅ Alive│  │ ✅ Alive│       │
│  └────────┘  └────────┘  └────────┘  └────────┘       │
│  ... (grid continues)                                   │
└─────────────────────────────────────────────────────────┘

When participant clicked:
┌─────────────────────────────────┐
│  Bekreft statusendring          │
├─────────────────────────────────┤
│  Er du sikker på at du vil      │
│  endre status for Daniel        │
│  Evensen fra levende til død?   │
├─────────────────────────────────┤
│         [Avbryt] [Ja, endre]    │
└─────────────────────────────────┘
```

---

## Testing the New Features

### Test Adding Participants:

1. **Login to admin panel**
2. **Click "Legg til deltaker"**
3. **Fill out form:**
   ```
   Navn: Test Person
   Studie: Test Studie
   Klasse: 1. klasse
   Bilde URL: (leave empty for default)
   ```
4. **Click "Legg til"**
5. **Verify:**
   - ✅ Success message appears
   - ✅ New participant in grid
   - ✅ Has highest player ID
   - ✅ Status is "alive"
   - ✅ Form resets

### Test Confirmation Modal:

1. **Click any participant card**
2. **Verify:**
   - ✅ Modal appears
   - ✅ Shows correct name and status change
   - ✅ "Avbryt" cancels (no change)
   - ✅ "Ja, endre status" changes status
   - ✅ Modal closes after action

---

## Security

Both features require authentication:

✅ **Check 1:** Valid auth token in cookie  
✅ **Check 2:** User is Index leader OR username is 'astaskj'  
✅ **Check 3:** Token verified on every request

Unauthenticated users **cannot:**

- ❌ Add participants
- ❌ Change participant status
- ❌ Access admin panel

---

## Data Persistence

### What Gets Saved:

**File:** `src/data/participants.json`

**Adding Participant:**

```json
// Before
[
  { "player": 60, "name": "Last Person", ... }
]

// After adding
[
  { "player": 60, "name": "Last Person", ... },
  { "player": 61, "name": "New Person", "status": "alive", ... }
]
```

**Changing Status:**

```json
// Before
{ "player": 1, "status": "alive", ... }

// After
{ "player": 1, "status": "dead", ... }
```

---

## Mobile Experience

Both features are mobile-friendly:

### Add Form:

- ✅ Responsive layout (1 column on mobile, 2 on desktop)
- ✅ Touch-friendly input fields
- ✅ Keyboard navigation
- ✅ Form validation

### Confirmation Modal:

- ✅ Centers on screen
- ✅ Readable text size
- ✅ Touch-friendly buttons
- ✅ Dark overlay (clearly visible)
- ✅ Prevents accidental taps

---

## Troubleshooting

### "Unauthorized" Error When Adding Participant

**Problem:** Not logged in or session expired

**Solution:**

1. Logout
2. Login again with TIHLDE credentials
3. Verify you're Index leader or 'astaskj'

### Form Validation Errors

**Problem:** Required fields empty

**Solution:**

- Fill out all fields marked with \*
- Name, study, and class are required
- Image URL is optional

### Participant Not Appearing

**Problem:** Cache not updated

**Solution:**

- Wait 5 seconds for auto-refresh
- Or refresh page manually
- Check browser console for errors

### Modal Not Showing

**Problem:** JavaScript error

**Solution:**

- Check browser console
- Refresh page
- Clear browser cache

---

## Best Practices

### When Adding Participants:

1. ✅ **Use consistent naming** (e.g., "Fornavn Etternavn")
2. ✅ **Include study program** (e.g., "Informatikk", "Data")
3. ✅ **Specify class correctly** (e.g., "1. klasse", "2. klasse")
4. ✅ **Upload photo first** to `/public/user-photos/` before adding
5. ✅ **Use correct path** format: `/user-photos/filename.jpg`

### When Changing Status:

1. ✅ **Always confirm** - Double-check before clicking "Ja"
2. ✅ **Use consistently** - Dead = eliminated, Alive = still playing
3. ✅ **Verify visually** - Check card color change (red = dead, green = alive)

---

## What's Next?

Possible future enhancements:

- 🔮 Edit participant details
- 🔮 Delete participants
- 🔮 Upload images directly through form
- 🔮 Bulk operations
- 🔮 Search/filter participants
- 🔮 Undo last action
- 🔮 Activity log/history

---

## Summary

### Admin Can Now:

✅ **Add new participants** with form  
✅ **See confirmation** before status change  
✅ **Cancel accidental clicks**  
✅ **View success messages**  
✅ **See changes immediately**

### All Changes Are:

✅ **Authenticated** - Requires valid login  
✅ **Validated** - Required fields checked  
✅ **Persistent** - Saved to JSON file  
✅ **Real-time** - Visible to all viewers  
✅ **Reversible** - Can toggle status back

Your admin panel is now more powerful and user-friendly! 🎉
