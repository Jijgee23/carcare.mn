import Link from "next/link";
import { Container, Logo } from "./ui";

const links = [
  { href: "#boloms", label: "Боломжууд" },
  { href: "#hows", label: "Хэрхэн ажилладаг" },
  { href: "#price", label: "Үнэ" },
  { href: "#faq", label: "Асуулт хариулт" },
];

export default function Nav() {
  return (
    <div className="sticky top-0 z-10 border-b border-line2 bg-carbon/90 backdrop-blur">
      <Container className="flex items-center justify-between py-4">
        <Logo />
        <div className="hidden items-center gap-8 text-[14px] md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted hover:text-accentHi">
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-2 text-[14px] text-ink2 hover:text-accentHi">
            Нэвтрэх
          </Link>
          <Link
            href="#price"
            className="rounded-md bg-accent px-[18px] py-2.5 text-[14px] font-semibold text-carbon hover:bg-accentHi hover:text-carbon"
          >
            Демо хүсэх
          </Link>
        </div>
      </Container>
    </div>
  );
}
