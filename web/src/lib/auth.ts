import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { dbFindUserById } from "./db";
import { Profile } from "@/types/database";

export const ACCESS_TOKEN_COOKIE = "trip_access_token";
export const ADMIN_USER_NAME = "samadul";

export function isAdminProfile(profile?: { full_name?: string; is_admin?: boolean } | null): boolean {
  if (!profile) return false;
  if (profile.is_admin) return true;
  return (profile.full_name || "").trim().toLowerCase() === ADMIN_USER_NAME;
}

function getJwtSecretKey(): Uint8Array {
  const secret =
    process.env.JWT_SECRET || "super-secret-trip-splitter-jwt-key-2026";
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(profile: Profile): Promise<string> {
  return await new SignJWT({
    sub: profile.id,
    full_name: profile.full_name,
    is_admin: isAdminProfile(profile),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifyAccessToken(
  token: string
): Promise<{ id: string; full_name: string; is_admin: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    if (!payload.sub) return null;
    const fullName = String(payload.full_name || "");
    return {
      id: String(payload.sub),
      full_name: fullName,
      is_admin: Boolean(payload.is_admin) || fullName.toLowerCase() === ADMIN_USER_NAME,
    };
  } catch {
    return null;
  }
}

export async function verifyPassword(
  inputPassword: string,
  storedHashOrPlain: string
): Promise<boolean> {
  if (
    storedHashOrPlain.startsWith("$2a$") ||
    storedHashOrPlain.startsWith("$2b$") ||
    storedHashOrPlain.startsWith("$2y$")
  ) {
    return await bcrypt.compare(inputPassword, storedHashOrPlain);
  }
  return inputPassword === storedHashOrPlain;
}

export interface AuthenticatedContext {
  profile: Profile;
  accessToken: string;
}

export function extractAccessToken(req: NextRequest): string | null {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export async function requireAuth(
  req: NextRequest
): Promise<{
  context: AuthenticatedContext | null;
  errorResponse: NextResponse | null;
}> {
  const accessToken = extractAccessToken(req);
  if (!accessToken) {
    return {
      context: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Missing authentication token" },
        { status: 401 }
      ),
    };
  }

  const decoded = await verifyAccessToken(accessToken);
  if (!decoded) {
    return {
      context: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  const profile = await dbFindUserById(decoded.id);
  if (!profile) {
    return {
      context: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: User account no longer exists" },
        { status: 401 }
      ),
    };
  }

  profile.is_admin = isAdminProfile(profile);

  return {
    context: {
      profile,
      accessToken,
    },
    errorResponse: null,
  };
}
