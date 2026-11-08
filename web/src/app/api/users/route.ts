import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { dbSearchUsers } from "@/lib/db";

/**
 * GET /api/users?q=searchTerm
 * Searches existing users from `profiles` by `full_name` (used on /create-trip and Android).
 */
export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireAuth(req);
  if (errorResponse || !context) return errorResponse!;

  const query = req.nextUrl.searchParams.get("q")?.trim() || "";

  try {
    const users = await dbSearchUsers(query);
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}
