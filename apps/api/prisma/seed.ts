import { PrismaClient, CostCategory, ProjectStatus, RabStatus, RealizationSource, RateType, RentalStatus, WorkOrderStatus, OpnameStatus, ProgressStatus, StockMovementType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Hapus data lama biar bersih (hati-hati di production!)
  console.log('Membersihkan data lama...');
  await prisma.opnameLine.deleteMany();
  await prisma.opname.deleteMany();
  await prisma.workOrderLine.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.equipmentUsage.deleteMany();
  await prisma.equipmentRental.deleteMany();
  await prisma.progressPhoto.deleteMany();
  await prisma.progressReport.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.realization.deleteMany();
  await prisma.rabItem.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // ========== TENANT ==========
  const tenant = await prisma.tenant.create({
    data: { name: 'PT Bangun Jaya Abadi' },
  });

  // ========== USERS ==========
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Budi Santoso',
      email: 'owner@demo.com',
      passwordHash,
      role: 'OWNER',
    },
  });

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Siti Rahayu',
      email: 'admin@demo.com',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const mandor1 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Joko Widodo',
      email: 'mandor@demo.com',
      passwordHash,
      role: 'MANDOR',
    },
  });

  const mandor2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Ahmad Fauzi',
      email: 'mandor2@demo.com',
      passwordHash,
      role: 'MANDOR',
    },
  });

  console.log('Users dibuat...');

  // ========== PROJECT 1: Rumah Tinggal (ONGOING) ==========
  const project1 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      code: 'PRJ-2024-001',
      name: 'Rumah Tinggal 2 Lantai - Bapak Andi',
      location: 'Jl. Melati No. 12, Padang Barat, Padang',
      clientName: 'Andi Pratama',
      startDate: new Date('2024-08-15'),
      endDate: new Date('2025-02-28'),
      status: ProjectStatus.ONGOING,
      rabStatus: RabStatus.APPROVED,
      rabApprovedAt: new Date('2024-08-10'),
    },
  });

  // ========== PROJECT 2: Ruko (PLANNING) ==========
  const project2 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      code: 'PRJ-2024-002',
      name: 'Ruko 3 Lantai - Kompleks Bandar Buat',
      location: 'Kompleks Bandar Buat Blok C, Padang',
      clientName: 'PT Surya Property',
      startDate: new Date('2025-01-10'),
      endDate: new Date('2025-09-30'),
      status: ProjectStatus.PLANNING,
      rabStatus: RabStatus.DRAFT,
    },
  });

  // ========== PROJECT 3: Renovasi (DONE) ==========
  const project3 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      code: 'PRJ-2024-003',
      name: 'Renovasi Kantor Cabang - Bank XYZ',
      location: 'Jl. Sudirman No. 45, Padang',
      clientName: 'Bank XYZ Cabang Padang',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-07-15'),
      status: ProjectStatus.DONE,
      rabStatus: RabStatus.APPROVED,
      rabApprovedAt: new Date('2024-02-20'),
    },
  });

  // Assign members
  await prisma.projectMember.createMany({
    data: [
      { tenantId: tenant.id, projectId: project1.id, userId: mandor1.id },
      { tenantId: tenant.id, projectId: project1.id, userId: mandor2.id },
      { tenantId: tenant.id, projectId: project2.id, userId: mandor1.id },
      { tenantId: tenant.id, projectId: project3.id, userId: mandor2.id },
    ],
  });

  console.log('Projects dibuat...');

  // ========== RAB PROJECT 1 (Rumah) - lengkap ==========
  const rabP1 = [
    // PEKERJAAN PERSIAPAN
    { code: 'A.1', name: 'Pembersihan lahan & urugan', category: CostCategory.LAINNYA, unit: 'm2', volume: 180, unitPrice: 25000 },
    { code: 'A.2', name: 'Papan nama proyek & pagar sementara', category: CostCategory.LAINNYA, unit: 'ls', volume: 1, unitPrice: 2500000 },
    // PEKERJAAN TANAH
    { code: 'B.1', name: 'Galian tanah pondasi', category: CostCategory.UPAH, unit: 'm3', volume: 45, unitPrice: 85000 },
    { code: 'B.2', name: 'Urugan kembali tanah', category: CostCategory.UPAH, unit: 'm3', volume: 25, unitPrice: 45000 },
    // BETON & BESI
    { code: 'C.1', name: 'Beton ready mix K-225', category: CostCategory.MATERIAL, unit: 'm3', volume: 38, unitPrice: 950000 },
    { code: 'C.2', name: 'Besi beton D10', category: CostCategory.MATERIAL, unit: 'kg', volume: 1800, unitPrice: 16000 },
    { code: 'C.3', name: 'Besi beton D13', category: CostCategory.MATERIAL, unit: 'kg', volume: 2200, unitPrice: 15800 },
    { code: 'C.4', name: 'Kawat bendrat', category: CostCategory.MATERIAL, unit: 'kg', volume: 80, unitPrice: 22000 },
    { code: 'C.5', name: 'Upah pasang beton & bekisting', category: CostCategory.UPAH, unit: 'm3', volume: 38, unitPrice: 450000 },
    // DINDING
    { code: 'D.1', name: 'Bata merah press', category: CostCategory.MATERIAL, unit: 'bh', volume: 12000, unitPrice: 950 },
    { code: 'D.2', name: 'Semen PC 50kg', category: CostCategory.MATERIAL, unit: 'sak', volume: 280, unitPrice: 72000 },
    { code: 'D.3', name: 'Pasir pasang', category: CostCategory.MATERIAL, unit: 'm3', volume: 35, unitPrice: 280000 },
    { code: 'D.4', name: 'Upah pasang bata', category: CostCategory.UPAH, unit: 'm2', volume: 420, unitPrice: 65000 },
    // PLESTER & ACI
    { code: 'E.1', name: 'Upah plester dinding', category: CostCategory.UPAH, unit: 'm2', volume: 480, unitPrice: 45000 },
    { code: 'E.2', name: 'Upah acian dinding', category: CostCategory.UPAH, unit: 'm2', volume: 480, unitPrice: 28000 },
    // ATAP
    { code: 'F.1', name: 'Rangka atap baja ringan', category: CostCategory.MATERIAL, unit: 'm2', volume: 140, unitPrice: 185000 },
    { code: 'F.2', name: 'Genteng metal pasir', category: CostCategory.MATERIAL, unit: 'm2', volume: 140, unitPrice: 95000 },
    { code: 'F.3', name: 'Upah pasang atap', category: CostCategory.UPAH, unit: 'm2', volume: 140, unitPrice: 55000 },
    // LANTAI
    { code: 'G.1', name: 'Keramik 60x60 putih', category: CostCategory.MATERIAL, unit: 'm2', volume: 160, unitPrice: 125000 },
    { code: 'G.2', name: 'Upah pasang keramik', category: CostCategory.UPAH, unit: 'm2', volume: 160, unitPrice: 75000 },
    // CAT
    { code: 'H.1', name: 'Cat tembok interior', category: CostCategory.MATERIAL, unit: 'kg', volume: 120, unitPrice: 45000 },
    { code: 'H.2', name: 'Cat tembok eksterior', category: CostCategory.MATERIAL, unit: 'kg', volume: 60, unitPrice: 85000 },
    { code: 'H.3', name: 'Upah pengecatan', category: CostCategory.UPAH, unit: 'm2', volume: 520, unitPrice: 22000 },
    // ALAT
    { code: 'I.1', name: 'Sewa excavator mini', category: CostCategory.ALAT, unit: 'hari', volume: 8, unitPrice: 850000 },
    { code: 'I.2', name: 'Sewa molen cor', category: CostCategory.ALAT, unit: 'hari', volume: 15, unitPrice: 150000 },
  ];

  const rabMapP1: Record<string, string> = {};
  for (const [i, item] of rabP1.entries()) {
    const row = await prisma.rabItem.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        volume: item.volume,
        unitPrice: item.unitPrice,
        budget: item.volume * item.unitPrice,
        sortOrder: i,
      },
    });
    rabMapP1[item.code] = row.id;
  }

  // ========== RAB PROJECT 2 (Ruko) - lebih ringkas ==========
  const rabP2 = [
    { code: 'A.1', name: 'Pembersihan & persiapan lahan', category: CostCategory.LAINNYA, unit: 'm2', volume: 240, unitPrice: 30000 },
    { code: 'B.1', name: 'Pondasi tiang pancang', category: CostCategory.MATERIAL, unit: 'titik', volume: 24, unitPrice: 3500000 },
    { code: 'B.2', name: 'Upah pemancangan', category: CostCategory.UPAH, unit: 'titik', volume: 24, unitPrice: 450000 },
    { code: 'C.1', name: 'Beton ready mix K-250', category: CostCategory.MATERIAL, unit: 'm3', volume: 85, unitPrice: 1050000 },
    { code: 'C.2', name: 'Besi beton D16', category: CostCategory.MATERIAL, unit: 'kg', volume: 4500, unitPrice: 15500 },
    { code: 'C.3', name: 'Upah struktur beton', category: CostCategory.UPAH, unit: 'm3', volume: 85, unitPrice: 520000 },
    { code: 'D.1', name: 'Bata ringan', category: CostCategory.MATERIAL, unit: 'm2', volume: 680, unitPrice: 95000 },
    { code: 'D.2', name: 'Upah pasang bata ringan', category: CostCategory.UPAH, unit: 'm2', volume: 680, unitPrice: 55000 },
    { code: 'E.1', name: 'Rangka atap baja WF', category: CostCategory.MATERIAL, unit: 'kg', volume: 3200, unitPrice: 18500 },
    { code: 'E.2', name: 'Upah rangka atap', category: CostCategory.UPAH, unit: 'kg', volume: 3200, unitPrice: 4500 },
  ];

  for (const [i, item] of rabP2.entries()) {
    await prisma.rabItem.create({
      data: {
        tenantId: tenant.id,
        projectId: project2.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        volume: item.volume,
        unitPrice: item.unitPrice,
        budget: item.volume * item.unitPrice,
        sortOrder: i,
      },
    });
  }

  // ========== RAB PROJECT 3 (Renovasi) ==========
  const rabP3 = [
    { code: 'A.1', name: 'Bongkaran partisi lama', category: CostCategory.UPAH, unit: 'm2', volume: 120, unitPrice: 45000 },
    { code: 'B.1', name: 'Gypsum board + rangka', category: CostCategory.MATERIAL, unit: 'm2', volume: 180, unitPrice: 125000 },
    { code: 'B.2', name: 'Upah pasang gypsum', category: CostCategory.UPAH, unit: 'm2', volume: 180, unitPrice: 65000 },
    { code: 'C.1', name: 'Cat tembok premium', category: CostCategory.MATERIAL, unit: 'kg', volume: 80, unitPrice: 95000 },
    { code: 'C.2', name: 'Upah pengecatan', category: CostCategory.UPAH, unit: 'm2', volume: 350, unitPrice: 28000 },
    { code: 'D.1', name: 'Lantai vinyl plank', category: CostCategory.MATERIAL, unit: 'm2', volume: 95, unitPrice: 185000 },
    { code: 'D.2', name: 'Upah pasang vinyl', category: CostCategory.UPAH, unit: 'm2', volume: 95, unitPrice: 55000 },
  ];

  const rabMapP3: Record<string, string> = {};
  for (const [i, item] of rabP3.entries()) {
    const row = await prisma.rabItem.create({
      data: {
        tenantId: tenant.id,
        projectId: project3.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        volume: item.volume,
        unitPrice: item.unitPrice,
        budget: item.volume * item.unitPrice,
        sortOrder: i,
      },
    });
    rabMapP3[item.code] = row.id;
  }

  console.log('RAB dibuat...');

  // ========== REALISASI PROJECT 1 ==========
  const realizationsP1 = [
    { rabCode: 'A.1', date: '2024-08-18', description: 'Pembersihan lahan tahap 1', amount: 3200000, quantity: 128, vendor: 'Tim lokal' },
    { rabCode: 'A.2', date: '2024-08-20', description: 'Papan nama & pagar seng', amount: 2450000, quantity: 1, vendor: 'Toko Bangunan Sejahtera' },
    { rabCode: 'B.1', date: '2024-08-25', description: 'Galian pondasi minggu 1', amount: 2550000, quantity: 30, vendor: null },
    { rabCode: 'C.1', date: '2024-09-05', description: 'Cor pondasi & sloof batch 1', amount: 19000000, quantity: 20, vendor: 'Ready Mix Padang' },
    { rabCode: 'C.2', date: '2024-09-03', description: 'Pembelian besi D10', amount: 19200000, quantity: 1200, vendor: 'CV Baja Makmur' },
    { rabCode: 'C.3', date: '2024-09-03', description: 'Pembelian besi D13', amount: 23700000, quantity: 1500, vendor: 'CV Baja Makmur' },
    { rabCode: 'C.5', date: '2024-09-08', description: 'Upah cor pondasi', amount: 9000000, quantity: 20, vendor: null },
    { rabCode: 'D.1', date: '2024-10-02', description: 'Bata merah 6000 bh', amount: 5700000, quantity: 6000, vendor: 'Pabrik Bata Bukittinggi' },
    { rabCode: 'D.2', date: '2024-10-02', description: 'Semen 150 sak', amount: 10800000, quantity: 150, vendor: 'Toko Bangunan Sejahtera' },
    { rabCode: 'D.4', date: '2024-10-15', description: 'Upah pasangan dinding lantai 1', amount: 13650000, quantity: 210, vendor: null },
    { rabCode: 'I.1', date: '2024-08-22', description: 'Sewa excavator 5 hari', amount: 4250000, quantity: 5, vendor: 'Rental Alat Berat Padang' },
  ];

  for (const r of realizationsP1) {
    await prisma.realization.create({
      data: {
        tenantId: tenant.id,
        projectId: project1.id,
        rabItemId: rabMapP1[r.rabCode],
        date: new Date(r.date),
        description: r.description,
        amount: r.amount,
        quantity: r.quantity,
        vendor: r.vendor,
        source: RealizationSource.MANUAL,
        createdById: owner.id,
      },
    });
  }

  // Realisasi project 3 (sudah selesai)
  const realizationsP3 = [
    { rabCode: 'A.1', date: '2024-03-05', description: 'Bongkaran partisi', amount: 5400000, quantity: 120 },
    { rabCode: 'B.1', date: '2024-03-20', description: 'Material gypsum', amount: 22500000, quantity: 180 },
    { rabCode: 'B.2', date: '2024-04-10', description: 'Upah pasang gypsum', amount: 11700000, quantity: 180 },
    { rabCode: 'C.1', date: '2024-05-01', description: 'Cat tembok', amount: 7600000, quantity: 80 },
    { rabCode: 'C.2', date: '2024-05-15', description: 'Upah cat', amount: 9800000, quantity: 350 },
    { rabCode: 'D.1', date: '2024-06-01', description: 'Vinyl plank', amount: 17575000, quantity: 95 },
    { rabCode: 'D.2', date: '2024-06-20', description: 'Upah pasang vinyl', amount: 5225000, quantity: 95 },
  ];

  for (const r of realizationsP3) {
    await prisma.realization.create({
      data: {
        tenantId: tenant.id,
        projectId: project3.id,
        rabItemId: rabMapP3[r.rabCode],
        date: new Date(r.date),
        description: r.description,
        amount: r.amount,
        quantity: r.quantity,
        source: RealizationSource.MANUAL,
        createdById: admin.id,
      },
    });
  }

  console.log('Realisasi dibuat...');

  // ========== STOK PROJECT 1 ==========
  const stockSemen = await prisma.stockItem.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Semen PC 50kg',
      unit: 'sak',
      minStock: 40,
      currentQty: 85,
      defaultRabItemId: rabMapP1['D.2'],
    },
  });

  const stockBata = await prisma.stockItem.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Bata merah press',
      unit: 'bh',
      minStock: 1000,
      currentQty: 4200,
      defaultRabItemId: rabMapP1['D.1'],
    },
  });

  const stockBesiD13 = await prisma.stockItem.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Besi beton D13',
      unit: 'kg',
      minStock: 200,
      currentQty: 380,
      defaultRabItemId: rabMapP1['C.3'],
    },
  });

  const stockPasir = await prisma.stockItem.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Pasir pasang',
      unit: 'm3',
      minStock: 5,
      currentQty: 12,
      defaultRabItemId: rabMapP1['D.3'],
    },
  });

  // Stock movements (balanceAfter = stok setelah transaksi)
  await prisma.stockMovement.createMany({
    data: [
      // Semen: 0 → 150 → 85
      { tenantId: tenant.id, projectId: project1.id, stockItemId: stockSemen.id, type: StockMovementType.IN, quantity: 150, balanceAfter: 150, note: 'Pembelian awal', createdById: admin.id, date: new Date('2024-10-02') },
      { tenantId: tenant.id, projectId: project1.id, stockItemId: stockSemen.id, type: StockMovementType.OUT, quantity: 65, balanceAfter: 85, note: 'Pemakaian pasangan lantai 1', createdById: mandor1.id, date: new Date('2024-10-12') },
      // Bata: 0 → 6000 → 4200
      { tenantId: tenant.id, projectId: project1.id, stockItemId: stockBata.id, type: StockMovementType.IN, quantity: 6000, balanceAfter: 6000, note: 'Dari pabrik', createdById: admin.id, date: new Date('2024-10-02') },
      { tenantId: tenant.id, projectId: project1.id, stockItemId: stockBata.id, type: StockMovementType.OUT, quantity: 1800, balanceAfter: 4200, note: 'Pasangan dinding Lt.1', createdById: mandor1.id, date: new Date('2024-10-10') },
      // Besi D13: 0 → 1500 → 380
      { tenantId: tenant.id, projectId: project1.id, stockItemId: stockBesiD13.id, type: StockMovementType.IN, quantity: 1500, balanceAfter: 1500, note: 'Pembelian CV Baja', createdById: admin.id, date: new Date('2024-09-03') },
      { tenantId: tenant.id, projectId: project1.id, stockItemId: stockBesiD13.id, type: StockMovementType.OUT, quantity: 1120, balanceAfter: 380, note: 'Pembesian sloof & kolom', createdById: mandor1.id, date: new Date('2024-09-06') },
    ],
  });

  console.log('Stok dibuat...');

  // ========== EQUIPMENT RENTAL PROJECT 1 ==========
  const rentalExcavator = await prisma.equipmentRental.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Excavator Mini PC50',
      code: 'EXC-PC50-07',
      vendor: 'CV Rental Alat Berat Padang',
      rateType: RateType.DAILY,
      rate: 850000,
      operatorRate: 250000,
      plannedQuantity: 8,
      startDate: new Date('2024-08-20'),
      endDate: new Date('2024-09-05'),
      rabItemId: rabMapP1['I.1'],
      status: RentalStatus.RETURNED,
      returnedAt: new Date('2024-08-28'),
      notes: 'Untuk galian pondasi',
      createdById: owner.id,
    },
  });

  const rentalMolen = await prisma.equipmentRental.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Molen Cor 1 Sak',
      code: 'MOL-01',
      vendor: 'Sewa Sendiri',
      rateType: RateType.DAILY,
      rate: 150000,
      operatorRate: 0,
      plannedQuantity: 15,
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-10-30'),
      rabItemId: rabMapP1['I.2'],
      status: RentalStatus.ACTIVE,
      notes: 'Untuk cor & plester',
      createdById: admin.id,
    },
  });

  // Usage excavator
  await prisma.equipmentUsage.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      rentalId: rentalExcavator.id,
      date: new Date('2024-08-22'),
      quantity: 5,
      extraCost: 350000,
      cost: 5 * (850000 + 250000) + 350000,
      note: 'Galian pondasi depan & samping',
      createdById: mandor1.id,
    },
  });

  // Usage molen
  await prisma.equipmentUsage.createMany({
    data: [
      {
        tenantId: tenant.id,
        projectId: project1.id,
        rentalId: rentalMolen.id,
        date: new Date('2024-09-05'),
        quantity: 3,
        extraCost: 0,
        cost: 3 * 150000,
        note: 'Cor sloof',
        createdById: mandor1.id,
      },
      {
        tenantId: tenant.id,
        projectId: project1.id,
        rentalId: rentalMolen.id,
        date: new Date('2024-09-12'),
        quantity: 2,
        extraCost: 0,
        cost: 2 * 150000,
        note: 'Cor kolom',
        createdById: mandor2.id,
      },
    ],
  });

  console.log('Sewa alat dibuat...');

  // ========== PROGRESS REPORTS PROJECT 1 ==========
  await prisma.progressReport.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      reportDate: new Date('2024-09-15'),
      percent: 18.5,
      notes: 'Pondasi & sloof selesai 100%. Kolom lantai 1 sedang dikerjakan.',
      latitude: -0.9471,
      longitude: 100.4172,
      status: ProgressStatus.VERIFIED,
      reviewedById: owner.id,
      reviewedAt: new Date('2024-09-16'),
      createdById: mandor1.id,
    },
  });

  await prisma.progressReport.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      reportDate: new Date('2024-10-10'),
      percent: 32.0,
      notes: 'Dinding bata lantai 1 70% selesai. Mulai persiapan bekisting lantai 2.',
      latitude: -0.9471,
      longitude: 100.4172,
      status: ProgressStatus.VERIFIED,
      reviewedById: admin.id,
      reviewedAt: new Date('2024-10-11'),
      createdById: mandor1.id,
    },
  });

  await prisma.progressReport.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      reportDate: new Date('2024-10-25'),
      percent: 41.5,
      notes: 'Dinding Lt.1 selesai. Kolom Lt.2 sudah dicor. Material atap sudah datang.',
      latitude: -0.9471,
      longitude: 100.4172,
      status: ProgressStatus.SUBMITTED,
      createdById: mandor2.id,
    },
  });

  console.log('Progress dibuat...');

  // ========== WORK ORDER (SPK) + OPNAME PROJECT 1 ==========
  const wo1 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      code: 'SPK-001',
      contractorName: 'Joko Widodo (Mandor)',
      title: 'Pekerjaan pasangan dinding & plester lantai 1',
      rabItemId: rabMapP1['D.4'],
      retentionPercent: 5,
      status: WorkOrderStatus.ACTIVE,
      notes: 'Termasuk acian kasar',
      createdById: owner.id,
    },
  });

  const woLine1 = await prisma.workOrderLine.create({
    data: {
      workOrderId: wo1.id,
      description: 'Pasangan bata dinding Lt.1',
      unit: 'm2',
      contractVolume: 210,
      unitPrice: 65000,
      sortOrder: 0,
    },
  });

  const woLine2 = await prisma.workOrderLine.create({
    data: {
      workOrderId: wo1.id,
      description: 'Plester dinding Lt.1',
      unit: 'm2',
      contractVolume: 240,
      unitPrice: 45000,
      sortOrder: 1,
    },
  });

  // Opname termin 1 (sudah dibayar)
  const opname1 = await prisma.opname.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      workOrderId: wo1.id,
      number: 1,
      date: new Date('2024-10-15'),
      notes: 'Termin 1 - pasangan bata 60%',
      status: OpnameStatus.PAID,
      grossAmount: 8190000,
      retentionAmount: 409500,
      deduction: 500000,
      netAmount: 7280500,
      approvedById: owner.id,
      approvedAt: new Date('2024-10-16'),
      paidAt: new Date('2024-10-18'),
      paymentRef: 'TRF-20241018-001',
      createdById: admin.id,
    },
  });

  await prisma.opnameLine.createMany({
    data: [
      {
        opnameId: opname1.id,
        lineId: woLine1.id,
        previousVolume: 0,
        cumulativeVolume: 126,
        thisVolume: 126,
        amount: 126 * 65000,
      },
      {
        opnameId: opname1.id,
        lineId: woLine2.id,
        previousVolume: 0,
        cumulativeVolume: 0,
        thisVolume: 0,
        amount: 0,
      },
    ],
  });

  // Opname termin 2 (sudah diapprove, belum dibayar)
  const opname2 = await prisma.opname.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      workOrderId: wo1.id,
      number: 2,
      date: new Date('2024-10-28'),
      notes: 'Termin 2 - sisa pasangan + plester mulai',
      status: OpnameStatus.APPROVED,
      grossAmount: 10080000,
      retentionAmount: 504000,
      deduction: 0,
      netAmount: 9576000,
      approvedById: owner.id,
      approvedAt: new Date('2024-10-29'),
      createdById: admin.id,
    },
  });

  await prisma.opnameLine.createMany({
    data: [
      {
        opnameId: opname2.id,
        lineId: woLine1.id,
        previousVolume: 126,
        cumulativeVolume: 210,
        thisVolume: 84,
        amount: 84 * 65000,
      },
      {
        opnameId: opname2.id,
        lineId: woLine2.id,
        previousVolume: 0,
        cumulativeVolume: 100,
        thisVolume: 100,
        amount: 100 * 45000,
      },
    ],
  });

  // SPK lain (masih draft opname)
  const wo2 = await prisma.workOrder.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      code: 'SPK-002',
      contractorName: 'Ahmad Fauzi (Mandor)',
      title: 'Pekerjaan atap baja ringan',
      rabItemId: rabMapP1['F.3'],
      retentionPercent: 10,
      status: WorkOrderStatus.ACTIVE,
      createdById: owner.id,
    },
  });

  await prisma.workOrderLine.create({
    data: {
      workOrderId: wo2.id,
      description: 'Pasang rangka + genteng metal',
      unit: 'm2',
      contractVolume: 140,
      unitPrice: 55000,
      sortOrder: 0,
    },
  });

  console.log('SPK & Opname dibuat...');

  console.log('\n========================================');
  console.log('SEED DEMO SELESAI!');
  console.log('========================================');
  console.log('Login credentials:');
  console.log('  Owner  : owner@demo.com  / password123');
  console.log('  Admin  : admin@demo.com  / password123');
  console.log('  Mandor : mandor@demo.com / password123');
  console.log('  Mandor2: mandor2@demo.com / password123');
  console.log('----------------------------------------');
  console.log('Proyek yang tersedia:');
  console.log('  1. PRJ-2024-001 - Rumah Tinggal 2 Lantai (ONGOING) ← paling lengkap');
  console.log('  2. PRJ-2024-002 - Ruko 3 Lantai (PLANNING)');
  console.log('  3. PRJ-2024-003 - Renovasi Kantor (DONE)');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
