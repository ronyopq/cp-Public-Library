# API Documentation

Public Library Management System API Reference.

## Base URL

- **Development**: `http://localhost:8787`
- **Production**: `https://api.library.bd` (after deployment)

## Authentication

All endpoints except health checks and public endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Error Response Format

All errors are returned in this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "বার্তা বাংলায়",
    "message_en": "English message",
    "details": {}
  },
  "timestamp": "2024-03-18T12:00:00Z"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `INTERNAL_ERROR` | 500 | Server error |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `ACCOUNT_LOCKED` | 403 | Account locked after failed logins |
| `DUPLICATE` | 409 | Resource already exists |

---

## Endpoints

### Health Checks

#### `GET /health`
System health status.

**Response**: `200 OK`
```json
{
  "status": "ok",
  "version": "1.0.0-alpha",
  "timestamp": "2024-03-18T12:00:00Z"
}
```

#### `GET /health/db`
Database connectivity check.

**Response**: `200 OK`
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

### Authentication

#### `POST /api/auth/login`
Authenticate user with email and password.

**Body**:
```json
{
  "email": "user@library.bd",
  "password": "SecurePassword123"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "usr_abc123",
      "email": "user@library.bd",
      "full_name": "User Name",
      "role_id": "role_librarian",
      "role": { "name": "Librarian" }
    },
    "expiresIn": 900
  }
}
```

**Error**: `401 INVALID_CREDENTIALS` | `403 ACCOUNT_LOCKED`

---

#### `GET /api/auth/me`
Get current authenticated user.

**Auth**: Required  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "usr_abc123",
    "email": "user@library.bd",
    "full_name": "User Name",
    "role_id": "role_librarian",
    "role": { "name": "Librarian", "description": "..." },
    "permissions": [
      "books:read",
      "books:create",
      "loans:create",
      ...
    ]
  }
}
```

---

#### `POST /api/auth/change-password`
Change user password.

**Auth**: Required  
**Body**:
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword456"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।"
  }
}
```

**Error**: `400 VALIDATION_ERROR` | `401 INVALID_CREDENTIALS`

---

#### `POST /api/auth/logout`
Logout and invalidate token.

**Auth**: Required  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "লগ আউট সফল।"
  }
}
```

---

### Books

#### `GET /api/books`
List all public books (paginated).

**Auth**: Optional (public access, but staff see more data)  
**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 50, max: 100)
- `search` (string, optional) - Search by title/author/ISBN
- `category` (string, optional) - Filter by category
- `sort` (string, default: 'newest') - newest | popular | title

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "bib_123",
        "title": "Book Title",
        "isbn": "978-0-123456-78-9",
        "edition": "1st",
        "description": "...",
        "authors": ["Author Name"],
        "publisher": { "id": "pub_1", "name": "Publisher" },
        "category": { "id": "cat_fiction", "name": "Fiction" },
        "language": { "code": "bn", "name": "Bangla" },
        "total_copies": 5,
        "available_copies": 3,
        "cover_image_url": "https://r2.library.bd/covers/bib_123.jpg"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 50,
    "hasMore": true
  }
}
```

---

#### `GET /api/books/:id`
Get single book with full details.

