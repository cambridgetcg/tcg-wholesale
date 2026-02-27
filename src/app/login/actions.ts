"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function login(email: string, password: string) {
  try {
    await signIn("credentials", {
      email: email.toLowerCase().trim(),
      password,
      redirectTo: "/catalog",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    // signIn throws a NEXT_REDIRECT on success — rethrow it
    throw error;
  }
}
