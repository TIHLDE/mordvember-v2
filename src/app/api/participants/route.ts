import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const dataPath = join(process.cwd(), "src", "data", "participants.json");
const ACCESS_TOKEN = "MORDVEMBER-AccessToken";

export async function GET() {
  try {
    const data = readFileSync(dataPath, "utf-8");
    const participants = JSON.parse(data);
    return NextResponse.json(participants);
  } catch (error) {
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

    // Read current data
    const data = readFileSync(dataPath, "utf-8");
    const participants = JSON.parse(data);

    // Find highest player ID and increment
    const maxPlayerId = participants.reduce(
      (max: number, p: any) => Math.max(max, p.player),
      0
    );
    const newPlayerId = maxPlayerId + 1;

    // Create new participant
    const newParticipant = {
      player: newPlayerId,
      name: name.trim(),
      study: study.trim(),
      class: participantClass.trim(),
      status: "alive",
      imageUrl: imageUrl || "/user-photos/default.jpg",
    };

    // Add to participants array
    participants.push(newParticipant);

    // Write back to file
    writeFileSync(dataPath, JSON.stringify(participants, null, 2));

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

    // Read current data
    const data = readFileSync(dataPath, "utf-8");
    const participants = JSON.parse(data);

    // Find and update participant
    const participant = participants.find((p: any) => p.player === playerId);
    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    participant.status = status;

    // Write back to file
    writeFileSync(dataPath, JSON.stringify(participants, null, 2));

    return NextResponse.json({ success: true, participant });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update participant" },
      { status: 500 }
    );
  }
}
