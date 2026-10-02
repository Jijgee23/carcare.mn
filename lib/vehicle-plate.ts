// Улсын дугааргүй машин (шинээр орж ирсэн, транзит гэх мэт). `Vehicle.plate`
// заавал талбар тул тусгай тэмдэг хадгална; ийм машиныг VIN-ээр ялгана (VIN
// заавал). Дараа нь дугаар авбал зөвхөн энэ тэмдэгтэй машинд НЭГ удаа жинхэнэ
// дугаар оноож болно (бусад машины дугаар бүртгэсний дараа хөдлөхгүй).
// Client/server аль алинд ашиглагдана — prisma импортлохгүй.

export const NO_PLATE = "ДУГААРГҮЙ";

export function isNoPlate(plate: string | null | undefined): boolean {
  return (plate ?? "").trim().toUpperCase() === NO_PLATE;
}

/** Харуулах дугаар: дугааргүй бол "Дугааргүй · VIN". */
export function plateLabel(plate: string, vin?: string | null): string {
  if (!isNoPlate(plate)) return plate;
  return vin ? `Дугааргүй · ${vin}` : "Дугааргүй";
}

// Латин ↔ кирилл нүдэнд ижил харагдах үсгүүд. Монгол дугаарын үсэг кирилл тул
// латин хувилбарыг кирилл рүү хөрвүүлж канон болгоно — "1234ABC" (латин) болон
// "1234АВС" (кирилл) нэг л машин.
const PLATE_LATIN_TO_CYRILLIC: Record<string, string> = {
  A: "А", B: "В", C: "С", E: "Е", H: "Н", K: "К",
  M: "М", O: "О", P: "Р", T: "Т", X: "Х", Y: "У",
};

/**
 * Улсын дугаарын канон формат: том үсэг, зай/тэмдэгтгүй, латин төстэй үсгийг
 * кирилл болгоно. Ижил эзний мөрийг тааруулах, HUR prefill хайх гол түлхүүр
 * тул бүх бүртгэл/хайлт үүгээр нормчлогдох ёстой.
 */
export function normalizePlate(p: string): string {
  return p
    .toUpperCase()
    .replace(/[^0-9A-ZА-ЯЁӨҮ]/g, "")
    .replace(/[ABCEHKMOPTXY]/g, (ch) => PLATE_LATIN_TO_CYRILLIC[ch] ?? ch);
}
