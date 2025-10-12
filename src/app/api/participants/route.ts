import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ACCESS_TOKEN = "MORDVEMBER-AccessToken";

export async function GET() {
  try {
    // Use public client for read operations
    const { data: participants, error } = await supabase
      .from("participants")
      .select("*")
      .order("player");

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch participants" },
        { status: 500 }
      );
    }

    // Transform database records to match frontend format (snake_case -> camelCase)
    const transformedParticipants = participants.map((p) => ({
      player: p.player,
      name: p.name,
      study: p.study,
      class: p.class,
      status: p.status,
      imageUrl: p.image_url,
    }));

    return NextResponse.json(transformedParticipants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    return NextResponse.json(
      { error: "Failed to read participants" },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { name, study, class: participantClass, imageUrl } = body;

    // Validate required fields
    if (!name || !study || !participantClass) {
      return NextResponse.json(
        { error: "Name, study, and class are required" },
        { status: 400 }
      );
    }

    // Find highest player ID and increment using Supabase
    const { data: maxPlayerData, error: maxError } = await supabaseAdmin
      .from("participants")
      .select("player")
      .order("player", { ascending: false })
      .limit(1);

    if (maxError) {
      console.error("Error getting max player ID:", maxError);
      return NextResponse.json(
        { error: "Failed to generate player ID" },
        { status: 500 }
      );
    }

    const maxPlayerId =
      maxPlayerData && maxPlayerData.length > 0 ? maxPlayerData[0].player : 0;
    const newPlayerId = maxPlayerId + 1;

    // Create new participant
    const newParticipantData = {
      player: newPlayerId,
      name: name.trim(),
      study: study.trim(),
      class: participantClass.trim(),
      status: "alive" as const,
      image_url: imageUrl || "/user-photos/default.jpg",
    };

    // Insert into database using admin client
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from("participants")
      .insert(newParticipantData)
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting participant:", insertError);
      return NextResponse.json(
        { error: "Failed to add participant" },
        { status: 500 }
      );
    }

    // Transform back to camelCase for response
    const newParticipant = {
      player: insertedData.player,
      name: insertedData.name,
      study: insertedData.study,
      class: insertedData.class,
      status: insertedData.status,
      imageUrl: insertedData.image_url,
    };

    return NextResponse.json({ success: true, participant: newParticipant });
  } catch (error) {
    console.error("Failed to add participant:", error);
    return NextResponse.json(
      { error: "Failed to add participant" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { playerId, status } = body;

    // Validate status
    if (status !== "alive" && status !== "dead") {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    // Update participant in database using admin client
    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from("participants")
      .update({ status })
      .eq("player", playerId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating participant:", updateError);

      // Check if participant doesn't exist
      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Participant not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to update participant" },
        { status: 500 }
      );
    }

    if (!updatedData) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Transform back to camelCase for response
    const participant = {
      player: updatedData.player,
      name: updatedData.name,
      study: updatedData.study,
      class: updatedData.class,
      status: updatedData.status,
      imageUrl: updatedData.image_url,
    };

    return NextResponse.json({ success: true, participant });
  } catch (error) {
    console.error("Error in PUT /api/participants:", error);
    return NextResponse.json(
      { error: "Failed to update participant" },
      { status: 500 }
    );
  }
}
