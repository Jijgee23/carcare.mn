"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { requireAccount } from "@/lib/auth/account";
import { prisma } from "@/lib/prisma";

export type CreatedAccountVehicle = {
  id: string;
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
}): Promise<QuickCreateAccountVehicleResult> {
  const account = await requireAccount();

  const plate = (input.plate ?? "").trim();
  const make = (input.make ?? "").trim();
  const model = (input.model ?? "").trim();
  const yearRaw = (input.year ?? "").toString().trim();
  const vin = (input.vin ?? "").toString().trim();
  const fuelType = (input.fuelType ?? "").toString().trim();
  const wheelPosition = (input.wheelPosition ?? "").toString().trim();

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

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  try {
    const v = await prisma.accountVehicle.create({
      data: {
        accountId: account.id,
        plate,
        make,
        model,
        year,
        vin: vin || null,
        fuelType: fuelType || null,
        wheelPosition: wheelPosition || null,
      },
      select: { id: true, plate: true, make: true, model: true },
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
