import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import { dbCreateTrip, dbGetTripsForUser } from "@/lib/db";

const createTripSchema = z.object({
  name: z.string().trim().min(1, "Trip name is required"),
  member_ids: z.array(z.string().uuid()).optional().default([]),
  member_counts: z.record(z.string(), z.coerce.number().int().min(1)).optional().default({}),
});

/**
 * GET /api/trips
 * Returns list of trips where the logged-in user is a member.
 */
export async function GET(req: NextRequest) {
  const { context, errorResponse } = await requireAuth(req);
  if (errorResponse || !context) return errorResponse!;

  try {
    const trips = await dbGetTripsForUser(context.profile.id);
    return NextResponse.json({ trips });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips
 * Body: { name, member_ids: [], member_counts?: { [userId]: 1 | 2 | 3 | 4 } }
 * Only Admin ("Samadul") can create a new trip.
 */
export async function POST(req: NextRequest) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    if (!isAdminProfile(context.profile)) {
      return NextResponse.json(
        { error: "Only Admin (Samadul) is authorized to create a new trip." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createTripSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid trip payload" },
        { status: 400 }
      );
    }

    const { name, member_ids, member_counts } = parsed.data;
    const trip = await dbCreateTrip(
      name,
      context.profile.id,
      member_ids,
      member_counts
    );

    return NextResponse.json({ trip }, { status: 201 });
  } catch (err) {
    console.error("POST /api/trips error:", err);
    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    );
  }
}
