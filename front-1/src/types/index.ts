// ============================================================
// ENUMS
// ============================================================

export type Role =
  | "SUPER_ADMIN"
  | "GYM_OWNER"
  | "GYM_ADMIN"
  | "TRAINER"
  | "RECEPTIONIST";

export type MembershipStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "FROZEN"
  | "CANCELLED";

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "OTHER";

export type MaintenanceType = "PREVENTIVE" | "CORRECTIVE" | "INSPECTION";

export type InventoryStatus =
  | "ACTIVE"
  | "OUT_OF_SERVICE"
  | "MAINTENANCE"
  | "RETIRED";

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED";

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Gym {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  currency: string;
  address: string | null;
  country: string | null;
  timezone: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  demoEnabled: boolean;
  storeEnabled: boolean;
  advancedReportsEnabled: boolean;
  schedule?: Record<string, { open: string; close: string } | null> | null;
  ownerId: string | null;
  owner?: { id: string; email: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  gymId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  gymId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  imageUrl: string | null;
  gymId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  daysPerWeek: number | null;
  benefits: string[];
  isActive: boolean;
  isFeatured: boolean;
  storeEnabled: boolean;
  gymId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  photoUrl: string | null;
  isActive: boolean;
  gymId: string;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  startDate: string;
  endDate: string;
  status: MembershipStatus;
  frozenAt: string | null;
  frozenDays: number;
  notes: string | null;
  gymId: string;
  memberId: string;
  planId: string;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  notes: string | null;
  receiptUrl: string | null;
  gymId: string;
  memberId: string;
  membershipId: string | null;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  checkIn: string;
  checkOut: string | null;
  gymId: string;
  memberId: string;
  branchId: string | null;
  groupId: string | null;
  group?: { id: string; name: string } | null;
  createdAt: string;
}

export interface AttendanceGroup {
  id: string;
  name: string;
  gymId: string;
  createdAt: string;
}

export interface Trainer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
  availability: Record<string, unknown>;
  gymId: string;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  description: string | null;
  maxCapacity: number;
  schedule: ClassSchedule;
  isActive: boolean;
  gymId: string;
  branchId: string | null;
  trainerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassEnrollment {
  id: string;
  enrolledAt: string;
  attended: boolean;
  attendedAt: string | null;
  gymId: string;
  memberId: string;
  classId: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  status: InventoryStatus;
  serialNumber: string | null;
  purchaseDate: string | null;
  gymId: string;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Maintenance {
  id: string;
  type: MaintenanceType;
  description: string;
  responsibleName: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  gymId: string;
  inventoryItemId: string;
  createdAt: string;
}

export interface Communication {
  id: string;
  subject: string;
  body: string;
  recipientIds: string[];
  gymId: string;
  sentAt: string;
  createdAt: string;
  sentBy?: { name: string; email: string };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  gymId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  segment: CampaignSegment;
  scheduledAt: string | null;
  sentAt: string | null;
  metrics: CampaignMetrics;
  gymId: string;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// JSONB SHAPES
// ============================================================

export interface ClassSchedule {
  dayOfWeek: number; // 0 = domingo, 6 = sábado
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  recurrent: boolean;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TrainerAvailability = Partial<
  Record<DayOfWeek, { start: string; end: string }[]>
>;

export interface CampaignSegment {
  planIds?: string[];
  branchIds?: string[];
  membershipStatus?: MembershipStatus[];
  tags?: string[];
}

export interface CampaignMetrics {
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
}

// ============================================================
// EXPANDED RELATIONS (responses with joins)
// ============================================================

export interface MemberWithMembership extends Member {
  activeMembership?: Membership & { plan: Plan };
}

export interface MembershipWithRelations extends Membership {
  member: Member;
  plan: Plan;
  branch?: Branch | null;
}

export interface ClassWithRelations extends Class {
  trainer?: Trainer | null;
  branch?: Branch | null;
  _count?: { enrollments: number };
}

export interface InventoryItemWithMaintenances extends InventoryItem {
  maintenances: Maintenance[];
}

export interface EmailCampaignWithTemplate extends EmailCampaign {
  template?: EmailTemplate | null;
}

// ============================================================
// API — REQUEST BODIES
// ============================================================

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  gym?: Gym;
}

// Gyms
export interface CreateGymRequest {
  name: string;
  slug: string;
  logoUrl?: string;
  subscriptionPlan?: string;
}

export interface UpdateGymRequest extends Partial<CreateGymRequest> {
  isActive?: boolean;
}

// Users
export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
  gymId?: string;
}

export interface UpdateUserRequest extends Partial<Omit<CreateUserRequest, "password">> {
  isActive?: boolean;
}

// Branches
export interface CreateBranchRequest {
  name: string;
  address?: string;
  gymId: string;
}

export interface UpdateBranchRequest extends Partial<Omit<CreateBranchRequest, "gymId">> {
  isActive?: boolean;
}

// Plans
export interface CreatePlanRequest {
  name: string;
  price: number;
  currency?: string;
  durationDays: number;
  daysPerWeek?: number;
  benefits?: string[];
  isFeatured?: boolean;
  gymId: string;
}

export interface UpdatePlanRequest extends Partial<Omit<CreatePlanRequest, "gymId">> {
  isActive?: boolean;
}

// Members
export interface CreateMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  photoUrl?: string;
  gymId: string;
  branchId?: string;
}

export interface UpdateMemberRequest extends Partial<Omit<CreateMemberRequest, "gymId">> {
  isActive?: boolean;
}

// Memberships
export interface CreateMembershipRequest {
  startDate: string;
  endDate: string;
  memberId: string;
  planId: string;
  branchId?: string;
  notes?: string;
  gymId: string;
}

export interface UpdateMembershipRequest {
  status?: MembershipStatus;
  endDate?: string;
  notes?: string;
  frozenAt?: string;
  frozenDays?: number;
}

// Payments
export interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  method?: PaymentMethod;
  notes?: string;
  memberId: string;
  membershipId?: string;
  branchId?: string;
  gymId: string;
}

