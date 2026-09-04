import { notFound } from "next/navigation";
import { ManualArticleView } from "@/app/manual/_components/manual-article";
import { findManualArticle, findManualSection } from "@/lib/manual/content/tenant";

export default async function ManualArticlePage({
  params,
}: {
  params: Promise<{ section: string; article: string }>;
}) {
  const { section: sectionSlug, article: articleSlug } = await params;
  const section = findManualSection(sectionSlug);
  const article = section?.articles.find((a) => a.slug === articleSlug);
  if (!section || !article) notFound();

  return (
    <ManualArticleView
      section={section}
      article={article}
      basePath="/manual"
      resolveRelated={findManualArticle}
    />
  );
}
