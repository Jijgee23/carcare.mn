import {
  findArticleIn,
  findSection,
  flattenArticles,
  sectionArticleCount,
} from "@/lib/manual/query";
import type { ManualArticle, ManualSection } from "@/lib/manual/types";
import { discoverBooking } from "./discover-booking";
import { gettingStarted } from "./getting-started";
import { history } from "./history";
import { myAppointments } from "./my-appointments";
import { myVehicles } from "./my-vehicles";
import { notifications } from "./notifications";

// Эрэмбэ нь хэрэглэгчийн /account nav-той адил (app/_components/consumer-sidebar.tsx).
export const ACCOUNT_MANUAL_SECTIONS: ManualSection[] = [
  gettingStarted,
  discoverBooking,
  myAppointments,
  myVehicles,
  history,
  notifications,
];

export function findAccountManualSection(slug: string): ManualSection | undefined {
  return findSection(ACCOUNT_MANUAL_SECTIONS, slug);
}

export function findAccountManualArticle(
  articleSlug: string,
): { section: ManualSection; article: ManualArticle } | undefined {
  return findArticleIn(ACCOUNT_MANUAL_SECTIONS, articleSlug);
}

export function accountManualArticleCount(section: ManualSection): number {
  return sectionArticleCount(section);
}

export function allAccountManualArticlesFlat(): Array<{
  section: ManualSection;
  article: ManualArticle;
}> {
  return flattenArticles(ACCOUNT_MANUAL_SECTIONS);
}
