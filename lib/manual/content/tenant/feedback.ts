import type { ManualSection } from "@/lib/manual/types";

export const feedback: ManualSection = {
  slug: "feedback",
  title: "Санал хүсэлт",
  description: "Платформ руу санал хүсэлт/алдааны мэдээлэл илгээх, хариу харах.",
  articles: [
    {
      slug: "feedback-submit",
      title: "Санал хүсэлт илгээх",
      roleTags: [],
      whenToUse: "Системд алдаа тааралдсан, санал/хүсэлт байгаа үед платформ руу шууд мэдээлэхэд.",
      prerequisites: [],
      steps: [
        {
          title: "Аль ч хуудсанд байдаг \"Санал хүсэлт\" товчийг дарна",
          body: "Sidebar эсвэл mobile topbar дээр байрладаг — тусдаа хуудас руу орох шаардлагагүй.",
        },
        { title: "Төрлөө сонгож (алдаа, санал, бусад), тайлбараа бичнэ" },
        { title: "Шаардлагатай бол дэлгэцийн зураг хавсаргана" },
        { title: "Илгээнэ" },
      ],
      rules: [],
      faq: [],
      related: ["feedback-status"],
    },
    {
      slug: "feedback-status",
      title: "Илгээсэн хүсэлтийн хариуг харах",
      roleTags: [],
      whenToUse: "Илгээсэн санал хүсэлт ямар шатанд байгааг (шинэ/хянагдаж буй/шийдэгдсэн/хаагдсан) шалгах, платформын хариуг унших.",
      prerequisites: [],
      steps: [
        { title: "/dashboard/feedback хуудаснаас нэр/төрлөөр хайж, мөр дээр дарна" },
        { title: "Харилцан ярианы түүхэн дунд платформын хариуг харна" },
        { title: "Шаардлагатай бол дахин мессеж бичиж үргэлжлүүлнэ" },
      ],
      rules: [],
      faq: [],
      related: ["feedback-submit"],
    },
  ],
};
