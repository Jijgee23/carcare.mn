import Link from "next/link";
import { manualArticleCount, TENANT_MANUAL_SECTIONS } from "@/lib/manual/content/tenant";

export const metadata = {
  title: "Гарын авлага",
};

export default function ManualIndexPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--oc-ink)] mb-2">
        Ажилтны гарын авлага
      </h1>
      <p className="text-sm text-[var(--oc-muted)] mb-6">
        Carservice дээр ажилтан хийдэг бүх зүйл: нэвтрэх, захиалга, цаг захиалга,
        тайлан, тохиргоо.
      </p>
      <ol className="space-y-2">
        {TENANT_MANUAL_SECTIONS.map((section, i) => (
          <li key={section.slug}>
            <Link
              href={`/manual/${section.slug}`}
              className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
            >
              {i + 1}. {section.title}
            </Link>
            <span className="text-[var(--oc-muted3)]"> · {manualArticleCount(section)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
