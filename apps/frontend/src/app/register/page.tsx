"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type RegisterDto, RegisterSchema } from "@packages/shared-schemas";
import { orpc } from "@/lib/orpc/query";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/lib/toast/toast-context";
import { useTranslations } from "next-intl";
import { useValidationMessage } from "@/i18n/validation";

const initialFormData: RegisterDto = {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "CUSTOMER",
};

export default function RegisterPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const { isAuthenticated } = useSession();
    const t = useTranslations("Register");
    const localizeMessage = useValidationMessage();

    const registerMutation = useMutation(orpc.auth.register.mutationOptions());

    const {
        register,
        handleSubmit,
        formState: { isValid, errors },
    } = useForm<RegisterDto>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: initialFormData,
    });

    useEffect(() => {
        if (isAuthenticated) router.replace("/");
    }, [isAuthenticated, router]);

    const onSubmit = useCallback(
        async (data: RegisterDto) => {
            try {
                await registerMutation.mutateAsync(data);
                await queryClient.invalidateQueries({ queryKey: orpc.auth.key() });
                addToast({ message: t("success"), type: "success" });
                router.push("/");
                router.refresh();
            } catch (err: any) {
                addToast({ message: err?.message || t("failed"), type: "error" });
            }
        },
        [registerMutation, queryClient, addToast, router, t],
    );

    const isCreateAccountButtonDisabled = registerMutation.isPending || !isValid;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">{t("title")}</h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {t.rich("haveAccount", {
                            link: chunks => (
                                <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                                    {chunks}
                                </Link>
                            ),
                        })}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                                    {t("firstName")}
                                </label>
                                <input
                                    id="firstName"
                                    type="text"
                                    required
                                    {...register("firstName")}
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                {errors.firstName && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {localizeMessage(errors.firstName.message)}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                                    {t("lastName")}
                                </label>
                                <input
                                    id="lastName"
                                    type="text"
                                    required
                                    {...register("lastName")}
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                                {errors.lastName && (
                                    <p className="mt-1 text-xs text-red-600">
                                        {localizeMessage(errors.lastName.message)}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                {t("accountType")}
                            </label>
                            <select
                                id="role"
                                {...register("role")}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="CUSTOMER">{t("roleCustomer")}</option>
                                <option value="ORGANIZER">{t("roleOrganizer")}</option>
                                <option value="ADMIN">{t("roleAdmin")}</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                {t("email")}
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                {...register("email")}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            {errors.email && (
                                <p className="mt-1 text-xs text-red-600">{localizeMessage(errors.email.message)}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                {t("password")}
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                minLength={8}
                                {...register("password")}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500">{t("passwordHelp")}</p>
                            {errors.password && (
                                <p className="mt-1 text-xs text-red-600">{localizeMessage(errors.password.message)}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isCreateAccountButtonDisabled}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {registerMutation.isPending ? t("submitting") : t("submit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
