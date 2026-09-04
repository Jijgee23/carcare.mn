import type { ManualArticle, ManualSection } from "./types";

// Аль ч агуулгын багц (tenant, account, ...) дээр ажилладаг ерөнхий helper-үүд.

export function findSection(
  sections: ManualSection[],
  slug: string,
): ManualSection | undefined {
  return sections.find((s) => s.slug === slug);
}

// Article slug-ууд нэг багцын дотор өвөрмөц гэж үзнэ — эхний тохирлыг буцаана.
export function findArticleIn(
  sections: ManualSection[],
  articleSlug: string,
): { section: ManualSection; article: ManualArticle } | undefined {
  for (const section of sections) {
    const article = section.articles.find((a) => a.slug === articleSlug);
    if (article) return { section, article };
  }
  return undefined;
}

export function sectionArticleCount(section: ManualSection): number {
  return section.articles.length;
}

export function flattenArticles(
  sections: ManualSection[],
): Array<{ section: ManualSection; article: ManualArticle }> {
  return sections.flatMap((section) =>
    section.articles.map((article) => ({ section, article })),
  );
}
