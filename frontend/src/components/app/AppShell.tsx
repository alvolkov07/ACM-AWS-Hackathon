"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, AuthError, clearToken, getToken } from "@/lib/api";
import type { User, Workflow } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { AppContext, type AppState } from "./AppContext";
import Sidebar from "./Sidebar";

/** Signed-in area: loads the user and their workflows, then shows the sidebar and page. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [me, setMe] = useState<User | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const logOut = useCallback(() => {
    clearToken();
    router.replace("/login");
  }, [router]);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof AuthError) {
        toast(err.message, { error: true });
        router.replace("/login");
        return;
      }
      toast(err instanceof Error ? err.message : "Something went wrong", { error: true });
    },
    [router, toast],
  );

  const refreshWorkflows = useCallback(async () => {
    try {
      setWorkflows(await api<Workflow[]>("/workflows"));
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const user = await api<User>("/me");
        // Suppliers are matched by state, so the farm location must be resolved first.
        if (!user.farm_state) {
          router.replace("/setup-location");
          return;
        }
        setMe(user);
        setWorkflows(await api<Workflow[]>("/workflows"));
      } catch (err) {
        handleError(err);
      }
    })();
  }, [router, handleError]);

  // Close the mobile menu after navigating.
  useEffect(() => setMenuOpen(false), [pathname]);

  const value = useMemo<AppState | null>(
    () => (me ? { me, workflows, refreshWorkflows, handleError, logOut } : null),
    [me, workflows, refreshWorkflows, handleError, logOut],
  );

  if (!value) {
    return (
      <div className="grid min-h-svh place-items-center bg-surface" role="status">
        <span className="flex items-center gap-3 font-display text-[22px] text-field">
          <span aria-hidden className="sprig h-7 w-7 animate-pulse" />
          Loading your farm…
        </span>
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      <div className="min-h-svh bg-surface p-3 md:p-4 lg:grid lg:grid-cols-[300px_1fr] lg:gap-4">
        <Sidebar open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />
        <main className="mx-auto w-full max-w-[960px] px-2 pb-16 pt-6 md:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>
    </AppContext.Provider>
  );
}
