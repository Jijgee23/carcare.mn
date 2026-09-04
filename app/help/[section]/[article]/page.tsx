import { notFound } from "next/navigation";
import { ManualArticleView } from "@/app/manual/_components/manual-article";
import {
  findAccountManualArticle,
  findAccountManualSection,
} from "@/lib/manual/content/account";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ section: string; article: string }>;
}) {
  const { section: sectionSlug, article: articleSlug } = await params;
  const section = findAccountManualSection(sectionSlug);
  const article = section?.articles.find((a) => a.slug === articleSlug);
  if (!section || !article) notFound();

  return (
    <ManualArticleView
      section={section}
      article={article}
      basePath="/help"
      resolveRelated={findAccountManualArticle}
      emptyRoleLabel="Бүх хэрэглэгч"
    />
  );
}
