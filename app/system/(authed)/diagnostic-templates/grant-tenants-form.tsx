"use client";

import { useState } from "react";
import { setTemplateGrantsAction } from "@/app/_actions/system-diagnostic-templates";
import { Btn } from "@/app/_components/landing-ops-ui";

export type TenantOption = { id: string; name: string };

/**
 * Загварыг ямар байгууллагад ашиглуулахыг нэг дор тохируулна — checkbox
 * жагсаалт, нэг товч. Хайлтын input-оор урт жагсаалтыг шүүнэ (submit-д
 * нөлөөгүй, зөвхөн харагдацыг шүүнэ).
 */
export function GrantTenantsForm({
  templateId,
  tenants,
  grantedTenantIds,
}: {
  templateId: string;
  tenants: TenantOption[];
  grantedTenantIds: string[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // Хайлтаар тохирохгүй мөрийг DOM-оос устгахгүй, зөвхөн CSS-ээр нуудаг —
  // эс бөгөөс аль хэдийн чагтлаcан checkbox unmount хийгдэж, submit хийхэд
  // алдагдана (диагностик бөглөх хайлттай адил зарчим).
  const matchCount = tenants.filter((t) =>
    !q || t.name.toLowerCase().includes(q),
  ).length;

  const action = setTemplateGrantsAction.bind(null, templateId);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="Байгууллагаар хайх..."
        className="auth-input"
      />

      {tenants.length === 0 ? (
        <div className="text-sm text-[var(--oc-muted3)] py-4 text-center">
          Бүртгэлтэй байгууллага алга байна.
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-[10px] border border-[var(--oc-line)] divide-y divide-[var(--oc-line)]">
          {tenants.map((t) => {
            const matches = !q || t.name.toLowerCase().includes(q);
            return (
              <label
                key={t.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--oc-ink2)] hover:bg-white/[0.03] cursor-pointer ${matches ? "" : "hidden"}`}
              >
                <input
                  type="checkbox"
                  name="tenantIds"
                  value={t.id}
                  defaultChecked={grantedTenantIds.includes(t.id)}
                  className="accent-[var(--oc-accent)]"
                />
                {t.name}
              </label>
            );
          })}
          {matchCount === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--oc-muted3)]">
              Илэрц олдсонгүй.
            </div>
          ) : null}
        </div>
      )}

      <Btn type="submit" className="self-start">
        Хадгалах
      </Btn>
    </form>
  );
}
