"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/catalog");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-[#12121a] p-8 border border-[#1e1e2e]">
        <h1 className="text-2xl font-bold text-center text-brand-500">TCG Wholesale</h1>
        <p className="text-center text-sm text-gray-400">Sign in to your account</p>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
        <button
          type="submit"
          className="w-full rounded bg-brand-600 py-2 text-sm font-medium hover:bg-brand-700 transition"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