**Auth**: Optional  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "bib_123",
    "title": "Book Title",
    "isbn": "978-0-123456-78-9",
    "edition": "1st",
    "copyright_year": 2020,
    "description": "Book description",
    "authors": ["Author 1", "Author 2"],
    "contributors": [
      {
        "id": "bib_contrib_1",
        "name": "Editor Name",
        "role": "EDITOR"
      }
    ],
    "publisher": { "id": "pub_1", "name": "Publisher", "country": "BD" },
    "category": { "id": "cat_fiction", "name": "Fiction" },
    "language": { "code": "bn", "name": "Bangla" },
    "series": "Optional Series Name",
    "cover_image_url": "https://r2.library.bd/covers/bib_123.jpg",
    "copies": [
      {
        "id": "copy_1",
        "accession_number": "24-0001",
        "barcode": "9780123456789",
        "condition": "GOOD",
        "is_available": true,
        "shelf": { "location": "Room A / Rack 2 / Shelf 3" }
      }
    ],
    "statistics": {
      "total_copies": 5,
      "available_copies": 3,
      "total_issued": 142,
      "current_loans": 2
    }
  }
}
```

---

#### `POST /api/books`
Create a new bibliographic record.

**Auth**: Required (Librarian+)  
**Permission**: `books:create`  
**Body**:
```json
{
  "title": "Nayok",
  "isbn": "978-984-1234-56-7",
  "edition": "1st",
  "copyright_year": 2020,
  "description": "A Bengali novel about...",
  "author_ids": ["auth_1", "auth_2"],
  "publisher_id": "pub_1",
  "category_id": "cat_fiction",
  "language_id": "lang_bn",
  "series": "Optional Series",
  "is_visible": true
}
```

**Response**: `201 CREATED`
```json
{
  "success": true,
  "data": {
    "id": "bib_123",
    "title": "Nayok",
    "message": "বই সফলভাবে যোগ করা হয়েছে।"
  }
}
```

**Error**: `400 VALIDATION_ERROR` | `409 DUPLICATE` (ISBN exists)

---

#### `POST /api/books/:id/copies`
Add a physical copy of a book.

**Auth**: Required (Librarian+)  
**Permission**: `books:create`  
**Body**:
```json
{
  "condition": "NEW",
  "acquisition_type": "PURCHASE",
  "acquisition_date": "2024-03-01",
  "acquisition_cost": 250.00,
  "acquisition_notes": "Donated by...",
  "shelf_id": "shelf_1"
}
```

**Response**: `201 CREATED`
```json
{
  "success": true,
  "data": {
    "id": "copy_123",
    "accession_number": "24-0002",
    "barcode": "9780984123456",
    "condition": "NEW",
    "is_available": true,
    "message": "কপি সফলভাবে যোগ করা হয়েছে।"
  }
}
```

---

### Members

#### `GET /api/members`
List all members (role-based access).

**Auth**: Required  
**Permission**: `members:read`  
**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 50, max: 100)
- `search` (string, optional) - Search by name/phone
- `status` (enum) - ACTIVE | EXPIRED | SUSPENDED
- `sort` (string) - name | joined | active_loans

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mem_123",
        "full_name": "Member Name",
        "phone": "+8801712345678",
        "address": "Address, City",
        "membership_number": "M240001",
        "membership_type": "GENERAL",
        "membership_status": "ACTIVE",
        "membership_start": "2024-01-01",
        "membership_expiry": "2025-01-01",
        "total_books_issued": 15,
        "current_loans": 2,
        "outstanding_fine": 0,
        "joined_at": "2024-01-01"
      }
    ],
    "total": 250,
    "page": 1,
    "hasMore": false
  }
}
```

---

#### `GET /api/members/:id`
Get member details with loan and fine history.

