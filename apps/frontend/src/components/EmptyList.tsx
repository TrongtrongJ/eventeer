import React from "react";
import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { Empty, EmptyActions, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface EmptyListProps {
    message?: string;
    title?: string;
    icon?: React.ReactNode;
    /** An optional call to action, e.g. a <Button asChild><Link/></Button>. */
    action?: React.ReactNode;
}

const EmptyList: React.FC<EmptyListProps> = ({ message, title, icon, action }) => {
    const t = useTranslations("Common");
    return (
        <Empty>
            <EmptyMedia>{icon ?? <Inbox />}</EmptyMedia>
            <EmptyHeader>
                {title && <EmptyTitle>{title}</EmptyTitle>}
                <EmptyDescription>{message || t("noItems")}</EmptyDescription>
            </EmptyHeader>
            {action && <EmptyActions>{action}</EmptyActions>}
        </Empty>
    );
};
export default EmptyList;
