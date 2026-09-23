// P7-B0 — the loader moved to `lib/reports.ts` so the mobile-facing
// `app/api/v1/reports/**` routes can share it with this web page and the
// export route. Re-exported here so nothing else in `app/dashboard/reports`
// needs to change its import path.
export {
  parseRange,
  fmt,
  loadReportData,
  type Range,
  type ReportData,
} from "@/lib/reports";
