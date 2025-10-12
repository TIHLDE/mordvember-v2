import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ACCESS_TOKEN = "MORDVEMBER-AccessToken";
const BUCKET_NAME = "mordvember-images";

export async function POST(request: NextRequest) {
  try {
    // Check authentication via cookie
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_TOKEN);

    if (!token || !token.value) {
      return NextResponse.json(
        { error: "Unauthorized - No valid token" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const participantName = formData.get("participantName") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Create a unique filename (convert Norwegian characters for Supabase compatibility)
    const fileExt = file.name.split(".").pop();
    const sanitizedName = participantName
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/Æ/g, "AE")
      .replace(/Ø/g, "O")
      .replace(/Å/g, "A")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    const fileName = `${Date.now()}-${sanitizedName}.${fileExt}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json(
        { error: `Failed to upload image: ${error.message}` },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: data.path,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
