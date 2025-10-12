/**
 * Script to migrate participants from JSON file to Supabase
 *
 * Usage:
 * 1. Set up your Supabase project at https://supabase.com
 * 2. Run the schema in supabase-schema.sql in your Supabase SQL Editor
 * 3. Get your Supabase URL and Service Role Key (from Settings > API)
 * 4. Set environment variables:
 *    NEXT_PUBLIC_SUPABASE_URL=your-url
 *    SUPABASE_SERVICE_ROLE_KEY=your-service-key
 * 5. Run: node migrate-to-supabase.js
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials!");
  console.error(
    "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
  );
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateData() {
  try {
    console.log("🚀 Starting migration to Supabase...\n");

    // Read participants from JSON file
    const jsonPath = path.join(__dirname, "src", "data", "participants.json");
    const jsonData = fs.readFileSync(jsonPath, "utf-8");
    const participants = JSON.parse(jsonData);

    console.log(`📊 Found ${participants.length} participants in JSON file\n`);

    // Check if table already has data
    const { data: existingData, error: checkError } = await supabase
      .from("participants")
      .select("player")
      .limit(1);

    if (checkError) {
      console.error("❌ Error checking existing data:", checkError);
      console.error(
        "Make sure you have run the schema from supabase-schema.sql first!"
      );
      process.exit(1);
    }

    if (existingData && existingData.length > 0) {
      console.log("⚠️  Warning: Table already contains data!");
      console.log(
        "This script will skip existing records and only add new ones.\n"
      );
    }

    // Transform and insert data
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const participant of participants) {
      // Transform imageUrl to image_url (snake_case for database)
      const dbParticipant = {
        player: participant.player,
        name: participant.name,
        study: participant.study,
        class: participant.class,
        status: participant.status,
        image_url: participant.imageUrl,
      };

      // Try to insert (will skip if player ID already exists due to UNIQUE constraint)
      const { data, error } = await supabase
        .from("participants")
        .upsert(dbParticipant, {
          onConflict: "player",
          ignoreDuplicates: false,
        });

      if (error) {
        if (error.code === "23505") {
          // Duplicate key error - record already exists
          skipCount++;
          console.log(
            `⏭️  Skipped: ${participant.name} (player ${participant.player}) - already exists`
          );
        } else {
          errorCount++;
          console.error(
            `❌ Error inserting ${participant.name}:`,
            error.message
          );
        }
      } else {
        successCount++;
        console.log(
          `✅ Inserted: ${participant.name} (player ${participant.player})`
        );
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`   ✅ Successfully inserted: ${successCount}`);
    console.log(`   ⏭️  Skipped (already exist): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("\n🎉 Migration complete!");

    // Verify the data
    const { data: finalData, error: verifyError } = await supabase
      .from("participants")
      .select("*")
      .order("player");

    if (!verifyError) {
      console.log(
        `\n✓ Verified: ${finalData.length} total participants in database`
      );
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateData();
