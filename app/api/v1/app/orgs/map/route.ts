import { jsonError, jsonOk } from "@/lib/api";
import { DISCOVERY_MAX_MARKERS, getDiscoveryCatalog, parseDiscoveryFilters } from "@/lib/discovery-catalog";
import { setBypassContext } from "@/lib/tenant-context";

/** Mobile discovery map contract: lightweight viewport-scoped branch markers. */
export async function GET(request: Request) {
  setBypassContext();
  const parsed = parseDiscoveryFilters(new URL(request.url).searchParams);
  if (parsed.error || !parsed.filters) return jsonError(400, parsed.error ?? "Шүүлтүүр буруу байна.");
  const catalog = await getDiscoveryCatalog(parsed.filters);
  return jsonOk({
    markers: catalog.markers.slice(0, DISCOVERY_MAX_MARKERS),
    count: catalog.markerCount,
    truncated: catalog.markersTruncated,
    max: DISCOVERY_MAX_MARKERS,
  });
}
