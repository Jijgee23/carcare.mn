export default function Loading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-7 w-56 rounded-lg bg-[var(--oc-panel2)] mb-6" />
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] h-64 mb-4" />
      <div className="rounded-[10px] border border-[var(--oc-line)] bg-[var(--oc-panel)] h-40" />
    </div>
  );
}
