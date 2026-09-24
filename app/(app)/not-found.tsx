import { BtnLink } from "@/app/_components/landing-ops-ui";

export default function ConsumerNotFound() {
  return (
    <div className="max-w-md mx-auto text-center rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] p-10">
      <h1 className="text-lg font-semibold text-[var(--oc-ink)] mb-2">
        Хуудас олдсонгүй
      </h1>
      <p className="text-sm text-[var(--oc-muted3)] mb-6">
        Хайж буй хуудас олдсонгүй эсвэл устгагдсан байж болзошгүй.
      </p>
      <BtnLink href="/discover" variant="primary" size="md">
        Нүүр хуудас руу
      </BtnLink>
    </div>
  );
}
