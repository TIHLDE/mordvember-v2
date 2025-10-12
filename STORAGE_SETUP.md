# Supabase Storage Setup for Participant Images

## Overview

The admin panel now uploads participant images directly to Supabase Storage instead of using local files.

## Setup Instructions

### 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** (left sidebar)
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name**: `participant-images` (or your preferred name)
   - **Public bucket**: ✅ Check this box (images need to be publicly accessible)
   - Click **"Create bucket"**

### 2. Update Bucket Name in Code

If you named your bucket something other than `participant-images`, update the constant in:

**File**: `src/app/api/upload-image/route.ts`

```typescript
const BUCKET_NAME = "participant-images"; // Change to your bucket name
```

### 3. Configure Storage Policies (Optional but Recommended)

For better security, you can set up Row Level Security (RLS) policies:

1. In Supabase, go to **Storage** → **Policies** → `participant-images`
2. **For reading images** (already public):

   - Policy name: "Public read access"
   - Allowed operation: SELECT
   - Policy definition: `true` (allow all)

3. **For uploading images** (admin only):
   - Policy name: "Authenticated upload"
   - Allowed operation: INSERT
   - Policy definition: `(auth.role() = 'authenticated')`

> Note: Since we're using the service role key in the API route, it bypasses RLS, but these policies are good practice for direct client access.

## How It Works

### Admin Workflow

1. Admin opens `/admin` and clicks **"Legg til deltaker"**
2. Fills in participant details (name, study, class)
3. **Selects an image file** using the file picker
4. Clicks **"Legg til"**
5. The image is uploaded to Supabase Storage
6. The participant is created with the public URL from Storage
7. Image appears immediately in the grid

### Technical Flow

```
User selects image
    ↓
handleAddParticipant()
    ↓
Upload to /api/upload-image
    ↓
Supabase Storage (participant-images bucket)
    ↓
Get public URL
    ↓
Create participant in database with image URL
    ↓
Display on homepage & admin panel
```

## Supported File Types

- ✅ JPEG/JPG
- ✅ PNG
- ✅ GIF
- ✅ WebP
- ✅ Any image/\* MIME type

## File Naming

Files are automatically renamed to prevent conflicts:

```
{timestamp}-{sanitized-participant-name}.{extension}

Example: 1697234567890-daniel-evensen.jpeg
```

## Storage Limits

Supabase free tier includes:

- ✅ 1 GB storage
- ✅ 2 GB bandwidth per month
- ✅ Unlimited image transformations

For production with many participants, consider upgrading if needed.

## Security

- ✅ **Authentication required**: Only logged-in admins can upload
- ✅ **File type validation**: Only images are accepted
- ✅ **Unique filenames**: Prevents overwriting existing files
- ✅ **Public bucket**: Images are publicly accessible (needed for display)

## Migrating Existing Images

If you have existing images in `/public/user-photos/`, you have two options:

### Option 1: Upload via Admin Panel

Re-add each participant through the admin interface with their image.

### Option 2: Bulk Upload Script

Create a migration script to upload existing images:

```javascript
// upload-existing-images.js
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ... implementation to bulk upload from /public/user-photos/
```

## Troubleshooting

### Error: "Failed to upload image"

- Check that the bucket exists and is named correctly
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check Supabase Storage logs in dashboard

### Error: "Unauthorized"

- Ensure you're logged in as admin
- Verify the access token cookie is present

### Images not displaying

- Check that the bucket is set to **Public**
- Verify the public URL is correct in the database
- Check browser console for CORS errors

### "Bucket not found" error

- Make sure the bucket name in `route.ts` matches your Supabase bucket
- The bucket must be created in the same Supabase project

## Benefits

✅ **Production-ready**: Works on any hosting platform  
✅ **Scalable**: Handles any number of images  
✅ **Fast**: Images served from Supabase CDN  
✅ **Organized**: All images in one managed location  
✅ **Automatic**: No manual file management needed

## Related Documentation

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Storage Management](https://supabase.com/docs/guides/storage/management/buckets)
- [Image Transformations](https://supabase.com/docs/guides/storage/image-transformations)
