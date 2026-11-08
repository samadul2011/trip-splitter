"use client";

import React from "react";
import Link from "next/link";
import { Compass, LogOut, User as UserIcon, Languages, ShieldCheck } from "lucide-react";
import { useApp } from "./AppProvider";
import { toast } from "sonner";

export function Navbar() {
  const { user, logout, bengaliNumbers, toggleBengaliNumbers } = useApp();
  const isAdmin =
    Boolean(user?.is_admin) ||
    (user?.full_name || "").trim().toLowerCase() === "samadul";

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/90 backdrop-blur-md print:hidden">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link
          href={user ? "/dashboard" : "/login"}
          className="flex items-center gap-2.5 text-emerald-900 transition hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900">
              TripSplit
            </span>
            <span className="hidden text-xs text-emerald-600 sm:block">
              Group Expense & Settlement
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleBengaliNumbers}
            title="Toggle English / Bengali digits"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              bengaliNumbers
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span>{bengaliNumbers ? "বাংলা (১২৩)" : "EN (123)"}</span>
          </button>

          {user && (
            <>
              <div className="flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                <UserIcon className="h-3.5 w-3.5 text-sky-600" />
                <span>{user.full_name}</span>
                {isAdmin && (
                  <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
