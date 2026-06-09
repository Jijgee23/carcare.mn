import Link from "next/link";
import { Brand } from "@/app/_components/brand";
import { Footer } from "@/app/_components/footer";
import { CONTACT } from "@/lib/contact";

export const metadata = {
  title: "Холбоо барих",
};

export const revalidate = 3600;

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Brand />
          </Link>
          <Link
            href="/page/landing"
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            ← Нүүр
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Холбоо барих</h1>
        <p className="text-white/40 text-sm mt-2">
          {CONTACT.org}-тэй холбогдох мэдээлэл.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card title="Байгууллага">
            <div className="text-white/85 font-medium">{CONTACT.org}</div>
            <a
              href={`https://${CONTACT.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 hover:text-violet-200 text-sm"
            >
              {CONTACT.website}
            </a>
          </Card>

          <Card title="Имэйл">
            <a
              href={`mailto:${CONTACT.email}`}
              className="text-white/85 hover:text-violet-200"
            >
              {CONTACT.email}
            </a>
          </Card>

          <Card title="Утас">
            <div className="flex flex-col gap-1 tabular-nums">
              {CONTACT.phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p}`}
                  className="text-white/85 hover:text-violet-200"
                >
                  {p}
                </a>
              ))}
            </div>
          </Card>

          <Card title="Хаяг">
            <div className="text-white/85">{CONTACT.address}</div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/[0.08]">
      <div className="text-xs uppercase tracking-wider text-white/30 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
