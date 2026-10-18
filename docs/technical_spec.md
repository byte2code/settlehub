# SettleHub Technical Specification & Artifact Analysis Report

**App Name**: SettleHub  
**Source Artifact**: `splitwise.apk` (Version: 26.9.1, VersionCode: 963, Package: `com.Splitwise.SplitwiseMobile`)  
**Analysis Engine**: JADX v1.5.6 Decompiler & Bytecode Inspector  
**Document Status**: Final Specification for Cleanroom Reimplementation  

---

## 1. Executive Summary & Package Layout

Inspection of the target Android package artifact (`./target/splitwise.apk`) revealed a multi-dex layout spanning 7 Dalvik Executable (`classes.dex` through `classes7.dex`) files totaling ~88MB of DEX bytecode. Analysis identified that all proprietary domain models, network clients, database schemas, and business logic reside within `classes3.dex`, `classes4.dex`, and `classes6.dex`.

### Key Package Architecture Discovered
```
com.Splitwise.SplitwiseMobile/
├── data/                  # Domain POJOs, parcelables, and calculation adapters
│   ├── Expense.java       # Core expense model with cost, currency, timestamps
│   ├── ExpenseTask.java   # Offline sync action queue (ADD, UPDATE, DELETE, UNDELETE)
│   ├── Group.java         # Group model containing members, original & simplified debts
│   ├── GroupMember.java   # Member reference with per-currency balances
│   ├── GroupRepayment.java# Directed debt edge (from, to, amount, currency)
│   ├── Person.java        # User profile (id, name, email, phone, avatar)
│   ├── Share.java         # Expense share entry (paid_share, owed_share, net_balance)
│   └── UserSplit.java     # User split wire contract (user_id, owed_share, email)
├── db/                    # GreenDAO ORM schema definitions (Schema Version 48)
│   ├── DaoMaster.java     # Master table registry and SQLite DDL execution
│   ├── ExpenseDao.java    # SQLite DDL & CRUD for table "EXPENSE"
│   ├── GroupDao.java      # SQLite DDL & CRUD for table "GROUP_"
│   ├── GroupMemberDao.java# SQLite DDL & CRUD for table "GROUP_MEMBER"
│   ├── GroupRepaymentDao.java # SQLite DDL & CRUD for table "GROUP_REPAYMENT"
│   ├── PersonDao.java     # SQLite DDL & CRUD for table "PERSON"
│   └── ShareDao.java      # SQLite DDL & CRUD for table "SHARE"
├── web/                   # Network communications and serialization
│   ├── ApiHostProvider.java   # Host URL resolver (Default: secure.splitwise.com)
│   ├── WebRequestHandler.java # OkHttp-based wire protocol with query/form flattening
│   ├── CoreApi.java           # High-level REST endpoint dispatchers
│   ├── ExpenseDeserializer.java # Jackson deserializer for expense structures
│   ├── GroupDeserializer.java   # Jackson deserializer for group & debt graphs
│   └── ShareDeserializer.java   # Jackson deserializer for split shares
└── views/                 # UI components and client-side calculation logic
    └── AddExpenseSplitFragment.java # Math for Equal, Unequal, Percent, and Cent distribution
```

---

## 2. API Contract & Wire Protocol

### 2.1 Host & Versioning
- **Base URL**: `https://secure.splitwise.com/api/v3.0` (with modern sub-services on `/api/v4.0`).
- **Transport Security**: TLS 1.3, HTTPS strictly enforced.
- **Request Headers**:
  - `Accept: application/json`
  - `Content-Type: application/json` or `multipart/form-data` (for legacy post requests / receipt attachments)
  - `Authorization: Bearer <access_token>` (or OAuth 1.0a HMAC-SHA1 header)
  - `X-Splitwise-Time-Zone: <IANA_TIMEZONE_ID>` (e.g., `America/New_York`)

