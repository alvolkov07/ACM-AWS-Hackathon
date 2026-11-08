"use client";

import { createContext, useContext } from "react";
import type { User, Workflow } from "@/lib/types";

export type AppState = {
  me: User;
  workflows: Workflow[];
  /** Reloads the sidebar list, e.g. after a new workflow is created. */
  refreshWorkflows: () => Promise<void>;
  /** Handles an error from an API call: expired sessions go to /login, others show a toast. */
  handleError: (err: unknown) => void;
  logOut: () => void;
};

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside the app layout");
  return ctx;
}
