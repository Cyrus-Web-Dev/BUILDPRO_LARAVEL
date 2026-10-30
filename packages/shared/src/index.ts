import { z } from 'zod';

export const RoleEnum = z.enum(['OWNER', 'ADMIN', 'MANDOR']);
export type Role = z.infer<typeof RoleEnum>;

export const CostCategoryEnum = z.enum(['MATERIAL', 'UPAH', 'ALAT', 'LAINNYA']);
export type CostCategory = z.infer<typeof CostCategoryEnum>;

export const ProjectStatusEnum = z.enum(['PLANNING', 'ONGOING', 'DONE']);

// ---- Auth ----
const emailField = z.string().trim().toLowerCase().email();

export const registerCompanySchema = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: emailField,
  password: z.string().min(8),
});
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});
export const createUserSchema = z.object({
  name: z.string().min(2),
  email: emailField,
  password: z.string().min(8),
  role: RoleEnum,
});

// ---- Project ----
export const createProjectSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2),
  location: z.string().optional(),
  clientName: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export const updateProjectStatusSchema = z.object({ status: ProjectStatusEnum });

// ---- RAB ----
export const rabItemSchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(2),
  category: CostCategoryEnum,
  unit: z.string().min(1).max(20),
  volume: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  sortOrder: z.number().int().optional(),
});
export const updateRabItemSchema = rabItemSchema.partial();

// ---- Realisasi ----
export const createRealizationSchema = z.object({
  rabItemId: z.string().uuid(),
  date: z.coerce.date(),
  description: z.string().min(2),
  amount: z.number().positive(),
  quantity: z.number().positive().optional(),
  vendor: z.string().optional(),
  receiptUrl: z.string().url().optional(),
});

export type RegisterCompanyDto = z.infer<typeof registerCompanySchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type RabItemDto = z.infer<typeof rabItemSchema>;
export type UpdateRabItemDto = z.infer<typeof updateRabItemSchema>;
export type CreateRealizationDto = z.infer<typeof createRealizationSchema>;

export const rabBulkSchema = z.object({ items: z.array(rabItemSchema).min(1).max(500) });
export const updateProjectSchema = createProjectSchema.partial().omit({ code: true });
export type RabBulkDto = z.infer<typeof rabBulkSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

// ---- Modul 3: Stok ----
export const createStockItemSchema = z.object({
  name: z.string().min(2),
  unit: z.string().min(1).max(20),
  minStock: z.number().nonnegative().optional(),
  defaultRabItemId: z.string().uuid().optional(),
});
export const updateStockItemSchema = z.object({
  name: z.string().min(2).optional(),
  minStock: z.number().nonnegative().optional(),
  defaultRabItemId: z.string().uuid().nullable().optional(),
});
export const stockInSchema = z.object({
  stockItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  date: z.coerce.date(),
  supplier: z.string().optional(),
  refNo: z.string().optional(),
  note: z.string().optional(),
  rabItemId: z.string().uuid().optional(),
});
export const stockOutSchema = z.object({
  stockItemId: z.string().uuid(),
  quantity: z.number().positive(),
  date: z.coerce.date(),
  note: z.string().optional(),
});
export const stockAdjustSchema = z.object({
  stockItemId: z.string().uuid(),
  newQuantity: z.number().nonnegative(),
  date: z.coerce.date(),
  note: z.string().min(3),
});
export type CreateStockItemDto = z.infer<typeof createStockItemSchema>;
export type UpdateStockItemDto = z.infer<typeof updateStockItemSchema>;
export type StockInDto = z.infer<typeof stockInSchema>;
export type StockOutDto = z.infer<typeof stockOutSchema>;
export type StockAdjustDto = z.infer<typeof stockAdjustSchema>;

// ---- Tim proyek ----
export const assignMemberSchema = z.object({ userId: z.string().uuid() });

// ---- Modul 4: Progress ----
// Dikirim sebagai multipart/form-data, sehingga semua nilai datang sebagai string.
export const progressFormSchema = z
  .object({
    percent: z.coerce.number().min(0).max(100),
    notes: z.string().max(2000).optional(),
    reportDate: z.coerce.date().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    accuracy: z.coerce.number().nonnegative().optional(),
    capturedAt: z.coerce.date().optional(),
  })
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: 'latitude dan longitude harus dikirim bersamaan',
    path: ['latitude'],
  });
export const verifyProgressSchema = z
  .object({ status: z.enum(['VERIFIED', 'REJECTED']), comment: z.string().max(500).optional() })
  .refine((v) => v.status !== 'REJECTED' || !!v.comment?.trim(), {
    message: 'Alasan penolakan wajib diisi',
    path: ['comment'],
  });
export type ProgressFormDto = z.infer<typeof progressFormSchema>;
export type VerifyProgressDto = z.infer<typeof verifyProgressSchema>;

// ---- Modul 5a: Sewa alat berat ----
export const RateTypeEnum = z.enum(['HOURLY', 'DAILY']);
export const createRentalSchema = z
  .object({
    name: z.string().min(2),
    code: z.string().optional(),
    vendor: z.string().optional(),
    rateType: RateTypeEnum,
    rate: z.number().positive(),
    operatorRate: z.number().nonnegative().optional(),
    plannedQuantity: z.number().positive().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    rabItemId: z.string().uuid(),
    notes: z.string().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'Tanggal berakhir tidak boleh sebelum tanggal mulai', path: ['endDate'] });
export const updateRentalSchema = z.object({
  endDate: z.coerce.date().optional(),
  plannedQuantity: z.number().positive().nullable().optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
});
export const rentalUsageSchema = z.object({
  date: z.coerce.date(),
  quantity: z.number().positive(),
  extraCost: z.number().nonnegative().optional(),
  note: z.string().optional(),
});
export const returnRentalSchema = z.object({ returnedAt: z.coerce.date().optional() });
export type CreateRentalDto = z.infer<typeof createRentalSchema>;
export type UpdateRentalDto = z.infer<typeof updateRentalSchema>;
export type RentalUsageDto = z.infer<typeof rentalUsageSchema>;
export type ReturnRentalDto = z.infer<typeof returnRentalSchema>;

// ---- Modul 5b: Opname mandor ----
export const workOrderLineSchema = z.object({
  description: z.string().min(2),
  unit: z.string().min(1).max(20),
  contractVolume: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});
export const createWorkOrderSchema = z.object({
  code: z.string().min(1).max(30),
  contractorName: z.string().min(2),
  title: z.string().min(2),
  rabItemId: z.string().uuid(),
  retentionPercent: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  lines: z.array(workOrderLineSchema).min(1).max(100),
});
export const opnameSchema = z.object({
  date: z.coerce.date(),
  notes: z.string().optional(),
  deduction: z.number().nonnegative().optional(),
  // cumulativeVolume = total volume selesai sampai saat ini (bukan selisih). Item yang tidak dikirim dianggap tidak berubah.
  lines: z.array(z.object({ lineId: z.string().uuid(), cumulativeVolume: z.number().nonnegative() })).min(1),
});
export const payOpnameSchema = z.object({ paidDate: z.coerce.date(), reference: z.string().optional() });
export type CreateWorkOrderDto = z.infer<typeof createWorkOrderSchema>;
export type OpnameDto = z.infer<typeof opnameSchema>;
export type PayOpnameDto = z.infer<typeof payOpnameSchema>;
