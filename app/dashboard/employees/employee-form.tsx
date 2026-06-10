"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type EmployeeActionState,
  createEmployeeAction,
  updateEmployeeAction,
} from "@/app/_actions/employees";
import { Field, FormError } from "@/app/_components/auth-shell";
import { DatePicker } from "@/app/_components/date-picker";
import { Select } from "@/app/_components/select";

type Initial = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string | null;
  branchId: string | null;
  isActive: boolean;
  activeUntil: Date | null;
};

type Branch = { id: string; name: string };
type Role = { id: string; name: string };

export function EmployeeForm({
  initial,
  branches,
  roles,
}: {
  initial?: Initial;
  branches: Branch[];
  roles: Role[];
}) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateEmployeeAction.bind(null, initial!.id!)
    : createEmployeeAction;

  const [state, formAction, pending] = useActionState<
    EmployeeActionState,
    FormData
  >(action, null);

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [roleId, setRoleId] = useState(initial?.roleId ?? "");
  const [branchId, setBranchId] = useState(initial?.branchId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [activeUntil, setActiveUntil] = useState(
    initial?.activeUntil
      ? new Date(initial.activeUntil.getTime() - initial.activeUntil.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10)
      : "",
  );

  const fe = state?.fieldErrors ?? {};
  const fieldMaxWidth = "max-w-xs";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormError message={state?.message} />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Field label="Овог" htmlFor="lastName" error={fe.lastName} className={fieldMaxWidth}>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={`compact-input ${fe.lastName ? "border-red-500/50" : ""}`}
            placeholder="Батын"
          />
        </Field>
        <Field label="Нэр" htmlFor="firstName" error={fe.firstName} className={fieldMaxWidth}>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={`compact-input ${fe.firstName ? "border-red-500/50" : ""}`}
            placeholder="Болд"
          />
        </Field>
        <Field label="Имэйл" htmlFor="email" error={fe.email} className={fieldMaxWidth}>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`compact-input ${fe.email ? "border-red-500/50" : ""}`}
            placeholder="bold@gmail.com"
          />
        </Field>
        <Field label="Утас" htmlFor="phone" error={fe.phone} className={fieldMaxWidth}>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={8}
            pattern="[0-9]{8}"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D+/g, ""))}
            className={`compact-input ${fe.phone ? "border-red-500/50" : ""}`}
            placeholder="99000000"
          />
        </Field>
        <Field
          label="Үүрэг"
          htmlFor="roleId"
          error={fe.roleId}
          hint={
            roles.length === 0
              ? "Үүрэг үүсээгүй. Эхлээд үүрэг үүсгэнэ үү."
              : undefined
          }
          className={fieldMaxWidth}
        >
          <Select
            id="roleId"
            name="roleId"
            required
            value={roleId}
            onChange={setRoleId}
            error={fe.roleId}
            placeholder="— Үүрэг сонгох —"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
          />
        </Field>
        <Field label="Салбар" htmlFor="branchId" error={fe.branchId} className={fieldMaxWidth}>
          <Select
            id="branchId"
            name="branchId"
            value={branchId}
            onChange={setBranchId}
            placeholder="— Салбар —"
            error={fe.branchId}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
        <Field
          label="Ажиллах хүртэлх огноо"
          htmlFor="activeUntil"
          hint="Түр ажилтан бол огноо. Хоосон бол байнгын."
          error={fe.activeUntil}
          className={fieldMaxWidth}
        >
          <DatePicker
            id="activeUntil"
            name="activeUntil"
            value={activeUntil}
            onChange={setActiveUntil}
            error={Boolean(fe.activeUntil)}
          />
        </Field>
      </div>

      {!isEdit ? (
        <div className="max-w-md text-xs text-white/45 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 leading-relaxed">
          Нууц үгийг та тавихгүй. Ажилтан анх удаа нэвтрэхдээ нэвтрэх хуудасны
          «Анх удаа нэвтрэх» хэсгээр имэйлээ оруулж, утсандаа ирэх кодоор
          баталгаажуулан өөрийн нууц үгээ үүсгэнэ.
        </div>
      ) : null}

      <label className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] max-w-md">
        <input
          type="checkbox"
          name="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          value="on"
          className="mt-0.5 accent-violet-500"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-white/90">Идэвхтэй</div>
          <div className="text-xs text-white/40 mt-0.5">
            Идэвхгүй ажилтан нэвтэрч чадахгүй. Бичлэг нь хадгалагдана.
          </div>
        </div>
      </label>
      {!isActive ? (
        <input type="hidden" name="isActive" value="off" />
      ) : null}

      <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
        <Link
          href="/dashboard/employees"
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
