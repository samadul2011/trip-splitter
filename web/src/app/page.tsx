import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";

export default function HomePage() {
  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) {
    redirect("/dashboard");
  }
  redirect("/login");
}

