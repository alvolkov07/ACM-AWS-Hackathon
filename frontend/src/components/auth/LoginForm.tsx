"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { useToast } from "@/components/Toast";
import SubmitButton from "@/components/SubmitButton";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";

export default function LoginForm() {
  useRedirectIfSignedIn();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>("/login", "POST", {
        username: String(form.get("username") || "").trim(),
        password: String(form.get("password") || ""),
      });
      setToken(token);
      router.replace("/dashboard");
    } catch (err) {
      toast((err as Error).message, { error: true });
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-[2.4rem] leading-none">Log in</h2>
      <p className="mt-3 text-[15px] text-muted">Pick up your supplier requests where you left off.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label htmlFor="username" className="field-label">
            Username
          </label>
          <input id="username" name="username" className="field" autoComplete="username" required autoFocus />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="field"
            autoComplete="current-password"
            required
          />
        </div>
        <SubmitButton busy={busy} busyLabel="Logging in…" className="btn btn-solid btn-green mt-2 w-full" sprig>
          Log in
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-[15px] text-muted">
        New to Eagle?{" "}
        <Link href="/signup" className="font-medium text-field underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
