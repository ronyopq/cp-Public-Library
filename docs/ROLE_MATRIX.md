# Role Matrix & Permission System

Public Library Management System - Complete RBAC Configuration

---

## 🎯 7 System Roles with Hierarchy

```
Level 0: SUPER_ADMIN (Full system access)
  ↓
Level 1: ADMIN (All features except system settings)
  ↓
Level 2: LIBRARIAN (Day-to-day operations)
  ↓
Level 3: MEMBER (Self-service borrowing)
  ↓
Level 4: GUEST (Public view-only)

Level 5: AUDITOR (Parallel - audit/compliance)
Level 6: SYSTEM (Parallel - automated jobs)
```

---

## 📋 Role Descriptions

### SUPER_ADMIN (Hierarchy Level 0)
**Used By**: System administrators, CTO  
**Permissions**: 50+ (ALL)  
**Cannot**: Nothing (full access)  

**Capabilities**:
- Create/modify all users and roles
- Access system settings
- View audit logs
- Assign permissions
- Delete any data
- Configure integrations

---

### ADMIN (Hierarchy Level 1)
**Used By**: Library manager, Head librarian  
**Permissions**: 45 (All except system-level)  
**Cannot**: Modify system settings, delete admin accounts  

**Capabilities**:
- Manage staff accounts
- Handle all book operations
- Process member registrations  
- Generate reports
- Create and waive fines
- Process payments
- View audit logs (read-only)

---

### LIBRARIAN (Hierarchy Level 2)
**Used By**: Regular library staff, circulation desk  
**Permissions**: 18  
**Cannot**: Delete books/members, create admins, modify settings  

**Capabilities**:
- Issue and return books
- Renew loans
- Register members
- Process fine payments
- Generate member reports
- Search book catalog
- View member history

---

### MEMBER (Hierarchy Level 3)
**Used By**: Library patrons  
**Permissions**: 10  
**Cannot**: Issue loans (via desk), delete fines, create users  

**Capabilities**:
- Search books
- View own profile
- View own active loans
- Renew own loans
- Pay own fines
- View own payment history

---

### GUEST (Hierarchy Level 4)
**Used By**: Unauthenticated visitors  
**Permissions**: 3  
**Cannot**: Anything except read  

**Capabilities**:
- Search book catalog
- View book details
- View availability status

---

### AUDITOR (Parallel - No Hierarchy)
**Used By**: Compliance officer, accountant  
**Permissions**: 3  
**Cannot**: Modify anything  

**Capabilities**:
- View all reports and analytics
- Access audit logs
- Export audit data
- Read-only access to data

---

### SYSTEM (Parallel - Service Role)
**Used By**: Background jobs, Cron tasks  
**Permissions**: 4  
**Cannot**: User-facing operations  

**Capabilities**:
- Create/update fines
- Read loan data
- Send notifications
- Calculate overdue fees

---

## 📊 Permission Matrix (50 Total Permissions)

### Book Management (5 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| Read Books | `book:read` | View book details | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Books | `book:create` | Add new books | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit Books | `book:update` | Modify book info | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete Books | `book:delete` | Remove books | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Search Books | `book:search` | Full-text search | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

### Physical Copy Management (5 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| Read Copy Info | `copy:read` | View copy status | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Copies | `copy:create` | Add physical copy | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update Copies | `copy:update` | Modify copy condition | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete Copies | `copy:delete` | Mark lost/damaged | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List Copies | `copy:list` | View all copies | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Member Management (6 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| Read Member | `member:read` | View member profile | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Register Member | `member:create` | Add new member | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit Member | `member:update` | Modify member info | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Member | `member:delete` | Remove member | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List Members | `member:list` | View all members | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Suspend Member | `member:suspend` | Block access | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Loan Operations (5 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| View Loan | `loan:read` | Check loan details | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Issue Loan | `loan:create` | Borrow book | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Renew Loan | `loan:update` | Extend due date | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Return Book | `loan:return` | Complete loan | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| List Loans | `loan:list` | View all loans | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Fine Management (5 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| View Fine | `fine:read` | Check fine amount | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Create Fine | `fine:create` | Auto/manual fine | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Waive Fine | `fine:waive` | Forgive/cancel | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List Fines | `fine:list` | View all fines | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Fine | `fine:delete` | Remove fine | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Payment Processing (5 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| View Payment | `payment:read` | Check payment info | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Record Payment | `payment:create` | Process transaction | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Refund Payment | `payment:refund` | Return money | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List Payments | `payment:list` | View all payments | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export Payments | `payment:export` | Download data | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Reports & Analytics (3 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| View Report | `report:read` | Check reports | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Create Report | `report:create` | Generate report | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export Report | `report:export` | Download report | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

