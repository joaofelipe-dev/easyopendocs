import type { Metadata } from "next";

import { SyncPanel } from "@/components/admin/sync-panel";
import { CONTENT_ROOT_RELATIVE } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Sincronização" };
export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const [logs, orphanDocuments, orphanDepartments] = await Promise.all([
    prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
    prisma.document.findMany({
      where: { isOrphan: true },
      orderBy: { updatedAt: "desc" },
      include: { department: { select: { name: true } } },
    }),
    prisma.department.findMany({
      where: { isOrphan: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true, userRoles: true } } },
    }),
  ]);

  return (
    <SyncPanel
      contentRoot={CONTENT_ROOT_RELATIVE}
      logs={logs.map((log) => ({
        id: log.id,
        trigger: log.trigger,
        startedAt: log.startedAt.toISOString(),
        durationMs: log.durationMs,
        ok: log.ok,
        error: log.error,
        departmentsCreated: log.departmentsCreated,
        departmentsUpdated: log.departmentsUpdated,
        departmentsOrphaned: log.departmentsOrphaned,
        documentsCreated: log.documentsCreated,
        documentsUpdated: log.documentsUpdated,
        documentsOrphaned: log.documentsOrphaned,
        documentsSkipped: log.documentsSkipped,
      }))}
      orphanDocuments={orphanDocuments.map((document) => ({
        id: document.id,
        title: document.title,
        filePath: document.filePath,
        departmentName: document.department.name,
        updatedAt: document.updatedAt.toISOString(),
      }))}
      orphanDepartments={orphanDepartments.map((department) => ({
        id: department.id,
        name: department.name,
        path: department.path,
        documentCount: department._count.documents,
        memberCount: department._count.userRoles,
      }))}
    />
  );
}