**Auth**: Required  
**Permission**: `members:read`  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "mem_123",
    "full_name": "Member Name",
    "phone": "+8801712345678",
    "email": "member@email.com",
    "address": "Address",
    "city": "Dhaka",
    "membership_number": "M240001",
    "membership_type": "GENERAL",
    "membership_status": "ACTIVE",
    "membership_start": "2024-01-01",
    "membership_expiry": "2025-01-01",
    "statistics": {
      "total_books_issued": 15,
      "total_books_returned": 13,
      "current_loans": 2,
      "overdue_count": 1,
      "outstanding_fine": 50,
      "total_paid_fine": 100
    },
    "current_loans": [
      {
        "id": "loan_1",
        "book_title": "Book Name",
        "issued_date": "2024-03-01",
        "due_date": "2024-03-15",
        "is_overdue": true,
        "days_overdue": 3
      }
    ],
    "recent_fines": [
      {
        "id": "fine_1",
        "amount": 50,
        "status": "PENDING",
        "calculated_date": "2024-03-15"
      }
    ]
  }
}
```

---

#### `POST /api/members`
Register a new member.

**Auth**: Required  
**Permission**: `members:create`  
**Body**:
```json
{
  "full_name": "New Member",
  "phone": "+8801712345678",
  "address": "House 10, Road 5",
  "city": "Dhaka",
  "membership_type": "GENERAL"
}
```

**Response**: `201 CREATED`
```json
{
  "success": true,
  "data": {
    "id": "mem_new",
    "membership_number": "M240251",
    "membership_start": "2024-03-18",
    "membership_expiry": "2025-03-18",
    "message": "সদস্য সফলভাবে নিবন্ধন করা হয়েছে।"
  }
}
```

**Error**: `400 VALIDATION_ERROR` | `409 DUPLICATE` (Phone exists)

---

### Loans

#### `GET /api/loans`
List all loans (paginated).

**Auth**: Required  
**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 50)
- `status` (enum) - ACTIVE | RETURNED | LOST
- `member_id` (string, optional)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "loan_123",
        "member_name": "Member Name",
        "book_title": "Book Title",
        "accession_number": "24-0001",
        "issued_date": "2024-03-01",
        "due_date": "2024-03-15",
        "returned_date": null,
        "status": "ACTIVE",
        "is_overdue": true,
        "days_overdue": 3,
        "renewal_count": 1
      }
    ],
    "total": 45,
    "page": 1,
    "hasMore": false
  }
}
```

---

#### `POST /api/loans`
Issue a loan (create new loan record).

**Auth**: Required  
**Permission**: `loans:create`  
**Body**:
```json
{
  "member_id": "mem_123",
  "book_copy_id": "copy_456"
}
```

**Response**: `201 CREATED`
```json
{
  "success": true,
  "data": {
    "id": "loan_new",
    "member_id": "mem_123",
    "book_title": "Book Title",
    "due_date": "2024-03-28",
    "message": "লোন সফলভাবে তৈরি হয়েছে। ফেরত দেওয়ার তারিখ: ২৮/০৩/২০২৪"
  }
}
```

**Error**: `404 NOT_FOUND` | `400 VALIDATION_ERROR` (Member inactive, copy unavailable, max loans reached)

---

#### `POST /api/loans/:id/return`
Return a loan.

**Auth**: Required  
**Permission**: `loans:return`  
**Body**:
```json
{
  "copy_condition": "GOOD",
  "staff_notes": "Returned in good condition"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "loan_id": "loan_123",
    "status": "RETURNED",
    "is_overdue": true,
    "fine_created": true,
    "fine_id": "fine_new",
    "message": "লোন ফেরত দেওয়া হয়েছে। বিলম্ব ফি প্রয়োজনীয়।"
  }
}
```

---

#### `POST /api/loans/:id/renew`
Renew a loan (extend due date).

**Auth**: Required  
**Permission**: `loans:renew`  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "loan_id": "loan_123",
    "new_due_date": "2024-04-11",
    "renewal_count": 2,
    "message": "লোন নবায়ন করা হয়েছে। নতুন ফেরত দেওয়ার তারিখ: ১১/০৪/২০২৪"
  }
}
```

**Error**: `400 VALIDATION_ERROR` (Max renewals reached)

---

#### `GET /api/loans/due-soon`
Get loans due within next 3 days (Dashboard).

**Auth**: Required  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "loan_1",
      "member_name": "Member Name",
      "phone": "+8801712345678",
      "book_title": "Book Title",
      "due_date": "2024-03-20",
      "days_until_due": 2
    }
  ]
}
```

---

### Fines

#### `GET /api/fines`
List all fines (paginated).

