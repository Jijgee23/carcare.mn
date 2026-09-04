import type { ManualSection } from "@/lib/manual/types";

export const myAppointments: ManualSection = {
  slug: "my-appointments",
  title: "Миний цаг",
  description: "Захиалсан цагуудаа харах, цуцлах.",
  articles: [
    {
      slug: "appointment-list-cancel",
      title: "Захиалсан цагаа харах, цуцлах",
      roleTags: [],
      whenToUse: "Захиалсан цагныхаа төлөв (хүлээгдэж буй/баталгаажсан) болон хураамжийн төлбөрийн байдлыг шалгах, шаардлагатай бол цуцлахад.",
      prerequisites: [],
      steps: [
        { title: "\"Миний цаг\" хуудсанд орно" },
        { title: "Цаг бүрийн төлөв, хураамж төлөгдсөн эсэхийг харна" },
        { title: "Шаардлагатай бол \"Цуцлах\" дарна" },
      ],
      rules: [
        "Зөвхөн \"Хүлээгдэж буй\" эсвэл \"Баталгаажсан\" төлөвтэй цагийг цуцлах боломжтой.",
      ],
      faq: [],
      related: ["appointment-payment"],
    },
  ],
};
