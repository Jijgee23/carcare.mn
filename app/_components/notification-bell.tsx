"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationItem } from "@/lib/notifications";

// Realm-agnostic мэдэгдэлийн хонх — server action-уудыг prop-оор авна (ажилтан ба
// Account layout тус бүр өөрийн action-уудыг дамжуулна). lib/push энд орохгүй.

const POLL_MS = 45_000;

type Props = {
  initialUnread: number;
  getUnreadCount: () => Promise<number>;
  getRecent: () => Promise<NotificationItem[]>;
  markRead: (id: string) => Promise<number>;
  markAllRead: () => Promise<number>;
  historyHref: string;
  // Dropdown-ийн тэгшлэлт. Зүүн талын sidebar-д "left" (баруун тийш нээгдэнэ),
  // баруун талын header/topbar-д "right" (default).
  align?: "left" | "right";
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "саяхан";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} цаг`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} өдөр`;
  return new Date(iso).toLocaleDateString("mn-MN", {
    month: "short",
    day: "2-digit",
  });
}

export function NotificationBell({
  initialUnread,
  getUnreadCount,
  getRecent,
  markRead,
  markAllRead,
  historyHref,
  align = "right",
}: Props) {
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Уншаагүй тоог тогтмол шинэчлэх — таб идэвхтэй үед л.
  const refreshCount = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    getUnreadCount()
      .then(setUnread)
      .catch(() => {});
  }, [getUnreadCount]);

  useEffect(() => {
    const id = window.setInterval(refreshCount, POLL_MS);
    window.addEventListener("focus", refreshCount);
    document.addEventListener("visibilitychange", refreshCount);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refreshCount);
      document.removeEventListener("visibilitychange", refreshCount);
    };
  }, [refreshCount]);

  // Гадна дарахад хаах.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setItems(await getRecent());
        setUnread(await getUnreadCount());
      } catch {
        // чимээгүй
      } finally {
        setLoading(false);
      }
    }
  }

  function onItemClick(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) =>
        prev?.map((it) => (it.id === n.id ? { ...it, read: true } : it)) ?? prev,
      );
      setUnread((u) => Math.max(0, u - 1));
      markRead(n.id)
        .then(setUnread)
        .catch(() => {});
    }
  }

  async function onMarkAll() {
    setItems((prev) => prev?.map((it) => ({ ...it, read: true })) ?? prev);
    setUnread(0);
    try {
      setUnread(await markAllRead());
    } catch {
      // чимээгүй
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Мэдэгдэл"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute mt-2 w-80 max-w-[calc(100vw-2rem)] glass rounded-xl border border-white/[0.08] shadow-2xl z-50 overflow-hidden ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white/80">Мэдэгдэл</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={onMarkAll}
                className="text-xs text-violet-300 hover:text-violet-200 transition-colors"
              >
                Бүгдийг уншсан
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && !items ? (
              <div className="px-4 py-6 text-center text-sm text-white/40">
                Уншиж байна...
              </div>
            ) : !items || items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-white/40">
                Мэдэгдэл алга байна.
              </div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => onItemClick(n)}
                  className={`block px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                    n.read ? "" : "bg-violet-500/[0.06]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read ? (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    ) : (
                      <span className="mt-1.5 w-1.5 h-1.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white/85 truncate">
                        {n.title}
                      </div>
                      <div className="text-xs text-white/50 line-clamp-2">
                        {n.body}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5">
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            href={historyHref}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-xs text-white/50 hover:text-white hover:bg-white/[0.03] transition-colors border-t border-white/[0.06]"
          >
            Бүх мэдэгдэл
          </Link>
        </div>
      ) : null}
    </div>
  );
}
