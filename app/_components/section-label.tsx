export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center mb-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-violet-400 glass px-4 py-1.5 rounded-full">
        {children}
      </span>
    </div>
  );
}
