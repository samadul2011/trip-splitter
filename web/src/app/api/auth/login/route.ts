import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbFindUserByName } from "@/lib/db";
import {
  ACCESS_TOKEN_COOKIE,
  isAdminProfile,
  signAccessToken,
  verifyPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Your name is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || "Invalid credentials payload",
        },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const cleanName = username.includes("@")
      ? username.split("@")[0].trim()
      : username.trim();

    const userRow = await dbFindUserByName(cleanName);

    if (!userRow) {
      return NextResponse.json(
        { error: "Invalid name or password. Please check your credentials." },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(
      password,
      userRow.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid name or password. Please check your credentials." },
        { status: 401 }
      );
    }

    const profile = {
      id: userRow.id,
      full_name: userRow.full_name,
      is_admin: isAdminProfile({ full_name: userRow.full_name }),
    };

    const accessToken = await signAccessToken(profile);

    const response = NextResponse.json({
      access_token: accessToken,
      user: profile,
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { error: "Failed to process login request" },
      { status: 500 }
    );
  }
}
