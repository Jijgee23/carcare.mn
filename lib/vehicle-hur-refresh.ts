import { Prisma } from "@/app/generated/prisma/client";
import { HurService, normalizeWheelPosition } from "@/lib/hur_service";
import { prisma } from "@/lib/prisma";

export type VehicleHurRefreshResult =
  | {
      ok: true;
      vehicle: {
        plate: string;
        make: string;
        model: string;
        year: number | null;
        vin: string | null;
        fuelType: string | null;
        wheelPosition: string | null;
        colorName: string | null;
        capacity: number | null;
        purpose: string | null;
        serviceCount: number;
        diagnosisCount: number;
      };
    }
  | { ok: false; message: string };

/**
 * Global Vehicle-ийн бие даасан шинжийг (марк, загвар, он, VIN, шатахуун,
 * жолооны хүрд, өнгө, багтаамж, зориулалт) HUR-аас гар аргаар дахин татаж
 * шинэчилнэ. Веб (`refreshVehicleFromHur` server action) болон мобайл
 * (`POST /api/v1/app/vehicles/[id]/refresh-hur`) хоёулаа адилхан дуудна —
 * эзэмшил шалгах (auth эх сурвалж өөр: сесс vs. Bearer token) талыг л
 * дуудагч тал өөрөө хийнэ, энд зөвхөн `vehicleId`+`plate` дамжина.
 *
 * Дугаар (plate)-ыг ЗОРИУДЛАН өөрчлөхгүй: энэ бол "мэдээлэл шинэчлэх", "дугаар
 * солих" биш үйлдэл.
 */
export async function refreshVehicleFieldsFromHur(
  vehicleId: string,
  plate: string,
): Promise<VehicleHurRefreshResult> {
  let hur;
  try {
    hur = await HurService.getVehicle(plate);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "HUR-аас мэдээлэл татаж чадсангүй.",
    };
  }

  try {
    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        make: hur.make ?? undefined,
        model: hur.model ?? undefined,
        year: hur.year ?? undefined,
        vin: hur.vin ?? undefined,
        fuelType: hur.fuelType ?? undefined,
        wheelPosition: normalizeWheelPosition(hur.wheelPosition) ?? undefined,
        colorName: hur.color ?? undefined,
        capacity: hur.capacity ?? undefined,
        purpose: hur.purpose ?? undefined,
      },
      select: {
        plate: true,
        make: true,
        model: true,
        year: true,
        vin: true,
        fuelType: true,
        wheelPosition: true,
        colorName: true,
        capacity: true,
        purpose: true,
        _count: {
          select: {
            serviceOrders: { where: { status: "COMPLETED" } },
            diagnosticReports: true,
          },
        },
      },
    });
    return {
      ok: true,
      vehicle: {
        plate: updated.plate,
        make: updated.make,
        model: updated.model,
        year: updated.year,
        vin: updated.vin,
        fuelType: updated.fuelType,
        wheelPosition: updated.wheelPosition,
        colorName: updated.colorName,
        capacity: updated.capacity,
        purpose: updated.purpose,
        serviceCount: updated._count.serviceOrders,
        diagnosisCount: updated._count.diagnosticReports,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        message: "HUR-аас ирсэн VIN өөр машинд аль хэдийн бүртгэгдсэн байна.",
      };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Шинэчлэх явцад алдаа гарлаа.",
    };
  }
}
