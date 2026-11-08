import { NextRequest, NextResponse } from "next/server";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import { isNeonConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireAuth(req);
  if (errorResponse || !context) return errorResponse!;

  return NextResponse.json({
    user: {
      id: context.profile.id,
      full_name: context.profile.full_name,
      is_admin: isAdminProfile(context.profile),
    },
    db_mode: isNeonConfigured() ? "neon" : "local",
  });
}
