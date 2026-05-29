"use client";

import { useActionState, useState } from "react";
import {
  type OrderActionState,
  addOrderItemAction,
} from "@/app/_actions/orders";
import { FormError } from "@/app/_components/auth-shell";
import { Select } from "@/app/_components/select";
import {
  SERVICE_KIND_LABEL,
  type ServiceKind,
} from "@/lib/services";

export type ServiceOption = {
  id: string;
  type: ServiceKind;
  name: string;
  code: string | null;
  unit: string;
  price: string;
  stock: string | null;
};

export type DiagnosticTemplateOption = {
  id: string;
  name: string;
  price: string;
  durationMin: number | null;
};

type Mode = "catalog" | "custom";

export function AddItemForm({
  orderId,
  services,
  diagnosticTemplates,
}: {
  orderId: string;
  services: ServiceOption[];
  diagnosticTemplates: DiagnosticTemplateOption[];
}) {
  const action = addOrderItemAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(action, null);

  const successKey = state?.ok ? "ok" : "idle";
  return (
    <FormContent
      key={successKey}
      formAction={formAction}
      pending={pending}
      state={state}
      services={services}
      diagnosticTemplates={diagnosticTemplates}
    />
  );
}

function FormContent({
  formAction,
  pending,
  state,
  services,
  diagnosticTemplates,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: OrderActionState;
  services: ServiceOption[];
  diagnosticTemplates: DiagnosticTemplateOption[];
}) {
  const hasCatalog = services.length > 0 || diagnosticTemplates.length > 0;
  const [mode, setMode] = useState<Mode>(hasCatalog ? "catalog" : "custom");
  const [pick, setPick] = useState<string>("");
  const [kind, setKind] = useState<string>("LABOR");
  const [description, setDescription] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("");

  function onCatalogChange(token: string) {
    setPick(token);
    if (!token) return;
    if (token.startsWith("svc:")) {
      const id = token.slice(4);
      const svc = services.find((s) => s.id === id);
      if (!svc) return;
      setDescription(svc.code ? `${svc.name} (${svc.code})` : svc.name);
      setUnitPrice(svc.price);
    } else if (token.startsWith("tpl:")) {
      const id = token.slice(4);
      const tpl = diagnosticTemplates.find((t) => t.id === id);
      if (!tpl) return;
      setDescription(tpl.name);
      setUnitPrice(tpl.price);
    }
  }

  const serviceId = pick.startsWith("svc:") ? pick.slice(4) : "";
  const diagnosticTemplateId = pick.startsWith("tpl:") ? pick.slice(4) : "";

  // Каталогын бүх сонголтыг нэгдсэн жагсаалт болгоно (Select нь optgroup-гүй).
  // Оношилгоог дээр гаргаснаар олон үйлчилгээтэй үед доош scroll-уулахгүйгээр шууд харагдана.
  const catalogOptions = [
    ...diagnosticTemplates.map((t) => ({
      value: `tpl:${t.id}`,
      label: `🔬 ${t.name}`,
      hint: `Оношилгоо · ${t.price}₮${t.durationMin ? ` · ${t.durationMin}мин` : ""}`,
    })),
    ...services.map((s) => ({
      value: `svc:${s.id}`,
      label: `${s.name}${s.code ? ` · ${s.code}` : ""}`,
      hint: `${SERVICE_KIND_LABEL[s.type]}${s.stock != null ? ` · ${s.stock} ${s.unit}` : ""} · ${s.price}₮`,
    })),
  ];

  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      <div className="flex items-center gap-1 self-start p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs">
        <button
          type="button"
          onClick={() => setMode("catalog")}
          disabled={!hasCatalog}
          className={`px-3 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === "catalog"
              ? "bg-violet-600/30 text-violet-200"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          Каталогоос
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("custom");
            setPick("");
          }}
          className={`px-3 py-1 rounded-md transition-colors ${
            mode === "custom"
              ? "bg-violet-600/30 text-violet-200"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          Гараар оруулах
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        {mode === "catalog" ? (
          <div className="sm:col-span-7">
            <input type="hidden" name="serviceId" value={serviceId} />
            <input
              type="hidden"
              name="diagnosticTemplateId"
              value={diagnosticTemplateId}
            />
            <Select
              name="catalogPick"
              value={pick}
              onChange={onCatalogChange}
              placeholder="— Сонгох —"
              options={catalogOptions}
            />
            {fe.serviceId ? (
              <p className="mt-1 text-xs text-red-400">{fe.serviceId}</p>
            ) : null}
            {fe.diagnosticTemplateId ? (
              <p className="mt-1 text-xs text-red-400">
                {fe.diagnosticTemplateId}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="sm:col-span-2">
              <Select
                name="kind"
                required
                value={kind}
                onChange={setKind}
                error={fe.kind}
                options={[
                  { value: "LABOR", label: "Ажил" },
                  { value: "DIAGNOSTIC", label: "Оношилгоо" },
                  { value: "PART", label: "Сэлбэг" },
                  { value: "FEE", label: "Хураамж" },
                ]}
              />
            </div>
            <div className="sm:col-span-5">
              <input
                name="description"
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Нэр (жишээ: Тосны солилт)"
                className={`compact-input ${fe.description ? "border-red-500/50" : ""}`}
              />
              {fe.description ? (
                <p className="mt-1 text-xs text-red-400">{fe.description}</p>
              ) : null}
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <input
            name="quantity"
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Тоо"
            className={`compact-input ${fe.quantity ? "border-red-500/50" : ""}`}
          />
          {fe.quantity ? (
            <p className="mt-1 text-xs text-red-400">{fe.quantity}</p>
          ) : null}
        </div>

        <div className="sm:col-span-3">
          <input
            name="unitPrice"
            type="text"
            inputMode="decimal"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="Нэгж үнэ (₮)"
            className={`compact-input ${fe.unitPrice ? "border-red-500/50" : ""}`}
          />
          {fe.unitPrice ? (
            <p className="mt-1 text-xs text-red-400">{fe.unitPrice}</p>
          ) : null}
        </div>
      </div>

      {/* Каталог горимд description-г hidden талбараар сервер рүү дамжуулна */}
      {mode === "catalog" ? (
        <input type="hidden" name="description" value={description} />
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-end inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition-colors px-4 py-2 rounded-lg text-sm font-medium"
      >
        {pending ? "Нэмж байна..." : "+ Мөр нэмэх"}
      </button>
    </form>
  );
}
