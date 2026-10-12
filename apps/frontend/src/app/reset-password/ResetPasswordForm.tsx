"use client";

import React, { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { type ResetPasswordFormDto, ResetPasswordFormSchema } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { useTranslations } from "next-intl";

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{t("title")}</h2>
                    <p className="mt-2 text-center text-sm text-gray-600">{t("intro")}</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                {t("newPassword")}
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                minLength={8}
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                {t("confirmPassword")}
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                required
                                minLength={8}
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitButtonDisabled}
                            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {resetPasswordMutation.isPending ? t("submitting") : t("submit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
