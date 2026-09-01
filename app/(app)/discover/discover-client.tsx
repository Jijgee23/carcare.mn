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
  const [district, setDistrict] = useState("");
  // Засварын (үйлчилгээ) нэр эсвэл салбарын нэрээр хайх — жагсаалт/газрын
  // зураг хоёуланд хамаарна.
  const [query, setQuery] = useState("");

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
    if (!city && !district && !q) return orgs;
    return orgs
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
      .filter((o) => o.branches.length > 0);
  }, [orgs, city, district, q]);

  const markers = useMemo<Marker[]>(
    () =>
      visibleOrgs.flatMap((org) =>
        org.branches
          .filter((b) => b.lat != null && b.lng != null)
          .map((branch) => ({ org, branch })),
      ),
    [visibleOrgs],
  );

  const hasMap = Boolean(apiKey) && markers.length > 0;
  const [view, setView] = useState<"map" | "list">(hasMap ? "map" : "list");
  const [selected, setSelected] = useState<Marker | null>(null);
  const [mapError, setMapError] = useState(false);
  const [light, setLight] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<{ marker: any; m: Marker }[]>([]);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Advanced = g.maps.marker?.AdvancedMarkerElement;
        const bounds = new g.maps.LatLngBounds();
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
        if (markers.length === 1) {
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, hasMap, apiKey, markers, mapId, light]);

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
          {hasMap ? (
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
            className={`h-10 flex items-center px-4 rounded-lg text-sm font-medium transition-colors ${view === "list" || !hasMap
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

        <span className="text-xs text-white/40 shrink-0 ml-auto">
          {visibleOrgs.length} газар · {markers.length} салбар
        </span>
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
                href={`/org/${org.slug}`}
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
