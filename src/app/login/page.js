"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import BrandHeader from "@/components/BrandHeader";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    const result = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: "/admin/cycles" // or "/" if you want to go home after login
    });
    setLoading(false);
    if (result?.ok) {
      setStatus("If your email is valid and active, a magic link has been sent.");
    } else {
      setStatus("There was a problem sending the magic link. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-neutral-950/80 backdrop-blur-xl p-8 rounded-xl border border-neutral-800 shadow-2xl w-full max-w-md space-y-6 text-[var(--foreground)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-br from-blue-700/20 via-indigo-700/10 to-purple-700/20" />
        <BrandHeader subtitle="Access Portal" />
        <h2 className="text-sm font-medium text-neutral-400 -mt-4">Sign in with your company email</h2>
        <input
          type="email"
          name="email"
          required
          placeholder="you@capplc.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-neutral-800/70 border border-neutral-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 placeholder-neutral-400"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition font-medium"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Magic Link"}
        </button>
        {status && <div className="text-center text-sm text-green-400 mt-2">{status}</div>}
        <p className="text-xs text-neutral-500 text-center">Only active @capplc.com emails are allowed.</p>
      </form>
    </div>
  );
}
