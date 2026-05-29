"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type ServiceActionState,
  createServiceAction,
  updateServiceAction,
} from "@/app/_actions/services";
import { Field, FormError } from "@/app/_components/auth-shell";
import { Select } from "@/app/_components/select";
import {
  SERVICE_KINDS,
  SERVICE_KIND_DESCRIPTION,
  SERVICE_KIND_LABEL,
  SERVICE_KIND_SLUG,
  type ServiceKind,
} from "@/lib/services";

type Initial = {
  id?: string;
  type: ServiceKind;
  name: string;
  code: string | null;
  unitId: string | null;
  price: string;
  costPrice: string | null;
  stock: string | null;
  durationValue: string | null;
  durationUnitId: string | null;
  description: string | null;
  isActive: boolean;
  laborCategoryId: string | null;
};

export type LaborCategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type UnitOption = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
};

const FIELD_MW = "max-w-xs";

export function ServiceForm({
  initial,
  fixedType,
  laborCategories,
  units,
}: {
  initial?: Initial;
  fixedType?: ServiceKind;
  laborCategories: LaborCategoryOption[];
  units: UnitOption[];
}) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateServiceAction.bind(null, initial!.id!)
    : createServiceAction;
  const [state, formAction, pending] = useActionState<
    ServiceActionState,
    FormData
  >(action, null);

  const [type, setType] = useState<ServiceKind>(
    initial?.type ?? fixedType ?? "LABOR",
  );
  const [laborCategoryId, setLaborCategoryId] = useState<string>(
    initial?.laborCategoryId ?? "",
  );
  const [unitId, setUnitId] = useState<string>(initial?.unitId ?? "");
  const [durationUnitId, setDurationUnitId] = useState<string>(
    initial?.durationUnitId ?? "",
  );

  // Controlled — action амжилтгүй болсон үед утгууд цэвэрлэгдэхгүй
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [costPrice, setCostPrice] = useState(initial?.costPrice ?? "");
  const [stock, setStock] = useState(initial?.stock ?? "0");
  const [durationValue, setDurationValue] = useState(
    initial?.durationValue ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const fe = state?.fieldErrors ?? {};
  const isGoods = type === "GOODS";
  const isLabor = type === "LABOR";

  const backHref = `/dashboard/services/${SERVICE_KIND_SLUG[type]}`;

  const visibleCategories = laborCategories.filter(
    (c) => c.isActive || c.id === initial?.laborCategoryId,
  );
  const hasAnyCategory = laborCategories.length > 0;

  const visibleUnits = (selectedId: string | null | undefined) =>
    units.filter((u) => u.isActive || u.id === selectedId);
  const hasAnyUnit = units.length > 0;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormError message={state?.message} />

      <Field label="Төрөл" htmlFor="type" error={fe.type}>
        {isEdit || fixedType ? (
          <>
            <input type="hidden" name="type" value={type} />
            <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 max-w-lg">
              {SERVICE_KIND_LABEL[type]}
              <span className="text-white/30 ml-2">
                · {SERVICE_KIND_DESCRIPTION[type]}
              </span>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-3xl">
            {SERVICE_KINDS.map((k) => (
              <label
                key={k}
                className={`flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === k
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="type"
                    value={k}
                    checked={type === k}
                    onChange={() => setType(k)}
                    className="accent-violet-500"
                  />
                  <span className="text-sm font-medium text-white/90">
                    {SERVICE_KIND_LABEL[k]}
                  </span>
                </div>
                <span className="text-xs text-white/40 pl-6">
                  {SERVICE_KIND_DESCRIPTION[k]}
                </span>
              </label>
            ))}
          </div>
        )}
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLabor ? (
          <Field
            label="Ажлын ангилал"
            htmlFor="laborCategoryId"
            error={fe.laborCategoryId}
            hint={
              hasAnyCategory
                ? undefined
                : "Тохиргоо → Системийн → Ажлын ангилалд бүртгээрэй."
            }
            className={FIELD_MW}
          >
            <Select
              id="laborCategoryId"
              name="laborCategoryId"
              required
              value={laborCategoryId}
              onChange={setLaborCategoryId}
              error={fe.laborCategoryId}
              placeholder={
                hasAnyCategory ? "— Ангилал —" : "Ангилал бүртгэгдээгүй"
              }
              options={visibleCategories.map((c) => ({
                value: c.id,
                label: `${c.name}${c.isActive ? "" : " (идэвхгүй)"}`,
              }))}
            />
          </Field>
        ) : null}

        <Field label="Нэр" htmlFor="name" error={fe.name} className={FIELD_MW}>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`compact-input ${fe.name ? "border-red-500/50" : ""}`}
            placeholder={
              isGoods
                ? "Жишээ: 5W-30 моторын тос"
                : type === "DIAGNOSTIC"
                  ? "Жишээ: Компьютерийн оношилгоо"
                  : "Жишээ: Тосны солилт"
            }
          />
        </Field>
        <Field
          label={isGoods ? "SKU / код" : "Код"}
          htmlFor="code"
          hint="заавал биш"
          error={fe.code}
          className={FIELD_MW}
        >
          <input
            id="code"
            name="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`compact-input uppercase ${fe.code ? "border-red-500/50" : ""}`}
            placeholder={isGoods ? "OIL-5W30" : "LAB-OIL"}
          />
        </Field>

        <Field
          label="Хэмжих нэгж"
          htmlFor="unitId"
          error={fe.unitId}
          hint={
            hasAnyUnit
              ? undefined
              : "Тохиргоо → Хэмжих нэгжүүдэд бүртгээрэй."
          }
          className={FIELD_MW}
        >
          <Select
            id="unitId"
            name="unitId"
            required
            value={unitId}
            onChange={setUnitId}
            error={fe.unitId}
            placeholder={hasAnyUnit ? "— Нэгж —" : "Бүртгэгдээгүй"}
            options={visibleUnits(initial?.unitId).map((u) => ({
              value: u.id,
              label: `${u.name}${u.code ? ` (${u.code})` : ""}${u.isActive ? "" : " — идэвхгүй"}`,
            }))}
          />
        </Field>
        <Field
          label={isGoods ? "Борлуулах үнэ (₮)" : "Үнэ (₮)"}
          htmlFor="price"
          error={fe.price}
          className={FIELD_MW}
        >
          <input
            id="price"
            name="price"
            type="text"
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`compact-input ${fe.price ? "border-red-500/50" : ""}`}
            placeholder="45000"
          />
        </Field>

        {isGoods ? (
          <>
            <Field
              label="Өртөг үнэ (₮)"
              htmlFor="costPrice"
              hint="заавал биш"
              error={fe.costPrice}
              className={FIELD_MW}
            >
              <input
                id="costPrice"
                name="costPrice"
                type="text"
                inputMode="decimal"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className={`compact-input ${fe.costPrice ? "border-red-500/50" : ""}`}
                placeholder="32000"
              />
            </Field>
            {!isEdit ? (
              <Field
                label="Эхний үлдэгдэл"
                htmlFor="stock"
                hint="Дараа орлого/зарлагаар тохируулна"
                error={fe.stock}
                className={FIELD_MW}
              >
                <input
                  id="stock"
                  name="stock"
                  type="text"
                  inputMode="decimal"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className={`compact-input ${fe.stock ? "border-red-500/50" : ""}`}
                  placeholder="0"
                />
              </Field>
            ) : (
              <input type="hidden" name="stock" value={initial?.stock ?? "0"} />
            )}
          </>
        ) : (
          <>
            <Field
              label="Хугацаа"
              htmlFor="durationValue"
              hint="товлогоонд хэрэг болно"
              error={fe.durationValue}
              className={FIELD_MW}
            >
              <input
                id="durationValue"
                name="durationValue"
                type="text"
                inputMode="decimal"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className={`compact-input ${fe.durationValue ? "border-red-500/50" : ""}`}
                placeholder="1.5"
              />
            </Field>
            <Field
              label="Хугацааны нэгж"
              htmlFor="durationUnitId"
              error={fe.durationUnitId}
              className={FIELD_MW}
            >
              <Select
                id="durationUnitId"
                name="durationUnitId"
                value={durationUnitId}
                onChange={setDurationUnitId}
                error={fe.durationUnitId}
                placeholder="— Нэгжгүй —"
                options={visibleUnits(initial?.durationUnitId).map((u) => ({
                  value: u.id,
                  label: `${u.name}${u.code ? ` (${u.code})` : ""}${u.isActive ? "" : " — идэвхгүй"}`,
                }))}
              />
            </Field>
          </>
        )}
      </div>

      <Field label="Тайлбар" htmlFor="description" hint="заавал биш" className="max-w-2xl">
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="compact-input resize-none"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="accent-violet-500"
        />
        Идэвхтэй (захиалга дээр сонгох боломжтой)
      </label>

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href={backHref}
          className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all px-5 py-2 rounded-lg font-medium text-sm text-white/60 text-center"
        >
          ← Буцах
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all px-6 py-2 rounded-lg font-medium text-sm"
        >
          {pending ? "..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </button>
      </div>
    </form>
  );
}
