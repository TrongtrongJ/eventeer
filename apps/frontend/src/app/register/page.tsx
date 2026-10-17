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
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

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
        <AuthLayout
            title={t("title")}
            description={t.rich("haveAccount", {
                link: chunks => (
                    <Link
                        href="/login"
                        className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                    >
                        {chunks}
                    </Link>
                ),
            })}
        >
            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-2 gap-3">
                    <Field>
                        <FieldLabel htmlFor="firstName">{t("firstName")}</FieldLabel>
                        <Input
                            id="firstName"
                            type="text"
                            required
                            aria-invalid={!!errors.firstName}
                            {...register("firstName")}
                        />
                        <FieldError>{errors.firstName && localizeMessage(errors.firstName.message)}</FieldError>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="lastName">{t("lastName")}</FieldLabel>
                        <Input
                            id="lastName"
                            type="text"
                            required
                            aria-invalid={!!errors.lastName}
                            {...register("lastName")}
                        />
                        <FieldError>{errors.lastName && localizeMessage(errors.lastName.message)}</FieldError>
                    </Field>
                </div>

                <Field>
                    <FieldLabel htmlFor="role">{t("accountType")}</FieldLabel>
                    <NativeSelect id="role" {...register("role")}>
                        <option value="CUSTOMER">{t("roleCustomer")}</option>
                        <option value="ORGANIZER">{t("roleOrganizer")}</option>
                        <option value="ADMIN">{t("roleAdmin")}</option>
                    </NativeSelect>
                </Field>

                <Field>
                    <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                    <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        aria-invalid={!!errors.email}
                        {...register("email")}
                    />
                    <FieldError>{errors.email && localizeMessage(errors.email.message)}</FieldError>
                </Field>

                <Field>
                    <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
                    <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        aria-invalid={!!errors.password}
                        {...register("password")}
                    />
                    <FieldDescription>{t("passwordHelp")}</FieldDescription>
                    <FieldError>{errors.password && localizeMessage(errors.password.message)}</FieldError>
                </Field>

                <Button type="submit" size="lg" disabled={isCreateAccountButtonDisabled} className="w-full">
                    {registerMutation.isPending && <Spinner />}
                    {registerMutation.isPending ? t("submitting") : t("submit")}
                </Button>
            </form>
        </AuthLayout>
    );
}
