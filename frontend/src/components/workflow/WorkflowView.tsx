"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isSent, shortDate } from "@/lib/format";
import type { WorkflowDetail } from "@/lib/types";
import { useApp } from "@/components/app/AppContext";
import ChatStep from "./ChatStep";
import EmailCard from "./EmailCard";
import StepHeading from "./StepHeading";
import SupplierStep from "./SupplierStep";

export default function WorkflowView() {
  const { id } = useParams<{ id: string }>();
  const { handleError } = useApp();
  const [data, setData] = useState<WorkflowDetail | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api<WorkflowDetail>(`/workflows/${id}`));
    } catch (err) {
      if ((err as Error).message === "Not found") setMissing(true);
      else handleError(err);
    }
  }, [id, handleError]);

  useEffect(() => {
    setData(null);
    setMissing(false);
    load();
  }, [load]);

  if (missing) {
    return (
      <div className="fade-in card mt-6 p-8 text-center">
        <h1 className="font-display text-[28px]">Request not found</h1>
        <p className="mt-2 text-[15px] text-muted">It may have been removed, or the link is wrong.</p>
        <Link href="/dashboard" className="btn btn-solid btn-green btn-sm mt-6">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-6 flex flex-col gap-4" role="status" aria-label="Loading request">
        <div className="h-5 w-32 animate-pulse rounded-full bg-line" />
        <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-line" />
        <div className="mt-6 h-48 animate-pulse rounded-[24px] bg-line/70" />
      </div>
    );
  }

  const { workflow: w, companies, emails } = data;
  const sentCount = emails.filter((e) => isSent(e.status)).length;

  return (
    <div className="fade-in">
      <Link href="/dashboard" className="text-[14px] font-medium text-field underline-offset-4 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[14px] text-muted">Request{w.created ? ` · ${shortDate(w.created)}` : ""}</p>
          <h1 className="mt-1 font-display text-[clamp(1.9rem,4vw,2.7rem)] leading-tight">{w.title}</h1>
        </div>
        <span className="pill bg-mint text-[13px] text-field-deep">
          <span aria-hidden className="sprig h-3.5 w-3.5" />
          {w.service || "No service match"}
        </span>
      </div>

      <blockquote className="mt-5 rounded-[20px] border-l-4 border-wheat bg-white px-5 py-4 text-[15.5px] leading-relaxed text-ink/85">
        &ldquo;{w.prompt}&rdquo;
      </blockquote>

      {/* Budget + scope summary */}
      {(w.budget_label || (w.search_scope && w.search_scope !== "local")) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {w.budget_label && (
            <span className="pill bg-wheat-soft text-[13px] text-[#6b4e12]">
              💰 Budget: {w.budget_label}
            </span>
          )}
          {w.search_scope && w.search_scope !== "local" && (
            <span className="pill bg-mint text-[13px] text-field-deep capitalize">
              🔍 {w.search_scope} search
            </span>
          )}
        </div>
      )}

      <SupplierStep workflowId={w._id} companies={companies} emails={emails} onDrafted={load} />

      <section aria-labelledby="step-review" className="scroll-mt-6" id="review">
        <StepHeading
          n={2}
          id="step-review"
          title="Review & send"
          hint={
            emails.length
              ? `${sentCount} of ${emails.length} sent. Edit each draft before it goes out.`
              : "Edit each draft before it goes out."
          }
          done={emails.length > 0 && sentCount === emails.length}
        />
        <div className="card flex flex-col gap-4 p-3 md:p-4">
          {emails.length === 0 ? (
            <p className="p-3 text-[15px] text-muted">
              No drafts yet. Select suppliers above to write quote requests.
            </p>
          ) : (
            emails.map((e) => <EmailCard key={e._id} email={e} onSent={load} />)
          )}
        </div>
      </section>

      <ChatStep workflowId={w._id} chat={w.chat || []} />
    </div>
  );
}
