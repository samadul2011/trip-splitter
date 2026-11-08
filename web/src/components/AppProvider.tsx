"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Profile } from "@/types/database";

interface AppContextType {
  user: Profile | null;
  accessToken: string | null;
  loadingAuth: boolean;
  dbMode: "neon" | "local" | null;
  bengaliNumbers: boolean;
  toggleBengaliNumbers: () => void;
  setAuthSession: (token: string, user: Profile) => void;
  logout: () => Promise<void>;
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_TOKEN_KEY = "trip_splitter_token";
const STORAGE_USER_KEY = "trip_splitter_user";
const STORAGE_BN_KEY = "trip_splitter_bn";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [dbMode, setDbMode] = useState<"neon" | "local" | null>(null);
  const [bengaliNumbers, setBengaliNumbers] = useState(false);

  useEffect(() => {
    const savedBn = localStorage.getItem(STORAGE_BN_KEY);
    if (savedBn === "true") {
      setBengaliNumbers(true);
    }

    const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
    const savedUser = localStorage.getItem(STORAGE_USER_KEY);

    if (savedToken && savedUser) {
      try {
        setAccessToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore invalid JSON
      }
    }

    // Verify session with /api/auth/me
    const headers: Record<string, string> = {};
    if (savedToken) {
      headers["Authorization"] = `Bearer ${savedToken}`;
    }

    fetch("/api/auth/me", { headers, cache: "no-store" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.db_mode) {
            setDbMode(data.db_mode);
          }
          if (data.user) {
            setUser(data.user);
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
          }
        } else if (res.status === 401) {
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      })
      .catch(() => {
        // Ignore network errors on boot
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, []);

  const toggleBengaliNumbers = useCallback(() => {
    setBengaliNumbers((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_BN_KEY, String(next));
      return next;
    });
  }, []);

  const setAuthSession = useCallback((token: string, profile: Profile) => {
    setAccessToken(token);
    setUser(profile);
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(profile));
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    router.push("/login");
  }, [router]);

  const apiFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const token = accessToken || localStorage.getItem(STORAGE_TOKEN_KEY);
      const headers = new Headers(init.headers || {});
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(url, {
        cache: "no-store",
        ...init,
        headers,
      });

      if (res.status === 401) {
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        router.push("/login");
      }

      return res;
    },
    [accessToken, router]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        accessToken,
        loadingAuth,
        dbMode,
        bengaliNumbers,
        toggleBengaliNumbers,
        setAuthSession,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return ctx;
}

