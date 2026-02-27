"use server";

import { signIn } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminHost } from "@/lib/subdomain";
import { AuthError } from "next-auth";

export async function login(email: string, password: string) {
  const host = (await headers()).get("host") ?? "";
  const redirectTo = isAdminHost(host) ? "/admin" : "/catalog";

  try {
    await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    // signIn throws a NEXT_REDIRECT on success — rethrow it
    throw error;
  }
}
