"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

type HealthResponse = {
  status: string;
  time: string;
};

type StatusState =
  | { kind: "loading" }
  | { kind: "ok"; time: string }
  | { kind: "error"; message: string };

export function ApiStatusCard() {
  const [state, setState] = useState<StatusState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api<HealthResponse>("/api/health");
        if (!cancelled) {
          setState({ kind: "ok", time: data.time });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : "Could not reach /api/health";
          setState({ kind: "error", message });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API status</CardTitle>
        <CardDescription>
          Calls the local <code>/api/health</code> route so you can confirm the
          app server is responding.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {state.kind === "loading" && (
          <p className="text-muted-foreground">Checking…</p>
        )}
        {state.kind === "ok" && (
          <p>
            Status: <span className="font-medium text-foreground">ok</span>
            <span className="text-muted-foreground"> · {state.time}</span>
          </p>
        )}
        {state.kind === "error" && (
          <p className="text-destructive">{state.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
