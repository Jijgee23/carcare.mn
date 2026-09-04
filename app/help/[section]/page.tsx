import Link from "next/link";
import { notFound } from "next/navigation";
import { findAccountManualSection } from "@/lib/manual/content/account";

export default async function HelpSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = findAccountManualSection(slug);
  if (!section) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--oc-ink)] mb-2">{section.title}</h1>
      <p className="text-sm text-[var(--oc-muted)] mb-6">{section.description}</p>
      {section.articles.length === 0 ? (
        <p className="text-sm text-[var(--oc-muted3)]">Тун удахгүй нэмэгдэнэ.</p>
      ) : (
        <ul className="space-y-1">
          {section.articles.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/help/${section.slug}/${a.slug}`}
                className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
              >
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
