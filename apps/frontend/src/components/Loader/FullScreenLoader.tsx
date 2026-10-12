import React from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";

interface LoaderProps {
    message?: string;
}

const FullScreenLoader: React.FC<LoaderProps> = ({ message }) => {
    const t = useTranslations("Common");
    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
            <Spinner className="size-5 text-primary" />
            <p className="text-sm text-muted-foreground">{message || t("loading")}</p>
        </div>
    );
};

export default FullScreenLoader;
