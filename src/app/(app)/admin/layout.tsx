import { AdminNav } from "@/components/admin/admin-nav";
import { requireSuperAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireSuperAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Usuários, acessos por departamento, papéis e sincronização de conteúdo.
        </p>
      </header>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </div>
  );
}
