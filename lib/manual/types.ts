import type { ResourceKey } from "@/lib/auth/permissions";

// Гарын авлагын "role tag" — тухайн resource-ийн эрхтэй ажилтанд хамаарна,
// эсвэл зөвхөн эзэмшигчид (owner) зориулагдсан бол "owner". Шинэ resource
// нэмэгдэхэд `lib/auth/permissions.ts`-ийн `RESOURCES`-аас автоматаар дагана.
export type ManualRoleTag = ResourceKey | "owner";

export type ManualStep = {
  title: string;
  body?: string;
  // public/manual/<section>/<file>.png — өгөгдөөгүй бол зураггүйгээр render хийнэ.
  screenshot?: string;
};

export type ManualFaqItem = {
  q: string;
  a: string;
};

export type ManualArticle = {
  // Бүх section дундаа өвөрмөц байх ёстой (холбоос/хайлтад ашиглагдана).
  slug: string;
  title: string;
  roleTags: ManualRoleTag[];
  whenToUse: string;
  prerequisites: string[];
  steps: ManualStep[];
  rules: string[];
  faq: ManualFaqItem[];
  // Бусад article-ийн slug (энэ файлын `related`).
  related: string[];
};

export type ManualSection = {
  slug: string;
  title: string;
  description: string;
  articles: ManualArticle[];
};
