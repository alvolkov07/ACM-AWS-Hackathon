"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { greeting, season, shortDate } from "@/lib/format";
import type { WorkflowDetail } from "@/lib/types";
import HeroBackground from "@/components/HeroBackground";
import SubmitButton from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";
import { useApp } from "./AppContext";

const SAMPLE_NEEDS = [
  "We need irrigation service for 40 acres",
  "Looking to buy seeds for the spring planting",
  "Need fertilizer delivered before next month",
  "Our tractor needs equipment repair",
  "Looking for pest control for our orchard",
];

export default function Dashboard() {
  const { me, workflows, refreshWorkflows, handleError } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Time-based greeting is computed on the client to match the viewer's clock.
  useEffect(() => setNow(new Date()), []);

  // "+ New" in the sidebar links to #new; focus the request box.
  useEffect(() => {
    const focusIfNew = () => {
      if (window.location.hash === "#new") promptRef.current?.focus();
    };
    focusIfNew();
    window.addEventListener("hashchange", focusIfNew);
    return () => window.removeEventListener("hashchange", focusIfNew);
  }, []);

  async function startWorkflow(e?: React.FormEvent) {
    e?.preventDefault();
    const text = prompt.trim();
    if (text.length < 3) {
      toast("Tell us what your farm needs first.", { error: true });
      promptRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const d = await api<WorkflowDetail>("/workflows", "POST", { prompt: text });
      await refreshWorkflows();
      router.push(`/workflows/${d.workflow._id}`);
    } catch (err) {
      handleError(err);
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[15px] text-muted">{now ? `${greeting(now)},` : " "}</p>
          <h1 className="mt-1 font-display text-[clamp(2rem,4vw,2.9rem)] leading-tight">Welcome back, {me.username}</h1>
        </div>
        {now && (
          <span className="pill bg-wheat-soft text-[13px] text-[#6b4e12]">
            <span aria-hidden className="sprig h-3.5 w-3.5" />
            {season(now)}
            {me.farm_state_name ? ` · ${me.farm_state_name}` : ""}
          </span>
        )}
      </div>

      {/* Request box on the wheat photo, echoing the landing page hero. */}
      <section
        id="new"
        className="on-photo relative mt-7 scroll-mt-6 overflow-hidden rounded-[28px] p-6 text-white md:p-9"
        aria-labelledby="new-heading"
      >
        <HeroBackground tint={0.34} position="50% 70%" sizes="(min-width: 1024px) 900px, 100vw" />
        <div className="relative z-10">
          <h2 id="new-heading" className="font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-tight">
            What does your farm need today?
          </h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed">
            Describe it in plain words. We&apos;ll find the best-rated suppliers in your state.
          </p>

          <form onSubmit={startWorkflow} className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
            <label htmlFor="prompt" className="sr-only">
              What does your farm need?
            </label>
            <textarea
              id="prompt"
              ref={promptRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startWorkflow();
              }}
              maxLength={2000}
              placeholder="e.g. We need irrigation service for our south field…"
              className="field min-h-[64px] flex-1 [text-shadow:none]"
              disabled={busy}
            />
            <SubmitButton busy={busy} busyLabel="Finding suppliers…" className="btn btn-solid btn-white" sprig>
              Find suppliers
            </SubmitButton>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {SAMPLE_NEEDS.map((need) => (
              <button
                key={need}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPrompt(need);
                  promptRef.current?.focus();
                }}
                className="rounded-full bg-[rgba(24,38,18,0.38)] px-3.5 py-1.5 text-[13px] text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[rgba(24,38,18,0.55)]"
              >
                {need}
              </button>
            ))}
          </div>
          {busy && (
            <p className="mt-4 text-[14px]" role="status">
              Searching suppliers and reading reviews. This can take up to a minute.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="mb-4">
          <h2 id="recent-heading" className="font-display text-[26px] leading-tight">
            Recent requests
          </h2>
          <p className="text-[14px] text-muted">Pick up where you left off</p>
        </div>

        {workflows.length === 0 ? (
          <div className="card p-6 text-[15px] text-muted">
            You haven&apos;t started any requests yet. Describe a need above to create your first one.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((w) => (
              <Link
                key={w._id}
                href={`/workflows/${w._id}`}
                className="card group flex flex-col p-5 transition hover:-translate-y-1 hover:border-leaf"
              >
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.12em] text-[#a26a06]">
                  <span aria-hidden className="sprig h-3 w-3" />
                  Request
                </span>
                <h3 className="mt-2 font-display text-[19px] leading-snug">{w.title}</h3>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-[12.5px] text-muted">
                  <span className="pill bg-mint text-field-deep">{w.service || "No service match"}</span>
                  {w.created && <span>{shortDate(w.created)}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
