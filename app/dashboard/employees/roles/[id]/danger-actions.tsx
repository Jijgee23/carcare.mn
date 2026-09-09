"use client";

import { deleteRoleAction } from "@/app/_actions/roles";
import { ConfirmForm } from "@/app/_components/confirm-form";
import { Btn } from "@/app/_components/landing-ops-ui";

export function DeleteRoleButton({
  roleId,
  roleName,
  canDelete,
}: {
  roleId: string;
  roleName: string;
  canDelete: boolean;
}) {
  return (
    <ConfirmForm action={deleteRoleAction} message={`"${roleName}" үүргийг устгах уу?`}>
      <input type="hidden" name="id" value={roleId} />
      <Btn type="submit" variant="danger" disabled={!canDelete}>
        Үүрэг устгах
      </Btn>
    </ConfirmForm>
  );
}
