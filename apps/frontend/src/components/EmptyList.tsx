import React from "react";
import { useTranslations } from "next-intl";
interface EmptyListProps {
    message?: string;
    icon?: string;
    redirect?: string;
}

const EmptyList: React.FC<EmptyListProps> = ({ message, icon, redirect }) => {
    const t = useTranslations("Common");
    return <p className="text-center text-slate-500">{message || t("noItems")}</p>;
};
export default EmptyList;
