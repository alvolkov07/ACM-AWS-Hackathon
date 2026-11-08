"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { useApp } from "@/components/app/AppContext";
import StepHeading from "./StepHeading";

type Props = {
  workflowId: string;
  chat: ChatMessage[];
};

const REPORT_PROMPT =
  "Write a short report comparing the companies, their replies, and recommend the best option.";

export default function ChatStep({ workflowId, chat }: Props) {
  const { handleError } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>(chat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages(chat), [chat]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (t.length < 3 || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: t }]);
    setBusy(true);
    try {
      const { answer } = await api<{ answer: string }>(`/workflows/${workflowId}/chat`, "POST", { prompt: t });
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (err) {
      // Roll back the optimistic message and put the text back so it can be retried.
      setMessages((m) => m.slice(0, -1));
      setInput(t);
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="step-report">
      <StepHeading
        n={3}
        id="step-report"
        title="Compare & report"
        hint="Ask about the replies, or get a recommendation."
      />

      <div className="card p-4 md:p-5">
        <div ref={listRef} className="flex max-h-[440px] flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
          {messages.length === 0 && (
            <div className="max-w-[85%] self-start rounded-[20px] rounded-bl-md bg-mint px-4 py-3 text-[15px] leading-relaxed">
              Hi! Once you&apos;ve logged a few supplier replies, ask me to compare them or generate a report.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-3 text-[15px] leading-relaxed ${
                m.role === "user"
                  ? "self-end rounded-br-md bg-field text-white"
                  : "self-start rounded-bl-md bg-mint text-ink"
              }`}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 self-start rounded-[20px] rounded-bl-md bg-mint px-4 py-3 text-[15px] text-muted">
              <span aria-hidden className="sprig h-4 w-4 animate-pulse text-field" />
              Thinking…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mt-4 flex gap-2"
        >
          <label htmlFor="chat-input" className="sr-only">
            Ask about your emails and replies
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder="Ask about your emails and replies…"
            className="field flex-1"
            disabled={busy}
          />
          <button type="submit" disabled={busy || input.trim().length < 3} className="btn btn-solid btn-green btn-sm">
            Send
          </button>
        </form>
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => send(REPORT_PROMPT)}
            className="btn btn-solid btn-wheat btn-sm"
          >
            Generate report
            <span aria-hidden className="sprig btn__sprig" />
          </button>
        </div>
      </div>
    </section>
  );
}
