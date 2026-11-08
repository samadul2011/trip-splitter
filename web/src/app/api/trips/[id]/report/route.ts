import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import {
  dbGetSettlementStatuses,
  dbGetTripById,
  dbGetTripExpenses,
  dbIsTripMember,
  dbToggleSettlementPaid,
} from "@/lib/db";
import { calculateTripSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

const updateSettlementSchema = z.object({
  from_user: z.string().trim().min(1),
  to_user: z.string().trim().min(1),
  is_paid: z.boolean(),
});

/**
 * GET /api/trips/{id}/report
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

  const [rawExpenses, statuses] = await Promise.all([
    dbGetTripExpenses(tripId),
    dbGetSettlementStatuses(tripId),
  ]);

  const members: { id: string; full_name: string; family_count: number }[] = (
    trip.members || []
  ).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    family_count: Math.max(1, Number(m.family_count) || 1),
  }));

  const memberIdsSet = new Set(members.map((m) => m.id));
  for (const exp of rawExpenses) {
    if (exp.paid_by && !memberIdsSet.has(exp.paid_by)) {
      memberIdsSet.add(exp.paid_by);
      members.push({
        id: exp.paid_by,
        full_name: exp.user_name || "Unknown",
        family_count: 1,
      });
    }
  }

  const settlementResult = calculateTripSettlement(
    members,
    rawExpenses.map((e) => ({
      paid_by: e.paid_by,
      amount: Number(e.amount),
    }))
  );

  const statusMap = new Map(
    statuses.map((s) => [`${s.from_user}__${s.to_user}`, s])
  );

  const settlementWithStatus = settlementResult.settlement.map((item) => {
    const matched = statusMap.get(`${item.from_user}__${item.to_user}`);
    return {
      ...item,
      is_paid: Boolean(matched?.is_paid),
      paid_at: matched?.paid_at || null,
    };
  });

  const expensesFormatted = rawExpenses.map((e) => ({
    id: e.id,
    paid_by: e.paid_by,
    user_name: e.user_name || "Unknown",
    amount: Number(e.amount),
    description: e.description,
    date: e.expense_date,
  }));

  return NextResponse.json({
    trip_id: trip.id,
    trip_name: trip.name,
    is_completed: Boolean(trip.is_completed),
    total_spent: settlementResult.total_spent,
    per_person_share: settlementResult.per_person_share,
    member_count: settlementResult.member_count,
    total_persons: settlementResult.total_persons,
    user_totals: settlementResult.user_totals,
    expenses: expensesFormatted,
    settlement: settlementWithStatus,
  });
}

/**
 * PATCH /api/trips/{id}/report
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    const tripId = params.id;
    if (!isAdminProfile(context.profile)) {
      return NextResponse.json(
        { error: "Only Admin (Samadul) can update settlement payment status." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }

    const status = await dbToggleSettlementPaid({
      tripId,
      fromUser: parsed.data.from_user,
      toUser: parsed.data.to_user,
      isPaid: parsed.data.is_paid,
    });

    return NextResponse.json({ status });
  } catch (err) {
    console.error("PATCH /api/trips/[id]/report error:", err);
    return NextResponse.json(
      { error: "Failed to update settlement status" },
      { status: 500 }
    );
  }
}