### 2.2 Endpoint Registry
| HTTP Method | Route Path | Purpose | Key Parameters | Response Object |
|---|---|---|---|---|
| `GET` | `/get_current_user` | Current user profile | None | `{ "user": Person }` |
| `POST` | `/update_user/{id}` | Update user details | `first_name`, `last_name`, `email` | `{ "user": Person }` |
| `GET` | `/get_groups` | Fetch user groups | None | `{ "groups": Group[] }` |
| `GET` | `/get_group/{id}` | Fetch group details & balances | `id` (path) | `{ "group": Group }` |
| `POST` | `/create_group` | Create new expense group | `name`, `group_type`, `simplify_by_default`, `users__*` | `{ "group": Group }` |
| `POST` | `/update_group_settings/{id}` | Update group attributes | `name`, `simplify_by_default` | `{ "group": Group }` |
| `POST` | `/delete_group/{id}` | Delete group | `id` (path) | `{ "success": true }` |
| `POST` | `/add_users_to_group` | Add members to group | `group_id`, `users__*` | `{ "success": true }` |
| `POST` | `/remove_user_from_group` | Remove user from group | `group_id`, `user_id` | `{ "success": true }` |
| `GET` | `/get_expenses` | Fetch expenses list | `group_id`, `friend_id`, `dated_after`, `limit` | `{ "expenses": Expense[] }` |
| `GET` | `/get_expense/{id}` | Fetch single expense | `id` (path) | `{ "expense": Expense }` |
| `POST` | `/create_expense` | Create expense / settlement | `cost`, `description`, `date`, `group_id`, `users__*`, `payment` | `{ "expenses": [Expense] }` |
| `POST` | `/update_expense/{id}` | Update existing expense | `id` (path), `cost`, `users__*` | `{ "expenses": [Expense] }` |
| `POST` | `/delete_expense/{id}` | Soft-delete expense | `id` (path) | `{ "success": true }` |
| `POST` | `/undelete_expense/{id}` | Restore deleted expense | `id` (path) | `{ "success": true }` |
| `GET` | `/get_friends` | List 1-on-1 friend balances | None | `{ "friends": Friendship[] }` |
| `GET` | `/get_categories` | List expense categories | None | `{ "categories": Category[] }` |

---

## 3. JSON Data Schemas & Payload Structures

### 3.1 Expense Creation / Update Payload (`POST /create_expense`)
Parameters are sent either as nested JSON or flattened form fields (`users__0__user_id`, etc.):

```json
{
  "cost": "45.00",
  "description": "Team Dinner",
  "currency_code": "USD",
  "date": "2026-10-18T20:00:00Z",
  "group_id": 101,
  "category_id": 15,
  "details": "Burgers and drinks",
  "creation_method": "equal",
  "payment": false,
  "users": [
    {
      "user_id": 1001,
      "paid_share": "45.00",
      "owed_share": "15.00"
    },
    {
      "user_id": 1002,
      "paid_share": "0.00",
      "owed_share": "15.00"
    },
    {
      "user_id": 1003,
      "paid_share": "0.00",
      "owed_share": "15.00"
    }
  ]
}
```

### 3.2 Settlement Payment Payload (`payment: true`)
A debt settlement between two peers is modeled identically to an expense, flagged with `payment: true`:
```json
{
  "cost": "15.00",
  "description": "Settle Up: Alice paid Bob",
  "currency_code": "USD",
  "date": "2026-10-18T21:00:00Z",
  "group_id": 101,
  "payment": true,
  "creation_method": "payment",
  "users": [
    {
      "user_id": 1002,
      "paid_share": "15.00",
      "owed_share": "0.00"
    },
    {
      "user_id": 1001,
      "paid_share": "0.00",
      "owed_share": "15.00"
    }
  ]
}
```

### 3.3 Group Details Response Payload (`GET /get_group/{id}`)
```json
{
  "group": {
    "id": 101,
    "name": "Ski Trip 2026",
    "group_type": "trip",
    "updated_at": "2026-10-18T19:30:00Z",
    "simplify_by_default": true,
    "simplified_debts_saved_repayments": 2,
    "members": [
      {
        "id": 1001,
        "first_name": "Alice",
        "last_name": "Smith",
        "email": "alice@example.com",
        "balance": [
          {
            "currency_code": "USD",
            "amount": "30.00"
          }
        ]
      },
      {
        "id": 1002,
        "first_name": "Bob",
        "last_name": "Jones",
        "email": "bob@example.com",
        "balance": [
          {
            "currency_code": "USD",
            "amount": "-15.00"
          }
        ]
      },
      {
        "id": 1003,
        "first_name": "Charlie",
        "last_name": "Brown",
        "email": "charlie@example.com",
        "balance": [
          {
            "currency_code": "USD",
            "amount": "-15.00"
          }
        ]
      }
    ],
    "original_debts": [
      {
        "from": 1002,
        "to": 1001,
        "amount": "15.00",
        "currency_code": "USD"
      },
      {
        "from": 1003,
        "to": 1001,
        "amount": "15.00",
        "currency_code": "USD"
      }
    ],
    "simplified_debts": [
      {
        "from": 1002,
        "to": 1001,
        "amount": "15.00",
        "currency_code": "USD"
      },
      {
        "from": 1003,
        "to": 1001,
        "amount": "15.00",
        "currency_code": "USD"
      }
    ]
  }
}
```

