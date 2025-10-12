/**
 * Script to migrate existing participant images to Supabase Storage
 *
 * This script:
 * 1. Reads all images from /public/user-photos/
 * 2. Uploads them to Supabase Storage bucket
 * 3. Updates the database with new image URLs
 *
 * Usage:
 * 1. Make sure your .env file has all Supabase credentials
 * 2. Run: node migrate-images-to-storage.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = "mordvember-images";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials!");
  console.error(
    "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
  );
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateImages() {
  try {
    console.log("🚀 Starting image migration to Supabase Storage...\n");

    const imagesDir = path.join(__dirname, "public", "user-photos");

    // Check if directory exists
    if (!fs.existsSync(imagesDir)) {
      console.error(`❌ Directory not found: ${imagesDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(imagesDir);
    console.log(`📊 Found ${files.length} images to upload\n`);

    // Get all participants from database
    const { data: participants, error: fetchError } = await supabase
      .from("participants")
      .select("*")
      .order("player");

    if (fetchError) {
      console.error("❌ Error fetching participants:", fetchError);
      process.exit(1);
    }

    console.log(`📦 Found ${participants.length} participants in database\n`);

    let uploadedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const participant of participants) {
      const currentImageUrl = participant.image_url;

      // Skip if already using Supabase Storage
      if (currentImageUrl && currentImageUrl.includes("supabase.co")) {
        console.log(
          `⏭️  Skipped: ${participant.name} (already using Supabase Storage)`
        );
        skippedCount++;
        continue;
      }

      // Find the local file for this participant
      // Look for files starting with their player ID
      const playerFiles = files.filter((f) =>
        f.startsWith(`${participant.player} - `)
      );

      if (playerFiles.length === 0) {
        console.log(
          `⚠️  Warning: No local file found for ${participant.name} (player ${participant.player})`
        );
        skippedCount++;
        continue;
      }

      const fileName = playerFiles[0]; // Use the first match
      const filePath = path.join(imagesDir, fileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(
          `⚠️  Warning: File not found for ${participant.name}: ${fileName}`
        );
        skippedCount++;
        continue;
      }

      try {
        // Read the file
        const fileBuffer = fs.readFileSync(filePath);

        // Determine MIME type from extension
        const ext = path.extname(fileName).toLowerCase();
        const mimeTypes = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".jfif": "image/jpeg",
        };
        const contentType = mimeTypes[ext] || "image/jpeg";

        // Create a clean storage filename (remove Norwegian characters for Supabase compatibility)
        const timestamp = Date.now();
        const cleanName = participant.name
          .replace(/æ/g, "ae")
          .replace(/ø/g, "o")
          .replace(/å/g, "a")
          .replace(/Æ/g, "AE")
          .replace(/Ø/g, "O")
          .replace(/Å/g, "A")
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .replace(/\s+/g, "-");
        const storageFileName = `${participant.player}-${cleanName}${ext}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storageFileName, fileBuffer, {
            contentType,
            upsert: true, // Overwrite if exists
          });

        if (uploadError) {
          console.error(
            `❌ Upload failed for ${participant.name}:`,
            uploadError.message
          );
          errorCount++;
          continue;
        }

        // Get the public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storageFileName);

        uploadedCount++;
        console.log(`✅ Uploaded: ${fileName} → ${storageFileName}`);

        // Update the database
        const { error: updateError } = await supabase
          .from("participants")
          .update({ image_url: publicUrl })
          .eq("player", participant.player);

        if (updateError) {
          console.error(
            `❌ Database update failed for ${participant.name}:`,
            updateError.message
          );
          errorCount++;
        } else {
          updatedCount++;
          console.log(`   📝 Updated database for: ${participant.name}`);
        }
      } catch (error) {
        console.error(
          `❌ Error processing ${participant.name}:`,
          error.message
        );
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(50));
    console.log(`✅ Uploaded: ${uploadedCount} images`);
    console.log(`📝 Database updated: ${updatedCount} records`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("=".repeat(50));
    console.log("\n🎉 Migration complete!");

    if (errorCount === 0 && uploadedCount > 0) {
      console.log("\n✨ All images successfully migrated to Supabase Storage!");
      console.log(
        "   You can now safely remove /public/user-photos/ if desired."
      );
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateImages();
