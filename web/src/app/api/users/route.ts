import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import { dbCreateUser, dbSearchUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters"),
  password: z.string().trim().min(4, "Password must be at least 4 characters").optional(),
});

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

/**
 * POST /api/users
 * Body: { full_name: "Kamal", password?: "123456" }
 * Only Admin ("Samadul") can register/add new members to the system.
 */
export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    if (!isAdminProfile(context.profile)) {
      return NextResponse.json(
        { error: "Only Admin (Samadul) can add new members." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }

    const newUser = await dbCreateUser(
      parsed.data.full_name,
      parsed.data.password || "123456"
    );

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
