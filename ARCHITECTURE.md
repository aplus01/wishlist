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
   └─> Parent shares Child ID + PIN credentials
       └─> Child enters credentials at login page
           └─> Verified against Children collection
               └─> Session created with child auth

2. Add Item
   └─> Child fills form (title, price, description, URL, image)
       └─> POST to /api/collections/pbc_items/records
           └─> Item created with status="pending" and priority order
               └─> Linked to child record via child_id
                   └─> Optional image upload

3. Manage Priority
   └─> Child can drag-and-drop items to reorder
       └─> PATCH priority field on reorder
           └─> "Send to Top" button for quick priority boost

4. Parent Review
   └─> Parent sees all items in "Review Items"
       └─> Filter by child, reservation status, purchase status
           └─> Approves item
               └─> PATCH to /api/collections/pbc_items/records/{id}
                   └─> status="approved", approved_at=now()
           └─> Or rejects with reason
               └─> status="rejected", rejection_reason="..."

5. Family View
   └─> Family member accesses personalized route (e.g., /grandma)
       └─> GET /api/collections/pbc_items/records
           └─> Filter: status="approved"
               └─> Expand: reservations_via_item
                   └─> Item appears in family view organized by child
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
│    users     │  (Extended PocketBase auth)
├──────────────┤
│ id           │◄──────────┐
│ email        │           │
│ password     │           │ parent
│ name         │           │
│ role         │           │ (parent/family_member)
│ route        │           │ (custom login path for family)
└──────────────┘           │
                           │
┌──────────────┐           │
│ pbc_children │           │
├──────────────┤           │
│ id           │◄──────────┘
│ parent       │           (relation to users)
│ name         │
│ age          │           (optional)
│ pin          │           (4-6 digit auth)
│ target_budget│           (optional, for equity tracking)
│ created      │
│ updated      │
└──────┬───────┘
       │
       │ child
       │
┌──────▼───────┐
│  pbc_items   │
├──────────────┤
│ id           │
│ child        │◄─────────┐ (relation to pbc_children)
│ title        │          │
│ description  │          │
│ url          │          │
│ price        │          │
│ image        │          │ (file field, actual upload)
│ status       │          │ (pending/approved/rejected)
│ rejection_   │          │
│   reason     │          │
│ approved_at  │          │
│ priority     │          │ (drag-and-drop order)
│ created      │          │
│ updated      │          │
└──────┬───────┘          │
       │                  │
       │ item             │
       │                  │
┌──────▼───────────┐      │
│ pbc_reservations │      │
├──────────────────┤      │
│ id               │      │
│ item             │──────┘ (relation to pbc_items)
│ user             │─────┐  (relation to users)
│ purchased        │     │
│ notes            │     │  (optional)
│ created          │     │
│ updated          │     │
└──────────────────┘     │
                         │
                    ┌────▼─────┐
                    │  users   │
                    │ (family) │
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
        │   └─> Multi-role login (Parent or Child with ID + PIN)
        │
        ├─> ParentDashboard.jsx (Protected Route)
        │   ├─> Header + Navigation
        │   ├─> ManageChildren.jsx
        │   │   └─> Child CRUD + PIN credentials display
        │   ├─> ReviewItems.jsx
        │   │   ├─> Custom select dropdowns (child, reservation, purchase filters)
        │   │   └─> Approve/reject/delete workflow
        │   ├─> EquityDashboard.jsx
        │   │   └─> Balance tracking + fairness metrics
        │   └─> ManageFamily.jsx
        │       └─> Family member list with custom routes
        │
        ├─> ChildWishlist.jsx (Protected Route)
        │   ├─> WishlistTable.jsx (Table view with drag-and-drop)
        │   │   └─> Edit/Delete/Send-to-Top actions
        │   └─> Card view with drag-and-drop reordering
        │       └─> Status badges + item actions
        │
        └─> FamilyView.jsx (Dynamic Route: /:route)
            ├─> Filter by child dropdown
            ├─> Filter by status buttons
            └─> Item cards with Reserve/Unreserve/Purchase actions

Components (Reusable):
├─> EquityDashboard.jsx - Shows gift equity across children
├─> ManageChildren.jsx - CRUD for children with PIN management
├─> ManageFamily.jsx - Manage family members with custom routes
├─> ReviewItems.jsx - Parent approval interface with filters
└─> WishlistTable.jsx - Drag-and-drop table for wishlist items
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
pbc_items Collection Rules:
├─> listRule:
│   └─> Parents: all items
│   └─> Children: only their items (child = @request.auth.id)
│   └─> Family: only approved items (status = 'approved')
│
├─> createRule:
│   └─> Only authenticated children
│   └─> Must set child = @request.auth.id
│
├─> updateRule:
│   └─> Parents: all items
│   └─> Children: own pending items only
│
└─> deleteRule:
    └─> Parents: all items
    └─> Children: own pending items only

