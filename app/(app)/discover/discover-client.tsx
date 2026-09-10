"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@/app/_components/select";

export type DiscoverBranch = {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  city: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  open: boolean;
  hours: string | null;
  distanceKm?: number;
  // Бямба/Ням аль нэгэнд ажилладаг эсэх ("Амралтын өдөр ажилладаг" шүүлт).
  weekend: boolean;
  services: string[];
};

const DEFAULT_CITY = "Улаанбаатар";

export type DiscoverOrg = {
  slug: string;
  name: string;
  logoUrl: string | null;
  phone: string;
  branches: DiscoverBranch[];
};

type Marker = { org: DiscoverOrg; branch: DiscoverBranch };

type GeoPoint = { lat: number; lng: number };

function distanceLabel(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} м`;
  }
  return `${distanceKm.toFixed(1)} км`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Merge the API's filtered/sorted branch summary onto the richer SSR payload. */
function mergeFilteredOrgs(
  initialOrgs: DiscoverOrg[],
  payload: unknown,
  { openNow }: { openNow: boolean },
): DiscoverOrg[] {
  const body = asRecord(payload);
  const apiOrgs = body?.orgs;
  if (!Array.isArray(apiOrgs)) throw new Error("Шүүлтүүрийн хариу буруу байна.");

  const initialBySlug = new Map(initialOrgs.map((org) => [org.slug, org]));
  const filtered: DiscoverOrg[] = [];
  for (const rawOrg of apiOrgs) {
    const apiOrg = asRecord(rawOrg);
    const slug = apiOrg?.slug;
    const apiBranches = apiOrg?.branches;
    if (typeof slug !== "string" || !Array.isArray(apiBranches)) continue;

    const initialOrg = initialBySlug.get(slug);
    if (!initialOrg) continue;
    const initialBranches = new Map(
      initialOrg.branches.map((branch) => [branch.id, branch]),
    );
    const branches: DiscoverBranch[] = [];
    for (const rawBranch of apiBranches) {
      const apiBranch = asRecord(rawBranch);
      const id = apiBranch?.id;
      if (typeof id !== "string") continue;
      const initialBranch = initialBranches.get(id);
      if (!initialBranch) continue;
      const rawDistance = apiBranch?.distanceKm;
      branches.push({
        ...initialBranch,
        ...(openNow ? { open: true } : {}),
        ...(typeof rawDistance === "number" && Number.isFinite(rawDistance)
          ? { distanceKm: rawDistance }
          : {}),
      });
    }
    if (branches.length === 0) continue;
    filtered.push({ ...initialOrg, branches });
  }
  return filtered;
}

async function fetchFilteredOrgs({
  initialOrgs,
  location,
  openNow,
  signal,
}: {
  initialOrgs: DiscoverOrg[];
  location: GeoPoint | null;
  openNow: boolean;
  signal: AbortSignal;
}): Promise<DiscoverOrg[]> {
  const params = new URLSearchParams();
  if (location) {
    params.set("lat", String(location.lat));
    params.set("lng", String(location.lng));
  }
  if (openNow) params.set("openNow", "1");
  const query = params.toString();
  const response = await fetch(`/api/v1/app/orgs${query ? `?${query}` : ""}`, {
    signal,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Шүүлтүүрийн үр дүнг ачаалж чадсангүй.");
  return mergeFilteredOrgs(initialOrgs, payload, { openNow });
}

function requestBrowserLocation(): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Энэ browser байршил тогтоохыг дэмжихгүй байна."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => reject(new Error("Байршлын зөвшөөрөл олгогдсонгүй.")),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  });
}

// Google Maps JS API-г нэг л удаа ачаална (module-level promise).
declare global {
  interface Window {
    google?: unknown;
    __gmapsPromise?: Promise<void>;
  }
}
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps) return Promise.resolve();
  if (window.__gmapsPromise) return window.__gmapsPromise;
  window.__gmapsPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=marker&language=mn&region=MN`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google Maps ачаалж чадсангүй."));
    document.head.appendChild(s);
  });
  return window.__gmapsPromise;
}

