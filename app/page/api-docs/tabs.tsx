"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { TabButton } from "@/app/_components/landing-ops-ui";
import { AccountDocs } from "./account-docs";
import { TenantDocs } from "./tenant-docs";

type Tab = "account" | "tenant";

export function ApiDocsTabs() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "tenant" ? "tenant" : "account",
  );

  return (
    <>
      <div className="flex items-center gap-2 mt-2">
        <TabButton active={tab === "account"} onClick={() => setTab("account")}>
          Хэрэглэгч
        </TabButton>
        <TabButton active={tab === "tenant"} onClick={() => setTab("tenant")}>
          Байгууллага
        </TabButton>
      </div>

      {tab === "account" ? (
        <>
          <p className="text-[var(--oc-muted)] text-sm mt-4 max-w-2xl leading-relaxed">
            Энэ хуудас нь эцсийн хэрэглэгчийн (машины эзэмшигч/жолооч) мобайл
            аппаас дуудах <strong className="text-[var(--oc-ink2)]">Account</strong>{" "}
            realm-ийн API-г баримтжуулна. Ажилтны (байгууллагын дотоод) мобайл
            API нь өөр auth механизм (email+нууц үг,{" "}
            <code className="font-plex-mono text-[var(--oc-muted2)]">User</code>{" "}
            загвар) ашигладаг тусдаа realm — &quot;Байгууллага&quot; таб-аас үзнэ үү.
          </p>
        </>
      ) : (
        <p className="text-[var(--oc-muted)] text-sm mt-4 max-w-2xl leading-relaxed">
          Энэ хуудас нь байгууллагын ажилтны (менежер/мастер) мобайл аппаас
          дуудах <strong className="text-[var(--oc-ink2)]">User</strong>{" "}
          realm-ийн API-г баримтжуулна — имэйл + нууц үгээр нэвтэрч, тухайн
          ажилтны харьяалагдах байгууллага (tenant), салбарын хүрээнд ажилладаг.
          Эцсийн хэрэглэгчийн (утас+OTP) Account realm-ийг &quot;Хэрэглэгч&quot;
          таб-аас үзнэ үү.
        </p>
      )}

      <div className="mt-6 rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5">
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] mb-1">
              Base URL
            </div>
            <div className="text-[var(--oc-ink2)]">
              Прод: <code className="font-plex-mono">https://carservice.mn</code>
              <br />
              Dev: <code className="font-plex-mono">http://&lt;LAN-IP&gt;:4000</code>
            </div>
          </div>
          <div>
            <div className="font-plex-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] mb-1">
              Content-Type
            </div>
            <div className="text-[var(--oc-ink2)]">
              Бүх POST/PATCH/DELETE хүсэлт: <code className="font-plex-mono">application/json</code>{" "}
              (эсвэл <code className="font-plex-mono">multipart/form-data</code> — файл хавсаргах endpoint-д)
            </div>
          </div>
        </div>
      </div>

      {tab === "account" ? <AccountDocs /> : <TenantDocs />}
    </>
  );
}
