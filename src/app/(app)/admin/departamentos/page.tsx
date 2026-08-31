import type { Metadata } from "next";

import { DepartmentsManager } from "@/components/admin/departments-manager";
import { CONTENT_ROOT_RELATIVE } from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Departamentos" };
export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  await syncContent({ trigger: "AUTOMATIC" });

  const departments = await prisma.department.findMany({
    orderBy: [{ isOrphan: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          documents: { where: { isOrphan: false } },
          userRoles: true,
        },
      },
    },
  });

  return (
    <DepartmentsManager
      contentRoot={CONTENT_ROOT_RELATIVE}
      departments={departments.map((department) => ({
        id: department.id,
        slug: department.slug,
        name: department.name,
        description: department.description,
        path: department.path,
        isOrphan: department.isOrphan,
        documentCount: department._count.documents,
        memberCount: department._count.userRoles,
      }))}
    />
  );
}
