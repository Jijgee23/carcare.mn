import { Container, Eyebrow } from "./ui";

const faq = [
  {
    q: "Хэрэглэгчийн өгөгдөл хэрхэн тусгаарлагддаг вэ?",
    a: "Байгууллага тус бүр өөрийн tenant-д ажиллана. Салбар, хэрэглэгчийн эрхийг зөвхөн тухайн байгууллагын админ тохируулна.",
  },
  {
    q: "Одоо байгаа Excel бүртгэлээ шилжүүлж болох уу?",
    a: "Болно. Машин, харилцагч, сэлбэгийн жагсаалтыг загварын файлаар импортлож, нэвтрүүлэлтийн үед бид шалгаж өгнө.",
  },
  {
    q: "Жолооч заавал бүртгүүлэх шаардлагатай уу?",
    a: "Үгүй. Утасны дугаараа оруулж, ирсэн кодоор нэвтрэхэд хаяг автоматаар үүснэ. Нууц үг шаардахгүй.",
  },
  {
    q: "Интернет тасарвал ажиллах уу?",
    a: "Захиалгын үндсэн үйлдлүүд офлайн хадгалагдаж, холболт сэргэмэгц автоматаар синк болно.",
  },
];

export default function Faq() {
  return (
    <Container className="pt-24">
      <div id="faq" className="scroll-mt-24 grid gap-14 lg:grid-cols-[340px_1fr]">
        <div>
          <Eyebrow>Асуулт хариулт</Eyebrow>
          <h2 className="mt-4 text-[34px] font-semibold tracking-[-0.03em] text-ink">Түгээмэл асуултууд</h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted2">
            Хариултаа олсонгүй бол <a href="mailto:contact@infosystems.mn">тусламжийн ажилтантай</a>{" "}
            холбогдоорой.
          </p>
        </div>
        <div className="flex flex-col">
          {faq.map((f, i) => (
            <div
              key={f.q}
              className={`border-t border-line py-[22px] ${i === faq.length - 1 ? "border-b" : ""}`}
            >
              <div className="text-[16.5px] font-semibold text-ink2">{f.q}</div>
              <div className="mt-2.5 max-w-[700px] text-[14.5px] leading-relaxed text-muted2">{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
