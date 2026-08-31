"use client";

import { useActionState, useMemo, useState } from "react";
import {
  type OrderActionState,
  addOrderItemAction,
} from "@/app/_actions/orders";
import { FormError } from "@/app/_components/auth-shell";
import { Btn, TabButton } from "@/app/_components/landing-ops-ui";
import { Select } from "@/app/_components/select";
import type { ServiceKind } from "@/lib/services";

export type ServiceOption = {
  id: string;
  type: ServiceKind;
  name: string;
  code: string | null;
  unit: string;
  price: string;
  stock: string | null;
  laborCategoryId: string | null;
  laborCategoryName: string | null;
};

export type DiagnosticTemplateOption = {
  id: string;
  name: string;
  price: string;
  durationMin: number | null;
};

type Tab = "labor" | "diagnostic" | "part" | "custom";

const TAB_LABEL: Record<Tab, string> = {
  labor: "Ажил",
  diagnostic: "Оношилгоо",
  part: "Сэлбэг",
  custom: "Гараар оруулах",
};

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

  // Амжилттай нэмсний дараа формыг шинэчилнэ (key солигдоно).
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
  const laborServices = useMemo(
    () => services.filter((s) => s.type === "LABOR"),
    [services],
  );
  const partServices = useMemo(
    () => services.filter((s) => s.type === "GOODS"),
    [services],
  );

  const hasLabor = laborServices.length > 0;
  const hasDiag = diagnosticTemplates.length > 0;
  const hasPart = partServices.length > 0;

  const initialTab: Tab = hasLabor
    ? "labor"
    : hasDiag
      ? "diagnostic"
      : hasPart
        ? "part"
        : "custom";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [serviceId, setServiceId] = useState("");
  const [diagnosticTemplateId, setDiagnosticTemplateId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [kind, setKind] = useState("LABOR");
  const [laborCat, setLaborCat] = useState("");

  function switchTab(next: Tab) {
    setTab(next);
    setServiceId("");
    setDiagnosticTemplateId("");
    setDescription("");
    setUnitPrice("");
  }

  function pickService(id: string) {
    setServiceId(id);
    setDiagnosticTemplateId("");
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setDescription(svc.code ? `${svc.name} (${svc.code})` : svc.name);
      setUnitPrice(svc.price);
    }
  }

  function pickTemplate(id: string) {
    setDiagnosticTemplateId(id);
    setServiceId("");
    const tpl = diagnosticTemplates.find((t) => t.id === id);
    if (tpl) {
      setDescription(tpl.name);
      setUnitPrice(tpl.price);
    }
  }

  // Ажлын ангилалууд — зөвхөн ажил үйлчилгээ дээр байгаа ангиллууд.
  const laborCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of laborServices) {
      if (s.laborCategoryId && s.laborCategoryName) {
        map.set(s.laborCategoryId, s.laborCategoryName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [laborServices]);

  const filteredLabor = laborCat
    ? laborServices.filter((s) => s.laborCategoryId === laborCat)
    : laborServices;

  const fe = state?.fieldErrors ?? {};

  const canSubmit =
    tab === "custom"
      ? description.trim().length > 0
      : tab === "diagnostic"
        ? Boolean(diagnosticTemplateId)
        : Boolean(serviceId);

  const TABS: Tab[] = ["labor", "diagnostic", "part", "custom"];
  const tabEnabled: Record<Tab, boolean> = {
    labor: hasLabor,
    diagnostic: hasDiag,
    part: hasPart,
    custom: true,
  };

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <FormError
        message={state?.message && !state.ok ? state.message : undefined}
      />

      {/* Табууд */}
      <div className="flex flex-wrap items-center gap-1 self-start">
        {TABS.map((t) => (
          <TabButton
            key={t}
            active={tab === t}
            onClick={() => switchTab(t)}
            disabled={!tabEnabled[t]}
          >
            {TAB_LABEL[t]}
          </TabButton>
        ))}
      </div>

      {/* Always-present hidden fields for the server action */}
      <input type="hidden" name="serviceId" value={serviceId} />
      <input
        type="hidden"
        name="diagnosticTemplateId"
        value={diagnosticTemplateId}
      />
      {tab !== "custom" ? (
        <input type="hidden" name="description" value={description} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-12">
        {tab === "labor" ? (
          <>
            <div className="sm:col-span-4">
              <Select
                name="laborCategoryFilter"
                value={laborCat}
                onChange={(v) => {
                  setLaborCat(v);
                  setServiceId("");
                  setDescription("");
                  setUnitPrice("");
                }}
                placeholder="Бүх ангилал"
                options={laborCategories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
              />
            </div>
            <div className="sm:col-span-3">
              <Select
                name="laborPick"
                value={serviceId}
                onChange={pickService}
                placeholder="— Ажил сонгох —"
                options={filteredLabor.map((s) => ({
                  value: s.id,
                  label: s.name,
                  hint: `${s.laborCategoryName ?? "Ангилалгүй"} · ${s.price}₮`,
                }))}
              />
              {fe.serviceId ? (
                <p className="mt-1 text-xs text-red-400 light:text-red-600">{fe.serviceId}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === "diagnostic" ? (
          <div className="sm:col-span-7">
            <Select
              name="diagnosticPick"
              value={diagnosticTemplateId}
              onChange={pickTemplate}
              placeholder="— Оношилгоо сонгох —"
              options={diagnosticTemplates.map((t) => ({
                value: t.id,
                label: t.name,
                hint: `${t.price}₮${t.durationMin ? ` · ${t.durationMin}мин` : ""}`,
              }))}
            />
            {fe.diagnosticTemplateId ? (
              <p className="mt-1 text-xs text-red-400 light:text-red-600">
                {fe.diagnosticTemplateId}
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "part" ? (
          <div className="sm:col-span-7">
            <Select
              name="partPick"
              value={serviceId}
              onChange={pickService}
              placeholder="— Сэлбэг сонгох —"
              options={partServices.map((s) => ({
                value: s.id,
                label: `${s.name}${s.code ? ` · ${s.code}` : ""}`,
                hint: `${s.stock != null ? `${s.stock} ${s.unit} · ` : ""}${s.price}₮`,
              }))}
            />
            {fe.serviceId ? (
              <p className="mt-1 text-xs text-red-400 light:text-red-600">{fe.serviceId}</p>
            ) : null}
          </div>
        ) : null}

        {tab === "custom" ? (
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
                className={`auth-input ${fe.description ? "border-red-500/50" : ""}`}
              />
              {fe.description ? (
                <p className="mt-1 text-xs text-red-400 light:text-red-600">{fe.description}</p>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <input
            name="quantity"
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Тоо"
            className={`auth-input ${fe.quantity ? "border-red-500/50" : ""}`}
          />
          {fe.quantity ? (
            <p className="mt-1 text-xs text-red-400 light:text-red-600">{fe.quantity}</p>
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
            className={`auth-input ${fe.unitPrice ? "border-red-500/50" : ""}`}
          />
          {fe.unitPrice ? (
            <p className="mt-1 text-xs text-red-400 light:text-red-600">{fe.unitPrice}</p>
          ) : null}
        </div>
      </div>

      <Btn type="submit" disabled={pending || !canSubmit} size="sm" className="self-end">
        {pending ? "Нэмж байна..." : "+ Мөр нэмэх"}
      </Btn>
    </form>
  );
}
