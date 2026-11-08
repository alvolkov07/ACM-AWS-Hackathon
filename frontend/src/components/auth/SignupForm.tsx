"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { useToast } from "@/components/Toast";
import SubmitButton from "@/components/SubmitButton";
import { useRedirectIfSignedIn } from "./useRedirectIfSignedIn";

export default function SignupForm() {
  useRedirectIfSignedIn();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = (k: string) => String(form.get(k) || "").trim();
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>("/register", "POST", {
        username: value("username"),
        password: String(form.get("password") || ""),
        email: value("email"),
        farm_name: value("farm_name"),
        farm_location: value("farm_location"),
      });
      setToken(token);
      toast("Welcome to Eagle!");
      router.replace("/dashboard");
    } catch (err) {
      toast((err as Error).message, { error: true });
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-[2.4rem] leading-none">Create your account</h2>
      <p className="mt-3 text-[15px] text-muted">Set up your farm profile so we can find suppliers near you.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="username" className="field-label">
              Username
            </label>
            <input
              id="username"
              name="username"
              className="field"
              autoComplete="username"
              minLength={3}
              maxLength={50}
              required
              autoFocus
            />
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
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="mt-1.5 text-[12px] text-muted">
              At least 8 characters
            </p>
          </div>
        </div>
        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="you@farm.com"
            required
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="farm_name" className="field-label">
              Farm name <span className="font-normal">(optional)</span>
            </label>
            <input id="farm_name" name="farm_name" className="field" placeholder="Green Acres" maxLength={100} />
          </div>
          <div>
            <label htmlFor="farm_location" className="field-label">
              Farm location
            </label>
            <input
              id="farm_location"
              name="farm_location"
              className="field"
              placeholder="Fresno, CA"
              minLength={3}
              maxLength={200}
              required
            />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel="Creating account…" className="btn btn-solid btn-green mt-2 w-full" sprig>
          Create account
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-[15px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-field underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
