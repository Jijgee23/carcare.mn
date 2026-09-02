import Link from "next/link";
import { Brand } from "@/app/_components/brand";
import { Footer } from "@/app/_components/footer";
import { CONTACT } from "@/lib/contact";

export const metadata = {
  title: "Гарын авлага",
};

export const revalidate = 3600;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-semibold text-white/90 mb-2">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
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
        <h1 className="text-3xl font-bold">Гарын авлага</h1>
        <p className="text-white/40 text-sm mt-2">
          carservice.mn платформыг хэрхэн ашиглах талаарх заавар
        </p>

        <Section title="Платформын тухай">
          <p>
            carservice.mn нь авто засвар, үйлчилгээний байгууллага болон
            тэдгээрийн үйлчлүүлэгчдийг холбосон онлайн цаг захиалгын платформ
            юм. Доор харилцагч болон засварын газрын талд зориулсан үндсэн
            боломжуудыг товч танилцуулав.
          </p>
        </Section>

        <Section title="Тээврийн хэрэгслийн эзэд, харилцагчдад зориулсан">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-white/80">Нэвтрэх:</span> утасны
              дугаараа оруулж, ирсэн SMS кодоор баталгаажуулж нэвтэрнэ (нууц
              үг шаардлагагүй).
            </li>
            <li>
              <span className="text-white/80">Автосервис хайх:</span>{" "}
              байршил, ажиллах цагаар нь автосервисүүдийг харьцуулж сонгоно.
            </li>
            <li>
              <span className="text-white/80">Цаг захиалах:</span> сонгосон
              автосервисээс онлайнаар цаг товлоно.
            </li>
            <li>
              <span className="text-white/80">Миний цаг:</span> захиалсан
              цагаа хянах, түүний төлөвийг шалгах.
            </li>
            <li>
              <span className="text-white/80">Миний машинууд:</span>{" "}
              машинаа бүртгэж, дараагийн захиалгад хурдан ашиглах.
            </li>
            <li>
              <span className="text-white/80">Үйлчилгээний түүх:</span>{" "}
              өмнөх засвар, сольсон сэлбэгийн түүхээ харах.
            </li>
            <li>
              <span className="text-white/80">Мэдэгдэл:</span> захиалгын
              статус, сануулгыг мэдэгдлээр хүлээн авах.
            </li>
          </ul>
        </Section>

        <Section title="Засварын газар, ажилтнуудад зориулсан">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-white/80">Бүртгүүлэх:</span> 14 хоног
              үнэгүй туршилтаар эхлэх боломжтой, карт шаардлагагүй.
            </li>
            <li>
              <span className="text-white/80">Багаа урих:</span> менежер,
              мастер, кассч зэрэг ажилтнуудыг үүрэгтэйгээр урьж, хандалтыг
              хязгаарлах.
            </li>
            <li>
              <span className="text-white/80">Захиалга удирдах:</span> бүх
              захиалга, дараа төлбөрт захиалгыг нэг дороос харах, удирдах.
            </li>
            <li>
              <span className="text-white/80">Цаг захиалга удирдах:</span>{" "}
              онлайнаар ирсэн захиалгуудыг баталгаажуулах, хуваарилах.
            </li>
            <li>
              <span className="text-white/80">
                Үйлчлүүлэгч ба машин бүртгэл:
              </span>{" "}
              үйлчлүүлэгчид, тэдний машин, түүхийг нэг дороос хөтлөх.
            </li>
            <li>
              <span className="text-white/80">Үйлчилгээ тохируулах:</span>{" "}
              ажил, оношилгоо, сэлбэг/бараа, ангиллаар үнэ, боломжит
              үйлчилгээгээ тохируулах.
            </li>
            <li>
              <span className="text-white/80">Нөөц ба сэлбэг:</span> барааны
              үлдэгдэлд хяналт тавих.
            </li>
            <li>
              <span className="text-white/80">Тайлан:</span> орлого,
              ачаалал, гүйцэтгэлийн бодит цагийн тайлан харах.
            </li>
            <li>
              <span className="text-white/80">Тохиргоо:</span> байгууллагын
              мэдээлэл, салбарууд, QPay холболт, багц (subscription) удирдах.
            </li>
          </ul>
        </Section>

        <Section title="Асуулт байвал">
          <p>
            Түгээмэл асуултын хариултыг{" "}
            <Link
              href="/page/landing#faq"
              className="text-violet-300 hover:text-violet-200 light:text-violet-700 light:hover:text-violet-800"
            >
              нүүр хуудасны Асуулт хариулт
            </Link>{" "}
            хэсгээс үзнэ үү. Нэмэлт тусламж хэрэгтэй бол бидэнтэй{" "}
            <a
              href={`mailto:${CONTACT.email}`}
              className="text-violet-300 hover:text-violet-200 light:text-violet-700 light:hover:text-violet-800"
            >
              {CONTACT.email}
            </a>{" "}
            хаягаар эсвэл{" "}
            <Link
              href="/contact"
              className="text-violet-300 hover:text-violet-200 light:text-violet-700 light:hover:text-violet-800"
            >
              Холбоо барих
            </Link>{" "}
            хуудаснаас холбогдоорой.
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
