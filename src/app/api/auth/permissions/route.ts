import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tokenUserMap } from "../tokenStore";

const ACCESS_TOKEN = "MORDVEMBER-AccessToken";
const TIHLDE_API_URL =
  process.env.NEXT_PUBLIC_TIHLDE_API_URL || "https://api.tihlde.org";

// Full permissions for Index leaders
const FULL_PERMISSIONS = {
  participants: {
    read: true,
    write: true,
    write_all: true,
    destroy: true,
  },
  admin: {
    read: true,
    write: true,
    write_all: true,
    destroy: true,
  },
};

// Helper function to check if user is an Index leader
function isIndexLeader(user: any): boolean {
  if (!user || !user.groups) return false;

  return user.groups.some(
    (group: any) =>
      group.name?.toUpperCase() === "INDEX" && group.isLeader === true
  );
}

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

    // Try to get user from token map
    let user = tokenUserMap.get(tokenCookie.value);

    // If not cached, fetch from TIHLDE API
    if (!user) {
      const userResponse = await fetch(`${TIHLDE_API_URL}/users/me/`, {
        headers: {
          "X-CSRF-Token": tokenCookie.value,
        },
      });

      if (!userResponse.ok) {
        return NextResponse.json(
          { error: "Unauthorized - Invalid token" },
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

      user = {
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
      tokenUserMap.set(tokenCookie.value, user);
    }

    // Check if user is an Index leader OR specific admin user - only they get permissions
    const hasAccess = (user && isIndexLeader(user)) || user?.id === "astaskj";

    if (hasAccess) {
      return NextResponse.json(FULL_PERMISSIONS);
    }

    // Non-Index leaders have no permissions
    return NextResponse.json(
      { error: "Access denied. You must be an Index leader." },
      { status: 403 }
    );
  } catch (error) {
    console.error("Get permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
