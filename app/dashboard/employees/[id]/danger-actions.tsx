"use client";

import {
  deleteEmployeeAndReturnAction,
  resetEmployeePasswordAction,
} from "@/app/_actions/employees";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn } from "@/app/_components/landing-ops-ui";

export function ResetPasswordButton({ employeeId }: { employeeId: string }) {
  return (
    <ConfirmForm
      action={resetEmployeePasswordAction}
      message="Энэ ажилтны нууц үгийг хүчингүй болгох уу? Дараагийн удаа нэвтрэхдээ утсанд ирэх кодоор шинэ нууц үг үүсгэнэ."
    >
      <input type="hidden" name="id" value={employeeId} />
      <Btn type="submit" variant="ghost">
        Нууц үг шинэчлэх
      </Btn>
    </ConfirmForm>
  );
}

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  return (
    <ConfirmForm
      action={deleteEmployeeAndReturnAction}
      message={`"${employeeName}" ажилтныг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`}
    >
      <input type="hidden" name="id" value={employeeId} />
      <Btn type="submit" variant="danger" className="w-full">
        Ажилтныг устгах
      </Btn>
    </ConfirmForm>
  );
}
