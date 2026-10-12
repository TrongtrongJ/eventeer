"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { toast } from "sonner";

export type ToastType = "success" | "error" | "info";

interface ToastContextValue {
    addToast: (toast: { message: string; type: ToastType }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Thin adapter over Sonner so existing `addToast({ message, type })` call sites keep working.
 * Rendering is done by <Toaster /> (see components/ToastContainer).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const addToast = useCallback(({ message, type }: { message: string; type: ToastType }) => {
        toast[type](message);
    }, []);

    const value = useMemo(() => ({ addToast }), [addToast]);

    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within a ToastProvider");
    return ctx;
}