pbc_reservations Collection Rules:
├─> listRule:
│   └─> Parents: all reservations
│   └─> Family: only own reservations (user = @request.auth.id)
│   └─> Children: none
│
├─> createRule:
│   └─> Only family members (role = 'family_member')
│   └─> Must set user = @request.auth.id
│
├─> updateRule:
│   └─> Only own reservations (user = @request.auth.id)
│
└─> deleteRule:
    └─> Only own reservations (user = @request.auth.id)

pbc_children Collection Rules:
├─> listRule:
│   └─> Parents: only their children (parent = @request.auth.id)
│
├─> createRule:
│   └─> Only parents (role = 'parent')
│   └─> Must set parent = @request.auth.id
│
├─> updateRule:
│   └─> Only parent who created the child
│
└─> deleteRule:
    └─> Only parent who created the child
```

## API Endpoints (PocketBase)

```
Authentication
POST   /api/collections/users/auth-with-password        (Parent, Family Member)
POST   /api/collections/pbc_children/auth-with-password (Child with ID + PIN)

Users (Parents & Family Members)
GET    /api/collections/users/records
POST   /api/collections/users/records
PATCH  /api/collections/users/records/:id
DELETE /api/collections/users/records/:id

Children
GET    /api/collections/pbc_children/records
POST   /api/collections/pbc_children/records
PATCH  /api/collections/pbc_children/records/:id
DELETE /api/collections/pbc_children/records/:id

Items (Wishlist)
GET    /api/collections/pbc_items/records
       ?filter=status='approved'                        (Family view)
       ?filter=child='CHILD_ID'                         (Child's items)
       ?expand=child,reservations_via_item             (With relations)
POST   /api/collections/pbc_items/records              (Child creates)
PATCH  /api/collections/pbc_items/records/:id          (Update/Approve/Reject)
DELETE /api/collections/pbc_items/records/:id          (Delete item)

Reservations
GET    /api/collections/pbc_reservations/records
       ?filter=user='USER_ID'                          (My reservations)
       ?expand=item,item.child                         (With relations)
POST   /api/collections/pbc_reservations/records       (Reserve gift)
PATCH  /api/collections/pbc_reservations/records/:id   (Mark purchased)
DELETE /api/collections/pbc_reservations/records/:id   (Unreserve)

File Uploads
POST   /api/files                                      (Upload item images)
GET    /api/files/pbc_items/:id/:filename             (Retrieve images)
       ?thumb=100x100                                  (Thumbnail)

Real-time
WS     /api/realtime                                   (Live updates)
       - Subscribe to pbc_items changes
       - Subscribe to pbc_reservations changes
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

## Deployment Architecture

### Docker Deployment (Recommended)

```
┌──────────────────────────────────────┐
│         Docker Compose               │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────┐  ┌────────────┐ │
│  │   Frontend     │  │  Backend   │ │
│  │   Container    │  │  Container │ │
│  │   (Nginx)      │  │(PocketBase)│ │
│  │   Port 80      │  │  Port 8090 │ │
│  └───────┬────────┘  └─────┬──────┘ │
│          │                 │        │
│          │   Docker Network│        │
│          └────────┬────────┘        │
│                   │                 │
│          ┌────────▼────────┐        │
│          │ pocketbase-data │        │
│          │  (Volume)       │        │
│          └─────────────────┘        │
└──────────────────────────────────────┘

User → http://localhost → Nginx
                           ├─> / → React App
                           ├─> /api/ → PocketBase
                           └─> /_/ → PocketBase Admin
```

### Separate Hosting (Alternative)

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
    │                 │  With volume mount
    └─────────────────┘
```

## Design System Architecture

```
CSS Variables (Root Level)
├─> Colors
│   ├─> --green-dark (#3d5a40)
│   ├─> --green-medium (#6b8a6e)
│   ├─> --green-light (#c4d5c5)
│   ├─> --red-dark (#c41e3a)
│   ├─> --red-medium (#d85971)
│   ├─> --red-light (#ffd6d6)
│   ├─> --gold (#d4af37)
│   └─> --cream (#f8f4e3)
│
├─> Functional Colors
│   ├─> --edit-btn (#5d4037)
│   ├─> --delete-btn (var(--red-dark))
│   ├─> --header-bg-color (var(--green-dark))
│   └─> --heading-font-color (var(--green-dark))
│
└─> Component Classes
    ├─> .card (base card styling)
    ├─> .card-bordered (1px border)
    ├─> .btn-primary (gold buttons)
    ├─> .btn-secondary (stroked buttons)
    └─> .item-card (wishlist cards with green left border)
```

This architecture provides:

- ✅ Clear separation of concerns
- ✅ Role-based access control with row-level security
- ✅ Real-time updates via PocketBase subscriptions
- ✅ Scalable deployment options (Docker or separate hosting)
- ✅ Self-hosted data privacy
- ✅ Consistent theming via CSS variables
- ✅ Modern, responsive UI with Material Design icons
- ✅ Drag-and-drop wishlist management
- ✅ Custom family member routes for easy access
