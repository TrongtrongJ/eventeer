"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";

/** Signs the user out, clears cached user state and sends them to /login. Shared by the account menu and ⌘K. */
export function useSignOut() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const t = useTranslations("Nav");
    const logoutMutation = useMutation(orpc.auth.logout.mutationOptions());

    return useCallback(async () => {
        try {
            await logoutMutation.mutateAsync(undefined);
        } catch (error: unknown) {
            console.error("Logout error:", error);
        } finally {
            // The backend clears the httpOnly cookies; clear our cached user state too.
            queryClient.removeQueries({ queryKey: orpc.auth.key() });
            addToast({ message: t("loggedOut"), type: "success" });
            router.push("/login");
            router.refresh();
        }
    }, [logoutMutation, queryClient, addToast, router, t]);
}
