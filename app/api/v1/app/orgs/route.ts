import { jsonError, jsonOk } from "@/lib/api";
import { getDiscoveryCatalog, parseDiscoveryFilters } from "@/lib/discovery-catalog";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { setBypassContext } from "@/lib/tenant-context";

/** Mobile discovery contract: server-filtered, organization-paginated catalog. */
export async function GET(request: Request) {
  setBypassContext();
  const searchParams = new URL(request.url).searchParams;
  const parsed = parseDiscoveryFilters(searchParams);
  if (parsed.error || !parsed.filters) return jsonError(400, parsed.error ?? "Шүүлтүүр буруу байна.");
  const { page, pageSize, skip, take } = getApiPageInfo(searchParams, { defaultSize: 20 });
  const catalog = await getDiscoveryCatalog(parsed.filters);
  const orgs = catalog.organizations.map((organization) => ({
    slug: organization.slug,
    name: organization.name,
    logoUrl: organization.logoUrl,
    branches: organization.branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      city: branch.city,
      district: branch.district,
      latitude: branch.lat,
      longitude: branch.lng,
      serviceKeyIds: branch.serviceKeyIds,
      tags: branch.tags,
      ...(branch.distanceKm == null ? {} : { distanceKm: branch.distanceKm }),
    })),
  }));
  return jsonOk({
    orgs: orgs.slice(skip, skip + take),
    pagination: buildMeta(orgs.length, page, pageSize),
    facets: catalog.facets,
  });
}
