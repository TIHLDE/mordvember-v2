import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tokenUserMap } from "../tokenStore";

const ACCESS_TOKEN = "MORDVEMBER-AccessToken";
const TIHLDE_API_URL =
  process.env.NEXT_PUBLIC_TIHLDE_API_URL || "https://api.tihlde.org";

export async function GET(request: NextRequest) {
  try {
    // Check authentication via cookie
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(ACCESS_TOKEN);

    if (!tokenCookie || !tokenCookie.value) {
      return NextResponse.json(
        { error: "Unauthorized - No valid token" },
        { status: 401 }
      );
    }

    // Try to get user from token map (cached)
    const cachedUser = tokenUserMap.get(tokenCookie.value);
    if (cachedUser) {
      return NextResponse.json(cachedUser);
    }

    // If not in cache, fetch from TIHLDE API
    const userResponse = await fetch(`${TIHLDE_API_URL}/users/me/`, {
      headers: {
        "X-CSRF-Token": tokenCookie.value,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user data from TIHLDE API" },
        { status: 401 }
      );
    }

    const userData = await userResponse.json();

    // Fetch memberships
    const membershipsResponse = await fetch(
      `${TIHLDE_API_URL}/users/me/memberships/`,
      {
        headers: {
          "X-CSRF-Token": tokenCookie.value,
        },
      }
    );

    let memberships = [];
    if (membershipsResponse.ok) {
      const membershipsData = await membershipsResponse.json();
      memberships = membershipsData.results || membershipsData || [];
    }

    // Transform to our format
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

    // Cache it
    tokenUserMap.set(tokenCookie.value, transformedUser);

    return NextResponse.json(transformedUser);
  } catch (error) {
    console.error("Get user data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
