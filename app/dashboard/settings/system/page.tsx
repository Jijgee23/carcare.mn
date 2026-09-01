import { requireUser } from "@/lib/auth";
import { Chip } from "@/app/_components/landing-ops-ui";
import { isPushConfigured } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";
import { UnitsSection } from "../units-section";

export const metadata = {
  title: "Системийн тохиргоо",
};

export default async function SystemSettingsPage() {
  const user = await requireUser();

  const units = await prisma.unit.findMany({
    where: { tenantId: user.tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isActive: true },
  });

  const pushConfigured = isPushConfigured();

  return (
    <div className="p-4 sm:p-6 max-w-full flex-1 flex flex-col min-h-0 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--oc-ink)]">Системийн тохиргоо</h1>
        <p className="text-sm text-[var(--oc-muted3)] mt-1">
          Үйлчилгээ, бараа бүртгэхэд ашиглах лавлах өгөгдөл.
        </p>
      </div>

      <div className="grid gap-4">
        <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--oc-ink)] mb-0.5">Хэмжих нэгжүүд</h2>
          <p className="text-xs text-[var(--oc-muted3)] mb-4">
            Үйлчилгээ, бараа, сэлбэг бүртгэхэд ашиглах нэгжүүд (ширхэг, цаг,
            литр, кг, м г.м.).
          </p>
          <UnitsSection units={units} />
        </section>

        <section className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--oc-ink)] mb-0.5">Push мэдэгдэл</h2>
          <p className="text-xs text-[var(--oc-muted3)] mb-4">
            Мобайл апп руу push мэдэгдэл илгээх Firebase тохиргооны төлөв.
          </p>
          <Chip tone={pushConfigured ? "ok" : "danger"} bordered>
            {pushConfigured ? "Идэвхтэй" : "Тохируулаагүй"}
          </Chip>
          {!pushConfigured ? (
            <p className="text-xs text-[var(--oc-muted3)] mt-2">
              Серверт{" "}
              <code className="font-plex-mono">FIREBASE_SERVICE_ACCOUNT_BASE64</code>{" "}
              (эсвэл <code className="font-plex-mono">FIREBASE_SERVICE_ACCOUNT</code> /{" "}
              <code className="font-plex-mono">FIREBASE_SERVICE_ACCOUNT_FILE</code>) орчны
              хувьсагч тохируулаагүй тул push мэдэгдэл илгээгдэхгүй байна.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
