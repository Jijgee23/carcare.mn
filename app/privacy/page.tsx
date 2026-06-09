import Link from "next/link";
import { Brand } from "@/app/_components/brand";
import { Footer } from "@/app/_components/footer";
import { CONTACT } from "@/lib/contact";

export const metadata = {
  title: "Нууцлалын бодлого",
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

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold">Нууцлалын бодлого</h1>
        <p className="text-white/40 text-sm mt-2">
          Сүүлд шинэчилсэн: 2021 он
        </p>

        <Section title="1. Ерөнхий">
          <p>
            {CONTACT.org} ({CONTACT.website}) нь carcare.mn платформыг
            ажиллуулдаг. Энэхүү бодлого нь таны хувийн мэдээллийг хэрхэн
            цуглуулж, ашиглаж, хамгаалдаг талаар тайлбарлана. Үйлчилгээг
            ашигласнаар та энэхүү бодлогыг хүлээн зөвшөөрсөнд тооцно.
          </p>
        </Section>

        <Section title="2. Цуглуулдаг мэдээлэл">
          <ul className="list-disc pl-5 space-y-1">
            <li>Бүртгэлийн мэдээлэл: нэр, утас, имэйл, байгууллагын мэдээлэл.</li>
            <li>Үйлчилгээний мэдээлэл: машин, захиалга, үйлчилгээний түүх.</li>
            <li>
              Төхөөрөмжийн мэдээлэл: push notification token, төхөөрөмжийн төрөл,
              OS, нэвтрэлтийн лог (IP, цаг).
            </li>
          </ul>
        </Section>

        <Section title="3. Мэдээллийг ашиглах зорилго">
          <ul className="list-disc pl-5 space-y-1">
            <li>Үйлчилгээ үзүүлэх, цаг захиалга боловсруулах.</li>
            <li>Мэдэгдэл илгээх (SMS, push) — баталгаажуулалт, сануулга.</li>
            <li>Аюулгүй байдал, залилангаас сэргийлэх, үйлчилгээг сайжруулах.</li>
          </ul>
        </Section>

        <Section title="4. Мэдээлэл хуваалцах">
          <p>
            Бид таны мэдээллийг гуравдагч этгээдэд зардаггүй. Зөвхөн үйлчилгээ
            үзүүлэхэд шаардлагатай хүрээнд (SMS оператор, тээврийн хэрэгслийн
            бүртгэлийн систем, төлбөрийн үйлчилгээ) болон хууль ёсны шаардлагаар
            холбогдох байгууллагад дамжуулж болно.
          </p>
        </Section>

        <Section title="5. Хадгалалт ба аюулгүй байдал">
          <p>
            Мэдээллийг шифрлэлт болон хандалтын хяналттай орчинд хадгална. Нууц үг
            нь hash хэлбэрээр, нэвтрэлтийн session-ийг хамгаалалттай байдлаар
            хадгалагдана.
          </p>
        </Section>

        <Section title="6. Таны эрх">
          <p>
            Та өөрийн мэдээллийг үзэх, засах, устгуулах, мэдэгдэл хүлээн авахаас
            татгалзах эрхтэй. Үүний тулд доорх хаягаар бидэнтэй холбогдоно уу.
          </p>
        </Section>

        <Section title="7. Cookie ба session">
          <p>
            Нэвтрэлтийг хадгалахад зориулсан зайлшгүй cookie ашиглана. Эдгээр нь
            үйлчилгээ ажиллахад шаардлагатай.
          </p>
        </Section>

        <Section title="8. Өөрчлөлт">
          <p>
            Энэхүү бодлого үе үе шинэчлэгдэж болно. Чухал өөрчлөлтийг платформоор
            дамжуулан мэдэгдэнэ.
          </p>
        </Section>

        <Section title="9. Холбоо барих">
          <p>Асуулт, хүсэлтээ дараах хаягаар илгээнэ үү:</p>
          <ul className="space-y-1">
            <li>
              Имэйл:{" "}
              <a
                href={`mailto:${CONTACT.email}`}
                className="text-violet-300 hover:text-violet-200"
              >
                {CONTACT.email}
              </a>
            </li>
            <li>Утас: {CONTACT.phones.join(", ")}</li>
            <li>Хаяг: {CONTACT.address}</li>
          </ul>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
