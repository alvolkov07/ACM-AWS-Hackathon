"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

/** Sends visitors who already have a session straight to the dashboard. */
export function useRedirectIfSignedIn() {
  const router = useRouter();
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);
}
