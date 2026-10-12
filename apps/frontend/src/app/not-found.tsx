import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default async function NotFound() {
    const [t, tEvent] = await Promise.all([getTranslations("NotFound"), getTranslations("EventDetails")]);

    return (
        <Empty className="min-h-[60vh]">
            <EmptyMedia>
                <FileQuestion />
            </EmptyMedia>
            <EmptyHeader>
                <EmptyTitle>{t("title")}</EmptyTitle>
                <EmptyDescription>{t("body")}</EmptyDescription>
            </EmptyHeader>
            <EmptyActions>
                <Button asChild variant="outline" size="sm">
                    <Link href="/">{tEvent("backToEvents")}</Link>
                </Button>
            </EmptyActions>
        </Empty>
    );
}
