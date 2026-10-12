"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type State = "verifying" | "success" | "error";

/** Target of the link in the verification email: /verify-email?token=... */
export default function VerifyEmailPage() {
    const queryClient = useQueryClient();
    const t = useTranslations("VerifyEmail");
    const verify = useMutation(orpc.auth.verifyEmail.mutationOptions());
    const [state, setState] = useState<State>("verifying");
    const started = useRef(false); // StrictMode runs effects twice; a token is single-use

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const token = new URLSearchParams(window.location.search).get("token");
        if (!token) {
            setState("error");
            return;
        }
        verify
            .mutateAsync({ token })
            .then(() => {
                setState("success");
                return queryClient.invalidateQueries({ queryKey: orpc.auth.key() });
            })
            .catch(() => setState("error"));
    }, [verify, queryClient]);

    if (state === "verifying") {
        return (
            <AuthLayout title={t("verifying")}>
                <div className="flex justify-center text-muted-foreground">
                    <Spinner className="size-5" />
                </div>
            </AuthLayout>
        );
    }

    const ok = state === "success";
    return (
        <AuthLayout title={ok ? t("successTitle") : t("errorTitle")} description={ok ? t("successBody") : t("errorBody")}>
            <div className="flex flex-col items-center gap-5">
                {ok ? <CircleCheck className="size-8 text-success" /> : <CircleAlert className="size-8 text-destructive" />}
                <Button asChild variant={ok ? "default" : "outline"} className="w-full">
                    <Link href={ok ? "/" : "/login"}>{ok ? t("continue") : t("goToSignIn")}</Link>
                </Button>
            </div>
        </AuthLayout>
    );
}
