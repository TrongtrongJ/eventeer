"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import { useTranslations } from "next-intl";

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

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center space-y-4">
                {state === "verifying" && <p className="text-gray-600">{t("verifying")}</p>}
                {state === "success" && (
                    <>
                        <h2 className="text-2xl font-bold text-gray-900">{t("successTitle")}</h2>
                        <p className="text-gray-600">{t("successBody")}</p>
                        <Link href="/" className="inline-block text-indigo-600 font-medium hover:text-indigo-500">
                            {t("continue")}
                        </Link>
                    </>
                )}
                {state === "error" && (
                    <>
                        <h2 className="text-2xl font-bold text-gray-900">{t("errorTitle")}</h2>
                        <p className="text-gray-600">{t("errorBody")}</p>
                        <Link href="/login" className="inline-block text-indigo-600 font-medium hover:text-indigo-500">
                            {t("goToSignIn")}
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
