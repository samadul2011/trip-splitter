import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import {
  dbGetTripById,
  dbIsTripMember,
  dbUpdateTripMemberFamilyCount,
  dbUpdateTripStatus,
} from "@/lib/db";

const updateTripSchema = z.object({
  is_completed: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  member_user_id: z.string().uuid().optional(),
  family_count: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * GET /api/trips/{id}
 * Returns trip details and members (including each member's `family_count`).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { context, errorResponse } = await requireAuth(req);
  if (errorResponse || !context) return errorResponse!;

  const tripId = params.id;
  const isMember = await dbIsTripMember(tripId, context.profile.id);
  if (!isMember && !isAdminProfile(context.profile)) {
    return NextResponse.json(
      { error: "Forbidden: You are not a member of this trip" },
      { status: 403 }
    );
  }

  const trip = await dbGetTripById(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({ trip });
}

/**
 * PATCH /api/trips/{id}
 * Body:
 *   - { is_completed: true | false } -> Close or reopen trip (Admin only)
 *   - { member_user_id: "uuid", family_count: 2 } -> Update a member's family count (1, 2, 3, 4...) (Admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    if (!isAdminProfile(context.profile)) {
      return NextResponse.json(
        {
          error:
            "Only Admin (Samadul) can update trip status or member family count.",
        },
        { status: 403 }
      );
    }

    const tripId = params.id;
    const body = await req.json();
    const parsed = updateTripSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload" },
        { status: 400 }
      );
    }

    if (parsed.data.member_user_id && parsed.data.family_count !== undefined) {
      await dbUpdateTripMemberFamilyCount({
        tripId,
        userId: parsed.data.member_user_id,
        familyCount: parsed.data.family_count,
      });
      const updatedTrip = await dbGetTripById(tripId);
      return NextResponse.json({ trip: updatedTrip });
    }

    const updated = await dbUpdateTripStatus(
      tripId,
      parsed.data.is_completed ?? true
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update trip" },
        { status: 500 }
      );
    }

    const fullTrip = await dbGetTripById(tripId);
    return NextResponse.json({ trip: fullTrip || updated });
  } catch (err) {
    console.error("PATCH /api/trips/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update trip" },
      { status: 500 }
    );
  }
}
