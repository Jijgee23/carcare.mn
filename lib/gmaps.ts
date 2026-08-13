// Google Maps JS API loader — script-ийг нэг л удаа нэмнэ (module-level promise).
// Client component-уудаас ашиглана (discover map, салбарын байршил сонгогч).

declare global {
  interface Window {
    google?: unknown;
    __gmapsPromise?: Promise<void>;
  }
}

// AdvancedMarkerElement-д vector map шаардлагатай. Бодит Map ID байхгүй бол
// Google-ийн DEMO_MAP_ID ажиллана.
export const GMAP_DEMO_MAP_ID = "DEMO_MAP_ID";

export function loadGoogleMaps(apiKey: string): Promise<void> {
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
