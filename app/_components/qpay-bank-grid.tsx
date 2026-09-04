export type QPayBankUrlLike = {
  name: string;
  name_mn: string;
  logo: string;
  link: string;
};

/** QPay invoice-ийн банкны апп deeplink-үүд (order/subscription/appointment
    QR панелиуд адилхан ашигладаг). */
export function QPayBankGrid({ urls }: { urls: QPayBankUrlLike[] }) {
  if (urls.length === 0) return null;
  return (
    <div>
      <div className="font-plex-mono text-[10px] uppercase tracking-[0.1em] text-[var(--oc-muted3)] mb-2.5">
        Банкны апп сонгох
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {urls.map((bank) => (
          <a
            key={bank.link}
            href={bank.link}
            title={bank.name_mn || bank.name}
            className="flex flex-col items-center gap-1.5 rounded-[8px] border border-[var(--oc-line2)] px-2 py-2.5 hover:border-[var(--oc-accent)]/50 hover:bg-[var(--oc-accent)]/[0.04] transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bank.logo}
              alt={bank.name_mn || bank.name}
              className="w-7 h-7 object-contain rounded shrink-0"
            />
            <span className="text-[10px] text-[var(--oc-muted3)] text-center leading-tight line-clamp-2">
              {bank.name_mn || bank.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
