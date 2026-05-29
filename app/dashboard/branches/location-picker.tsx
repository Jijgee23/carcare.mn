"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Анхдагч төв — Улаанбаатар
const DEFAULT_CENTER: [number, number] = [47.918873, 106.917698];
const DEFAULT_ZOOM = 12;
const PICKED_ZOOM = 16;

type Coords = { lat: number; lng: number };

// React 19-той үед react-leaflet дээр асуудал гардаг тул raw Leaflet ашиглана.
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: Coords | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Map-г нэг л удаа init хийнэ
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    fixLeafletIcons();

    const initialCenter: [number, number] =
      latitude != null && longitude != null
        ? [latitude, longitude]
        : DEFAULT_CENTER;
    const initialZoom =
      latitude != null && longitude != null ? PICKED_ZOOM : DEFAULT_ZOOM;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (latitude != null && longitude != null) {
      addMarker(map, latitude, longitude);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setMarker(lat, lng);
      onChangeRef.current({ lat, lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Гадаас (text input-аас) lat/lng өөрчлөгдвөл marker-г шинэчилнэ
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (latitude == null || longitude == null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    const current = markerRef.current?.getLatLng();
    if (
      !current ||
      Math.abs(current.lat - latitude) > 1e-6 ||
      Math.abs(current.lng - longitude) > 1e-6
    ) {
      setMarker(latitude, longitude);
      map.setView([latitude, longitude], Math.max(map.getZoom(), PICKED_ZOOM));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  function addMarker(map: L.Map, lat: number, lng: number) {
    const m = L.marker([lat, lng], { draggable: true }).addTo(map);
    m.on("dragend", () => {
      const { lat: nlat, lng: nlng } = m.getLatLng();
      onChangeRef.current({ lat: nlat, lng: nlng });
    });
    markerRef.current = m;
  }

  function setMarker(lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      addMarker(map, lat, lng);
    }
  }

  function pickMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("Энэ хөтөч geolocation дэмждэггүй.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onChangeRef.current({ lat, lng });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || "Байршил тогтоож чадсангүй.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function clear() {
    onChangeRef.current(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-72 w-full rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d0d14]"
      />
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <button
          type="button"
          onClick={pickMyLocation}
          disabled={geoLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 disabled:opacity-50 border border-violet-500/30 text-violet-200 transition-colors"
        >
          {geoLoading ? "Тогтоож байна..." : "📍 Миний байршлыг авах"}
        </button>
        {latitude != null && longitude != null ? (
          <>
            <span className="text-white/40 font-mono">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </span>
            <button
              type="button"
              onClick={clear}
              className="text-red-300/80 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10"
            >
              ✕ Цэвэрлэх
            </button>
          </>
        ) : (
          <span className="text-white/40">
            Газрын зураг дээр товшиж байршлыг сонгоно уу
          </span>
        )}
        {geoError ? (
          <span className="text-red-400">{geoError}</span>
        ) : null}
      </div>
    </div>
  );
}

// Leaflet-ийн default icon path-ыг засна (Next.js bundler-той ажиллахын тулд).
let iconFixed = false;
function fixLeafletIcons() {
  if (iconFixed) return;
  iconFixed = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}
