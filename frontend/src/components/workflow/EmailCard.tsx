"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isSent } from "@/lib/format";
import type { Email } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";
import { useApp } from "@/components/app/AppContext";

type Props = {
  email: Email;
  /** Called after sending so the page can reload the status. */
  onSent: () => Promise<void>;
};

export default function EmailCard({ email, onSent }: Props) {
  const { handleError } = useApp();
  const toast = useToast();
  const [to, setTo] = useState(email.to || "");
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [reply, setReply] = useState(email.reply || "");
  const [busy, setBusy] = useState<"save" | "send" | "reply" | null>(null);

  const sent = isSent(email.status);
  const id = email._id;

  async function save(quiet = false) {
    await api(`/emails/${id}`, "PUT", { subject, body, to });
    if (!quiet) toast("Draft saved.");
  }

  async function run(kind: "save" | "send" | "reply", fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-[20px] border border-line bg-[#fcfcf8] p-4 md:p-5" aria-labelledby={`email-${id}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`email-${id}`} className="font-display text-[19px] leading-snug">
          {email.company_name}
        </h3>
        <span className={`pill ${sent ? "bg-mint text-field-deep" : "bg-wheat-soft text-[#6b4e12]"}`}>
          {sent ? "✓ " : ""}
          {email.status || "draft"}
        </span>
      </header>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <label htmlFor={`to-${id}`} className="field-label">
            To
          </label>
          <input
            id={`to-${id}`}
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="No email found. Add the supplier's address."
            className="field"
            readOnly={sent}
          />
        </div>
        <div>
          <label htmlFor={`subject-${id}`} className="field-label">
            Subject
          </label>
          <input
            id={`subject-${id}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            className="field"
            readOnly={sent}
          />
        </div>
        <div>
          <label htmlFor={`body-${id}`} className="field-label">
            Message
          </label>
          <textarea
            id={`body-${id}`}
            rows={sent ? 6 : 9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            className="field"
            readOnly={sent}
          />
        </div>

        {!sent && (
          <div className="flex flex-wrap gap-3">
            <SubmitButton
              type="button"
              busy={busy === "save"}
              disabled={!!busy}
              busyLabel="Saving…"
              className="btn btn-solid btn-outline btn-sm"
              onClick={() => run("save", () => save())}
            >
              Save draft
            </SubmitButton>
            <SubmitButton
              type="button"
              busy={busy === "send"}
              disabled={!!busy}
              busyLabel="Sending…"
              className="btn btn-solid btn-green btn-sm"
              onClick={() =>
                run("send", async () => {
                  await save(true);
                  const r = await api<{ status: string }>(`/emails/${id}/send`, "POST");
                  toast(r.status === "sent" ? "Email sent." : `Email ${r.status}.`);
                  await onSent();
                })
              }
            >
              Approve &amp; send
            </SubmitButton>
          </div>
        )}

        <div className="border-t border-line pt-4">
          <label htmlFor={`reply-${id}`} className="field-label">
            Supplier&apos;s reply
          </label>
          <textarea
            id={`reply-${id}`}
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={10000}
            placeholder="Paste the supplier's reply here once it comes in…"
            className="field"
          />
          <div className="mt-3">
            <SubmitButton
              type="button"
              busy={busy === "reply"}
              disabled={!!busy || !reply.trim()}
              busyLabel="Saving…"
              className="btn btn-solid btn-wheat btn-sm"
              onClick={() =>
                run("reply", async () => {
                  await api(`/emails/${id}/reply`, "POST", { text: reply.trim() });
                  toast("Reply saved.");
                })
              }
            >
              Save reply
            </SubmitButton>
          </div>
        </div>
      </div>
    </article>
  );
}
