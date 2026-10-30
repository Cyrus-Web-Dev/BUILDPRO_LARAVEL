export type Role = 'OWNER' | 'ADMIN' | 'MANDOR';
export type BudgetStatus = 'OK' | 'WARNING' | 'OVER';
export type Category = 'MATERIAL' | 'UPAH' | 'ALAT' | 'LAINNYA';

export interface User { id: string; name: string; email: string; role: Role; tenantId: string }

export interface Project {
  id: string; code: string; name: string; location: string | null; clientName: string | null;
  startDate: string | null; endDate: string | null;
  status: 'PLANNING' | 'ONGOING' | 'DONE'; rabStatus: 'DRAFT' | 'APPROVED'; rabApprovedAt: string | null;
}
export interface ProjectOverview extends Project {
  progressPercent: number;
  budget: number | null; realized: number | null; usagePercent: number | null; budgetStatus: BudgetStatus | null;
}
export interface RabItem {
  id: string; code: string; name: string; category: Category; unit: string;
  volume: string; unitPrice: string; budget: string; sortOrder: number;
}
export interface SummaryItem {
  id: string; code: string; name: string; category: Category; unit: string;
  volume: number; unitPrice: number; budget: number; realized: number; remaining: number;
  usagePercent: number; status: BudgetStatus;
}
export interface Summary {
  project: { id: string; code: string; name: string; rabStatus: 'DRAFT' | 'APPROVED' };
  totals: { budget: number; realized: number; remaining: number; usagePercent: number; status: BudgetStatus };
  byCategory: { category: Category; budget: number; realized: number; usagePercent: number; status: BudgetStatus }[];
  items: SummaryItem[];
  alerts: { itemId: string; code: string; name: string; status: BudgetStatus; usagePercent: number }[];
}
export interface Realization {
  id: string; date: string; description: string; amount: string; vendor: string | null;
  receiptUrl: string | null; source: 'MANUAL' | 'STOK' | 'SEWA_ALAT' | 'OPNAME';
  rabItem: { code: string; name: string; category: Category };
}
export interface CreateRealizationResult {
  realization: Realization;
  alert: { level: BudgetStatus; message: string } | null;
}

export interface ProjectMemberUser { id: string; name: string; email: string; role: Role }

export type StockStatus = 'OK' | 'LOW' | 'EMPTY';
export interface StockItem {
  id: string; name: string; unit: string; minStock: number; currentQty: number;
  defaultRabItemId: string | null; status: StockStatus;
}
export interface StockMovement {
  id: string; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; balanceAfter: number;
  unitPrice: number | null; totalCost: number | null; supplier: string | null; refNo: string | null;
  note: string | null; date: string; voidedAt: string | null; createdBy?: string;
  stockItem?: { id: string; name: string; unit: string };
}
export interface StockOpResult {
  movement: StockMovement; stock: StockItem;
  alert?: { level: string; message: string } | null;
  budgetAlert?: { level: string; message: string } | null;
}

export interface ProgressReport {
  id: string; reportDate: string; percent: number; notes: string | null;
  latitude: number | null; longitude: number | null; accuracy: number | null; capturedAt: string | null;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED'; reviewComment: string | null; reviewedAt: string | null;
  createdAt: string; createdBy: string; photos: { id: string; url: string }[];
}

export interface Rental {
  id: string; name: string; code: string | null; vendor: string | null;
  rateType: 'HOURLY' | 'DAILY'; unit: string; rate: number | null; operatorRate: number | null;
  plannedQuantity: number | null; usedQuantity: number; totalCost: number | null;
  startDate: string; endDate: string; daysRemaining: number;
  status: 'ACTIVE' | 'RETURNED'; returnedAt: string | null; rabItemId: string; notes: string | null;
  durationStatus: 'OK' | 'EXPIRING' | 'OVERDUE' | 'RETURNED'; usageStatus: BudgetStatus; alerts: string[];
}
export interface RentalUsage {
  id: string; date: string; quantity: number; note: string | null; voidedAt: string | null;
  extraCost: number | null; cost: number | null;
}
export interface RentalUsageResult {
  rental: Rental; budgetAlert: { level: BudgetStatus; message: string } | null;
}

export interface WorkOrderLineView {
  id: string; description: string; unit: string; contractVolume: number; unitPrice: number; certifiedVolume: number;
}
export interface WorkOrderView {
  id: string; code: string; title: string; contractorName: string; status: 'ACTIVE' | 'CLOSED';
  retentionPercent: number; rabItemId: string; notes: string | null;
  contractValue: number; certifiedGross: number; progressPercent: number;
  retentionHeld: number; paidNet: number; unpaidNet: number; hasDraft: boolean;
  lines: WorkOrderLineView[];
}
export interface OpnameView {
  id: string; number: number; date: string; notes: string | null;
  status: 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED';
  grossAmount: number; retentionAmount: number; deduction: number; netAmount: number;
  approvedAt: string | null; paidAt: string | null; paymentRef: string | null;
  workOrder: { id: string; code: string; title: string; contractorName: string };
  lines: {
    lineId: string; description: string; unit: string; unitPrice: number; contractVolume: number;
    previousVolume: number; cumulativeVolume: number; thisVolume: number; amount: number;
  }[];
}
