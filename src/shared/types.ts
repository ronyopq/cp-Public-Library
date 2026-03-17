// src/shared/types.ts

export type Role = 'public' | 'member' | 'librarian' | 'officer' | 'manager' | 'admin' | 'super_admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  password_hash: string;
  role_id: string;
  is_active: boolean;
  last_login?: string;
  failed_login_attempts: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role_id: string;
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
  role_id: string;
  isAuthenticated: boolean;
}

export interface Book {
  id: string;
  isbn?: string;
  title: string;
  subtitle?: string;
  edition?: string;
  language_id: string;
  publisher_id?: string;
  publication_year?: number;
  pages?: number;
  description?: string;
  category_id?: string;
  cover_image_url?: string;
}

export interface BookCopy {
  id: string;
  bibliographic_record_id: string;
  accession_number: string;
  barcode?: string;
  qr_code?: string;
  condition: 'NEW' | 'GOOD' | 'WORN' | 'DAMAGED' | 'LOST' | 'WITHDRAWN' | 'REPAIR';
  is_available: boolean;
  acquisition_type: string;
  acquisition_cost?: number;
  acquisition_date: string;
}

export interface Member {
  id: string;
  membership_number: string;
  full_name: string;
  phone: string;
  email?: string;
  address: string;
  membership_type: 'STUDENT' | 'STAFF' | 'GENERAL' | 'LIFE';
  membership_status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'INACTIVE';
  membership_start_date: string;
  membership_expiry_date?: string;
  outstanding_fine: number;
  total_books_borrowed: number;
}

export interface Loan {
  id: string;
  book_copy_id: string;
  member_id: string;
  issued_date: string;
  due_date: string;
  returned_date?: string;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'LOST';
  renewal_count: number;
  is_overdue: boolean;
}

export interface Fine {
  id: string;
  member_id: string;
  amount: number;
  reason: string;
  fine_date: string;
  status: 'PENDING' | 'PAID' | 'WAIVED';
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  status: 'SUCCESS' | 'FAILED';
  created_at: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
