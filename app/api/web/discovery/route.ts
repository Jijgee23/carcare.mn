import { jsonError, jsonOk } from "@/lib/api";
import { getDiscoveryCatalog, parseDiscoveryFilters } from "@/lib/discovery-catalog";
import { setBypassContext } from "@/lib/tenant-context";

/** Internal web discovery adapter. The current web UI receives the complete filtered list. */
export async function GET(request: Request) {
  setBypassContext();
  const parsed = parseDiscoveryFilters(new URL(request.url).searchParams);
  if (parsed.error || !parsed.filters) return jsonError(400, parsed.error ?? "Шүүлтүүр буруу байна.");
  const catalog = await getDiscoveryCatalog(parsed.filters);
  return jsonOk({ orgs: catalog.organizations, facets: catalog.facets });
}
