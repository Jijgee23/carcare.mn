import type { ManualSection } from "@/lib/manual/types";

export const notifications: ManualSection = {
  slug: "notifications",
  title: "Мэдэгдэл",
  description: "Мэдэгдэлийн түүх, push мэдэгдэл асаах/унтраах.",
  articles: [
    {
      slug: "notification-center",
      title: "Мэдэгдэлийн түүхийг харах",
      roleTags: [],
      whenToUse: "Өнгөрсөн мэдэгдлүүдээ (шинэ захиалга, санал хүсэлтийн хариу, багц дуусах г.м) дахин харах, төрлөөр нь шүүхэд.",
      prerequisites: [],
      steps: [
        { title: "/dashboard/notifications хуудсанд орно" },
        { title: "Төрлөөр шүүнэ (жишээ: зөвхөн \"Шинэ цаг захиалга\")" },
        { title: "Мэдэгдэл дээр дарж холбогдох захиалга/цаг захиалга руу шууд орно" },
      ],
      rules: [
        "Мэдэгдэл зөвхөн танд (тухайн ажилтанд) ирснийг харуулна — байгууллагын бусад ажилтны мэдэгдэл харагдахгүй.",
      ],
      faq: [],
      related: ["notification-push-toggle"],
    },
    {
      slug: "notification-push-toggle",
      title: "Push мэдэгдэл асаах",
      roleTags: [],
      whenToUse: "Шинэ захиалга/цаг захиалга ирэх үед browser/утсандаа push мэдэгдэл авахыг хүсвэл.",
      prerequisites: ["Browser эсвэл төхөөрөмж мэдэгдэл зөвшөөрсөн байх"],
      steps: [
        { title: "Самбарын дээд хэсэгт (эсвэл /dashboard/profile) \"Push мэдэгдэл\" хэсгийг асаана" },
        { title: "Browser-ийн зөвшөөрлийн цонхонд \"Зөвшөөрөх\" дарна" },
      ],
      rules: [
        "Push мэдэгдэл тухайн browser/төхөөрөмжид тусад нь холбогддог — өөр төхөөрөмж дээр дахин асаах шаардлагатай.",
      ],
      faq: [],
      related: ["notification-center"],
    },
  ],
};
