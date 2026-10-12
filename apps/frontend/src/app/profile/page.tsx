import { requireSession } from "@/lib/auth/require-session";
import { AccessDenied } from "@/components/AccessDenied";
import { getFormatter, getTranslations } from "next-intl/server";

export default async function ProfilePage() {
    const { session, denied } = await requireSession();
    if (denied) return <AccessDenied />;

    const user = session.user;
    if (!user) return null;

    const [t, tEnum, tProvider, format] = await Promise.all([
        getTranslations("Profile"),
        getTranslations("Enums.role"),
        getTranslations("Enums.provider"),
        getFormatter(),
    ]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <div className="flex items-center space-x-5">
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={`${user.firstName} ${user.lastName}`}
                                className="h-20 w-20 rounded-full"
                            />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center">
                                <span className="text-white text-2xl font-medium">
                                    {user.firstName[0]}
                                    {user.lastName[0]}
                                </span>
                            </div>
                        )}

                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {user.firstName} {user.lastName}
                            </h1>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <div className="mt-1 flex items-center space-x-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                    {tEnum(user.role)}
                                </span>
                                {user.isEmailVerified ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {t("verified")}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        {t("unverified")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-medium text-gray-500">{t("accountType")}</h3>
                            <p className="mt-1 text-sm text-gray-900">{tEnum(user.role)}</p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-500">{t("loginProvider")}</h3>
                            <p className="mt-1 text-sm text-gray-900">
                                {user.provider ? tProvider(user.provider) : ""}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-500">{t("lastLogin")}</h3>
                            <p className="mt-1 text-sm text-gray-900">
                                {user.lastLoginAt
                                    ? format.dateTime(new Date(user.lastLoginAt), {
                                          dateStyle: "medium",
                                          timeStyle: "short",
                                      })
                                    : t("never")}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-500">{t("memberSince")}</h3>
                            <p className="mt-1 text-sm text-gray-900">
                                {format.dateTime(new Date(user.createdAt), { dateStyle: "medium" })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
