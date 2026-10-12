import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function AccessDenied() {
    const t = useTranslations("AccessDenied");
    return (
        <Empty className="min-h-[60vh]">
            <EmptyMedia>
                <ShieldAlert />
            </EmptyMedia>
            <EmptyHeader>
                <EmptyTitle>{t("title")}</EmptyTitle>
                <EmptyDescription>{t("body")}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
