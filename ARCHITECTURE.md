# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│                     http://localhost:3000                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Parent     │  │    Child     │  │   Family     │      │
│  │  Dashboard   │  │  Wishlist    │  │   Member     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  PocketBase    │                        │
│                    │   API Client   │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PocketBase    │
                    │     Server      │
                    │   (Backend)     │
                    │ localhost:8090  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    SQLite DB    │
                    │   (pb_data)     │
                    └─────────────────┘
```

## Data Flow

### Adding a Wishlist Item (Child → Parent → Family)

```
1. Child Login
   └─> Child enters ID + PIN
       └─> Verified against Children collection
           └─> Session created

2. Add Item
   └─> Child fills form (title, price, description, etc.)
       └─> POST to /api/collections/items/records
           └─> Item created with status="pending"
               └─> Linked to child record

3. Parent Review
   └─> Parent sees item in "Review Items"
       └─> Approves item
           └─> PATCH to /api/collections/items/records/{id}
               └─> status="approved", approved_at=now()

4. Family View
   └─> Family member sees approved item
       └─> GET /api/collections/items/records
           └─> Filter: status="approved"
               └─> Item appears in family view
```

### Reserving a Gift (Family Member)

```
1. Family Member Views Item
   └─> GET /api/collections/items/records
       └─> Filter: status="approved"
           └─> Expand: reservations_via_item

2. Reserve Gift
   └─> Click "Reserve This Gift"
       └─> POST to /api/collections/reservations/records
           └─> Creates reservation record
               └─> Links: item_id + user_id
                   └─> purchased=false

3. Real-time Update
   └─> Other family members see "Reserved" badge
       └─> PocketBase subscription pushes update
           └─> Button changes to "Reserved by Another"
```

## Database Schema

```
┌──────────────┐
│    users     │
├──────────────┤
│ id           │◄──────────┐
│ email        │           │
│ password     │           │ parent
│ name         │           │
│ role         │           │
└──────────────┘           │
                           │
┌──────────────┐           │
│   children   │           │
├──────────────┤           │
│ id           │◄──────────┘
│ name         │           │
│ age          │           │
│ pin          │           │
│ target_budget│           │
└──────┬───────┘           │
       │                   │
       │ child             │
       │                   │
┌──────▼───────┐           │
│    items     │           │
├──────────────┤           │
│ id           │◄──────────┘
│ title        │
│ description  │
│ url          │
│ price        │
│ image_url    │
│ status       │
│ rejection_   │
│   reason     │
│ approved_at  │
└──────┬───────┘
       │
       │ item
       │
┌──────▼───────────┐
│  reservations    │
├──────────────────┤
│ id               │
│ reserved_by      │─────┐
│ purchased        │     │
│ notes            │     │
└──────────────────┘     │
                         │
                         │ reserved_by
                         │
                    ┌────▼─────┐
                    │  users   │
                    └──────────┘
```

## User Roles & Permissions

```
┌─────────────┐
│   PARENT    │
├─────────────┤
│ Can:        │
│ • CRUD children
│ • Review all items
│ • Approve/reject items
│ • View all reservations
│ • View equity dashboard
│ • Manage family members
└─────────────┘

┌─────────────┐
│    CHILD    │
├─────────────┤
│ Can:        │
│ • Create items (own)
│ • Read items (own)
│ • Update items (own, pending only)
│ • Delete items (own, pending only)
│ Cannot:     │
│ • See reservations
│ • Approve items
└─────────────┘

┌─────────────┐
│   FAMILY    │
├─────────────┤
│ Can:        │
│ • Read approved items
│ • Create reservations
│ • Update own reservations
│ • Delete own reservations
│ Cannot:     │
│ • See pending items
│ • See other's reservations
│ • Modify items
└─────────────┘
```

## Component Hierarchy

```
App.jsx
├─> BrowserRouter
    ├─> Routes
        ├─> Login.jsx
        │   └─> Multi-role login form
        │
        ├─> FamilySignup.jsx
        │   └─> Registration form
        │
        ├─> ParentDashboard.jsx
        │   ├─> ManageChildren.jsx
        │   │   └─> Child CRUD + credentials
        │   ├─> ReviewItems.jsx
        │   │   └─> Approve/reject workflow
        │   ├─> EquityDashboard.jsx
        │   │   └─> Balance tracking
        │   └─> ManageFamily.jsx
        │       └─> Family member list
        │
        ├─> ChildWishlist.jsx
        │   └─> Item CRUD + status display
        │
        └─> FamilyView.jsx
            └─> Browse + reserve items
```

## Security Model

### Authentication
```
PocketBase Auth Store
├─> JWT Token (stored in localStorage)
├─> User Record (with role)
└─> Auto-refresh on expiry
```

### Authorization (Row-Level Security)
```
Items Collection Rules:
├─> listRule: 
│   └─> Parents: all items
│   └─> Children: only their items
│   └─> Family: only approved items
│
├─> createRule:
│   └─> Only children can create
│
├─> updateRule:
│   └─> Parents: all items
│   └─> Children: own pending items
│
└─> deleteRule:
    └─> Parents: all items
    └─> Children: own pending items
```

## API Endpoints (PocketBase)

```
Authentication
POST   /api/collections/users/auth-with-password

Users
GET    /api/collections/users/records
POST   /api/collections/users/records
PATCH  /api/collections/users/records/:id
DELETE /api/collections/users/records/:id

Children
GET    /api/collections/children/records
POST   /api/collections/children/records
PATCH  /api/collections/children/records/:id
DELETE /api/collections/children/records/:id

Items
GET    /api/collections/items/records
POST   /api/collections/items/records
PATCH  /api/collections/items/records/:id
DELETE /api/collections/items/records/:id

Reservations
GET    /api/collections/reservations/records
POST   /api/collections/reservations/records
PATCH  /api/collections/reservations/records/:id
DELETE /api/collections/reservations/records/:id

Real-time
WS     /api/realtime
```

## State Management

```
React Component State (useState)
├─> Local UI state
├─> Form data
└─> Loading/error states

PocketBase Auth Store
├─> Current user
├─> Authentication token
└─> Role information

Session Storage
└─> Active child ID (for child login)

Real-time Subscriptions
├─> Items collection changes
└─> Reservations collection changes
```

## Deployment Architecture (Production)

```
┌────────────────┐
│   Cloudflare   │  DNS + CDN
│   or similar   │
└────────┬───────┘
         │
    ┌────▼────────────┐
    │  Frontend Host  │  Vercel/Netlify
    │   (Static)      │  Serves React app
    └────────┬────────┘
             │
        HTTPS API calls
             │
    ┌────────▼────────┐
    │  PocketBase VPS │  Your server
    │  (Backend)      │  Railway/Render/DO
    └─────────────────┘
```

This architecture provides:
- ✅ Clear separation of concerns
- ✅ Role-based access control
- ✅ Real-time updates
- ✅ Scalable deployment options
- ✅ Self-hosted data privacy
