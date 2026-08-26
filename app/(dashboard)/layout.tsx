import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { filterNavigation } from "@/lib/navigation";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const navigation = filterNavigation(user.role);

  const unreadCount = await db.notification.count({ where: { readAt: null } });

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      navigation={navigation}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
