"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  Loader2,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useApp } from "@/components/AppProvider";
import { Trip } from "@/types/database";
import { formatDate, formatTaka, toBengaliDigits } from "@/lib/format";

export default function DashboardPage() {
  const { user, loadingAuth, dbMode, apiFetch, bengaliNumbers } = useApp();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const isAdmin =
    Boolean(user?.is_admin) ||
    (user?.full_name || "").trim().toLowerCase() === "samadul";

  const fetchTrips = useCallback(async () => {
    setLoadingTrips(true);
    try {
      const res = await apiFetch("/api/trips");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status !== 401) {
          toast.error(err.error || "Failed to load trips");
        }
        return;
      }
      const data = await res.json();
      setTrips(data.trips || []);
    } catch {
      toast.error("Could not connect to server");
    } finally {
      setLoadingTrips(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!loadingAuth) {
      fetchTrips();
    }
  }, [loadingAuth, fetchTrips]);

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        {isAdmin && dbMode === "local" && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-sm">
            <p className="font-bold">
              ⚠️ Database Mode: Temporary Local Storage (Neon DATABASE_URL not set on Vercel yet)
            </p>
            <p className="mt-1 text-amber-800">
              To save all added/edited expenses permanently on Vercel, open your{" "}
              <span className="font-semibold">Vercel Project → Settings → Environment Variables</span>, add{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono font-bold">DATABASE_URL</code>{" "}
              with your Neon PostgreSQL connection string, and click <span className="font-semibold">Redeploy</span>.
            </p>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 p-6 text-white shadow-lg shadow-emerald-700/15 sm:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                  Trip Dashboard
                </p>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Admin Control
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Welcome, {user?.full_name || "Traveler"}!
              </h1>
              <p className="mt-1 text-sm text-emerald-50/90">
                {isAdmin
                  ? "As Admin, you can create trips, close trips, and edit or delete any wrong expense entry."
                  : "Track shared expenses with friends and view the live settlement report."}
              </p>
            </div>

            {isAdmin && (
              <Link
                href="/create-trip"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-[0.99]"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Create New Trip</span>
              </Link>
            )}
          </div>
        </div>

        {/* Trips Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Your Trips</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              {bengaliNumbers ? toBengaliDigits(trips.length) : trips.length}{" "}
              {trips.length === 1 ? "Trip" : "Trips"}
            </span>
          </div>

          {loadingTrips ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                Loading your trips...
              </p>
            </div>
          ) : trips.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                No trips yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {isAdmin
                  ? "Start by creating a trip (like 'Sylhet 2026') and adding your group members."
                  : "Wait for Admin (Samadul) to create a trip and add you as a member."}
              </p>
              {isAdmin && (
                <Link
                  href="/create-trip"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Trip</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              {trips.map((trip) => (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 text-emerald-600 ring-1 ring-emerald-200/60">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 group-hover:text-emerald-700">
                            {trip.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Created {formatDate(trip.created_at, bengaliNumbers)}
                          </p>
                        </div>
                      </div>

                      {trip.is_completed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Closed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                          <Clock className="h-3.5 w-3.5 text-sky-600" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5 text-xs text-slate-600">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {bengaliNumbers
                          ? toBengaliDigits(trip.member_count || 1)
                          : trip.member_count || 1}{" "}
                        members
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                        <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                        {formatTaka(trip.total_spent || 0, {
                          bengali: bengaliNumbers,
                        })}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 transition group-hover:translate-x-0.5">
                      Open
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
