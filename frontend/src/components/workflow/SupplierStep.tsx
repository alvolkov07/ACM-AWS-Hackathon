"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Company, Email } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";
import { useApp } from "@/components/app/AppContext";
import StepHeading from "./StepHeading";

type Props = {
  workflowId: string;
  companies: Company[];
  emails: Email[];
  /** Called after drafts are created so the page can reload. */
  onDrafted: () => Promise<void>;
};

const fmt = (n?: number) => Number(n || 0).toFixed(1);

export default function SupplierStep({ workflowId, companies, emails, onDrafted }: Props) {
  const { handleError } = useApp();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const drafted = new Set(emails.map((e) => e.company_id));
  const selectable = companies.filter((c) => !drafted.has(c._id));
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c._id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function draft() {
    if (!selected.size) {
      toast("Select at least one supplier.", { error: true });
      return;
    }
    setBusy(true);
    try {
      await api<Email[]>(`/workflows/${workflowId}/drafts`, "POST", {
        company_ids: [...selected],
        details: details.trim(),
      });
      await onDrafted();
      setSelected(new Set());
      toast("Drafts ready. Review them below.");
      document.getElementById("step-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="step-suppliers">
      <StepHeading
        n={1}
        id="step-suppliers"
        title="Choose suppliers"
        hint="Most trusted first. Pick who to ask for a quote."
        done={emails.length > 0}
      />

      <div className="card p-3 md:p-4">
        {companies.length === 0 ? (
          <p className="p-3 text-[15px] text-muted">
            No suppliers were found in your state for this service. Try describing the need differently.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 pb-2 pt-1">
              <span className="text-[13px] text-muted">
                {companies.length} supplier{companies.length === 1 ? "" : "s"} found
              </span>
              {selectable.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c._id)))}
                  className="text-[13px] font-medium text-field underline-offset-4 hover:underline"
                >
                  {allSelected ? "Clear selection" : "Select all"}
                </button>
              )}
            </div>

            <ul className="flex flex-col gap-1.5">
              {companies.map((c) => {
                const isDrafted = drafted.has(c._id);
                const checked = selected.has(c._id);
                return (
                  <li key={c._id}>
                    <label
                      className={`flex gap-3.5 rounded-2xl border p-4 transition-colors ${
                        isDrafted
                          ? "cursor-default border-transparent bg-[#faf9f4]"
                          : checked
                            ? "cursor-pointer border-leaf bg-mint/60"
                            : "cursor-pointer border-transparent hover:bg-[#faf9f4]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 flex-none accent-[var(--field)]"
                        checked={isDrafted || checked}
                        disabled={isDrafted || busy}
                        onChange={() => toggle(c._id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-display text-[18px] leading-snug">{c.name}</span>
                          {c.verified && <span className="pill bg-mint text-field-deep">✓ Verified</span>}
                          {isDrafted && <span className="pill bg-wheat-soft text-[#6b4e12]">Email drafted</span>}
                        </span>
                        <span className="mt-1 block text-[13.5px] text-muted">
                          {[c.address || c.state, c.distance_miles != null ? `${fmt(c.distance_miles)} mi away` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {(c.services?.length || c.category) && (
                          <span className="mt-0.5 block text-[13.5px] text-muted">
                            {c.services?.length ? c.services.join(", ") : c.category}
                          </span>
                        )}
                        <span className="mt-1.5 block text-[13px] text-muted">
                          {Number(c.review_count || 0).toLocaleString()} reviews · trust {fmt(c.trust_score ?? c.rating)}/5
                        </span>
                        {c.review_summary && (
                          <span className="mt-2 block text-[14px] leading-relaxed text-ink/85">{c.review_summary}</span>
                        )}
                        {(c.website || c.phone || c.maps_url) && (
                          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                            {c.website && (
                              <a href={c.website} target="_blank" rel="noreferrer noopener" className="text-field underline-offset-4 hover:underline">
                                Website
                              </a>
                            )}
                            {c.phone && (
                              <a href={`tel:${c.phone}`} className="text-field underline-offset-4 hover:underline">
                                {c.phone}
                              </a>
                            )}
                            {c.maps_url && (
                              <a href={c.maps_url} target="_blank" rel="noreferrer noopener" className="text-field underline-offset-4 hover:underline">
                                Map
                              </a>
                            )}
                          </span>
                        )}
                      </span>
                      <span className="pill h-fit bg-wheat-soft text-[13px] text-[#6b4e12]" title="Google rating">
                        ★ {fmt(c.rating)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            {selectable.length > 0 && (
              <div className="border-t border-line px-3 pb-2 pt-5">
                <label htmlFor="details" className="field-label">
                  Extra details for the email <span className="font-normal">(optional)</span>
                </label>
                <textarea
                  id="details"
                  rows={2}
                  value={details}
                  maxLength={2000}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Quantities, dates, budget, delivery needs…"
                  className="field"
                  disabled={busy}
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <SubmitButton type="button" onClick={draft} busy={busy} busyLabel="Drafting emails…" sprig>
                    {selected.size ? `Draft ${selected.size} email${selected.size === 1 ? "" : "s"}` : "Draft emails"}
                  </SubmitButton>
                  {!selected.size && <span className="text-[13.5px] text-muted">Select suppliers above first.</span>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
