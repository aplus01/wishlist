# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Christmas Wishlist App - A family gift management application with three user roles:
- **Parents**: Manage children, approve/reject wishlist items, monitor gift equity
- **Children**: Add wishlist items (require parent approval before visible to family)
- **Family Members**: View approved items and reserve/purchase gifts

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: PocketBase (self-hosted SQLite-based backend)
- **Routing**: React Router v6
- **Styling**: Vanilla CSS

## Commands

```bash
# Frontend (from frontend/ directory)
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build to dist/
npm run preview      # Preview production build

# Backend (from backend/ directory)
cd backend
./pocketbase serve   # Start PocketBase backend (http://127.0.0.1:8090)
```

## Architecture

### Data Flow
1. Children create wishlist items → status="pending"
2. Parents review and approve/reject items
3. Approved items visible to family members
4. Family members can reserve gifts (prevents duplicates)

### Project Structure
```
wishlist/
├── frontend/           # React app
│   ├── src/
│   │   ├── lib/pocketbase.js   # API client
│   │   ├── pages/              # Page components
│   │   └── components/         # Reusable components
│   ├── index.html
│   └── package.json
└── backend/            # PocketBase
    ├── pocketbase      # Binary
    ├── pb_schema.json  # Database schema
    └── pb_data/        # SQLite database
```

### Database Collections
- `users` - Parent and family member accounts (role field: "parent" | "family_member")
- `children` - Child profiles with PIN auth (linked to parent)
- `items` - Wishlist items (status: pending/approved/rejected, linked to child)
- `reservations` - Gift reservations (linked to item and user)

### Authentication
- Parents/Family: Email + password via PocketBase auth
- Children: Child ID + PIN (verified against children collection, then uses parent's auth context)
- Active child ID stored in sessionStorage

### PocketBase API Patterns
```javascript
// All API functions in src/lib/pocketbase.js
import pb, { auth, children, items, reservations } from './lib/pocketbase';

// Example: List items with expansion
pb.collection('items').getFullList({
  filter: 'status = "approved"',
  expand: 'child,reservations_via_item,reservations_via_item.reserved_by',
});
```

## Environment Variables

In `frontend/.env`:
```bash
VITE_POCKETBASE_URL=http://127.0.0.1:8090  # PocketBase server URL
```
- the deployed code lives in /mnt/c/wishlist on microbot