---

## 4. Database Schema (Extracted SQLite DDL)

Extracted directly from `DaoMaster.java` and individual GreenDAO classes:

```sql
-- 1. Users / Contacts Table
CREATE TABLE "PERSON" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "PERSON_ID" INTEGER UNIQUE,
    "FIRST_NAME" TEXT NOT NULL,
    "LAST_NAME" TEXT,
    "EMAIL" TEXT,
    "PHONE" TEXT,
    "CURRENCY_CODE" TEXT DEFAULT 'USD',
    "IMAGE_PATH" TEXT,
    "LARGE_IMAGE_PATH" TEXT,
    "COUNTRY_CODE" TEXT,
    "ADDRESS_BOOK_PHONE_NUMBER" TEXT
);
CREATE INDEX IDX_PERSON_PERSON_ID ON "PERSON" ("PERSON_ID");

-- 2. Expense Groups Table
CREATE TABLE "GROUP_" (
    "GROUP_ID" INTEGER PRIMARY KEY,
    "NAME" TEXT NOT NULL,
    "GROUP_TYPE" TEXT,
    "UPDATED_AT" INTEGER,
    "SIMPLIFY_BY_DEFAULT" INTEGER DEFAULT 1,
    "WHITEBOARD" TEXT,
    "INVITE_LINK" TEXT,
    "IMAGE_PATH" TEXT,
    "LARGE_IMAGE_PATH" TEXT,
    "CUSTOM_AVATAR" INTEGER DEFAULT 0,
    "COVER_PHOTO_PATH" TEXT,
    "LARGE_COVER_PHOTO_IMAGE_PATH" TEXT,
    "SIMPLIFIED_DEBTS_SAVED_REPAYMENTS" INTEGER DEFAULT 0,
    "TALL_AVATAR_PATH" TEXT,
    "GROUP_REMINDERS_JSON" TEXT,
    "SHOW_ROOT_SETTLE_UP" INTEGER DEFAULT 1,
    "WHITEBOARD_LOCK_VERSION" INTEGER DEFAULT 0,
    "WHITEBOARD_UPDATED_AT" INTEGER,
    "WHITEBOARD_UPDATED_BY" INTEGER,
    "ACTIVE_PRO_PASS" TEXT
);
CREATE INDEX IDX_GROUP__GROUP_ID ON "GROUP_" ("GROUP_ID");

-- 3. Group Members Join Table
CREATE TABLE "GROUP_MEMBER" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "GROUP_ID" INTEGER NOT NULL REFERENCES "GROUP_"("GROUP_ID") ON DELETE CASCADE,
    "PERSON_ID" INTEGER NOT NULL REFERENCES "PERSON"("PERSON_ID") ON DELETE CASCADE,
    "DEFAULT_SPLIT_JSON" TEXT
);
CREATE INDEX IDX_GROUP_MEMBER_GROUP_ID ON "GROUP_MEMBER" ("GROUP_ID");

-- 4. Group Member Cumulative Balance Table
CREATE TABLE "GROUP_MEMBER_BALANCE" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "AMOUNT" REAL NOT NULL,
    "CURRENCY_CODE" TEXT NOT NULL,
    "MEMBER_ID" INTEGER NOT NULL REFERENCES "GROUP_MEMBER"("_id") ON DELETE CASCADE
);
CREATE INDEX IDX_GROUP_MEMBER_BALANCE_MEMBER_ID ON "GROUP_MEMBER_BALANCE" ("MEMBER_ID");

-- 5. Calculated Debt Edges (Repayments) Table
CREATE TABLE "GROUP_REPAYMENT" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "AMOUNT" REAL NOT NULL,
    "CURRENCY_CODE" TEXT NOT NULL,
    "GROUP_ID" INTEGER NOT NULL REFERENCES "GROUP_"("GROUP_ID") ON DELETE CASCADE,
    "FROM_PERSON_ID" INTEGER NOT NULL REFERENCES "PERSON"("PERSON_ID"),
    "TO_PERSON_ID" INTEGER NOT NULL REFERENCES "PERSON"("PERSON_ID")
);
CREATE INDEX IDX_GROUP_REPAYMENT_GROUP_ID ON "GROUP_REPAYMENT" ("GROUP_ID");
CREATE INDEX IDX_GROUP_REPAYMENT_FROM_PERSON_ID_TO_PERSON_ID ON "GROUP_REPAYMENT" ("FROM_PERSON_ID", "TO_PERSON_ID");

-- 6. Expenses Table
CREATE TABLE "EXPENSE" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "EXPENSE_ID" INTEGER UNIQUE,
    "GROUP_ID" INTEGER REFERENCES "GROUP_"("GROUP_ID") ON DELETE CASCADE,
    "DESCRIPTION" TEXT NOT NULL,
    "PAYMENT" INTEGER DEFAULT 0,
    "COST" REAL NOT NULL,
    "DATE" INTEGER NOT NULL,
    "UPDATED_AT" INTEGER,
    "CREATED_AT" INTEGER,
    "DELETED_AT" INTEGER,
    "CURRENCY_CODE" TEXT NOT NULL DEFAULT 'USD',
    "CREATED_BY_ID" INTEGER REFERENCES "PERSON"("PERSON_ID"),
    "CATEGORY_ID" INTEGER,
    "NOTES" TEXT,
    "RECEIPT_PATH" TEXT,
    "ORIGINAL_RECEIPT_PATH" TEXT,
    "COMMENTS_COUNT" INTEGER DEFAULT 0,
    "ERROR_BIT" INTEGER DEFAULT 0,
    "TRANSACTION_ID" TEXT,
    "TRANSACTION_METHOD" TEXT,
    "TRANSACTION_CONFIRMED" INTEGER DEFAULT 0,
    "CREATION_METHOD" TEXT DEFAULT 'equal',
    "REPEAT_INTERVAL" TEXT DEFAULT 'never',
    "EMAIL_REMINDER_DAYS_IN_ADVANCE" INTEGER,
    "NEXT_REPEAT_TIMESTAMP" INTEGER,
    "GUID" TEXT,
    "UPDATED_BY_ID" INTEGER,
    "DELETED_BY_ID" INTEGER,
    "TRANSACTION_STATUS" TEXT
);
CREATE INDEX IDX_EXPENSE_GROUP_ID ON "EXPENSE" ("GROUP_ID");
CREATE INDEX IDX_EXPENSE_DATE ON "EXPENSE" ("DATE");
CREATE INDEX IDX_EXPENSE_TRANSACTION_ID ON "EXPENSE" ("TRANSACTION_ID");

-- 7. Expense Shares (Splits) Table
CREATE TABLE "SHARE" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "NET_BALANCE" REAL NOT NULL,
    "OWED_SHARE" REAL NOT NULL,
    "PAID_SHARE" REAL NOT NULL,
    "PERSON_ID" INTEGER NOT NULL REFERENCES "PERSON"("PERSON_ID"),
    "EXPENSE_ID" INTEGER NOT NULL REFERENCES "EXPENSE"("EXPENSE_ID") ON DELETE CASCADE
);
CREATE INDEX IDX_SHARE_PERSON_ID ON "SHARE" ("PERSON_ID");
CREATE INDEX IDX_SHARE_EXPENSE_ID ON "SHARE" ("EXPENSE_ID");

-- 8. Offline Task Sync Queue
CREATE TABLE "EXPENSE_TASK" (
    "_id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "NAME" TEXT NOT NULL,
    "STATUS" TEXT NOT NULL,
    "EXPENSE_ID" INTEGER,
    "DATA" BLOB,
    "ERROR_STRING" TEXT,
    "CREATED_AT" INTEGER,
    "TASK_CREATED_AT" INTEGER
);
```

