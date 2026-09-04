import type { ManualSection } from "@/lib/manual/types";

export const notifications: ManualSection = {
  slug: "notifications",
  title: "Мэдэгдэл",
  description: "Цаг захиалгатай холбоотой мэдэгдлийн түүх, push мэдэгдэл.",
  articles: [
    {
      slug: "account-notification-list",
      title: "Мэдэгдэлийн түүхийг харах",
      roleTags: [],
      whenToUse: "Цаг баталгаажсан/татгалзсан, сануулга зэрэг өмнөх мэдэгдлүүдээ дахин харахад.",
      prerequisites: [],
      steps: [
        { title: "\"Мэдэгдэл\" хуудсанд орно" },
        { title: "Мэдэгдэл дээр дарж холбогдох цаг захиалга руу шууд орно" },
      ],
      rules: [],
      faq: [],
      related: ["account-push-toggle"],
    },
    {
      slug: "account-push-toggle",
      title: "Push мэдэгдэл асаах",
      roleTags: [],
      whenToUse: "Цаг баталгаажих/сануулах үед утсандаа шууд мэдэгдэл авахыг хүсвэл.",
      prerequisites: ["Browser эсвэл утас мэдэгдэл зөвшөөрсөн байх"],
      steps: [
        { title: "\"Мэдэгдэл\" хуудсанд \"Push мэдэгдэл\" асаана" },
        { title: "Зөвшөөрлийн цонхонд \"Зөвшөөрөх\" дарна" },
      ],
      rules: [],
      faq: [],
      related: ["account-notification-list"],
    },
  ],
};