### Admin Management (5 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| Create Admin | `admin:create` | Add staff member | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit Admin | `admin:update` | Modify admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete Admin | `admin:delete` | Remove admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List Admins | `admin:list` | View all admins | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Users | `admin:manage` | Update roles | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Settings & Configuration (3 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| View Settings | `settings:read` | Check config | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update Settings | `settings:update` | Change config | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| System Config | `system:config` | System setup | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Audit & Compliance (3 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| View Audit Log | `audit:read` | Check logs | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Export Audit | `audit:export` | Download logs | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Delete Audit | `audit:delete` | Remove logs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Notifications (2 permissions)

| Permission | Code | Description | Super | Admin | Lib | Member | Guest | Audit | System |
|------------|------|-------------|-------|-------|-----|--------|-------|-------|--------|
| Send Notify | `notification:send` | Send messages | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View Notify | `notification:read` | Check messages | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 🔑 Default Roleассуnd Setup

When system initializes, these roles are created:

```sql
-- Roles created in migration 0003
INSERT INTO roles (role_id, name, hierarchy_level, status) VALUES
  ('role_super_admin', 'super_admin', 0, 'active'),
  ('role_admin', 'admin', 1, 'active'),
  ('role_librarian', 'librarian', 2, 'active'),
  ('role_member', 'member', 3, 'active'),
  ('role_guest', 'guest', 4, 'active'),
  ('role_auditor', 'auditor', 5, 'active'),
  ('role_system', 'system', 6, 'active');
```

---

## 🔒 Permission Checking Flow

```typescript
// 1. User makes API request
POST /api/loans/create { copy_id, member_id }

// 2. Authentication Middleware
  ↓ Check JWT token validity
  ↓ Extract user_id, role_id from token
  ✅ Token valid, continue

// 3. RBAC Middleware
  ↓ Get required permission: 'loan:create'
  ↓ Query: SELECT * FROM role_permissions
           WHERE role_id = user.role_id
           AND permission_id = (SELECT id FROM permissions WHERE code = 'loan:create')
  ↓ Check if record exists
  ✅ Permission granted, continue

// 4. Business Logic
  ↓ Validate copy availability
  ↓ Validate member status
  ↓ Create loan record
  ✅ Loan created

// 5. Audit Log
  ↓ Log action: 'create', entity: 'loan', user_id, timestamp
  ✅ Logged

// 6. Response
  ↓ Return: { success: true, data: loan }
```

---

## 🛡️ Permission Hierarchy Rules

```typescript
// Rule 1: Higher hierarchy = more permissions
if (user.role.hierarchy_level < required.hierarchy_level) {
  throw new PermissionError("Insufficient privileges");
}

// Rule 2: Users can only modify lower-level users
if (target_user.role.hierarchy_level <= current_user.role.hierarchy_level) {
  throw new PermissionError("Cannot modify same or higher level");
}

// Rule 3: Members can only view their own data
if (user.role.name === 'member') {
  if (requested_member_id !== user.member_id) {
    throw new PermissionError("Cannot view other members' data");
  }
}

// Rule 4: Read-only operations allowed if 'read' permission exists
if (permission.code.startsWith('*:read')) {
  allow_operation();
}
```

---

## 📱 API Examples by Role

### Example 1: Librarian Issues Book
```bash
# Librarian has: loan:create, copy:read, member:read
POST /api/loans/create
Authorization: Bearer <librarian_token>
{
  "copy_id": "copy_abc123",
  "member_id": "member_xyz789"
}

# Flow:
# 1. Verify JWT token → OK
# 2. Check loan:create permission → ✅ Granted (Librarian has)
# 3. Validate copy status → ✅ Available
# 4. Validate member status → ✅ Active
# 5. Create loan → ✅ Success
# 6. Return: { loan_id, due_date, fine_per_day }
```

### Example 2: Guest Searches Books
```bash
# Guest has: book:read, book:search, copy:read
GET /api/books/search?q=python
Authorization: Bearer <guest_token>

# Flow:
# 1. Verify JWT token → OK
# 2. Check book:search permission → ✅ Granted (Guest has)
# 3. Execute full-text search → ✅ Success
# 4. Return: { books: [...], pagination: {...} }
```

