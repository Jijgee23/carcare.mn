export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const cls =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : "w-8 h-8 text-sm";
  return (
    <div
      className={`${cls} rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center font-bold`}
    >
      C
    </div>
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
