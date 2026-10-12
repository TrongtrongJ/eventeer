"use client";

import React, { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { type ResetPasswordFormDto, ResetPasswordFormSchema } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { useTranslations } from "next-intl";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

const initialFormData: ResetPasswordFormDto = { password: "", confirmPassword: "" };

export function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addToast } = useToast();
    const t = useTranslations("ResetPassword");
    const token = searchParams.get("token") || "";

    const [formData, setFormData] = useState<ResetPasswordFormDto>(initialFormData);

    const resetPasswordMutation = useMutation(orpc.auth.resetPassword.mutationOptions());

    const validationResult = ResetPasswordFormSchema.safeParse(formData);
    const isFormValid = validationResult.success;

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            try {
                await resetPasswordMutation.mutateAsync({
                    token,
                    newPassword: formData.password,
                });
                addToast({ message: t("success"), type: "success" });
                router.push("/login");
            } catch (error: any) {
                addToast({ message: error?.message || t("failed"), type: "error" });
            }
        },
        [formData, token, resetPasswordMutation, addToast, router, t],
    );

    const isSubmitButtonDisabled = resetPasswordMutation.isPending || !isFormValid || !token;

    return (
        <AuthLayout title={t("title")} description={t("intro")}>
            <form className="space-y-4" onSubmit={handleSubmit}>
                <Field>
                    <FieldLabel htmlFor="password">{t("newPassword")}</FieldLabel>
                    <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                </Field>

                <Field>
                    <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
                    <Input
                        id="confirmPassword"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={formData.confirmPassword}
                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                </Field>

                <Button type="submit" size="lg" disabled={isSubmitButtonDisabled} className="w-full">
                    {resetPasswordMutation.isPending && <Spinner />}
                    {resetPasswordMutation.isPending ? t("submitting") : t("submit")}
                </Button>
            </form>
        </AuthLayout>
    );
}
