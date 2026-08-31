import Link from "next/link";
import { Container } from "./ui";

export default function TopBar() {
  return (
    <div className="border-b border-line2 bg-panel">
      <Container className="flex items-center justify-between py-2 font-mono text-[12.5px] text-muted3">
        <span>Улаанбаатар · 142 сервис төв онлайн</span>
        <span className="flex gap-6">
          <Link href="/business/login" className="text-muted2 hover:text-accentHi">
            Засварын газрын нэвтрэлт →
          </Link>
          <Link href="/login" className="text-muted2 hover:text-accentHi">
            Жолоочийн нэвтрэлт →
          </Link>
        </span>
      </Container>
    </div>
  );
}
