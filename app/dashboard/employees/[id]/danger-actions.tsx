"use client";

import {
  deleteEmployeeAndReturnAction,
  resetEmployeePasswordAction,
} from "@/app/_actions/employees";
import { Btn } from "@/app/_components/landing-ops-ui";

export function ResetPasswordButton({ employeeId }: { employeeId: string }) {
  return (
    <form
      action={resetEmployeePasswordAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Энэ ажилтны нууц үгийг хүчингүй болгох уу? Дараагийн удаа нэвтрэхдээ утсанд ирэх кодоор шинэ нууц үг үүсгэнэ.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={employeeId} />
      <Btn type="submit" variant="ghost">
        Нууц үг шинэчлэх
      </Btn>
    </form>
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
    <form
      action={deleteEmployeeAndReturnAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `"${employeeName}" ажилтныг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={employeeId} />
      <Btn type="submit" variant="danger" className="w-full">
        Ажилтныг устгах
      </Btn>
    </form>
  );
}
