import { useTranslations } from "next-intl";

export function AccessDenied() {
    const t = useTranslations("AccessDenied");
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("title")}</h2>
                <p className="text-gray-600">{t("body")}</p>
            </div>
        </div>
    );
}
