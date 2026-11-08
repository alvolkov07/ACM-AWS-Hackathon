"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, AuthError, clearToken, getToken } from "@/lib/api";
import type { User } from "@/lib/types";
import { useToast } from "@/components/Toast";
import SubmitButton from "@/components/SubmitButton";

/** Shown when an account has no resolved farm state yet; suppliers are matched by state. */
export default function LocationForm() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<User>("/me")
      .then((u) => (u.farm_state ? router.replace("/dashboard") : setMe(u)))
      .catch((err) => {
        if (err instanceof AuthError) router.replace("/login");
        else toast((err as Error).message, { error: true });
      });
  }, [router, toast]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const location = String(new FormData(e.currentTarget).get("farm_location") || "").trim();
    setBusy(true);
    try {
      await api<User>("/me/location", "PUT", { farm_location: location });
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof AuthError) return router.replace("/login");
      toast((err as Error).message, { error: true });
      setBusy(false);
    }
  }

  function logOut() {
    clearToken();
    router.replace("/login");
  }

  return (
    <>
      <h2 className="font-display text-[2.4rem] leading-none">Where is your farm?</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        We only show suppliers from your state, so we need your farm&apos;s location. A town and state is
        enough.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label htmlFor="farm_location" className="field-label">
            Farm location
          </label>
          <input
            id="farm_location"
            name="farm_location"
            className="field"
            placeholder="Fresno, CA or a farm address"
            defaultValue={me?.farm_location || ""}
            key={me?._id || "loading"}
            minLength={3}
            maxLength={200}
            required
            autoFocus
          />
        </div>
        <SubmitButton busy={busy} busyLabel="Finding your farm…" className="btn btn-solid btn-green mt-2 w-full" sprig>
          Save location
        </SubmitButton>
      </form>

      <p className="mt-8 text-center text-[15px] text-muted">
        {me ? <>Signed in as {me.username}. </> : null}
        <button type="button" onClick={logOut} className="font-medium text-field underline-offset-4 hover:underline">
          Log out
        </button>
      </p>
    </>
  );
}
