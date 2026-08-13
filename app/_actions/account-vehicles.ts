"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/prisma";
import { resolveVehicle } from "@/lib/vehicles";

export type CreatedAccountVehicle = {
  id: string; // AccountVehicle link id
  vehicleId: string; // global Vehicle id
  plate: string;
  make: string;
  model: string;
};

export type QuickCreateAccountVehicleResult = {
  ok: boolean;
  vehicle?: CreatedAccountVehicle;
  fieldErrors?: Record<string, string>;
  message?: string;
};

/**
 * Хэрэглэгчийн машин нэмэх. Inline form-оос (booking + account) дуудна — үүсгэсэн
 * машиныг буцаах тул form-state биш энгийн async функц.
 */
export async function quickCreateAccountVehicle(input: {
  plate: string;
  make: string;
  model: string;
  year?: string | null;
  vin?: string | null;
  fuelType?: string | null;
  wheelPosition?: string | null;
  colorName?: string | null;
  capacity?: string | null;
  purpose?: string | null;
}): Promise<QuickCreateAccountVehicleResult> {
  const account = await requireAccount();

  const plate = (input.plate ?? "").trim();
  const make = (input.make ?? "").trim();
  const model = (input.model ?? "").trim();
  const yearRaw = (input.year ?? "").toString().trim();
  const vin = (input.vin ?? "").toString().trim();
  const fuelType = (input.fuelType ?? "").toString().trim();
  const wheelPosition = (input.wheelPosition ?? "").toString().trim();
  const colorName = (input.colorName ?? "").toString().trim();
  const purpose = (input.purpose ?? "").toString().trim();
  const capacityRaw = (input.capacity ?? "").toString().trim();

  const fieldErrors: Record<string, string> = {};
  if (!plate) fieldErrors.plate = "Улсын дугаар оруулна уу.";
  if (!make) fieldErrors.make = "Марк оруулна уу.";
  if (!model) fieldErrors.model = "Загвар оруулна уу.";

  let year: number | null = null;
  if (yearRaw) {
    const n = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(n) || n < 1950 || n > 2100) {
      fieldErrors.year = "Он буруу.";
    } else {
      year = n;
    }
  }

  let capacity: number | null = null;
  if (capacityRaw) {
    const n = Number.parseInt(capacityRaw.replace(/\s+/g, ""), 10);
    if (Number.isFinite(n) && n >= 0) capacity = n;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  try {
    // global Vehicle-ийг resolve хийж, account-той нимгэн link үүсгэнэ.
    const v = await prisma.$transaction(async (tx) => {
      const vehicle = await resolveVehicle(tx, {
        plate,
        vin: vin || null,
        make,
        model,
        year,
        fuelType: fuelType || null,
        wheelPosition: wheelPosition || null,
        colorName: colorName || null,
        capacity,
        purpose: purpose || null,
      });
      const link = await tx.accountVehicle.create({
        data: { accountId: account.id, vehicleId: vehicle.id },
        select: { id: true },
      });
      const full = await tx.vehicle.findUniqueOrThrow({
        where: { id: vehicle.id },
        select: { plate: true, make: true, model: true },
      });
      return { id: link.id, vehicleId: vehicle.id, ...full };
    });
    revalidatePath("/account");
    return { ok: true, vehicle: v };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, fieldErrors: { plate: "Энэ дугаар аль хэдийн бүртгэгдсэн." } };
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Алдаа гарлаа.",
    };
  }
}

/** Хэрэглэгч өөрийн машинаа устгах. */
export async function deleteAccountVehicle(formData: FormData): Promise<void> {
  const account = await requireAccount();
  const id = ((formData.get("id") as string) ?? "").trim();
  if (!id) return;
  await prisma.accountVehicle.deleteMany({
    where: { id, accountId: account.id },
  });
  revalidatePath("/account");
}
