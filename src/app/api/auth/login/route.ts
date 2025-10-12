import { NextRequest, NextResponse } from "next/server";
import { tokenUserMap } from "../tokenStore";

const TIHLDE_API_URL =
  process.env.NEXT_PUBLIC_TIHLDE_API_URL || "https://api.tihlde.org";

// Helper function to check if user is an Index leader
function isIndexLeader(memberships: any[]): boolean {
  if (!memberships || !Array.isArray(memberships)) return false;

  return memberships.some((membership: any) => {
    const groupName = membership.group?.name || membership.name;
    const isLeader =
      membership.membership_type === "LEADER" || membership.isLeader === true;
    return groupName?.toUpperCase() === "INDEX" && isLeader;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Authenticate with TIHLDE API
    const authResponse = await fetch(`${TIHLDE_API_URL}/auth/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: username,
        password: password,
      }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("TIHLDE auth error:", errorText);
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();
    const token = authData.token;

    if (!token) {
      return NextResponse.json(
        { error: "No token received from authentication" },
        { status: 500 }
      );
    }

    // Fetch user data from TIHLDE API
    const userResponse = await fetch(`${TIHLDE_API_URL}/users/me/`, {
      headers: {
        "X-CSRF-Token": token,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }

    const userData = await userResponse.json();

    // Fetch user memberships to check for Index leader
    const membershipsResponse = await fetch(
      `${TIHLDE_API_URL}/users/me/memberships/`,
      {
        headers: {
          "X-CSRF-Token": token,
        },
      }
    );

    let memberships = [];
    if (membershipsResponse.ok) {
      const membershipsData = await membershipsResponse.json();
      memberships = membershipsData.results || membershipsData || [];
    }

    // Transform user data to our format
    const transformedUser = {
      id: userData.user_id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      email: userData.email,
      image: userData.image || null,
      groups: memberships.map((m: any) => ({
        id: m.group?.slug || m.slug || String(m.id),
        name: m.group?.name || m.name,
        isLeader: m.membership_type === "LEADER",
      })),
    };

    // Store user data with token for later retrieval
    tokenUserMap.set(token, transformedUser);

    // Check if user is Index leader OR specific admin user
    const hasAccess =
      isIndexLeader(memberships) || userData.user_id === "astaskj";

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Access denied. You must be an Index leader to access the admin panel.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      token,
      user: transformedUser,
      isIndexLeader: hasAccess,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
