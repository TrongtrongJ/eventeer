import { requireSession } from "@/lib/auth/require-session";
import { AccessDenied } from "@/components/AccessDenied";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
    const { session, denied } = await requireSession();
    if (denied) return <AccessDenied />;

    const user = session.user;
    if (!user) return null;

    const [t, tNav, tEnum, tProvider, format] = await Promise.all([
        getTranslations("Profile"),
        getTranslations("Nav"),
        getTranslations("Enums.role"),
        getTranslations("Enums.provider"),
        getFormatter(),
    ]);

    const fullName = `${user.firstName} ${user.lastName}`;
    const rows: { label: string; value: string }[] = [
        { label: t("accountType"), value: tEnum(user.role) },
        { label: t("loginProvider"), value: user.provider ? tProvider(user.provider) : "" },
        {
            label: t("lastLogin"),
            value: user.lastLoginAt
                ? format.dateTime(new Date(user.lastLoginAt), { dateStyle: "medium", timeStyle: "short" })
                : t("never"),
        },
        { label: t("memberSince"), value: format.dateTime(new Date(user.createdAt), { dateStyle: "medium" }) },
    ];

    return (
        <>
            <PageHeader title={tNav("profile")} />
            <PageContent width="narrow" className="space-y-8">
                <div className="flex items-center gap-4">
                    <Avatar className="size-16">
                        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={fullName} />}
                        <AvatarFallback className="text-xl">
                            {user.firstName[0]}
                            {user.lastName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1.5">
                        <h2 className="truncate text-xl font-semibold tracking-tight">{fullName}</h2>
                        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex items-center gap-2">
                            <Badge variant="primary">{tEnum(user.role)}</Badge>
                            <Badge variant={user.isEmailVerified ? "success" : "warning"}>
                                {user.isEmailVerified ? t("verified") : t("unverified")}
                            </Badge>
                        </div>
                    </div>
                </div>

                <dl className="divide-y rounded-lg border bg-card">
                    {rows.map(row => (
                        <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                            <dt className="text-muted-foreground">{row.label}</dt>
                            <dd className="font-medium">{row.value}</dd>
                        </div>
                    ))}
                </dl>
            </PageContent>
        </>
    );
}
