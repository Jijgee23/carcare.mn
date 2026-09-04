import {
  findArticleIn,
  findSection,
  flattenArticles,
  sectionArticleCount,
} from "@/lib/manual/query";
import type { ManualArticle, ManualSection } from "@/lib/manual/types";
import { appointments } from "./appointments";
import { auditLog } from "./audit-log";
import { branches } from "./branches";
import { customersVehicles } from "./customers-vehicles";
import { dashboardOverview } from "./dashboard-overview";
import { employeesRoles } from "./employees-roles";
import { feedback } from "./feedback";
import { gettingStarted } from "./getting-started";
import { notifications } from "./notifications";
import { orders } from "./orders";
import { reports } from "./reports";
import { services } from "./services";
import { settings } from "./settings";

// Эрэмбэ нь ажилтны /dashboard нав-той адил (app/_components/admin-sidebar.tsx).
export const TENANT_MANUAL_SECTIONS: ManualSection[] = [
  gettingStarted,
  dashboardOverview,
  branches,
  employeesRoles,
  orders,
  appointments,
  customersVehicles,
  services,
  notifications,
  feedback,
  reports,
  auditLog,
  settings,
];

export function findManualSection(slug: string): ManualSection | undefined {
  return findSection(TENANT_MANUAL_SECTIONS, slug);
}

// Article slug-ууд бүх section дундаа өвөрмөц гэж үзнэ (related холбоос,
// хайлтад ашиглана) — эхний тохирлыг буцаана.
export function findManualArticle(
  articleSlug: string,
): { section: ManualSection; article: ManualArticle } | undefined {
  return findArticleIn(TENANT_MANUAL_SECTIONS, articleSlug);
}

export function manualArticleCount(section: ManualSection): number {
  return sectionArticleCount(section);
}

export function allManualArticlesFlat(): Array<{
  section: ManualSection;
  article: ManualArticle;
}> {
  return flattenArticles(TENANT_MANUAL_SECTIONS);
}
