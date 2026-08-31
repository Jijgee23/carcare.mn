import Link from "next/link";
import { Container, Logo } from "./ui";

const columns = [
  {
    title: "Бүтээгдэхүүн",
    links: [
      { href: "#boloms", label: "Боломжууд" },
      { href: "#price", label: "Үнэ" },
      { href: "/login", label: "Жолоочийн апп" },
    ],
  },
  {
    title: "Компани",
    links: [
      { href: "/about", label: "Бидний тухай" },
      { href: "/partners", label: "Хамтрагчид" },
      { href: "/contact", label: "Холбоо барих" },
    ],
  },
  {
    title: "Хууль",
    links: [
      { href: "/terms", label: "Үйлчилгээний нөхцөл" },
      { href: "/privacy", label: "Нууцлалын бодлого" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-[88px] border-t border-line2 bg-panel">
      <Container className="grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3.5 max-w-[300px] text-[13.5px] leading-relaxed text-muted3">
            Жолооч ба засварын газрыг холбосон автосервисийн платформ.
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title} className="flex flex-col gap-2.5 text-[13.5px]">
            <div className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted3">{c.title}</div>
            {c.links.map((l) => (
              <Link key={l.label} href={l.href} className="text-muted hover:text-accentHi">
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </Container>
      <div className="border-t border-line2">
        <Container className="flex items-center justify-between py-[18px] font-mono text-[12px] text-muted4">
          <span>© 2026 carcare.mn</span>
          <span>Улаанбаатар, Монгол</span>
        </Container>
      </div>
    </footer>
  );
}
