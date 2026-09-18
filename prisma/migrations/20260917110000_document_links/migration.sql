CREATE TABLE "DocumentLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceDocumentId" TEXT NOT NULL,
  "targetDepartmentSlug" TEXT NOT NULL,
  "targetDocumentSlug" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentLink_sourceDocumentId_fkey"
    FOREIGN KEY ("sourceDocumentId") REFERENCES "Document" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentLink_sourceDocumentId_targetDepartmentSlug_targetDocumentSlug_key"
  ON "DocumentLink"("sourceDocumentId", "targetDepartmentSlug", "targetDocumentSlug");
CREATE INDEX "DocumentLink_targetDepartmentSlug_targetDocumentSlug_idx"
  ON "DocumentLink"("targetDepartmentSlug", "targetDocumentSlug");