// Attendance
export interface CreateAttendanceRequest {
  memberId: string;
  branchId?: string;
  gymId: string;
  checkIn?: string;
}

export interface UpdateAttendanceRequest {
  checkOut: string;
}

// Trainers
export interface CreateTrainerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialty?: string;
  availability?: TrainerAvailability;
  gymId: string;
  branchId?: string;
}

export interface UpdateTrainerRequest extends Partial<Omit<CreateTrainerRequest, "gymId">> {
  isActive?: boolean;
}

// Classes
export interface CreateClassRequest {
  name: string;
  description?: string;
  maxCapacity: number;
  schedule: ClassSchedule;
  gymId: string;
  branchId?: string;
  trainerId?: string;
}

export interface UpdateClassRequest extends Partial<Omit<CreateClassRequest, "gymId">> {
  isActive?: boolean;
}

// Class Enrollments
export interface CreateEnrollmentRequest {
  memberId: string;
  classId: string;
  gymId: string;
}

export interface MarkAttendanceRequest {
  attended: boolean;
  attendedAt?: string;
}

// Inventory
export interface CreateInventoryItemRequest {
  name: string;
  description?: string;
  quantity?: number;
  serialNumber?: string;
  purchaseDate?: string;
  gymId: string;
  branchId?: string;
}

export interface UpdateInventoryItemRequest extends Partial<Omit<CreateInventoryItemRequest, "gymId">> {
  status?: InventoryStatus;
  quantity?: number;
}

// Maintenance
export interface CreateMaintenanceRequest {
  type: MaintenanceType;
  description: string;
  responsibleName?: string;
  scheduledAt?: string;
  inventoryItemId: string;
  gymId: string;
}

export interface UpdateMaintenanceRequest {
  completedAt?: string;
  responsibleName?: string;
  description?: string;
}

// Communications
export interface CreateCommunicationRequest {
  subject: string;
  body: string;
  recipientIds: string[];
  gymId: string;
}

// Email Templates
export interface CreateEmailTemplateRequest {
  name: string;
  subject: string;
  body: string;
  gymId: string;
}

export interface UpdateEmailTemplateRequest extends Partial<Omit<CreateEmailTemplateRequest, "gymId">> {
  isActive?: boolean;
}

// Email Campaigns
export interface CreateEmailCampaignRequest {
  name: string;
  segment?: CampaignSegment;
  scheduledAt?: string;
  gymId: string;
  templateId?: string;
}

export interface UpdateEmailCampaignRequest {
  name?: string;
  status?: CampaignStatus;
  segment?: CampaignSegment;
  scheduledAt?: string;
  templateId?: string;
}

// ============================================================
// API — PAGINATED & GENERIC RESPONSES
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// ============================================================
// QUERY PARAMS
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface BaseQueryParams extends PaginationParams {
  gymId?: string;
  branchId?: string;
  isActive?: boolean;
  search?: string;
}

export interface MembershipQueryParams extends BaseQueryParams {
  status?: MembershipStatus;
  memberId?: string;
  planId?: string;
}

export interface AttendanceQueryParams extends BaseQueryParams {
  memberId?: string;
  from?: string;
  to?: string;
}

export interface PaymentQueryParams extends BaseQueryParams {
  memberId?: string;
  method?: PaymentMethod;
  from?: string;
  to?: string;
}

export interface InventoryQueryParams extends BaseQueryParams {
  status?: InventoryStatus;
}

export interface CampaignQueryParams extends BaseQueryParams {
  status?: CampaignStatus;
}

// ============================================================
// SESSION
// ============================================================

export interface SessionPayload {
  sub: string;
  email: string;
  role: Role;
  gymSlug?: string;
  gymId?: string;
  iat: number;
  exp: number;
}