### Example 3: Member Pays Fine
```bash
# Member has: payment:create, fine:read
POST /api/payments/create
Authorization: Bearer <member_token>
{
  "fine_id": "fine_123",
  "amount": "150",
  "method": "bkash"
}

# Flow:
# 1. Verify JWT token → OK
# 2. Check payment:create permission → ✅ Granted (Member has)
# 3. Verify fine belongs to member → ✅ Owned
# 4. Verify amount correct → ✅ Valid
# 5. Process payment → ✅ Success
# 6. Return: { receipt_url, transaction_id }
```

### Example 4: Admin Cannot Create Another Admin
```bash
# Admin lacks: admin:create (only Super Admin has)
POST /api/users/create-admin
Authorization: Bearer <admin_token>
{
  "email": "newadmin@library.org",
  "role": "admin"
}

# Flow:
# 1. Verify JWT token → OK
# 2. Check admin:create permission → ❌ Denied (Admin doesn't have)
# 3. Return error: { error: "Insufficient privileges" }
```

---

## 🧪 Testing Permission Checks

```typescript
// Test that Librarian can issue loans
test('Librarian can issue loan', async () => {
  const librarian = await createUser({ role: 'librarian' });
  const response = await api.loans.create({ 
    copy_id, member_id 
  }, { token: librarian.token });
  
  expect(response.success).toBe(true);
  expect(response.data.loan_id).toBeDefined();
});

// Test that Guest cannot issue loans
test('Guest cannot issue loan', async () => {
  const guest = await createUser({ role: 'guest' });
  const response = await api.loans.create({ 
    copy_id, member_id 
  }, { token: guest.token });
  
  expect(response.success).toBe(false);
  expect(response.error.code).toBe('ERR_PERMISSION_DENIED');
});

// Test that Member cannot waive fines
test('Member cannot waive fines', async () => {
  const member = await createUser({ role: 'member' });
  const response = await api.fines.waive({ 
    fine_id 
  }, { token: member.token });
  
  expect(response.success).toBe(false);
  expect(response.error.code).toBe('ERR_PERMISSION_DENIED');
});
```

---

## 🚀 Permission Best Practices

### DO ✅
- ✅ Check permissions server-side, never client-side
- ✅ Log all permission checks for audit
- ✅ Use specific permissions, not broad roles
- ✅ Verify user hierarchy on sensitive operations
- ✅ Implement data filtering based on role
- ✅ Cache permission queries in KV (1 hour TTL)
- ✅ Validate ownership before showing data

### DON'T ❌
- ❌ Trust client-provided role claims
- ❌ Skip permission checks for "admin" operations
- ❌ Mix authentication with authorization
- ❌ Hardcode role names in business logic
- ❌ Allow role escalation without audit
- ❌ Expose permission codes in error messages
- ❌ Cache permissions without TTL

---

## 📊 Permission Count by Role

| Role | Total | Read | Write | Delete | Admin |
|------|-------|------|-------|--------|-------|
| Super Admin | 50 | 15 | 22 | 8 | 5 |
| Admin | 45 | 15 | 22 | 5 | 3 |
| Librarian | 18 | 10 | 8 | 0 | 0 |
| Member | 10 | 5 | 5 | 0 | 0 |
| Guest | 3 | 3 | 0 | 0 | 0 |
| Auditor | 3 | 3 | 0 | 0 | 0 |
| System | 4 | 2 | 2 | 0 | 0 |

---

## 🔄 Adding New Permissions

When adding a new feature, follow these steps:

### 1. Define Permission
```sql
INSERT INTO permissions (permission_id, code, description, category)
VALUES ('perm_feature_new', 'feature:new', 'New feature access', 'admin');
```

### 2. Assign to Roles
```sql
INSERT INTO role_permissions (role_permission_id, role_id, permission_id)
VALUES 
  ('rp_admin_feature', 'role_admin', 'perm_feature_new'),
  ('rp_lib_feature', 'role_librarian', 'perm_feature_new');
```

### 3. Check in Middleware
```typescript
@requirePermission('feature:new')
async handleFeature(req: Request) {
  // Implementation
}
```

### 4. Log in Tests
```typescript
test('Feature accessible by admin', async () => {
  // Verify permission check
});
```

---

**Document Version**: 1.0  
**Last Updated**: March 18, 2026  
**Total Permissions**: 50  
**Total Roles**: 7  
**Total Permission Assignments**: 120+
