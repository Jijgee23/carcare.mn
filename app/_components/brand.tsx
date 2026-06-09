export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.png"
      alt="carcare"
      className={`${cls} rounded-lg object-contain`}
    />
  );
}

export function BrandWordmark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className={size === "sm" ? "font-bold" : "font-bold text-lg tracking-tight"}>
      car<span className="text-violet-400">care</span>
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
