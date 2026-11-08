import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminProfile, requireAuth } from "@/lib/auth";
import {
  dbAddTripExpense,
  dbDeleteTripExpense,
  dbGetTripById,
  dbGetTripExpenses,
  dbIsTripMember,
  dbUpdateTripExpense,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const createExpenseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required (e.g., 'Lunch at hotel')"),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be in YYYY-MM-DD format")
    .optional(),
  paid_by: z.string().uuid().optional(),
});

const updateExpenseSchema = z.object({
  expense_id: z.string().uuid("Valid expense_id is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().trim().min(1, "Description is required"),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be in YYYY-MM-DD format"),
  paid_by: z.string().uuid().optional(),
});

/**
 * GET /api/trips/{id}/expenses
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

  const expenses = await dbGetTripExpenses(tripId);
  return NextResponse.json({ expenses });
}

/**
 * POST /api/trips/{id}/expenses
 * Members can add expenses while trip is active. Admin ("Samadul") can also log on behalf of any member.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    const tripId = params.id;
    const isAdmin = isAdminProfile(context.profile);
    const isMember = await dbIsTripMember(tripId, context.profile.id);
    if (!isMember && !isAdmin) {
      return NextResponse.json(
        {
          error:
            "Forbidden: You can only add expenses to trips you are a member of",
        },
        { status: 403 }
      );
    }

    const trip = await dbGetTripById(tripId);
    if (trip?.is_completed && !isAdmin) {
      return NextResponse.json(
        { error: "This trip is closed. Only Admin (Samadul) can add or edit entries." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid expense payload" },
        { status: 400 }
      );
    }

    const { amount, description, expense_date, paid_by } = parsed.data;
    const dateToUse = expense_date || new Date().toISOString().split("T")[0];
    // Only Admin can log on behalf of someone else; regular members log as themselves
    const targetPayerId = isAdmin && paid_by ? paid_by : context.profile.id;

    const expenseResponse = await dbAddTripExpense({
      tripId,
      paidBy: targetPayerId,
      userName: context.profile.full_name,
      amount,
      description,
      expenseDate: dateToUse,
    });

    return NextResponse.json(
      {
        expense: expenseResponse,
        ...expenseResponse,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/trips/[id]/expenses error:", err);
    return NextResponse.json(
      { error: "Failed to add expense" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trips/{id}/expenses
 * Body: { expense_id, amount, description, expense_date, paid_by? }
 * Only Admin ("Samadul") can edit any wrong expense entry.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    if (!isAdminProfile(context.profile)) {
      return NextResponse.json(
        { error: "Only Admin (Samadul) is authorized to edit expense entries." },
        { status: 403 }
      );
    }

    const tripId = params.id;
    const body = await req.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload" },
        { status: 400 }
      );
    }

    const updated = await dbUpdateTripExpense({
      tripId,
      expenseId: parsed.data.expense_id,
      paidBy: parsed.data.paid_by,
      amount: parsed.data.amount,
      description: parsed.data.description,
      expenseDate: parsed.data.expense_date,
    });

    if (!updated) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ expense: updated });
  } catch (err) {
    console.error("PUT /api/trips/[id]/expenses error:", err);
    return NextResponse.json(
      { error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/{id}/expenses?expense_id=...
 * Only Admin ("Samadul") can delete a wrong expense entry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { context, errorResponse } = await requireAuth(req);
    if (errorResponse || !context) return errorResponse!;

    if (!isAdminProfile(context.profile)) {
      return NextResponse.json(
        { error: "Only Admin (Samadul) is authorized to delete expense entries." },
        { status: 403 }
      );
    }

    const tripId = params.id;
    const expenseId = req.nextUrl.searchParams.get("expense_id")?.trim();
    if (!expenseId) {
      return NextResponse.json(
        { error: "expense_id query parameter is required" },
        { status: 400 }
      );
    }

    await dbDeleteTripExpense(tripId, expenseId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/trips/[id]/expenses error:", err);
    return NextResponse.json(
      { error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}
