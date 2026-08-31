"use client";

import { deleteRoleAction } from "@/app/_actions/roles";
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
    <form
      action={deleteRoleAction}
      onSubmit={(e) => {
        if (!window.confirm(`"${roleName}" үүргийг устгах уу?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={roleId} />
      <Btn type="submit" variant="danger" disabled={!canDelete}>
        Үүрэг устгах
      </Btn>
    </form>
  );
}
