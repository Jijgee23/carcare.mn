"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";

const DEFAULT_CENTER: [number, number] = [47.918873, 106.917698]; // Улаанбаатар

export type MapMarker = {
  lat: number;
  lng: number;
  orgName: string;
  branchName: string;
  slug: string;
};

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

let iconFixed = false;

export function DiscoverMap({ markers }: { markers: MapMarker[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Leaflet нь `window`-д ханддаг тул зөвхөн client дээр (useEffect дотор)
    // динамикаар ачаална — SSR үед import хийвэл "window is not defined" гарна.
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      if (!iconFixed) {
        iconFixed = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      }

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const pts: [number, number][] = [];
      for (const m of markers) {
        const marker = L.marker([m.lat, m.lng]).addTo(map);
        marker.bindPopup(
          `<div style="min-width:150px">
            <strong>${escapeHtml(m.orgName)}</strong><br/>
            <span style="color:#888">${escapeHtml(m.branchName)}</span><br/>
            <a href="/org/${encodeURIComponent(m.slug)}" style="color:#7c5cff;font-weight:600">Цаг захиалах →</a>
          </div>`,
        );
        pts.push([m.lat, m.lng]);
      }
      if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
      else if (pts.length === 1) map.setView(pts[0], 14);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d0d14]"
    />
  );
}
