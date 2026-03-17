import { int, sql, text, blob, integer } from "drizzle-orm/sql-js";
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";

// ============================================================================
// PUBLIC LIBRARY MANAGEMENT SYSTEM - DRIZZLE ORM SCHEMA
// ============================================================================

// User & Authentication Tables
export const users = sqliteTable("users", {
  userId: text("user_id").primaryKey(),
  email: text("email").unique().notNull(),
  phoneNumber: text("phone_number").unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  roleId: text("role_id").notNull().references(() => roles.roleId),
  status: text("status", { enum: ["active", "inactive", "suspended"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const userProfiles = sqliteTable("user_profiles", {
  userProfileId: text("user_profile_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.userId, { onDelete: "cascade" }),
  department: text("department"),
  designation: text("designation"),
  officeLocation: text("office_location"),
  preferences: text("preferences", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Member Tables
export const members = sqliteTable("members", {
  memberId: text("member_id").primaryKey(),
  membershipNumber: text("membership_number").unique().notNull(), // LIB-YYYY-XXXXX
  email: text("email").unique().notNull(),
  phoneNumber: text("phone_number").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  gender: text("gender", { enum: ["M", "F", "O"] }),
  address: text("address"),
  city: text("city"),
  membershipType: text("membership_type", {
    enum: ["student", "faculty", "staff", "general"],
  }).notNull(),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.roleId),
  status: text("status", {
    enum: ["active", "inactive", "suspended", "delinquent"],
  })
    .notNull()
    .default("active"),
  maxBooksLimit: int("max_books_limit").notNull().default(5),
  membershipDate: integer("membership_date", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

export const memberProfiles = sqliteTable("member_profiles", {
  memberProfileId: text("member_profile_id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.memberId, { onDelete: "cascade" }),
  institution: text("institution"),
  institutionId: text("institution_id"),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
  nationalId: text("national_id"),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  preferences: text("preferences", { mode: "json" }),
  emergencyContact: text("emergency_contact", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Role & Permission Tables
export const roles = sqliteTable("roles", {
  roleId: text("role_id").primaryKey(),
  name: text("name")
    .unique()
    .notNull(),
  description: text("description"),
  hierarchyLevel: int("hierarchy_level").notNull(),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const permissions = sqliteTable("permissions", {
  permissionId: text("permission_id").primaryKey(),
  code: text("code").unique().notNull(), // e.g., "book:read", "fine:waive"
  description: text("description"),
  category: text("category", {
    enum: ["book", "copy", "member", "loan", "fine", "payment", "admin", "audit"],
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const rolePermissions = sqliteTable("role_permissions", {
  rolePermissionId: text("role_permission_id").primaryKey(),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.roleId),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permissions.permissionId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Publisher Table
export const publishers = sqliteTable("publishers", {
  publisherId: text("publisher_id").primaryKey(),
  name: text("name").unique().notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Category Table
export const categories = sqliteTable("categories", {
  categoryId: text("category_id").primaryKey(),
  name: text("name").unique().notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Book Tables (Bibliography + Physical Copies)
export const bibliographicRecords = sqliteTable("bibliographic_records", {
  bibliographicId: text("bibliographic_id").primaryKey(),
  isbn: text("isbn").unique().notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  authors: text("authors", { mode: "json" }).notNull(), // JSON array
  publisherId: text("publisher_id")
    .notNull()
    .references(() => publishers.publisherId),
  publicationDate: integer("publication_date", { mode: "timestamp" }),
  edition: text("edition"),
  pages: int("pages"),
  language: text("language").default("Bangla"),
  description: text("description"),
  keywords: text("keywords", { mode: "json" }), // JSON array
  status: text("status", {
    enum: ["active", "archived", "out_of_print"],
  })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const bookCopiesCategories = sqliteTable("book_copies_categories", {
  recordId: text("record_id").primaryKey(),
  bibliographicId: text("bibliographic_id")
    .notNull()
    .references(() => bibliographicRecords.bibliographicId),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.categoryId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const physicalCopies = sqliteTable("physical_copies", {
  copyId: text("copy_id").primaryKey(),
  bibliographicId: text("bibliographic_id")
    .notNull()
    .references(() => bibliographicRecords.bibliographicId),
  accessionNumber: text("accession_number").unique().notNull(), // LIB-YYYY-XXXXX
  barcode: text("barcode").unique().notNull(),
  callNumber: text("call_number"),
  location: text("location", {
    enum: ["shelf_a", "shelf_b", "reference", "archive"],
  }).notNull(),
  condition: text("condition", {
    enum: ["excellent", "good", "fair", "poor", "lost", "damaged"],
  })
    .notNull()
    .default("excellent"),
  status: text("status", {
    enum: ["available", "borrowed", "reserved", "lost", "damaged", "archived"],
  })
    .notNull()
    .default("available"),
  acquisitionDate: integer("acquisition_date", { mode: "timestamp" }),
  cost: text("cost"), // Decimal as text
  supplier: text("supplier"),
  lastLoanDate: integer("last_loan_date", { mode: "timestamp" }),
  lastBorrowedByMemberId: text("last_borrowed_by_member_id"),
  totalLoanCount: int("total_loan_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const inventoryHistory = sqliteTable("inventory_history", {
  historyId: text("history_id").primaryKey(),
  copyId: text("copy_id")
    .notNull()
    .references(() => physicalCopies.copyId),
  action: text("action", {
    enum: ["acquired", "moved", "condition_changed", "lost", "damaged", "archived"],
  }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  performedByUserId: text("performed_by_user_id").references(() => users.userId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Loan Tables
export const loans = sqliteTable("loans", {
  loanId: text("loan_id").primaryKey(),
  copyId: text("copy_id")
    .notNull()
    .references(() => physicalCopies.copyId),
  memberId: text("member_id")
    .notNull()
    .references(() => members.memberId),
  issuedByUserId: text("issued_by_user_id")
    .notNull()
    .references(() => users.userId),
  issueDate: integer("issue_date", { mode: "timestamp" }).notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  returnDate: integer("return_date", { mode: "timestamp" }),
  status: text("status", {
    enum: ["active", "returned", "lost", "overdue"],
  })
    .notNull()
    .default("active"),
  renewalCount: int("renewal_count").notNull().default(0),
  maxRenewals: int("max_renewals").notNull().default(2),
  finePerDay: text("fine_per_day").notNull(), // Decimal as text
  returnedByUserId: text("returned_by_user_id").references(() => users.userId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const loanRenewals = sqliteTable("loan_renewals", {
  renewalId: text("renewal_id").primaryKey(),
  loanId: text("loan_id")
    .notNull()
    .references(() => loans.loanId),
  renewedAt: integer("renewed_at", { mode: "timestamp" }).notNull(),
  newDueDate: integer("new_due_date", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["approved", "rejected"] })
    .notNull()
    .default("approved"),
  rejectionReason: text("rejection_reason"),
  renewedByUserId: text("renewed_by_user_id").references(() => users.userId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const loanHistory = sqliteTable("loan_history", {
  historyId: text("history_id").primaryKey(),
  copyId: text("copy_id")
    .notNull()
    .references(() => physicalCopies.copyId),
  memberId: text("member_id")
    .notNull()
    .references(() => members.memberId),
  issuedByUserId: text("issued_by_user_id").references(() => users.userId),
  issueDate: integer("issue_date", { mode: "timestamp" }).notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  returnDate: integer("return_date", { mode: "timestamp" }),
  status: text("status", {
    enum: ["returned", "lost", "overdue"],
  }).notNull(),
  renewalCount: int("renewal_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Fine Tables
export const fines = sqliteTable("fines", {
  fineId: text("fine_id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.memberId),
  loanId: text("loan_id").references(() => loans.loanId),
  copyId: text("copy_id").references(() => physicalCopies.copyId),
  reason: text("reason", {
    enum: ["overdue", "damaged", "lost"],
  }).notNull(),
  fineDate: integer("fine_date", { mode: "timestamp" }).notNull(),
  finePerDay: text("fine_per_day").notNull(), // Decimal
  daysOverdue: int("days_overdue").notNull().default(0),
  amount: text("amount").notNull(), // Decimal
  status: text("status", {
    enum: ["active", "partially_paid", "paid", "waived", "cancelled"],
  })
    .notNull()
    .default("active"),
  waivedReason: text("waived_reason"),
  waivedByUserId: text("waived_by_user_id").references(() => users.userId),
  waivedAt: integer("waived_at", { mode: "timestamp" }),
  dueDate: integer("due_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Payment Tables
export const payments = sqliteTable("payments", {
  paymentId: text("payment_id").primaryKey(),
  fineId: text("fine_id").references(() => fines.fineId),
  memberId: text("member_id")
    .notNull()
    .references(() => members.memberId),
  paymentMethod: text("payment_method", {
    enum: ["cash", "card", "bkash", "nagad", "online_transfer"],
  }).notNull(),
  paymentMethodId: text("payment_method_id").references(() => paymentMethods.paymentMethodId),
  amount: text("amount").notNull(), // Decimal
  transactionId: text("transaction_id").unique(),
  status: text("status", {
    enum: ["pending", "succeeded", "failed", "cancelled", "refunded"],
  })
    .notNull()
    .default("pending"),
  receiptUrl: text("receipt_url"),
  paymentDate: integer("payment_date", { mode: "timestamp" }).notNull(),
  processedByUserId: text("processed_by_user_id").references(() => users.userId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const paymentMethods = sqliteTable("payment_methods", {
  paymentMethodId: text("payment_method_id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.memberId),
  methodType: text("method_type", {
    enum: ["cash", "card", "bkash", "nagad", "bank_account"],
  }).notNull(),
  provider: text("provider"),
  reference: text("reference"), // Last 4 digits, phone number, etc.
  status: text("status", { enum: ["active", "inactive"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Notification Table
export const notifications = sqliteTable("notifications", {
  notificationId: text("notification_id").primaryKey(),
  recipientId: text("recipient_id").notNull(),
  recipientType: text("recipient_type", { enum: ["member", "user"] }).notNull(),
  type: text("type", { enum: ["email", "sms", "system"] }).notNull(),
  subject: text("subject"),
  message: text("message").notNull(),
  templateKey: text("template_key"),
  templateData: text("template_data", { mode: "json" }),
  status: text("status", {
    enum: ["pending", "sent", "failed", "read"],
  })
    .notNull()
    .default("pending"),
  errorMessage: text("error_message"),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  readAt: integer("read_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Settings Table
export const settings = sqliteTable("settings", {
  settingId: text("setting_id").primaryKey(),
  key: text("key").unique().notNull(),
  value: text("value"),
  description: text("description"),
  type: text("type", {
    enum: ["string", "int", "float", "boolean", "json"],
  }).notNull(),
  scope: text("scope", {
    enum: ["system", "library", "module"],
  }).notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.userId),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Audit Log Table
export const auditLog = sqliteTable("audit_log", {
  auditId: text("audit_id").primaryKey(),
  userId: text("user_id").references(() => users.userId),
  action: text("action", {
    enum: ["create", "read", "update", "delete"],
  }).notNull(),
  entity: text("entity", {
    enum: ["book", "member", "loan", "fine", "payment", "user", "setting"],
  }).notNull(),
  entityId: text("entity_id").notNull(),
  memberId: text("member_id").references(() => members.memberId),
  copyId: text("copy_id").references(() => physicalCopies.copyId),
  oldValues: text("old_values", { mode: "json" }),
  newValues: text("new_values", { mode: "json" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status", { enum: ["success", "failure"] })
    .notNull()
    .default("success"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ============================================================================
// SCHEMA EXPORT
// ============================================================================

export const schema = {
  // Users
  users,
  userProfiles,
  members,
  memberProfiles,
  roles,
  permissions,
  rolePermissions,
  // Books
  publishers,
  categories,
  bibliographicRecords,
  bookCopiesCategories,
  physicalCopies,
  inventoryHistory,
  // Loans
  loans,
  loanRenewals,
  loanHistory,
  // Fines & Payments
  fines,
  payments,
  paymentMethods,
  // System
  notifications,
  settings,
  auditLog,
};

export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type Member = typeof members.$inferSelect;
export type MemberProfile = typeof memberProfiles.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type Publisher = typeof publishers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type BibliographicRecord = typeof bibliographicRecords.$inferSelect;
export type PhysicalCopy = typeof physicalCopies.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type LoanRenewal = typeof loanRenewals.$inferSelect;
export type Fine = typeof fines.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
