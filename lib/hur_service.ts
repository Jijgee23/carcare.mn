/**
 * HUR (МАК-ын vehicle registry) API-тай харьцах wrapper.
 *
 * Орчны хувьсагчид:
 *   HUR_URL       — анхдагч https://hur.api.macs.mn/
 *   HUR_USERNAME, HUR_PASSWORD  — нэвтрэх
 *   HUR_CODE      — getVehicleInfo дуудахдаа илгээх tenant/code
 *
 * Token-г module-level дотор cache хийнэ — request бүрт login дуудахгүй.
 */

export type HurVehicle = {
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null; // cabinNumber
  color: string | null;
  country: string | null;
  fuelType: string | null;
  capacity: number | null;
  className: string | null;
  importDate: string | null;
  wheelPosition: string | null;
  owner: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    regnum: string | null;
    type: string | null;
    address: string | null;
  } | null;
};

type CachedToken = { token: string; expiresAt: number };

let cached: CachedToken | null = null;

function baseUrl(): string {
  return process.env.HUR_URL || "https://hur.api.macs.mn/";
}

export class HurService {
  static async getAccessToken(): Promise<string> {
    // 60 секундийн "буфер"-тэйгээр шалгана, тийм биш бол шинэчилнэ
    if (cached && cached.expiresAt - Date.now() > 60_000) {
      return cached.token;
    }

    const url = new URL("login", baseUrl()).toString();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: process.env.HUR_USERNAME,
        password: process.env.HUR_PASSWORD,
      }),
    });
    if (!response.ok) {
      throw new Error(`HUR login алдаа: ${response.status}`);
    }
    const data = (await response.json()) as {
      token?: string;
      expiresIn?: number;
    };
    if (!data.token) throw new Error("HUR login token буцаагаагүй.");
    const expiresInSec = typeof data.expiresIn === "number" ? data.expiresIn : 60 * 60;
    cached = {
      token: data.token,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    return data.token;
  }

  static async getVehicle(plate: string): Promise<HurVehicle> {
    const normalized = plate.trim().toUpperCase();
    if (!normalized) throw new Error("Улсын дугаар хоосон байна.");

    let token = await this.getAccessToken();

    const doFetch = async () =>
      fetch(new URL("getVehicleInfo", baseUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: process.env.HUR_CODE,
          number: normalized,
        }),
      });

    let response = await doFetch();
    // Token хугацаа дууссан байж магадгүй — нэг л удаа дахин оролдоно
    if (response.status === 401) {
      cached = null;
      token = await this.getAccessToken();
      response = await doFetch();
    }
    if (!response.ok) {
      throw new Error(`HUR getVehicleInfo алдаа: ${response.status}`);
    }

    const raw = (await response.json()) as unknown;
    return parseVehicleResponse(raw, normalized);
  }
}

export type PublicHurVehicle = Omit<HurVehicle, "owner">;

/**
 * Эцсийн хэрэглэгчид буцаах HUR мэдээлэл — өмчлөгчийн PII-г (нэр, утас, регистр)
 * хасна. Зөвхөн машины техникийн мэдээллийг үлдээнэ.
 */
export function toPublicVehicle(v: HurVehicle): PublicHurVehicle {
  const rest = { ...v };
  delete (rest as Partial<HurVehicle>).owner;
  return rest;
}

// HUR-аас ирэх wheelPosition string-ийг "Зүүн" / "Баруун" хэлбэрт оруулна.
// Танигдаагүй бол raw утгыг үлдээнэ.
export function normalizeWheelPosition(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("зүүн") || v === "left" || v === "l") return "Зүүн";
  if (v.startsWith("баруун") || v === "right" || v === "r") return "Баруун";
  return raw.trim();
}

function parseVehicleResponse(raw: unknown, fallbackPlate: string): HurVehicle {
  if (!raw || typeof raw !== "object") {
    throw new Error("HUR-аас буруу хариу ирлээ.");
  }

  // Хариу нь { return: { response: {...}, resultCode, resultMessage } } бүтэцтэй
  const ret =
    (raw as { return?: unknown }).return ?? (raw as Record<string, unknown>);
  if (!ret || typeof ret !== "object") {
    throw new Error("HUR-аас буруу хариу ирлээ.");
  }

  const block = ret as {
    response?: Record<string, unknown>;
    resultCode?: number;
    resultMessage?: string;
  };

  if (typeof block.resultCode === "number" && block.resultCode !== 0) {
    const msg = block.resultMessage || "HUR алдаа";
    throw new Error(`HUR: ${msg}`);
  }

  const r = (block.response ?? (raw as Record<string, unknown>)) as Record<
    string,
    unknown
  >;

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() && !v.includes("NO ACCESS")
      ? v.trim()
      : null;
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v)))
      return Number(v);
    return null;
  };

  const addr = r.ownerAddress as
    | { soum?: unknown; state?: unknown }
    | undefined;
  const addrStr = addr
    ? [str(addr.state), str(addr.soum)].filter(Boolean).join(", ") || null
    : null;

  const hasOwnerData =
    str(r.ownerFirstname) ||
    str(r.ownerLastname) ||
    str(r.ownerHandphone) ||
    str(r.ownerRegnum);

  return {
    plate: str(r.plateNumber) ?? fallbackPlate,
    make: str(r.markName),
    model: str(r.modelName),
    year: num(r.buildYear),
    vin: str(r.cabinNumber),
    color: str(r.colorName),
    country: str(r.countryName),
    fuelType: str(r.fueltype),
    capacity: num(r.capacity),
    className: str(r.className),
    importDate: str(r.importDate),
    wheelPosition: str(r.wheelPosition),
    owner: hasOwnerData
      ? {
          firstName: str(r.ownerFirstname),
          lastName: str(r.ownerLastname),
          phone: str(r.ownerHandphone),
          regnum: str(r.ownerRegnum),
          type: str(r.ownerType),
          address: addrStr,
        }
      : null,
  };
}
