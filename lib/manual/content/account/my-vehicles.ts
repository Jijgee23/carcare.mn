import type { ManualSection } from "@/lib/manual/types";

export const myVehicles: ManualSection = {
  slug: "my-vehicles",
  title: "Миний машинууд",
  description: "Машинаа нэмэх (улсын дугаараар автомат мэдээлэл), бүртгэлээ харах.",
  articles: [
    {
      slug: "vehicle-add-own",
      title: "Машин нэмэх",
      roleTags: [],
      whenToUse: "Шинэ машиныхаа мэдээллийг урьдчилан оруулж, дараа нь цаг захиалахдаа хурдан сонгохын тулд.",
      prerequisites: [],
      steps: [
        { title: "\"Миний машинууд\" хуудаснаас \"Машин нэмэх\" дарна" },
        {
          title: "Улсын дугаараа оруулна",
          body: "Формат зөв бол марк, модель, он зэрэг мэдээлэл автоматаар татагдана — шаардлагатай бол засварлаж болно.",
        },
        { title: "Хадгална" },
      ],
      rules: [],
      faq: [],
      related: ["vehicle-list-explain"],
    },
    {
      slug: "vehicle-list-explain",
      title: "\"Өөрөө нэмсэн\" ба \"Баталгаажсан\" машины ялгаа",
      roleTags: [],
      whenToUse: "Жагсаалтад машин яагаад устгах товчгүй харагдаж байгааг ойлгоход.",
      prerequisites: [],
      steps: [],
      rules: [
        "Та өөрөө нэмсэн машиныг устгах боломжтой.",
        "Аль нэг автосервист очиж бодит үйлчлүүлсэн машин \"баталгаажсан эзэмшил\"-д шилжиж, устгах боломжгүй болно — энэ нь таны түүхийг найдвартай хадгалахын тулд.",
      ],
      faq: [],
      related: ["vehicle-add-own", "service-history"],
    },
  ],
};
