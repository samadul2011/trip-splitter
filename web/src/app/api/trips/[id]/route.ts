import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import {
  dbGetTripById,
  dbIsTripMember,
  dbUpdateTripStatus,
} from "@/lib/db";

const updateTripSchema = z.object({
  is_completed: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
});

/**
 * GET /api/trips/{id}
 * Returns trip details and members if the user is a member of the trip.
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
 * Body: { is_completed: true }
 * Only Admin ("Samadul") can close (complete) or reopen a trip.
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
        { error: "Only Admin (Samadul) can close or reopen a trip." },
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

    return NextResponse.json({ trip: updated });
  } catch (err) {
    console.error("PATCH /api/trips/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update trip" },
      { status: 500 }
    );
  }
}
