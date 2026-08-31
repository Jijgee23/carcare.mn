/* Брэнд лого — theme-ээс хамаарч солигдоно: dark үед цайвар ягаан тэмдэг
   (/brand/mark-dark.png), light үед бараан ягаан (/brand/mark-light.png).
   Эх зургууд: app/carcare-1f-{dark,light}.png → scripts/make-brand-assets.mjs. */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mark-dark.png"
        alt="Carcare"
        className={`${cls} object-contain dark-only`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/mark-light.png"
        alt=""
        aria-hidden
        className={`${cls} object-contain light-only`}
      />
    </>
  );
}

export function BrandWordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className={size === "sm" ? "font-bold" : "font-bold text-lg tracking-tight"}>
      car<span className="text-violet-400 brand-care-accent">care</span>
    </span>
  );
}

export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2">
      <BrandMark size={size} />
      <BrandWordmark size={size} />
    </div>
  );
}
