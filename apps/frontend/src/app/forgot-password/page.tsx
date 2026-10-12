"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

export default function ForgotPasswordPage() {
    const { addToast } = useToast();
    const t = useTranslations("ForgotPassword");
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const forgotPasswordMutation = useMutation(orpc.auth.forgotPassword.mutationOptions());

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            try {
                await forgotPasswordMutation.mutateAsync({ email });
                setSubmitted(true);
                addToast({ message: t("sentToast"), type: "success" });
            } catch (error: any) {
                addToast({ message: error?.message || t("failed"), type: "error" });
            }
        },
        [email, forgotPasswordMutation, addToast, t],
    );

    if (submitted) {
        return (
            <AuthLayout
                title={t("sentTitle")}
                description={t.rich("sentBody", { email, strong: chunks => <strong className="text-foreground">{chunks}</strong> })}
            >
                <div className="flex flex-col items-center gap-5">
                    <span className="grid size-10 place-items-center rounded-full bg-success/15 text-success">
                        <MailCheck className="size-5" />
                    </span>
                    <Button asChild variant="outline" className="w-full">
                        <Link href="/login">{t("backToLogin")}</Link>
                    </Button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title={t("title")} description={t("intro")}>
            <form className="space-y-4" onSubmit={handleSubmit}>
                <Field>
                    <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                    <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t("emailPlaceholder")}
                    />
                </Field>

                <Button type="submit" size="lg" disabled={forgotPasswordMutation.isPending} className="w-full">
                    {forgotPasswordMutation.isPending && <Spinner />}
                    {forgotPasswordMutation.isPending ? t("submitting") : t("submit")}
                </Button>

                <div className="text-center">
                    <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
                        {t("backToLogin")}
                    </Link>
                </div>
            </form>
        </AuthLayout>
    );
}
