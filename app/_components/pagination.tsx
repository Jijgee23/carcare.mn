import Link from "next/link";

/**
 * Жагсаалтын хуудаслалт — server component. Одоогийн идэвхтэй шүүлтүүрүүдийг
 * (`params`) хадгалж, `pageParam` (default `page`)-ийг л солино.
 *
 * `totalPages <= 1` үед юу ч render хийхгүй.
 */
export function Pagination({
  page,
  totalPages,
  total,
  params = {},
  pageParam = "page",
  className,
}: {
  page: number;
  totalPages: number;
  total?: number;
  params?: Record<string, string | number | null | undefined>;
  pageParam?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const makeHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === pageParam) continue;
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    }
    if (p > 1) sp.set(pageParam, String(p));
    const qs = sp.toString();
    return qs ? `?${qs}` : "?";
  };

  // Идэвхтэй хуудасны эргэн тойронд цонх — эхэн/төгсгөлийг үргэлж харуулна.
  const windowSize = 1;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (
      p === 1 ||
      p === totalPages ||
      (p >= page - windowSize && p <= page + windowSize)
    ) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div
      className={`px-5 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3 text-xs ${className ?? ""}`}
    >
      <span className="text-white/40 whitespace-nowrap">
        {typeof total === "number" ? (
          <>
            Нийт {total.toLocaleString("mn-MN")} · {page}/{totalPages} хуудас
          </>
        ) : (
          <>
            {page} / {totalPages} хуудас
          </>
        )}
      </span>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={makeHref(page - 1)}
            scroll={false}
            className="text-white/60 hover:text-white px-2.5 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
          >
            ← Өмнөх
          </Link>
        ) : (
          <span className="text-white/20 px-2.5 py-1">← Өмнөх</span>
        )}

        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="text-white/20 px-1.5">
                …
              </span>
            ) : p === page ? (
              <span
                key={p}
                className="min-w-[1.75rem] text-center px-2 py-1 rounded-md bg-violet-600/30 text-violet-200 border border-violet-500/30"
              >
                {p}
              </span>
            ) : (
              <Link
                key={p}
                href={makeHref(p)}
                scroll={false}
                className="min-w-[1.75rem] text-center px-2 py-1 rounded-md text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                {p}
              </Link>
            ),
          )}
        </div>

        {page < totalPages ? (
          <Link
            href={makeHref(page + 1)}
            scroll={false}
            className="text-white/60 hover:text-white px-2.5 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
          >
            Дараах →
          </Link>
        ) : (
          <span className="text-white/20 px-2.5 py-1">Дараах →</span>
        )}
      </div>
    </div>
  );
}
