import "server-only";

import { prisma } from "@/lib/prisma";
import { listReadableDepartments, type CurrentUser } from "@/lib/rbac";

export type DocumentBacklink = {
  id: string;
  sourceDocument: {
    title: string;
    slug: string;
    department: { slug: string; name: string };
  };
};

/**
 * Backlinks são conteúdo potencialmente sensível: um título de outro
 * departamento já é informação. A consulta corta na origem com a mesma lista
 * de departamentos legíveis usada pela busca, em vez de filtrar depois.
 */
export async function listDocumentBacklinks(input: {
  user: CurrentUser;
  departmentSlug: string;
  documentSlug: string;
  excludeSourceDocumentId?: string;
}): Promise<DocumentBacklink[]> {
  const readableDepartments = await listReadableDepartments(input.user);

  return prisma.documentLink.findMany({
    where: {
      targetDepartmentSlug: input.departmentSlug,
      targetDocumentSlug: input.documentSlug,
      ...(input.excludeSourceDocumentId
        ? { sourceDocumentId: { not: input.excludeSourceDocumentId } }
        : {}),
      sourceDocument: {
        isOrphan: false,
        departmentId: { in: readableDepartments.map((department) => department.id) },
      },
    },
    orderBy: { sourceDocument: { title: "asc" } },
    select: {
      id: true,
      sourceDocument: {
        select: {
          title: true,
          slug: true,
          department: { select: { slug: true, name: true } },
        },
      },
    },
  });
}

