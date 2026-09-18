import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/app/_components/page-header";
import { ApiDocsTabs } from "@/app/page/api-docs/tabs";

export const metadata = {
  title: "Мобайл API",
};

// Нийтэд нээлттэй /page/api-docs-тай ИЖИЛ агуулга (account-docs / tenant-docs)
// — system admin sidebar-аас шууд харах зориулалттай, тусдаа хуулбар биш.
export default function SystemApiDocsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <PageHeader
        title="Мобайл API"
        description="Хэрэглэгч (Account) болон байгууллагын ажилтан (User) realm-ийн мобайл API баримт."
        actions={
          <Link
            href="/page/api-docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm border border-[var(--oc-line)] hover:border-[var(--oc-line2)] hover:bg-[var(--oc-panel2)] transition-colors px-4 py-2 rounded-lg font-medium text-[var(--oc-ink2)]"
          >
            Нийтийн хуудас ↗
          </Link>
        }
      />
      <Suspense fallback={null}>
        <ApiDocsTabs />
      </Suspense>
    </div>
  );
}