**Auth**: Required  
**Permission**: `fines:read`  
**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 50)
- `status` (enum) - PENDING | PAID | PARTIAL | WAIVED
- `member_id` (string, optional)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "fine_123",
        "member_name": "Member Name",
        "amount": 50,
        "fine_type": "OVERDUE",
        "status": "PENDING",
        "calculated_date": "2024-03-15",
        "due_date": "2024-03-28"
      }
    ],
    "total": 12,
    "page": 1
  }
}
```

---

#### `POST /api/fines`
Create a manual fine.

**Auth**: Required  
**Permission**: `fines:create`  
**Body**:
```json
{
  "member_id": "mem_123",
  "loan_id": "loan_123",
  "fine_type": "DAMAGE",
  "amount": 100,
  "notes": "Book cover damaged"
}
```

**Response**: `201 CREATED`
```json
{
  "success": true,
  "data": {
    "id": "fine_new",
    "member_id": "mem_123",
    "amount": 100,
    "status": "PENDING",
    "message": "ফি সফলভাবে তৈরি হয়েছে।"
  }
}
```

---

#### `POST /api/fines/:id/waive`
Waive (forgive) a fine.

**Auth**: Required  
**Permission**: `fines:waive`  
**Body**:
```json
{
  "waive_reason": "Policy override - member has good record"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "fine_123",
    "status": "WAIVED",
    "waived_amount": 50,
    "message": "ফি মাফ করা হয়েছে।"
  }
}
```

---

#### `GET /api/fines/member/:memberId`
Get all fines for a member with summary.

**Auth**: Required  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "fines": [...],
    "summary": {
      "total_pending": 150,
      "total_paid": 300,
      "total_waived": 50,
      "outstanding": 150
    }
  }
}
```

---

### Payments

#### `GET /api/payments`
List all payments (paginated).

**Auth**: Required  
**Permission**: `payments:read`  
**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 50)
- `payment_type` (enum, optional)
- `fine_id` (string, optional)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "pay_123",
        "member_name": "Member Name",
        "amount": 50,
        "payment_type": "CASH",
        "fine_type": "OVERDUE",
        "created_at": "2024-03-18T12:00:00Z"
      }
    ],
    "total": 25,
    "page": 1
  }
}
```

---

#### `POST /api/payments`
Record a payment against a fine.

**Auth**: Required  
**Permission**: `payments:create`  
**Body**:
```json
{
  "fine_id": "fine_123",
  "amount": 50,
  "payment_type": "CASH",
  "notes": "Paid in cash at counter"
}
```

**Response**: `201 CREATED`
```json
{
  "success": true,
  "data": {
    "payment_id": "pay_new",
    "receipt_id": "rec_new",
    "receipt_number": "RCP-20240318-ABC123",
    "amount": 50,
    "fine_status": "PAID",
    "message": "পেমেন্ট সফলভাবে রেকর্ড করা হয়েছে। ফি সম্পূর্ণভাবে পরিশোধ করা হয়েছে।"
  }
}
```

---

#### `GET /api/payments/member/:memberId/outstanding`
Get member's outstanding fines (not yet paid).

**Auth**: Required  
**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "total_outstanding": 150,
    "total_fines": 3,
    "fines": [
      {
        "id": "fine_1",
        "amount": 50,
        "fine_type": "OVERDUE",
        "status": "PENDING",
        "book_title": "Book Name",
        "issued_date": "2024-03-01",
        "due_date": "2024-03-15"
      }
    ]
  }
}
```

---

## Rate Limiting

Global rate limiting is applied:

- **Global**: 100 requests/minute per IP address
- **Per User**: 20 requests/minute per user per endpoint
- **Headers**:
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 99
  X-RateLimit-Reset: 1234567890
  ```

---

## Pagination

Paginated endpoints use standard query parameters:

```
GET /api/books?page=2&limit=25
```

Response includes:
```json
{
  "items": [...],
  "total": 150,
  "page": 2,
  "limit": 25,
  "hasMore": true
}
```

---

## Timestamps

All timestamps are in UTC (ISO 8601 format):
```
2024-03-18T12:00:00Z
```

Convert to local time (Asia/Dhaka) on the client side.

---

## Testing with cURL

```bash
# Health check
curl http://localhost:8787/health

# Login
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@library.bd","password":"Password123"}'

# Get current user (replace TOKEN)
curl http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer TOKEN"

# List books
curl http://localhost:8787/api/books

# Issue a loan
curl -X POST http://localhost:8787/api/loans \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"member_id":"mem_123","book_copy_id":"copy_456"}'
```

---

**Last Updated**: March 18, 2024  
**Version**: 1.0.0-alpha