---

## 5. Reverse-Engineered Business Logic & Mathematical Models

### 5.1 Cent-Precision Split Calculation (`divideFairly`)
In `AddExpenseSplitFragment.java`, Splitwise prevents floating-point rounding errors by scaling all currency operations to cents (`x * 100.0d`):

```java
// Extracted from AddExpenseSplitFragment.java:divideFairly
long totalCents = Math.round(cost * 100.0);
long baseCents = totalCents / count;
long residualCents = totalCents % count;

// The first 'residualCents' participants receive (baseCents + 1)
// The remaining participants receive baseCents.
// Sum of shares is guaranteed: (residual * (base + 1)) + ((count - residual) * base) == totalCents
```

#### Splitting Modes:
1. **Equal Split (`equal`)**:
   - Total cents divided by $N$ active participants.
   - Fractional residual cents ($R < N$) are allocated $1\text{c}$ each to the first $R$ users.
2. **Exact / Unequal Split (`unequal`)**:
   - Each participant's exact amount is verified: $\sum \text{owed\_share} == \text{cost}$.
   - If sum deviates by even 1 cent, the form fails validation with an error.
3. **Percentage Split (`percent`)**:
   - $\text{owed\_share}_i = \text{round}\left(\frac{\text{percent}_i \times \text{cost}}{100.0}\right)$.
   - Percentages must sum to $100.00\%$. Any discrepancy due to rounding (`totalCents - sum(owedCents)`) is balanced by adjusting 1 cent successively until exact match.

