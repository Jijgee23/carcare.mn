import Link from "next/link";
import { manualRoleTagLabel } from "@/lib/manual/labels";
import type { ManualArticle, ManualSection } from "@/lib/manual/types";

function RoleTagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-plex-mono text-[11px] px-2.5 py-1 rounded-full bg-[var(--oc-panel2)] text-[var(--oc-muted2)] border border-[var(--oc-line)]">
      {children}
    </span>
  );
}

export function ManualArticleView({
  section,
  article,
  basePath,
  resolveRelated,
  emptyRoleLabel = "Бүх ажилтан",
}: {
  section: ManualSection;
  article: ManualArticle;
  basePath: string;
  resolveRelated: (
    slug: string,
  ) => { section: ManualSection; article: ManualArticle } | undefined;
  emptyRoleLabel?: string;
}) {
  return (
    <article className="max-w-3xl">
      <div className="text-xs text-[var(--oc-muted3)] mb-2">
        <Link
          href={`${basePath}/${section.slug}`}
          className="hover:text-[var(--oc-ink2)] transition-colors"
        >
          {section.title}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-[var(--oc-ink)] mb-3">{article.title}</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {article.roleTags.length === 0 ? (
          <RoleTagPill>{emptyRoleLabel}</RoleTagPill>
        ) : (
          article.roleTags.map((tag) => (
            <RoleTagPill key={tag}>{manualRoleTagLabel(tag)}</RoleTagPill>
          ))
        )}
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--oc-ink2)] mb-2">
          Хэзээ хэрэглэх вэ
        </h2>
        <p className="text-sm text-[var(--oc-muted)] leading-relaxed">
          {article.whenToUse}
        </p>
      </section>

      {article.prerequisites.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--oc-ink2)] mb-2">
            Эхлэхийн өмнө
          </h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-[var(--oc-muted)]">
            {article.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {article.steps.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--oc-ink2)] mb-3">Алхмууд</h2>
          <ol className="space-y-4">
            {article.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--oc-accent)] text-[var(--oc-on-accent)] text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--oc-ink2)]">
                    {step.title}
                  </div>
                  {step.body ? (
                    <p className="text-sm text-[var(--oc-muted)] mt-0.5">{step.body}</p>
                  ) : null}
                  {step.screenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={step.screenshot}
                      alt=""
                      className="mt-2 rounded-lg border border-[var(--oc-line)] max-w-full"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {article.rules.length > 0 ? (
        <section className="mb-6 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-4">
          <h2 className="text-sm font-semibold text-[var(--oc-ink2)] mb-2">
            Дүрэм ба хязгаар
          </h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-[var(--oc-muted)]">
            {article.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {article.faq.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--oc-ink2)] mb-2">
            Алдаа гарвал
          </h2>
          <div className="space-y-2">
            {article.faq.map((item) => (
              <details
                key={item.q}
                className="group rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-[var(--oc-ink2)] list-none flex items-center gap-2">
                  <span className="text-[var(--oc-muted3)] transition-transform group-open:rotate-90">
                    ▶
                  </span>
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-[var(--oc-muted)] pl-5">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {article.related.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-[var(--oc-ink2)] mb-2">Холбоотой</h2>
          <div className="flex flex-wrap gap-2">
            {article.related.map((slug) => {
              const found = resolveRelated(slug);
              if (!found) return null;
              return (
                <Link
                  key={slug}
                  href={`${basePath}/${found.section.slug}/${slug}`}
                  className="text-xs px-2.5 py-1 rounded-full border border-[var(--oc-line)] text-[var(--oc-muted2)] hover:text-[var(--oc-ink2)] hover:border-[var(--oc-line2)] transition-colors"
                >
                  {found.article.title}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
