"use server";

import { BusinessError } from "@/app/lib/business-error";
import { runAdminAction } from "@/app/lib/action-guard";
import { changePassword } from "@/app/lib/mutations/auth";
import { getServerAuth } from "@/app/lib/server-auth";

export async function changePasswordAction(
  oldPassword: string,
  newPassword: string
) {
  return runAdminAction(async () => {
    const auth = await getServerAuth();
    if (!auth) throw new BusinessError("未登录", 401);

    await changePassword({
      token: auth.accessToken,
      email: auth.user.email,
      oldPassword,
      newPassword,
    });
    return null;
  });
}