const UB_CENTER = { lat: 47.918, lng: 106.917 };

// AdvancedMarkerElement-д ашиглах Map ID (vector map шаардлагатай). Бодит
// Map ID байхгүй бол Google-ийн DEMO_MAP_ID ажиллана.
const DEFAULT_MAP_ID = "DEMO_MAP_ID";

function isLightTheme(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("light")
  );
}

function ringColor(open: boolean, active: boolean): string {
  return active ? "#7c5cff" : open ? "#22c55e" : "#9ca3af";
}

/** Маркерын DOM — логотой дугуй "pin" + доош үзүүртэй. */
function buildPinElement(m: Marker, active: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:relative;width:44px;height:54px;cursor:pointer;transition:transform .15s ease;";

  const badge = document.createElement("div");
  badge.dataset.role = "badge";
  badge.style.cssText = `position:absolute;top:0;left:2px;width:40px;height:40px;border-radius:9999px;background:#fff;border:3px solid ${ringColor(
    m.branch.open,
    active,
  )};box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;overflow:hidden;`;

  if (m.org.logoUrl) {
    const img = document.createElement("img");
    img.src = m.org.logoUrl;
    img.alt = "";
    img.style.cssText = "width:100%;height:100%;object-fit:contain;";
    badge.appendChild(img);
  } else {
    badge.textContent = m.org.name.slice(0, 1).toUpperCase();
    badge.style.color = "#3b2f6b";
    badge.style.fontWeight = "700";
    badge.style.fontSize = "16px";
  }

  // Доош чиглэсэн жижиг үзүүр (pin tail)
  const tail = document.createElement("div");
  tail.dataset.role = "tail";
  tail.style.cssText = `position:absolute;top:36px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${ringColor(
    m.branch.open,
    active,
  )};`;

  wrap.appendChild(badge);
  wrap.appendChild(tail);
  if (active) wrap.style.transform = "scale(1.18)";
  return wrap;
}

