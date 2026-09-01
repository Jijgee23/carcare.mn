import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Brand } from "@/app/_components/brand";
import { Footer } from "@/app/_components/footer";
import { CONTACT } from "@/lib/contact";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "Үйлчилгээний нөхцөл",
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
      <h2 className="text-lg font-semibold text-[var(--oc-ink)] mb-2">{title}</h2>
      <div className="text-sm text-[var(--oc-muted)] leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} landing-ops min-h-screen flex flex-col`}
    >
      <header className="border-b border-[var(--oc-line2)]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Brand />
          </Link>
          <Link
            href="/page/landing"
            className="text-sm text-[var(--oc-muted2)] hover:text-[var(--oc-accent-hi)] transition-colors"
          >
            ← Нүүр
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Үйлчилгээний нөхцөл</h1>
        <p className="text-[var(--oc-muted3)] text-sm mt-2">Сүүлд шинэчилсэн: 2021 он</p>

        <Section title="1. Ерөнхий заалт">
          <p>
            Энэхүү нөхцөл нь {CONTACT.org} ({CONTACT.website})-ийн ажиллуулдаг
            carcare.mn платформ (цаашид «Үйлчилгээ»)-ийг ашиглахад үүсэх эрх,
            үүргийг зохицуулна. Үйлчилгээг ашигласнаар та энэхүү нөхцөлийг
            бүрэн хүлээн зөвшөөрсөнд тооцно. Хүлээн зөвшөөрөхгүй бол Үйлчилгээг
            ашиглахгүй байхыг хүсье.
          </p>
        </Section>

        <Section title="2. Үйлчилгээний тодорхойлолт">
          <p>
            Үйлчилгээ нь авто засвар, үйлчилгээний байгууллагуудад зориулсан
            захиалга, үйлчлүүлэгч, машин, нөөц, тайлан удирдах болон онлайн цаг
            захиалгын платформ юм. Боломжууд багцаас хамаарч өөр байж болно.
          </p>
        </Section>

        <Section title="3. Бүртгэл ба хаягийн аюулгүй байдал">
          <ul className="list-disc pl-5 space-y-1">
            <li>Та үнэн зөв мэдээллээр бүртгүүлэх үүрэгтэй.</li>
            <li>
              Нэвтрэх мэдээлэл (нууц үг, утас/OTP)-ийн нууцлалыг хариуцна.
            </li>
            <li>
              Таны хаягаар хийгдсэн үйлдлийн хариуцлагыг та хүлээнэ. Зөвшөөрөлгүй
              хандалт мэдэгдсэн даруйд бидэнд мэдэгдэнэ.
            </li>
          </ul>
        </Section>

        <Section title="4. Багц ба төлбөр">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Зарим багц төлбөртэй. Үнэ, боломжийг платформ дээр зарласан байдлаар
              мөрдөнө.
            </li>
            <li>
              Туршилтын хугацаа (trial) дууссаны дараа үргэлжлүүлэхэд төлбөр
              төлнө.
            </li>
            <li>
              Төлбөрийг сонгосон багц, хугацааны дагуу урьдчилан төлнө. Үйлчилгээ
              үзүүлж эхэлсэн хугацааны төлбөрийг буцаан олгохгүй болно.
            </li>
          </ul>
        </Section>

        <Section title="5. Хэрэглэгчийн үүрэг ба хориглох зүйл">
          <ul className="list-disc pl-5 space-y-1">
            <li>Хууль бус, бусдын эрхийг зөрчсөн үйлдэлд ашиглахгүй.</li>
            <li>
              Системд халдах, ачаалал өгөх, аюулгүй байдлыг тойрох оролдлого
              хийхгүй.
            </li>
            <li>Бусдын мэдээллийг зөвшөөрөлгүйгээр цуглуулах, ашиглахгүй.</li>
          </ul>
        </Section>

        <Section title="6. Контент ба өгөгдөл">
          <p>
            Танай байгууллагын оруулсан өгөгдөл танай өмч хэвээр үлдэнэ. Бид зөвхөн
            Үйлчилгээ үзүүлэх, сайжруулах зорилгоор тус өгөгдлийг боловсруулна
            (дэлгэрэнгүйг{" "}
            <Link href="/privacy" className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors">
              Нууцлалын бодлого
            </Link>
            -оос үзнэ үү).
          </p>
        </Section>

        <Section title="7. Үйлчилгээний боломжит байдал">
          <p>
            Бид Үйлчилгээг тогтвортой ажиллуулахыг эрмэлзэх боловч тасралтгүй
            ажиллана гэж баталгаажуулахгүй. Засвар үйлчилгээ, техникийн шинэчлэлт,
            гэнэтийн саатал гарч болно.
          </p>
        </Section>

        <Section title="8. Хариуцлагын хязгаар">
          <p>
            Хууль зөвшөөрсөн хэмжээнд, Үйлчилгээг ашигласнаас үүдэн гарсан шууд
            бус, дагалдах, ашиг алдагдсан хохиролд {CONTACT.org} хариуцлага
            хүлээхгүй. Үйлчилгээ «байгаа байдлаар» (as-is) үзүүлэгдэнэ.
          </p>
        </Section>

        <Section title="9. Үйлчилгээ цуцлах / зогсоох">
          <p>
            Та хүссэн үедээ бүртгэлээ цуцлаж болно. Нөхцөл зөрчсөн, төлбөр
            төлөгдөөгүй тохиолдолд бид хандалтыг түр зогсоох эсвэл цуцлах эрхтэй.
          </p>
        </Section>

        <Section title="10. Нөхцөл өөрчлөх">
          <p>
            Энэхүү нөхцөлийг үе үе шинэчилж болно. Чухал өөрчлөлтийг платформоор
            дамжуулан мэдэгдэх ба үргэлжлүүлэн ашигласнаар шинэ нөхцөлийг хүлээн
            зөвшөөрсөнд тооцно.
          </p>
        </Section>

        <Section title="11. Холбоо барих">
          <ul className="space-y-1">
            <li>
              Имэйл:{" "}
              <a
                href={`mailto:${CONTACT.email}`}
                className="text-[var(--oc-accent)] hover:text-[var(--oc-accent-hi)] transition-colors"
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
