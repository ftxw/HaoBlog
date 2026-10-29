"use client";


import { useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { runAction } from "@/components/admin/lib";
import { changePasswordAction } from "@/app/actions/auth";
import {
  Button,
  Sheet,
  SheetHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/admin/ui";

export default function AdminAccountPage() {
  const { addToast } = useToast();
  const [pwd, setPwd] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  const handleChangePassword = async () => {
    if (!pwd.oldPassword || !pwd.newPassword) {
      addToast("warning", "请填写旧密码和新密码");
      return;
    }
    if (pwd.newPassword.length < 6) {
      addToast("warning", "新密码长度不能少于 6 位");
      return;
    }
    if (pwd.newPassword !== pwd.confirm) {
      addToast("warning", "两次输入的新密码不一致");
      return;
    }
    setPwdSaving(true);
    try {
      await runAction(
        changePasswordAction(pwd.oldPassword, pwd.newPassword)
      );
      addToast("success", "密码修改成功");
      setPwd({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "修改失败");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="账号设置" description="修改登录密码" />

      <Sheet className="max-w-xl">
        <SheetHeader title="修改密码" description="修改后需使用新密码重新登录" />
        <div className="space-y-4 p-5">
          <Field label="旧密码" required>
            <Input
              type="password"
              value={pwd.oldPassword}
              onChange={(e) => setPwd({ ...pwd, oldPassword: e.target.value })}
              autoComplete="current-password"
            />
          </Field>
          <Field label="新密码" required hint="至少 6 位">
            <Input
              type="password"
              value={pwd.newPassword}
              onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
              autoComplete="new-password"
            />
          </Field>
          <Field label="确认新密码" required>
            <Input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              autoComplete="new-password"
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} loading={pwdSaving}>
              修改密码
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