### 5.2 Debt Simplification Engine (Dual Max-Heap Min-Cash-Flow)
For any group of $N$ users, let $B_i$ be the net balance of user $i$:
$$B_i = \sum \text{Paid}_i - \sum \text{Owed}_i$$
Conservation of money implies $\sum_{i=1}^N B_i = 0$.

#### Algorithm:
1. Initialize two heaps:
   - `CreditorHeap` (Max-heap of users with $B_i > 0$, keyed by $B_i$)
   - `DebtorHeap` (Max-heap of users with $B_i < 0$, keyed by $|B_i|$)
2. While both heaps are non-empty:
   - Pop maximum creditor $C$ (owed $Y$) and maximum debtor $D$ (owes $X$).
   - Compute settlement amount $M = \min(X, Y)$.
   - Emit debt settlement edge: $D \xrightarrow{\quad M \quad} C$.
   - Update $X' = X - M$ and $Y' = Y - M$.
   - If $X' > 0$, reinsert $D$ with balance $-X'$.
   - If $Y' > 0$, reinsert $C$ with balance $Y'$.
3. **Guarantees**:
   - Complexity: $O(N \log N)$.
   - Generates at most $N-1$ transactions.
   - Eliminates all transitive and cyclical debts.

---

## 6. SettleHub Cleanroom Target Architecture

To build a modern, high-performance, free-tier deployment compliant system, we adapt the reverse-engineered specs into the following cleanroom architecture:

```
                          ┌───────────────────────────┐
                          │   Cloudflare Pages SPA    │
                          │   React 18 + Vite + TS    │
                          │   Tailwind CSS + Lucide   │
                          └─────────────┬─────────────┘
                                        │ HTTPS / JWT
                                        ▼
                          ┌───────────────────────────┐
                          │     Render.com Web        │
                          │   Spring Boot 3.3.x       │
                          │   Java 21 Virtual Threads │
                          │   512MB RAM Tuning        │
                          └─────────────┬─────────────┘
                                        │ JDBC (SSL)
                                        ▼
                          ┌───────────────────────────┐
                          │    PostgreSQL 16          │
                          │   Render or Neon.tech     │
                          └───────────────────────────┘
```

### 6.1 Cleanroom REST API Routes (`/api/v1/...`)
- `POST /api/v1/auth/register` - Create user account and return JWT.
- `POST /api/v1/auth/login` - Authenticate and return JWT.
- `GET /api/v1/auth/me` - Get current authenticated user profile.
- `GET /api/v1/groups` - List groups for user with net balance badges.
- `POST /api/v1/groups` - Create new group with initial member list.
- `GET /api/v1/groups/{id}` - Get group details with members and balance summary.
- `GET /api/v1/groups/{id}/expenses` - Paginated chronological activity feed.
- `POST /api/v1/groups/{id}/expenses` - Create expense (equal, exact, percentage, or multi-payer).
- `DELETE /api/v1/groups/{id}/expenses/{expenseId}` - Delete expense and recalculate balances.
- `GET /api/v1/groups/{id}/balances` - Pairwise original debt matrix.
- `GET /api/v1/groups/{id}/simplified-debts` - Simplified debt graph computed via Max-Heap algorithm.
- `POST /api/v1/settlements` - Record peer settlement payment (`payment: true`).

### 6.2 Cent-Precision Representation in Backend
To guarantee zero floating-point imprecision, JPA entities store amounts as `Long totalCents` with helper accessors for `BigDecimal` and formatted display strings.
