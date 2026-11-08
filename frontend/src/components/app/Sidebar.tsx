"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { initials } from "@/lib/format";
import { useApp } from "./AppContext";

type Props = {
  /** Mobile only: whether the workflow list is expanded. */
  open: boolean;
  onToggle: () => void;
};

/**
 * Green panel with the white logo, framed by the cream page like the hero.
 * On desktop it is a sticky column; on phones it collapses to a top bar.
 */
export default function Sidebar({ open, onToggle }: Props) {
  const { me, workflows, logOut } = useApp();
  const params = useParams<{ id?: string }>();

  return (
    <aside className="flex flex-col overflow-hidden rounded-[28px] bg-field-deep text-white lg:sticky lg:top-4 lg:h-[calc(100svh-2rem)] lg:rounded-[32px]">
      <div className="flex items-center justify-between px-5 py-4 lg:px-6 lg:pb-3 lg:pt-6">
        <Link href="/dashboard" aria-label="Eagle dashboard" className="transition-opacity hover:opacity-85">
          <Image src="/brand/eagle_banner_white.png" alt="Eagle" width={122} height={36} priority className="h-9 w-auto" />
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="sidebar-body"
          className="nav-link lg:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div id="sidebar-body" className={`${open ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
        <div className="flex items-center justify-between px-5 pb-2 pt-3 lg:px-6">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/65">My requests</span>
          <Link
            href="/dashboard#new"
            className="rounded-full bg-white/12 px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-white/20"
          >
            + New
          </Link>
        </div>

        <nav aria-label="Workflows" className="flex max-h-72 min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-3 lg:max-h-none">
          {workflows.length === 0 ? (
            <p className="px-3 py-6 text-center text-[14px] leading-relaxed text-white/65">
              No requests yet.
              <br />
              Start one from the dashboard.
            </p>
          ) : (
            workflows.map((w) => {
              const active = params?.id === w._id;
              return (
                <Link
                  key={w._id}
                  href={`/workflows/${w._id}`}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                    active ? "bg-white text-ink" : "hover:bg-white/10"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`sprig mt-0.5 h-4 w-4 ${active ? "text-field" : "text-white/55 group-hover:text-white"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{w.title}</span>
                    <span className={`block truncate text-[12.5px] ${active ? "text-muted" : "text-white/60"}`}>
                      {w.service || "No service match"}
                    </span>
                  </span>
                </Link>
              );
            })
          )}
        </nav>

        <div className="flex items-center gap-3 border-t border-white/12 px-5 py-4 lg:px-6">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-wheat font-display text-[16px] text-[#3d2604]">
            {initials(me.username)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{me.username}</span>
            <span className="block truncate text-[12.5px] text-white/65">
              {me.farm_name || me.farm_state_name || "Farm profile"}
            </span>
          </span>
          <button type="button" onClick={logOut} className="nav-link px-3 text-[14px]">
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
