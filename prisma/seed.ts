import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

import { contentRoot } from "@/lib/content";
import { syncContent } from "@/lib/content-sync";
import { DEFAULT_ROLE_NAME } from "@/lib/permissions";
import { assignRole, seedPermissionsAndRoles, upsertUser } from "@/lib/rbac-seed";
import { prisma } from "@/lib/prisma";
import { TUTORIAL_DOCUMENT_SLUG, buildTutorialDocument } from "@/lib/tutorial-content";

// ---------------------------------------------------------------------------
// Departamentos de exemplo. São os mesmos que o repositório traz em
// `content/departamentos/` — se a pasta não existir (conteúdo apagado para dar
// lugar ao seu, por exemplo), criamos o `_departamento.json` para o sync
// conseguir indexar e os usuários abaixo terem onde receber papel.
//
// Ao adotar o portal, troque esta lista pelos seus departamentos — ou esvazie-a
// e crie tudo por `/admin/departamentos`.
// ---------------------------------------------------------------------------

const EXAMPLE_DEPARTMENTS: { slug: string; name: string }[] = [
  { slug: "engenharia", name: "Engenharia" },
  { slug: "recursos-humanos", name: "Recursos Humanos" },
];

async function ensureDepartmentFolders(): Promise<void> {
  const root = contentRoot();

  for (const department of EXAMPLE_DEPARTMENTS) {
    const dir = path.join(root, department.slug);
    await fs.mkdir(dir, { recursive: true });

    const metaPath = path.join(dir, "_departamento.json");
    await writeIfMissing(metaPath, `${JSON.stringify({ name: department.name }, null, 2)}\n`);

    const tutorialPath = path.join(dir, `${TUTORIAL_DOCUMENT_SLUG}.html`);
    await writeIfMissing(tutorialPath, buildTutorialDocument());
  }
}

async function writeIfMissing(filePath: string, contents: string): Promise<void> {
  try {
    await fs.writeFile(filePath, contents, { flag: "wx", encoding: "utf8" });
    console.log(`   + ${path.relative(process.cwd(), filePath)}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    console.log(`   = ${path.relative(process.cwd(), filePath)} (já existia)`);
  }
}

// ---------------------------------------------------------------------------
// Usuários de exemplo, um por combinação de acesso que vale a pena conseguir
// testar logo depois de instalar: quem edita, quem só administra um
// departamento e quem não tem papel nenhum (para ver a home vazia).
//
// O login não precisa ser um e-mail — qualquer identificador serve, e usar
// `nome.sobrenome` é comum em portal interno. Todos entram com troca de senha
// obrigatória no primeiro acesso.
// ---------------------------------------------------------------------------

const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD?.trim() || "teste123";

type SeedUser = {
  email: string;
  name: string;
  roles: { department: string; role: "Viewer" | "Editor" | "Department Admin" }[];
  summary: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "ana@exemplo.com",
    name: "Ana",
    roles: [
      { department: "engenharia", role: DEFAULT_ROLE_NAME },
      { department: "recursos-humanos", role: "Viewer" },
    ],
    summary: "Editor em Engenharia, Viewer em Recursos Humanos",
  },
  {
    email: "bruno@exemplo.com",
    name: "Bruno",
    roles: [{ department: "recursos-humanos", role: "Department Admin" }],
    summary: "Department Admin em Recursos Humanos",
  },
  {
    email: "carla@exemplo.com",
    name: "Carla",
    roles: [],
    summary: "sem papel nenhum — serve para testar a home vazia",
  },
];

// ---------------------------------------------------------------------------

type SeedUserResult = { email: string; password: string; summary: string };

async function main() {
  console.log("\n🌱 Seed do easyopendocs\n");

  console.log("1. Garantindo o conteúdo em content/departamentos/");
  await ensureDepartmentFolders();

  console.log("\n2. Indexando o filesystem");
  const sync = await syncContent({ trigger: "SEED", force: true });
  if (!sync.ok) throw new Error(`Sync falhou: ${sync.error}`);
  console.log(
    `   ${sync.departmentsCreated + sync.departmentsUpdated} departamento(s), ` +
      `${sync.documentsCreated + sync.documentsUpdated} documento(s) indexado(s) em ${sync.durationMs} ms`,
  );

  console.log("\n3. Permissões e papéis");
  const roleIdByName = await seedPermissionsAndRoles();
  console.log(`   ${roleIdByName.size} papel(éis) aplicados`);

  console.log("\n4. Administrador geral");

  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "admin123";
  const adminEmail = process.env.ADMIN_EMAIL?.trim() || "admin@exemplo.com";
  const adminName = process.env.ADMIN_NAME?.trim() || "Administrador";

  const created: SeedUserResult[] = [];

  await upsertUser({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    isSuperAdmin: true,
  });
  created.push({
    email: adminEmail,
    password: adminPassword,
    summary: "super admin — vê todos os departamentos e o /admin",
  });

  console.log("\n5. Usuários de exemplo");
  for (const entry of SEED_USERS) {
    const userId = await upsertUser({
      name: entry.name,
      email: entry.email,
      password: SEED_USER_PASSWORD,
      mustChangePassword: true,
    });

    for (const assignment of entry.roles) {
      const roleId = roleIdByName.get(assignment.role);
      if (!roleId) throw new Error(`Papel "${assignment.role}" não existe`);
      await assignRole(userId, assignment.department, roleId);
    }

    created.push({ email: entry.email, password: SEED_USER_PASSWORD, summary: entry.summary });
    console.log(`   • ${entry.email} — ${entry.summary}`);
  }

  console.log("\n✅ Seed concluído.\n");
  console.log("   Credenciais:");
  for (const user of created) {
    console.log(`   • ${user.email}  senha: ${user.password}`);
    console.log(`     ${user.summary}`);
  }
  console.log("\n   ⚠️  Troque essas senhas antes de qualquer uso real.\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Seed falhou:\n", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
