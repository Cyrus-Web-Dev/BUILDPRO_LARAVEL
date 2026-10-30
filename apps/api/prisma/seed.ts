import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (await prisma.user.findUnique({ where: { email: 'owner@demo.com' } })) {
    console.log('Data demo sudah ada, seed dilewati. (Untuk mengulang dari nol: npx prisma migrate reset)');
    return;
  }
  const tenant = await prisma.tenant.create({ data: { name: 'PT Contoh Kontraktor' } });
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: { tenantId: tenant.id, name: 'Owner Demo', email: 'owner@demo.com', passwordHash, role: 'OWNER' },
  });
  const project = await prisma.project.create({
    data: { tenantId: tenant.id, code: 'PRJ-001', name: 'Rumah 2 Lantai - Padang', location: 'Padang' },
  });
  const items = [
    { code: 'A.1', name: 'Semen PC 50kg', category: 'MATERIAL', unit: 'sak', volume: 500, unitPrice: 70000 },
    { code: 'A.2', name: 'Besi beton D13', category: 'MATERIAL', unit: 'batang', volume: 300, unitPrice: 135000 },
    { code: 'B.1', name: 'Upah tukang pasangan', category: 'UPAH', unit: 'm2', volume: 400, unitPrice: 85000 },
  ] as const;
  const created: Record<string, string> = {};
  for (const [i, it] of items.entries()) {
    const row = await prisma.rabItem.create({
      data: { ...it, tenantId: tenant.id, projectId: project.id, budget: it.volume * it.unitPrice, sortOrder: i },
    });
    created[it.code] = row.id;
  }
  const mandor = await prisma.user.create({
    data: { tenantId: tenant.id, name: 'Mandor Demo', email: 'mandor@demo.com', passwordHash, role: 'MANDOR' },
  });
  await prisma.projectMember.create({ data: { tenantId: tenant.id, projectId: project.id, userId: mandor.id } });
  await prisma.stockItem.create({
    data: { tenantId: tenant.id, projectId: project.id, name: 'Semen PC 50kg', unit: 'sak', minStock: 50, defaultRabItemId: created['A.1'] },
  });
  await prisma.stockItem.create({
    data: { tenantId: tenant.id, projectId: project.id, name: 'Besi beton D13', unit: 'batang', minStock: 30, defaultRabItemId: created['A.2'] },
  });
  console.log('Seed selesai. Login: owner@demo.com atau mandor@demo.com / password123');
}
main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