function OpenBadge({ open, hours }: { open: boolean; hours: string | null }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${open
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-300"
        : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30 light:bg-zinc-100 light:text-zinc-600 light:border-zinc-300"
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${open ? "bg-emerald-400" : "bg-zinc-400"}`}
      />
      {open ? "Нээлттэй" : "Хаалттай"}
      {hours ? <span className="opacity-70 tabular-nums">· {hours}</span> : null}
    </span>
  );
}

// Салбарын үзүүлдэг үйлчилгээний ангиллууд (жагсаалт мөр + map карт хоёуланд).
function ServiceTags({ services }: { services: string[] }) {
  if (services.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {services.map((s) => (
        <span
          key={s}
          className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/60 border border-white/[0.08] light:bg-black/[0.04] light:text-slate-600 light:border-black/[0.08]"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export function DiscoverClient({
  orgs,
  apiKey,
  mapId,
}: {
  orgs: DiscoverOrg[];
  apiKey: string;
  mapId: string;
}) {
  // Аймаг/хотын жагсаалт (branch-ийн баазын утгаас).
  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const o of orgs)
      for (const b of o.branches) {
        const c = b.city?.trim();
        if (c) s.add(c);
      }
    return [...s].sort((a, b) => a.localeCompare(b, "mn"));
  }, [orgs]);

  // Анх ороход Улаанбаатар сонгогдсон байна (жагсаалтад байгаа бол),
  // үгүй бол бүх аймаг/хот.
  const [city, setCity] = useState(() =>
    cities.includes(DEFAULT_CITY) ? DEFAULT_CITY : "",
  );
  const [citySelectedByUser, setCitySelectedByUser] = useState(false);
  const [district, setDistrict] = useState("");
  // Засварын (үйлчилгээ) нэр эсвэл салбарын нэрээр хайх — жагсаалт/газрын
  // зураг хоёуланд хамаарна.
  const [query, setQuery] = useState("");
  // "Амралтын өдөр ажилладаг" — байгууллага аль нэг салбар нь Бямба/Ням
  // ажилладаг бол харагдана (city/district-той ижил client-side шүүлт).
  const [weekendOnly, setWeekendOnly] = useState(false);
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [nearMeLocation, setNearMeLocation] = useState<GeoPoint | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [catalogOrgs, setCatalogOrgs] = useState(orgs);

  useEffect(() => {
    const controller = new AbortController();
    if (!nearMeOnly && !openNowOnly) {
      setCatalogOrgs(orgs);
      setFilterError(null);
      setFilterLoading(false);
      return () => controller.abort();
    }

    setFilterLoading(true);
    setFilterError(null);
    fetchFilteredOrgs({
      initialOrgs: orgs,
      location: nearMeOnly ? nearMeLocation : null,
      openNow: openNowOnly,
      signal: controller.signal,
    })
      .then((filtered) => {
        if (controller.signal.aborted) return;
        setCatalogOrgs(filtered);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFilterError(
          error instanceof Error
            ? error.message
            : "Шүүлтүүрийн үр дүнг ачаалж чадсангүй.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilterLoading(false);
      });

    return () => controller.abort();
  }, [nearMeLocation, nearMeOnly, openNowOnly, orgs]);

  // Сонгосон хотод хамаарах дүүрэг/сумууд.
  const districts = useMemo(() => {
    const s = new Set<string>();
    for (const o of orgs)
      for (const b of o.branches) {
        if (city && (b.city ?? "").trim() !== city) continue;
        const d = b.district?.trim();
        if (d) s.add(d);
      }
    return [...s].sort((a, b) => a.localeCompare(b, "mn"));
  }, [orgs, city]);

  const q = query.trim().toLowerCase();

  const visibleOrgs = useMemo(() => {
    if (!city && !district && !q && !weekendOnly) return catalogOrgs;
    return catalogOrgs
      .map((o) => ({
        ...o,
        branches: o.branches.filter(
          (b) =>
            (!city || (b.city ?? "").trim() === city) &&
            (!district || (b.district ?? "").trim() === district) &&
            (!q ||
              b.name.toLowerCase().includes(q) ||
              b.services.some((s) => s.toLowerCase().includes(q))),
        ),
      }))
      .filter((o) => o.branches.length > 0)
      // Org-level шүүлт: аль нэг (дээрх шүүлтийг давсан) салбар нь Бямба/Ням
      // ажилладаг бол ЭНЭ org-ийн БҮХ салбарыг харуулна (зөвхөн weekend
      // салбарыг нь биш) — city/district-ээс ялгаатай зарчим.
      .filter((o) => !weekendOnly || o.branches.some((b) => b.weekend));
  }, [catalogOrgs, city, district, q, weekendOnly]);

  const markers = useMemo<Marker[]>(
    () =>
      visibleOrgs.flatMap((org) =>
        org.branches
          .filter((b) => b.lat != null && b.lng != null)
          .map((branch) => ({ org, branch })),
      ),
    [visibleOrgs],
  );

  // Газрын зураг ТОХИРУУЛАГДСАН эсэх (apiKey байгаа эсэх) — тогтмол, шүүлтийн
  // үр дүнгээс хамаардаггүй тул "Газрын зураг" tab/товч шүүлтийн улмаас 0
  // илэрцтэй болоход алга болохгүй (үр дүнгүй үед доорхи "Энэ хайлтаар газар
  // олдсонгүй" мессеж харагдана, товч биш алга болно).
  const mapConfigured = Boolean(apiKey);
  const hasMap = mapConfigured && markers.length > 0;
  const [view, setView] = useState<"map" | "list">(hasMap ? "map" : "list");
  const [selected, setSelected] = useState<Marker | null>(null);
  const [mapError, setMapError] = useState(false);
  const [light, setLight] = useState(false);

  const toggleNearMe = async () => {
    setSelected(null);
    if (nearMeOnly) {
      setNearMeOnly(false);
      return;
    }
    setLocationPending(true);
    setFilterError(null);
    try {
      const location = nearMeLocation ?? (await requestBrowserLocation());
      // Ulaanbaatar is only a presentation default. Do not let that implicit
      // city filter hide nearby branches when the user's location is elsewhere;
      // preserve a city the user explicitly chose.
      if (!citySelectedByUser && city === DEFAULT_CITY) {
        setCity("");
        setDistrict("");
      }
      setNearMeLocation(location);
      setNearMeOnly(true);
    } catch (error: unknown) {
      setFilterError(
        error instanceof Error
          ? error.message
          : "Байршил авах боломжгүй байна.",
      );
    } finally {
      setLocationPending(false);
    }
  };

  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<{ marker: any; m: Marker }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);

  // Аппын theme-г ажиглаж state-д тусгана — өөрчлөгдөхөд газрын зургийг
  // тохирох colorScheme-тэйгээр дахин үүсгэнэ.
  useEffect(() => {
    setLight(isLightTheme());
    const observer = new MutationObserver(() => setLight(isLightTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (view !== "map" || !hasMap) return;
    let cancelled = false;
    setMapError(false);
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        if (!g?.maps) return;
        const map = new g.maps.Map(mapRef.current, {
          center: UB_CENTER,
          zoom: 12,
          mapId: mapId || DEFAULT_MAP_ID,
          colorScheme: light ? "LIGHT" : "DARK",
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          // Ctrl дарахгүйгээр шууд scroll-оор томруулна (cooperative биш greedy).
          gestureHandling: "greedy",
          // 3D барилга/налуу хардаггүй — flat 2D (Flutter-ийн buildingsEnabled
          // false-д хамгийн ойр JS хувилбар). Footprint-г бүрэн нуухын тулд
          // Map ID-ийн cloud style-аас Landmarks/Buildings унтраана.
          tilt: 0,
          rotateControl: false,
          tiltInteractionEnabled: false,
          headingInteractionEnabled: false,
        });
        mapInstanceRef.current = map;
        markersRef.current = [];
        userMarkerRef.current = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Advanced = g.maps.marker?.AdvancedMarkerElement;
        const bounds = new g.maps.LatLngBounds();
        const userPosition = nearMeLocation
          ? { lat: nearMeLocation.lat, lng: nearMeLocation.lng }
          : null;
        if (userPosition) {
          userMarkerRef.current = new g.maps.Marker({
            map,
            position: userPosition,
            title: "Таны байршил",
            zIndex: 2000,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
          });
          bounds.extend(userPosition);
        }
        markers.forEach((m) => {
          const pos = { lat: m.branch.lat as number, lng: m.branch.lng as number };
          const active = selected?.branch.id === m.branch.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let marker: any;
          if (Advanced) {
            const content = buildPinElement(m, active);
            marker = new Advanced({
              map,
              position: pos,
              content,
              title: `${m.org.name} — ${m.branch.name}`,
              zIndex: active ? 999 : 1,
              gmpClickable: true,
            });
            // gmp-click — content-ийн DOM-оос үл хамаарч найдвартай ажиллана
            // (логотой/логогүй аль ч маркерт). Content click-г нөөцөөр давхар.
            marker.addListener("gmp-click", () => setSelected(m));
            marker.addListener("click", () => setSelected(m));
            content.style.pointerEvents = "auto";
            content.addEventListener("click", () => setSelected(m));
          } else {
            // Fallback (AdvancedMarker байхгүй) — энгийн өнгөт цэг.
            marker = new g.maps.Marker({
              position: pos,
              map,
              title: `${m.org.name} — ${m.branch.name}`,
              icon: {
                path: g.maps.SymbolPath.CIRCLE,
                scale: active ? 12 : 9,
                fillColor: ringColor(m.branch.open, active),
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
            marker.addListener("click", () => setSelected(m));
          }
          markersRef.current.push({ marker, m });
          bounds.extend(pos);
        });
        if (userPosition) {
          map.setCenter(userPosition);
          map.setZoom(markers.length > 0 ? 13 : 15);
        } else if (markers.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, 64);
        }
        map.addListener("click", () => setSelected(null));
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      if (userMarkerRef.current?.setMap) {
        userMarkerRef.current.setMap(null);
      }
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, hasMap, apiKey, markers, mapId, light, nearMeLocation]);

  // Сонгосон маркерыг тодруулж (ягаан + том), түүн рүү зөөлөн төвлөрнө.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!g?.maps || markersRef.current.length === 0) return;
    for (const entry of markersRef.current) {
      const active = selected?.branch.id === entry.m.branch.id;
      if ("content" in entry.marker) {
        // AdvancedMarkerElement — контентыг дахин зурна.
        const el = buildPinElement(entry.m, active);
        el.addEventListener("click", () => setSelected(entry.m));
        entry.marker.content = el;
        entry.marker.zIndex = active ? 999 : 1;
      } else if (entry.marker.setIcon) {
        entry.marker.setIcon({
          path: g.maps.SymbolPath.CIRCLE,
          scale: active ? 12 : 9,
          fillColor: ringColor(entry.m.branch.open, active),
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        });
        entry.marker.setZIndex(active ? 999 : 1);
      }
    }
    if (
      selected &&
      mapInstanceRef.current &&
      selected.branch.lat != null &&
      selected.branch.lng != null
    ) {
      mapInstanceRef.current.panTo({
        lat: selected.branch.lat,
        lng: selected.branch.lng,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="flex flex-col gap-4">
      {/* Tab + шүүлтүүд нэг мөрөнд */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center rounded-xl border border-white/[0.1] p-0.5 bg-white/[0.03] shrink-0">
          {mapConfigured ? (
            <button
              type="button"
              onClick={() => setView("map")}
              className={`h-10 flex items-center px-4 rounded-lg text-sm font-medium transition-colors ${view === "map"
                ? "bg-violet-600 text-white"
                : "text-white/55 hover:text-white/80"
                }`}
            >
              Газрын зураг
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setView("list")}
            className={`h-10 flex items-center px-4 rounded-lg text-sm font-medium transition-colors ${view === "list" || !mapConfigured
              ? "bg-violet-600 text-white"
              : "text-white/55 hover:text-white/80"
              }`}
          >
            Жагсаалт
          </button>
        </div>

        <div className="relative flex-1 min-w-[10rem] sm:flex-none sm:w-64">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Засвар, салбарын нэрээр хайх..."
            className="auth-input !h-10 !py-0 !pl-9 !text-sm !rounded-lg"
          />
        </div>

        {cities.length > 0 ? (
          <div className="discover-filter-select w-36 sm:w-40 shrink-0">
            <Select
              name="discover-city"
              value={city}
              placeholder="Аймаг/хот"
              onChange={(v) => {
                setCitySelectedByUser(true);
                setCity(v);
                setDistrict("");
                setSelected(null);
              }}
              options={cities.map((c) => ({ value: c, label: c }))}
            />
          </div>
        ) : null}

        {districts.length > 0 ? (
          <div className="discover-filter-select w-36 sm:w-40 shrink-0">
            <Select
              name="discover-district"
              value={district}
              placeholder="Сум/дүүрэг"
              onChange={(v) => {
                setDistrict(v);
                setSelected(null);
              }}
              options={districts.map((d) => ({ value: d, label: d }))}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={toggleNearMe}
          disabled={locationPending}
          aria-pressed={nearMeOnly}
          aria-busy={locationPending}
          className={`shrink-0 text-xs px-3 h-10 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-wait ${
            nearMeOnly
              ? "bg-[#7c5cff] border-[#7c5cff] text-white"
              : "border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
          }`}
        >
          {locationPending ? "Байршил авч байна…" : "Надад ойр"}
        </button>

        <button
          type="button"
          onClick={() => {
            setOpenNowOnly((value) => !value);
            setSelected(null);
          }}
          aria-pressed={openNowOnly}
          className={`shrink-0 text-xs px-3 h-10 rounded-lg border transition-colors ${
            openNowOnly
              ? "bg-[#7c5cff] border-[#7c5cff] text-white"
              : "border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
          }`}
        >
          Одоо нээлттэй
        </button>

        <button
          type="button"
          onClick={() => {
            setWeekendOnly((v) => !v);
            setSelected(null);
          }}
          aria-pressed={weekendOnly}
          className={`shrink-0 text-xs px-3 h-10 rounded-lg border transition-colors ${
            weekendOnly
              ? "bg-[#7c5cff] border-[#7c5cff] text-white"
              : "border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
          }`}
        >
          Амралтын өдөр ажилладаг
        </button>

        <span className="text-xs text-white/40 shrink-0 ml-auto">
          {visibleOrgs.length} газар · {markers.length} салбар
        </span>

        {filterLoading ? (
          <span className="basis-full text-xs text-violet-300 light:text-violet-700">
            Шүүлтүүрийн үр дүн шинэчилж байна…
          </span>
        ) : null}
        {filterError ? (
          <div className="basis-full text-xs text-[var(--oc-warn)]">
            {filterError}
          </div>
        ) : null}
      </div>

      {orgs.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
          Одоогоор онлайн цаг захиалга нээсэн газар алга.
        </div>
      ) : visibleOrgs.length === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/[0.08] text-center text-sm text-white/40">
          Энэ хайлтаар газар олдсонгүй.
        </div>
      ) : view === "map" && hasMap ? (
        <div className="relative">
          <div
            ref={mapRef}
            className="h-[70vh] min-h-[24rem] w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-[var(--surface)]"
          />
          <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 shadow-lg light:border-black/10 light:bg-white/95">
              <button
                type="button"
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (map) map.setZoom((map.getZoom() ?? 12) + 1);
                }}
                aria-label="Газрын зургийг томруулах"
                title="Томруулах"
                className="flex h-10 w-10 items-center justify-center text-xl font-medium text-white/85 transition-colors hover:bg-white/10 light:text-zinc-700 light:hover:bg-zinc-100"
              >
                +
              </button>
              <div className="h-px bg-white/10 light:bg-zinc-200" />
              <button
                type="button"
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (map) map.setZoom((map.getZoom() ?? 12) - 1);
                }}
                aria-label="Газрын зургийг жижигрүүлэх"
                title="Жижигрүүлэх"
                className="flex h-10 w-10 items-center justify-center text-xl font-medium text-white/85 transition-colors hover:bg-white/10 light:text-zinc-700 light:hover:bg-zinc-100"
              >
                −
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const map = mapInstanceRef.current;
                if (map && nearMeLocation) {
                  map.panTo({
                    lat: nearMeLocation.lat,
                    lng: nearMeLocation.lng,
                  });
                  map.setZoom(Math.max(map.getZoom() ?? 13, 14));
                } else {
                  void toggleNearMe();
                }
              }}
              aria-label="Миний байршил руу очих"
              title="Миний байршил"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg transition-colors ${
                nearMeLocation
                  ? "border-blue-400/50 bg-blue-600 text-white hover:bg-blue-500"
                  : "border-white/10 bg-zinc-900/95 text-white/85 hover:bg-white/10 light:border-black/10 light:bg-white/95 light:text-zinc-700 light:hover:bg-zinc-100"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                ◎
              </span>
            </button>
          </div>
          {mapError ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50 bg-[var(--surface)] rounded-2xl">
              Газрын зураг ачаалж чадсангүй.
            </div>
          ) : null}

          {/* Сонгосон салбарын мэдээлэл — том, ойлгомжтой карт */}
          {selected ? (
            <div className="absolute left-3 right-3 bottom-3 sm:left-4 sm:right-auto sm:bottom-4 sm:w-[28rem]">
              <div className="bg-[var(--surface)] rounded-3xl border border-white/[0.14] shadow-2xl overflow-hidden">
                {/* Толгой — лого + газрын нэр */}
                <div className="flex items-center gap-3.5 p-5 pb-4">
                  {selected.org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.org.logoUrl}
                      alt=""
                      className="w-14 h-14 rounded-2xl object-contain bg-white/[0.05] border border-white/[0.08] shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/40 to-blue-500/40 border border-white/[0.08] shrink-0 flex items-center justify-center text-xl font-bold text-white/80">
                      {selected.org.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold text-white/95 truncate">
                      {selected.org.name}
                    </div>
                    <div className="text-sm text-white/55 truncate">
                      {selected.branch.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Хаах"
                    className="shrink-0 text-white/40 hover:text-white/90 hover:bg-white/[0.08] rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* Төлөв + мэдээлэл */}
                <div className="px-5 pb-5 flex flex-col gap-3">
                  <div>
                    <OpenBadge
                      open={selected.branch.open}
                      hours={selected.branch.hours}
                    />
                  </div>

                  {selected.branch.distanceKm != null ? (
                    <div className="flex items-center gap-2.5 text-sm text-violet-200 light:text-violet-700">
                      <span aria-hidden>⌖</span>
                      <span>
                        {distanceLabel(selected.branch.distanceKm)} зайтай
                      </span>
                    </div>
                  ) : null}

                  <div className="flex items-start gap-2.5 text-sm text-white/70">
                    <svg className="w-4 h-4 mt-0.5 text-white/35 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="min-w-0">{selected.branch.address}</span>
                  </div>

                  {selected.branch.phone ? (
                    <a
                      href={`tel:${selected.branch.phone}`}
                      className="flex items-center gap-2.5 text-sm text-white/70 hover:text-violet-300 light:hover:text-violet-700 transition-colors"
                    >
                      <svg className="w-4 h-4 text-white/35 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <span className="tabular-nums">{selected.branch.phone}</span>
                    </a>
                  ) : null}

                  <ServiceTags services={selected.branch.services} />

                  <Link
                    href={`/org/${selected.org.slug}?branch=${selected.branch.id}`}
                    className="mt-1 inline-flex w-full items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-3 rounded-2xl text-sm font-semibold"
                  >
                    Цаг захиалах
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 items-start">
          {visibleOrgs.map((org) => (
            <div
              key={org.slug}
              className="glass rounded-2xl border border-white/[0.08] overflow-hidden"
            >
              <Link
                href={`/org/${org.slug}?branch=${encodeURIComponent(org.branches[0].id)}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={org.logoUrl}
                    alt=""
                    className="w-11 h-11 rounded-xl object-contain bg-white/[0.04] border border-white/[0.06] shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-white/[0.06] shrink-0 flex items-center justify-center font-bold text-white/70">
                    {org.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-white/90 truncate">
                    {org.name}
                  </div>
                  <div className="text-xs text-white/40">
                    {org.branches.length} салбар
                    {org.branches[0].distanceKm != null ? (
                      <span className="text-violet-300 light:text-violet-700">
                        {` · ${distanceLabel(org.branches[0].distanceKm)} зайтай`}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="text-violet-300 light:text-violet-700 text-sm shrink-0">→</span>
              </Link>

              <ul className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                {org.branches.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-white/85">{b.name}</div>
                      <div className="text-xs text-white/40 mt-0.5 truncate">
                        {b.address}
                      </div>
                      {b.distanceKm != null ? (
                        <div className="text-xs text-violet-300 light:text-violet-700 mt-1">
                          {distanceLabel(b.distanceKm)} зайтай
                        </div>
                      ) : null}
                      {b.services.length > 0 ? (
                        <div className="mt-1.5">
                          <ServiceTags services={b.services} />
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0">
                      <OpenBadge open={b.open} hours={b.hours} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
