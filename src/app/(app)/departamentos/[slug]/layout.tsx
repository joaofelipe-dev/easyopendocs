import { DepartmentSidebar } from "@/components/department-sidebar";
import { syncContent } from "@/lib/content-sync";
import { departmentResponsibilitiesExist } from "@/lib/department-responsibilities-file";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, can, requireDepartmentAccess } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function DepartmentLayout({
  children,
  params,
}: LayoutProps<"/departamentos/[slug]">) {
  const { slug } = await params;

  // Descoberta automática também na entrada do departamento: um .html novo
  // colado na pasta aparece na barra lateral sem rebuild.
  await syncContent({ trigger: "AUTOMATIC" });

  const { access } = await requireDepartmentAccess(slug);

  const [documents, hasResponsibilities] = await Promise.all([
    prisma.document.findMany({
      where: { departmentId: access.department.id, isOrphan: false },
      select: { slug: true, title: true },
      orderBy: { title: "asc" },
    }),
    // O mapa não é indexado no banco (é um `_arquivo`, ignorado pelo sync),
    // então a existência dele vem do disco mesmo — um stat por render.
    departmentResponsibilitiesExist(access.department.slug),
  ]);

  return (
    <div className="print:block mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
      <aside className="print:hidden lg:w-64 lg:shrink-0">
        <div className="lg:sticky lg:top-20">
          <DepartmentSidebar
            departmentSlug={access.department.slug}
            departmentName={access.department.name}
            documents={documents}
            canCreate={can(access, PERMISSIONS.documentCreate)}
            hasResponsibilities={hasResponsibilities}
            canManage={can(access, PERMISSIONS.departmentManage)}
          />
        </div>
      </aside>

      <div className="print:max-w-none min-w-0 flex-1">{children}</div>
    </div>
  );
}
