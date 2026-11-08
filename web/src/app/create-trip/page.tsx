"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Search,
  UserPlus,
  X,
  Check,
  Loader2,
  MapPin,
  Users,
  ShieldAlert,
  Minus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { useApp } from "@/components/AppProvider";
import { Profile } from "@/types/database";

const createTripFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Trip name must be at least 2 characters (e.g., Sylhet 2026)"),
});

type CreateTripFormValues = z.infer<typeof createTripFormSchema>;

export default function CreateTripPage() {
  const router = useRouter();
  const { user, apiFetch } = useApp();

  const isAdmin =
    Boolean(user?.is_admin) ||
    (user?.full_name || "").trim().toLowerCase() === "samadul";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Profile[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTripFormValues>({
    resolver: zodResolver(createTripFormSchema),
    defaultValues: { name: "" },
  });

  const fetchUsers = useCallback(
    async (query: string) => {
      setSearching(true);
      try {
        const res = await apiFetch(`/api/users?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchUsers]);

  const adjustFamilyCount = (userId: string, delta: number) => {
    setMemberCounts((prev) => {
      const current = prev[userId] || 1;
      const next = Math.max(1, Math.min(30, current + delta));
      return { ...prev, [userId]: next };
    });
  };

  const toggleMember = (candidate: Profile) => {
    if (user && candidate.id === user.id) return;
    setSelectedMembers((prev) => {
      const exists = prev.some((m) => m.id === candidate.id);
      if (exists) {
        return prev.filter((m) => m.id !== candidate.id);
      }
      return [...prev, candidate];
    });
  };

  const selectAllMembers = () => {
    const others = searchResults.filter((u) => u.id !== user?.id);
    setSelectedMembers(others);
  };

  const totalHeadcount =
    (user ? memberCounts[user.id] || 1 : 1) +
    selectedMembers.reduce((sum, m) => sum + (memberCounts[m.id] || 1), 0);

  const onSubmit = async (values: CreateTripFormValues) => {
    try {
      const memberIds = selectedMembers.map((m) => m.id);
      const countsPayload: Record<string, number> = {};
      if (user) {
        countsPayload[user.id] = memberCounts[user.id] || 1;
      }
      for (const m of selectedMembers) {
        countsPayload[m.id] = memberCounts[m.id] || 1;
      }

      const res = await apiFetch("/api/trips", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          member_ids: memberIds,
          member_counts: countsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create trip");
        return;
      }

      toast.success(`Trip "${values.name}" created!`);
      router.push(`/trip/${data.trip.id}`);
    } catch {
      toast.error("Network error while creating trip");
    }
  };

  return (
    <div className="min-h-screen pb-16">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 pt-6 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>

        {!isAdmin ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              Admin Permission Required
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Only Admin (<strong>Samadul</strong>) can create new trips.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Create New Trip (Admin)
                </h1>
                <p className="text-xs text-slate-500">
                  Select members and set family member count (1, 2, 3, 4...) for each user
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 space-y-6"
              noValidate
            >
              {/* Trip Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Trip Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g., Sylhet 2026"
                  {...register("name")}
                  className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                {errors.name && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Selected Members & Family Count */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">
                      Trip Members ({selectedMembers.length + 1} accounts &bull;{" "}
                      <span className="text-emerald-700">
                        {totalHeadcount} total persons
                      </span>
                      )
                    </label>
                    <p className="text-xs text-slate-500">
                      Use <strong>- / +</strong> to set how many family members (1, 2, 3, 4...) are with each person
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={selectAllMembers}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    + Add All Registered Members
                  </button>
                </div>

                <div className="mt-2.5 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                  {/* Admin Row */}
                  {user && (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-700" />
                        <span className="text-sm font-bold text-emerald-950">
                          {user.full_name} (Admin)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">
                          Family members:
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustFamilyCount(user.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[28px] text-center text-sm font-extrabold text-emerald-800">
                          {memberCounts[user.id] || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustFamilyCount(user.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Other Selected Members */}
                  {selectedMembers.map((member) => {
                    const count = memberCounts[member.id] || 1;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {member.full_name}
                          </span>
                          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                            {count} {count === 1 ? "person" : "persons"} ({count}x share)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => adjustFamilyCount(member.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-extrabold text-slate-900">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustFamilyCount(member.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMember(member)}
                            title="Remove from trip"
                            className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search Existing Users by Name */}
              <div>
                <label
                  htmlFor="memberSearch"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Add Members by Name
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    id="memberSearch"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search existing users by name..."
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="mt-2.5 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {searching ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                      <span>Searching users...</span>
                    </div>
                  ) : searchResults.filter((u) => u.id !== user?.id).length ===
                    0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No other users found matching &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    searchResults
                      .filter((u) => u.id !== user?.id)
                      .map((candidate) => {
                        const isAdded = selectedMembers.some(
                          (m) => m.id === candidate.id
                        );
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => toggleMember(candidate)}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${
                              isAdded
                                ? "bg-emerald-50/70 text-emerald-900"
                                : "bg-white text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-xs font-bold text-white">
                                {candidate.full_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">
                                {candidate.full_name}
                              </span>
                            </div>

                            {isAdded ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                                <Check className="h-3.5 w-3.5" />
                                Added
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
                                <UserPlus className="h-3.5 w-3.5" />
                                Add
                              </span>
                            )}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-700 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Trip...</span>
                  </>
                ) : (
                  <span>Create Trip ({totalHeadcount} Total Persons)</span>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
