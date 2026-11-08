"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  PlusCircle,
  FileBarChart2,
  CheckCircle2,
  Clock,
  Loader2,
  Calendar,
  FileText,
  Banknote,
  Users,
  ArrowRight,
  Sparkles,
  Printer,
  RefreshCw,
  Filter,
  Trash2,
  Pencil,
  Check,
  X,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useApp } from "@/components/AppProvider";
import {
  Expense,
  SettlementTransaction,
  Trip,
  TripReport,
} from "@/types/database";
import { formatDate, formatTaka, toBengaliDigits } from "@/lib/format";

const expenseFormSchema = z.object({
  paid_by: z.string().optional(),
  amount: z.coerce
    .number({ invalid_type_error: "Please enter a valid amount" })
    .positive("Amount must be greater than 0"),
  description: z.string().trim().min(1, "Please enter what you spent on"),
  expense_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a valid date"),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const { user, apiFetch, bengaliNumbers } = useApp();

  const isAdmin =
    Boolean(user?.is_admin) ||
    (user?.full_name || "").trim().toLowerCase() === "samadul";

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<TripReport | null>(null);

  const [activeTab, setActiveTab] = useState<"expenses" | "report">("expenses");
  const [selectedMemberFilter, setSelectedMemberFilter] =
    useState<string>("ALL");
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [togglingSettlementKey, setTogglingSettlementKey] = useState<
    string | null
  >(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null
  );

  // Admin Edit Expense state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editPaidBy, setEditPaidBy] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      paid_by: user?.id || "",
      amount: undefined as unknown as number,
      description: "",
      expense_date: todayStr,
    },
  });

  useEffect(() => {
    if (user?.id) {
      setValue("paid_by", user.id);
    }
  }, [user?.id, setValue]);

  const loadReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const res = await apiFetch(`/api/trips/${tripId}/report`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to load trip report");
        return;
      }
      const data: TripReport = await res.json();
      setReport(data);
    } catch {
      toast.error("Network error loading report");
    } finally {
      setLoadingReport(false);
    }
  }, [apiFetch, tripId]);

  const loadTripAndExpenses = useCallback(async () => {
    setLoadingPage(true);
    try {
      const [tripRes, expRes, reportRes] = await Promise.all([
        apiFetch(`/api/trips/${tripId}`),
        apiFetch(`/api/trips/${tripId}/expenses`),
        apiFetch(`/api/trips/${tripId}/report`),
      ]);

      if (tripRes.ok) {
        const tripData = await tripRes.json();
        setTrip(tripData.trip);
      } else {
        const err = await tripRes.json().catch(() => ({}));
        toast.error(err.error || "Could not load trip details");
      }

      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(expData.expenses || []);
      }

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }
    } catch {
      toast.error("Network error loading trip");
    } finally {
      setLoadingPage(false);
    }
  }, [apiFetch, tripId]);

  useEffect(() => {
    if (tripId) {
      loadTripAndExpenses();
    }
  }, [tripId, loadTripAndExpenses]);

  useEffect(() => {
    if (activeTab === "report" && tripId) {
      loadReport();
    }
  }, [activeTab, tripId, loadReport]);

  const onAddExpense = async (values: ExpenseFormValues) => {
    try {
      const res = await apiFetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          ...values,
          paid_by: isAdmin ? values.paid_by || user?.id : user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add expense");
        return;
      }

      const newExpense: Expense = data.expense || data;
      setExpenses((prev: Expense[]) => [newExpense, ...prev]);
      reset({
        paid_by: values.paid_by || user?.id || "",
        amount: undefined as unknown as number,
        description: "",
        expense_date: values.expense_date,
      });
      toast.success(`Expense added for ${newExpense.user_name}!`);
      loadReport();
    } catch {
      toast.error("Failed to connect to server");
    }
  };

  const startEditingExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setEditPaidBy(exp.paid_by);
    setEditAmount(String(exp.amount));
    setEditDescription(exp.description);
    setEditDate(exp.expense_date);
  };

  const handleSaveEditedExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const numericAmount = Number(editAmount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (!editDescription.trim()) {
      toast.error("Description is required");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await apiFetch(`/api/trips/${tripId}/expenses`, {
        method: "PUT",
        body: JSON.stringify({
          expense_id: editingExpense.id,
          paid_by: editPaidBy,
          amount: numericAmount,
          description: editDescription.trim(),
          expense_date: editDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update expense");
        return;
      }

      const updated: Expense = data.expense;
      setExpenses((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setEditingExpense(null);
      toast.success("Expense updated & settlement recalculated!");
      loadReport();
    } catch {
      toast.error("Network error updating expense");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteExpense = async (expenseId?: string) => {
    if (!expenseId) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this expense entry? The settlement report will recalculate immediately."
      )
    ) {
      return;
    }
    setDeletingExpenseId(expenseId);
    try {
      const res = await apiFetch(
        `/api/trips/${tripId}/expenses?expense_id=${encodeURIComponent(
          expenseId
        )}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to delete expense");
        return;
      }
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      toast.success("Wrong expense deleted & settlement recalculated");
      loadReport();
    } catch {
      toast.error("Error deleting expense");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleToggleSettlementPaid = async (item: SettlementTransaction) => {
    if (!isAdmin) {
      toast.error("Only Admin (Samadul) can mark settlements as Paid.");
      return;
    }
    const key = `${item.from_user}__${item.to_user}`;
    const nextPaid = !item.is_paid;
    setTogglingSettlementKey(key);
    try {
      const res = await apiFetch(`/api/trips/${tripId}/report`, {
        method: "PATCH",
        body: JSON.stringify({
          from_user: item.from_user,
          to_user: item.to_user,
          is_paid: nextPaid,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to update settlement status");
        return;
      }

      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          settlement: prev.settlement.map((s) =>
            s.from_user === item.from_user && s.to_user === item.to_user
              ? {
                  ...s,
                  is_paid: nextPaid,
                  paid_at: nextPaid ? new Date().toISOString() : null,
                }
              : s
          ),
        };
      });

      toast.success(
        nextPaid
          ? `Marked "${item.from_user} pays ${item.to_user}" as Paid!`
          : `Marked "${item.from_user} pays ${item.to_user}" as Unpaid`
      );
    } catch {
      toast.error("Network error updating settlement");
    } finally {
      setTogglingSettlementKey(null);
    }
  };

  const handleToggleCompleted = async (nextCompleted: boolean) => {
    if (!trip || !isAdmin) return;
    setCompletingTrip(true);
    try {
      const res = await apiFetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_completed: nextCompleted }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update trip status");
        return;
      }

      setTrip((prev: Trip | null) =>
        prev ? { ...prev, is_completed: nextCompleted } : prev
      );
      if (nextCompleted) {
        toast.success("Trip closed! Viewing final settlement report...");
        setActiveTab("report");
        loadReport();
      } else {
        toast.success("Trip reopened for active expenses");
      }
    } catch {
      toast.error("Network error updating trip");
    } finally {
      setCompletingTrip(false);
    }
  };

  const totalSpentSoFar = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  const filteredReportExpenses = (report?.expenses || []).filter((exp) =>
    selectedMemberFilter === "ALL"
      ? true
      : exp.user_name === selectedMemberFilter
  );

  const paidSettlementCount = (report?.settlement || []).filter(
    (s) => s.is_paid
  ).length;

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              loadTripAndExpenses();
              toast.success("Refreshed latest expenses & report");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {loadingPage ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Loading trip details...
            </p>
          </div>
        ) : !trip ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-white p-8 text-center">
            <h2 className="text-lg font-bold text-slate-900">Trip Not Found</h2>
            <p className="mt-1 text-sm text-slate-600">
              You may not have access to this trip or it does not exist.
            </p>
          </div>
        ) : (
          <>
            {/* Trip Header Card */}
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                      {trip.name}
                    </h1>
                    {trip.is_completed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Closed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                        <Clock className="h-3.5 w-3.5 text-sky-600" />
                        Active Trip
                      </span>
                    )}
                  </div>

                  {/* Members List */}
                  {trip.members && trip.members.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        Members ({trip.members.length}):
                      </span>
                      {trip.members.map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {m.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin-Only: Close Trip / Reopen Trip Button */}
                {isAdmin && (
                  <div className="flex items-center gap-2 print:hidden">
                    {!trip.is_completed ? (
                      <button
                        type="button"
                        onClick={() => handleToggleCompleted(true)}
                        disabled={completingTrip}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 sm:text-sm"
                      >
                        {completingTrip ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Closing Trip...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Close / Complete Trip</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleCompleted(false)}
                        disabled={completingTrip}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                      >
                        <span>Reopen Trip (Admin)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="mt-6 flex gap-2 border-t border-slate-100 pt-4 print:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab("expenses")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                    activeTab === "expenses"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Add & View Expenses</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
                    activeTab === "report"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-sky-50 text-sky-800 hover:bg-sky-100"
                  }`}
                >
                  <FileBarChart2 className="h-4 w-4" />
                  <span>Trip Report & Settlement</span>
                </button>
              </div>
            </div>

            {/* ADMIN EDIT EXPENSE MODAL */}
            {isAdmin && editingExpense && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <h3 className="text-base font-bold text-slate-900">
                        Edit Expense Entry (Admin)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingExpense(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={handleSaveEditedExpense}
                    className="mt-4 space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Who Spent?
                      </label>
                      <select
                        value={editPaidBy}
                        onChange={(e) => setEditPaidBy(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                      >
                        {(trip.members || []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Amount (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Description (Why)
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Date
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingExpense(null)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {savingEdit ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 1: ADD EXPENSE & EXPENSE LIST */}
            {activeTab === "expenses" && (
              <div className="mt-6 space-y-6">
                {/* Add Expense Form */}
                {(!trip.is_completed || isAdmin) ? (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Log a New Expense
                        </h2>
                        <p className="text-xs text-slate-500">
                          {isAdmin
                            ? "Admin: You can log expenses for yourself or any trip member"
                            : `Logging expense under your account (${user?.full_name})`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("report")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100"
                      >
                        <FileBarChart2 className="h-3.5 w-3.5" />
                        <span>View Settlement Report</span>
                      </button>
                    </div>

                    <form
                      onSubmit={handleSubmit(onAddExpense)}
                      className="mt-4 grid gap-4 sm:grid-cols-12"
                      noValidate
                    >
                      {/* Admin can choose Who Spent; regular user sees their own name */}
                      {isAdmin && (
                        <div className="sm:col-span-3">
                          <label
                            htmlFor="paid_by"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Who Spent? (Admin)
                          </label>
                          <div className="relative mt-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <UserCheck className="h-4 w-4" />
                            </div>
                            <select
                              id="paid_by"
                              {...register("paid_by")}
                              className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            >
                              {(trip.members || []).map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.full_name}
                                  {m.id === user?.id ? " (Admin)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Amount Input */}
                      <div className={isAdmin ? "sm:col-span-2" : "sm:col-span-3"}>
                        <label
                          htmlFor="amount"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Amount (৳)
                        </label>
                        <div className="relative mt-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <Banknote className="h-4 w-4" />
                          </div>
                          <input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="500"
                            {...register("amount")}
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-2 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        {errors.amount && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.amount.message}
                          </p>
                        )}
                      </div>

                      {/* Description Input */}
                      <div className={isAdmin ? "sm:col-span-4" : "sm:col-span-5"}>
                        <label
                          htmlFor="description"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Description (Why)
                        </label>
                        <div className="relative mt-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <FileText className="h-4 w-4" />
                          </div>
                          <input
                            id="description"
                            type="text"
                            placeholder="e.g., Lunch, Boat ride, Hotel"
                            {...register("description")}
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        {errors.description && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.description.message}
                          </p>
                        )}
                      </div>

                      {/* Date Picker */}
                      <div className={isAdmin ? "sm:col-span-3" : "sm:col-span-4"}>
                        <label
                          htmlFor="expense_date"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Date
                        </label>
                        <div className="relative mt-1">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <input
                            id="expense_date"
                            type="date"
                            {...register("expense_date")}
                            className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        {errors.expense_date && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.expense_date.message}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-12">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Adding Expense...</span>
                            </>
                          ) : (
                            <>
                              <PlusCircle className="h-4 w-4" />
                              <span>Add Expense</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                    This trip has been closed by Admin (<strong>Samadul</strong>). View the{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("report")}
                      className="font-bold underline"
                    >
                      Trip Report & Settlement
                    </button>{" "}
                    tab for final calculations.
                  </div>
                )}

                {/* All Expenses List */}
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        All Trip Expenses (
                        {bengaliNumbers
                          ? toBengaliDigits(expenses.length)
                          : expenses.length}
                        )
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isAdmin
                          ? "Admin: Click Edit (pencil) or Delete (trash) to fix any wrong entry"
                          : "Shared log visible to every member in this trip"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3.5 py-2 text-right">
                      <span className="block text-[11px] font-medium text-emerald-700">
                        Total Trip Spending
                      </span>
                      <span className="text-base font-extrabold text-emerald-900">
                        {formatTaka(totalSpentSoFar, { bengali: bengaliNumbers })}
                      </span>
                    </div>
                  </div>

                  {expenses.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                      No expenses added yet. Use the form above to log your first
                      expense!
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <th className="py-3 pr-3">Who Spent</th>
                            <th className="px-3 py-3">Why (Description)</th>
                            <th className="px-3 py-3">Date</th>
                            <th className="px-3 py-3 text-right">Amount</th>
                            {isAdmin && (
                              <th className="py-3 pl-2 text-right">
                                Admin Actions
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {expenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-slate-50/80">
                              <td className="py-3.5 pr-3 font-semibold text-slate-900">
                                <span className="inline-flex items-center gap-2">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                                    {(exp.user_name || "U").charAt(0).toUpperCase()}
                                  </span>
                                  {exp.user_name}
                                </span>
                              </td>
                              <td className="px-3 py-3.5 text-slate-700">
                                {exp.description}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-500">
                                {formatDate(exp.expense_date, bengaliNumbers)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3.5 text-right font-bold text-emerald-700">
                                {formatTaka(exp.amount, {
                                  bengali: bengaliNumbers,
                                })}
                              </td>
                              {isAdmin && (
                                <td className="whitespace-nowrap py-3.5 pl-2 text-right">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditingExpense(exp)}
                                      title="Edit wrong entry"
                                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 transition hover:bg-sky-50 hover:text-sky-600"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingExpenseId === exp.id}
                                      onClick={() => handleDeleteExpense(exp.id)}
                                      title="Delete wrong entry"
                                      className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                    >
                                      {deletingExpenseId === exp.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: COMPLETE SHARED TRIP REPORT & SETTLEMENT */}
            {activeTab === "report" && (
              <div className="mt-6 space-y-6">
                {loadingReport || !report ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                    <p className="mt-3 text-sm font-medium text-slate-600">
                      Calculating equal split & settlement report...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Report Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white px-5 py-4 shadow-sm print:hidden">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Shared Trip Report — {report.trip_name}
                        </h2>
                        <p className="text-xs text-slate-500">
                          Everyone in this trip sees this live summary of all expenses, shares, and settlements
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab("expenses")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>
                            {isAdmin ? "Add / Edit Expenses" : "View / Add Expenses"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <Printer className="h-4 w-4 text-slate-600" />
                          <span>Print / Save PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Top Summary Cards */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md">
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                          Total Spent
                        </p>
                        <p className="mt-2 text-3xl font-extrabold">
                          {formatTaka(report.total_spent, {
                            bengali: bengaliNumbers,
                          })}
                        </p>
                        <p className="mt-1 text-xs text-emerald-100">
                          Across{" "}
                          {bengaliNumbers
                            ? toBengaliDigits(report.expenses.length)
                            : report.expenses.length}{" "}
                          logged expenses
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 p-5 text-white shadow-md">
                        <p className="text-xs font-semibold uppercase tracking-wider text-sky-100">
                          Per Person Share (Equal Split)
                        </p>
                        <p className="mt-2 text-3xl font-extrabold">
                          {formatTaka(report.per_person_share, {
                            bengali: bengaliNumbers,
                          })}
                        </p>
                        <p className="mt-1 text-xs text-sky-100">
                          Split equally among{" "}
                          {bengaliNumbers
                            ? toBengaliDigits(report.member_count)
                            : report.member_count}{" "}
                          members
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Settlement Progress
                        </p>
                        <p className="mt-2 text-3xl font-extrabold text-slate-900">
                          {bengaliNumbers
                            ? `${toBengaliDigits(paidSettlementCount)} / ${toBengaliDigits(
                                report.settlement.length
                              )}`
                            : `${paidSettlementCount} / ${report.settlement.length}`}{" "}
                          <span className="text-base font-semibold text-emerald-600">
                            Paid
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {isAdmin
                            ? 'Click "Mark Paid" below when a member pays'
                            : "Managed by Admin (Samadul)"}
                        </p>
                      </div>
                    </div>

                    {/* Settlement Section: Who Pays Whom */}
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/80 p-5 shadow-sm sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-lg font-extrabold text-slate-900">
                              Settlement Plan (Who Owes Whom)
                            </h2>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            Exact payments required so every member pays the equal share (
                            {formatTaka(report.per_person_share, {
                              bengali: bengaliNumbers,
                            })}
                            ).
                          </p>
                        </div>
                      </div>

                      {report.settlement.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4 text-center text-sm font-medium text-emerald-800">
                          Everyone is settled up! No payments needed.
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {report.settlement.map((item, idx) => {
                            const key = `${item.from_user}__${item.to_user}`;
                            const isToggling = togglingSettlementKey === key;
                            const isPaid = Boolean(item.is_paid);

                            return (
                              <div
                                key={idx}
                                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4 shadow-sm transition ${
                                  isPaid
                                    ? "border-emerald-300 bg-emerald-50/70"
                                    : "border-emerald-200/80 bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <span
                                    className={`font-bold ${
                                      isPaid
                                        ? "line-through text-slate-500"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {item.from_user}
                                  </span>
                                  <span className="text-xs font-medium text-slate-500">
                                    pays
                                  </span>
                                  <ArrowRight className="h-4 w-4 text-slate-400" />
                                  <span
                                    className={`font-bold ${
                                      isPaid
                                        ? "line-through text-slate-500"
                                        : "text-emerald-700"
                                    }`}
                                  >
                                    {item.to_user}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-lg px-2.5 py-1 text-xs font-extrabold sm:text-sm ${
                                      isPaid
                                        ? "bg-emerald-200/70 text-emerald-900 line-through"
                                        : "bg-emerald-100 text-emerald-900"
                                    }`}
                                  >
                                    {bengaliNumbers
                                      ? `${toBengaliDigits(item.amount)} টাকা`
                                      : `${item.amount.toLocaleString("en-IN")} Taka`}
                                  </span>

                                  {isAdmin ? (
                                    <button
                                      type="button"
                                      disabled={isToggling}
                                      onClick={() =>
                                        handleToggleSettlementPaid(item)
                                      }
                                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition print:hidden ${
                                        isPaid
                                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                                      }`}
                                    >
                                      {isToggling ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : isPaid ? (
                                        <>
                                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                          <span>Paid</span>
                                        </>
                                      ) : (
                                        <span>Mark Paid</span>
                                      )}
                                    </button>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                                        isPaid
                                          ? "bg-emerald-600 text-white"
                                          : "bg-amber-100 text-amber-800"
                                      }`}
                                    >
                                      {isPaid ? "Paid ✓" : "Pending"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Member Breakdown Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <h2 className="text-base font-bold text-slate-900">
                        Member-Wise Spending Summary
                      </h2>
                      <p className="text-xs text-slate-500">
                        Green (+) = Gets money back &bull; Red (-) = Owes money
                      </p>

                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                              <th className="py-3 pr-3">Member Name</th>
                              <th className="px-3 py-3 text-right">
                                Total Spent
                              </th>
                              <th className="px-3 py-3 text-right">
                                Equal Share
                              </th>
                              <th className="py-3 pl-3 text-right">
                                Status / Difference (+/-)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {report.user_totals.map((ut) => {
                              const diff =
                                ut.difference !== undefined
                                  ? ut.difference
                                  : ut.total_spent - report.per_person_share;
                              const isPositive = diff > 0.005;
                              const isNegative = diff < -0.005;

                              return (
                                <tr
                                  key={ut.user_name}
                                  className="hover:bg-slate-50"
                                >
                                  <td className="py-3.5 pr-3 font-semibold text-slate-900">
                                    <span className="inline-flex items-center gap-2">
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                                        {ut.user_name.charAt(0).toUpperCase()}
                                      </span>
                                      {ut.user_name}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3.5 text-right font-bold text-slate-900">
                                    {formatTaka(ut.total_spent, {
                                      bengali: bengaliNumbers,
                                    })}
                                  </td>
                                  <td className="px-3 py-3.5 text-right text-slate-600">
                                    {formatTaka(report.per_person_share, {
                                      bengali: bengaliNumbers,
                                    })}
                                  </td>
                                  <td className="py-3.5 pl-3 text-right font-bold">
                                    <span
                                      className={`inline-block rounded-lg px-2.5 py-1 text-xs ${
                                        isPositive
                                          ? "bg-emerald-100 text-emerald-800"
                                          : isNegative
                                          ? "bg-red-100 text-red-700"
                                          : "bg-slate-100 text-slate-600"
                                      }`}
                                    >
                                      {isPositive
                                        ? `Gets back ${formatTaka(diff, {
                                            bengali: bengaliNumbers,
                                            showSign: true,
                                          })}`
                                        : isNegative
                                        ? `Owes ${formatTaka(diff, {
                                            bengali: bengaliNumbers,
                                            showSign: true,
                                          })}`
                                        : "Settled (৳0)"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* All Expenses Table for Everyone to Inspect */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">
                            All Trip Expenses ({filteredReportExpenses.length})
                          </h2>
                          <p className="text-xs text-slate-500">
                            Complete itemized expense history for all members
                          </p>
                        </div>

                        <div className="flex items-center gap-2 print:hidden">
                          <Filter className="h-3.5 w-3.5 text-slate-400" />
                          <select
                            value={selectedMemberFilter}
                            onChange={(e) =>
                              setSelectedMemberFilter(e.target.value)
                            }
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none"
                          >
                            <option value="ALL">All Members</option>
                            {report.user_totals.map((u) => (
                              <option key={u.user_name} value={u.user_name}>
                                {u.user_name} (
                                {formatTaka(u.total_spent, {
                                  bengali: bengaliNumbers,
                                })}
                                )
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {filteredReportExpenses.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                          No expenses recorded yet for this selection.
                        </div>
                      ) : (
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <th className="py-3 pr-3">Spent By</th>
                                <th className="px-3 py-3">Description (Why)</th>
                                <th className="px-3 py-3">Date</th>
                                <th className="py-3 pl-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredReportExpenses.map((exp, idx) => (
                                <tr
                                  key={exp.id || idx}
                                  className="hover:bg-slate-50"
                                >
                                  <td className="py-3 pr-3 font-semibold text-slate-900">
                                    {exp.user_name}
                                  </td>
                                  <td className="px-3 py-3 text-slate-700">
                                    {exp.description}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                                    {formatDate(exp.date, bengaliNumbers)}
                                  </td>
                                  <td className="whitespace-nowrap py-3 pl-3 text-right font-bold text-emerald-700">
                                    {formatTaka(exp.amount, {
                                      bengali: bengaliNumbers,
                                    })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-bold text-slate-900">
                                <td colSpan={3} className="py-3 pl-3 text-right">
                                  Total:
                                </td>
                                <td className="py-3 pl-3 pr-1 text-right text-emerald-700">
                                  {formatTaka(
                                    filteredReportExpenses.reduce(
                                      (s, e) => s + (Number(e.amount) || 0),
                                      0
                                    ),
                                    { bengali: bengaliNumbers }
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
