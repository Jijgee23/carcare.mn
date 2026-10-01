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
