import Link from "next/link";
import {
  ACCOUNT_MANUAL_SECTIONS,
  accountManualArticleCount,
} from "@/lib/manual/content/account";

export const metadata = {
  title: "Гарын авлага",
};

export default function HelpIndexPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--oc-ink)] mb-2">
        Хэрэглэгчийн гарын авлага
      </h1>
      <p className="text-sm text-[var(--oc-muted)] mb-6">
        Carservice-ээр хэрхэн автосервис хайх, цаг захиалах, машинаа удирдах вэ.
      </p>
      <ol className="space-y-2">
        {ACCOUNT_MANUAL_SECTIONS.map((section, i) => (
          <li key={section.slug}>
            <Link
              href={`/help/${section.slug}`}
              className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
            >
              {i + 1}. {section.title}
            </Link>
            <span className="text-[var(--oc-muted3)]"> · {accountManualArticleCount(section)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
