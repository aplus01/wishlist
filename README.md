# 🎄 Christmas Wishlist App

A full-featured web application for managing family Christmas wishlists with parent approval and gift reservation features.

## Features

### For Parents

- **Manage Children**: Add children with login credentials (Child ID + PIN)
- **Review Items**: Approve or reject wishlist items before they're visible to family
- **Equity Dashboard**: Monitor gift distribution to ensure fairness across children
- **Manage Family**: View and manage family member accounts

### For Children

- **Build Wishlist**: Add items with title, description, price, URL, and image
- **Track Status**: See which items are pending, approved, or rejected
- **Edit Items**: Modify or remove items that are still pending

### For Family Members

- **View Approved Items**: Browse all approved wishlist items
- **Reserve Gifts**: Claim items to prevent duplicate purchases
- **Track Purchases**: Mark reserved items as purchased
- **By-Child Organization**: See items grouped by which child requested them

## Technology Stack

- **Frontend**: React 18 with Vite
- **Backend**: PocketBase (self-hosted)
- **Routing**: React Router v6
- **Styling**: Vanilla CSS with modern design

## Prerequisites

### Option 1: Docker (Recommended)

- Docker and Docker Compose installed

### Option 2: Local Development

- Node.js 18+ and npm
- PocketBase binary (download from https://pocketbase.io/docs/)

## Quick Start with Docker

The easiest way to run the app is using Docker Compose:

```bash
# Build and start both containers
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

The app will be available at:

- **Frontend**: http://localhost
- **Backend/Admin**: http://localhost/\_/

To stop the containers:

```bash
docker-compose down

# To also remove the database volume
docker-compose down -v
```

### Initial Setup (Docker)

1. Access the PocketBase admin UI at http://localhost/\_/
2. Create an admin account
3. The schema will be automatically loaded from `pb_schema.json`
4. Create your first parent user in Collections > users (set role to "parent")
5. Login to the app at http://localhost

## Installation & Setup (Local Development)

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Set Up PocketBase

#### Download PocketBase

```bash
# Linux/MacOS
curl -L https://github.com/pocketbase/pocketbase/releases/download/v0.22.0/pocketbase_0.22.0_linux_amd64.zip -o pocketbase.zip
unzip pocketbase.zip
rm pocketbase.zip

# Or download manually from https://pocketbase.io/docs/
```

#### Start PocketBase

```bash
./pocketbase serve
```

PocketBase will start on `http://127.0.0.1:8090`

#### Access Admin UI

1. Open `http://127.0.0.1:8090/_/` in your browser
2. Create an admin account (first time only)
3. You'll be logged into the PocketBase admin dashboard

### 3. Configure Database Schema

You have two options:

#### Option A: Manual Setup (Recommended for understanding the structure)

1. In PocketBase admin UI, go to **Settings** > **Import collections**
2. Upload the `pb_schema.json` file
3. Click **Import** to create all collections

#### Option B: Automatic Setup via API

The schema includes these collections:

- **users** (extended): Stores parent and family member accounts
- **children**: Child profiles with PIN authentication
- **items**: Wishlist items with approval status
- **reservations**: Gift reservations by family members

### 4. Create Your Parent Account

1. In PocketBase admin UI, go to **Collections** > **users**
2. Click **+ New record**
3. Fill in:
   - **email**: your email
   - **password**: your password
   - **name**: your name
   - **role**: select "parent"
4. Click **Save**

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` if your PocketBase runs on a different URL.

### 6. Start the Frontend

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Usage Guide

### First Time Setup

1. **Login as Parent**

   - Go to http://localhost:3000
   - Select "Parent" and login with your credentials

2. **Add Your Children**

   - Navigate to "Children" section
   - Click "+ Add Child"
   - Enter name, age (optional), PIN, and target budget (optional)
   - Note the Child ID and PIN for each child

3. **Share Child Credentials**
   - Give each child their Child ID and PIN
   - They can login by selecting "Child" on the login page

### For Children

1. **Login**

   - Go to http://localhost:3000
   - Select "Child"
   - Enter your Child ID and PIN

2. **Add Wishlist Items**

   - Click "+ Add Item to Wishlist"
   - Fill in item details (title, price required; description, URL, image optional)
   - Submit to add to your wishlist

3. **Track Status**
   - Pending: Waiting for parent approval
   - Approved: Visible to family members
   - Rejected: Not approved (with reason from parent)

### For Parents

1. **Review Items**

   - Navigate to "Review Items"
   - Filter by Pending/Approved/Rejected
   - Approve items to make them visible to family
   - Reject items with a reason (visible to child)

2. **Monitor Equity**

   - Navigate to "Equity Dashboard"
   - View reserved gift values per child
   - See progress toward target budgets
   - Check which family members have contributed

3. **Manage Family Members**
   - Navigate to "Family Members"
   - View all registered family members
   - Remove access if needed

### For Family Members

1. **Sign Up**

   - Go to http://localhost:3000/signup
   - Create an account with name, email, and password
   - Login automatically after signup

2. **Browse Wishlists**

   - View all approved items organized by child
   - Filter: All Items / Available / My Reservations

3. **Reserve Gifts**
   - Click "Reserve This Gift" on available items
   - Item becomes unavailable to other family members
   - Click "Mark Purchased" after buying
   - Can unreserve if plans change

## Project Structure

```
christmas-wishlist/
├── src/
│   ├── components/          # Reusable components
│   │   ├── ManageChildren.jsx
│   │   ├── ReviewItems.jsx
│   │   ├── EquityDashboard.jsx
│   │   └── ManageFamily.jsx
│   ├── pages/              # Page components
│   │   ├── Login.jsx
│   │   ├── FamilySignup.jsx
│   │   ├── ChildWishlist.jsx
│   │   ├── FamilyView.jsx
│   │   └── ParentDashboard.jsx
│   ├── lib/
│   │   └── pocketbase.js   # PocketBase API wrapper
│   ├── App.jsx             # Main app with routing
│   ├── main.jsx            # Entry point
│   └── index.css           # Global styles
├── pb_schema.json          # PocketBase collections schema
├── package.json            # Dependencies
└── vite.config.js          # Vite configuration
```

## API Functions

The `src/lib/pocketbase.js` file provides helper functions:

### Authentication

- `auth.loginParent(email, password)`
- `auth.loginChild(childId, pin)`
- `auth.loginFamily(email, password)`
- `auth.registerFamily(email, password, name)`
- `auth.logout()`

### Children

- `children.list(parentId)`
- `children.create(data)`
- `children.update(id, data)`
- `children.delete(id)`

### Items

- `items.list(filters)`
- `items.listApproved()`
- `items.create(data)`
- `items.update(id, data)`
- `items.approve(id)`
- `items.reject(id, reason)`
- `items.delete(id)`

### Reservations

- `reservations.list(filters)`
- `reservations.create(itemId)`
- `reservations.update(id, data)`
- `reservations.delete(id)`
- `reservations.markPurchased(id)`

## Security Features

- **Role-based access control**: Parents, children, and family members have different permissions
- **PIN authentication** for children (no email required)
- **Row-level security** in PocketBase ensures users only see their own data
- **Cascading deletes**: Removing a child also removes their items and reservations

## Deployment

### Docker Deployment (Recommended)

The app includes Docker configurations for easy deployment:

**Project Structure:**

```
wishlist/
├── docker-compose.yml          # Orchestrates both containers
├── frontend/
│   ├── Dockerfile             # Multi-stage build with nginx
│   ├── nginx.conf             # Proxies API requests to backend
│   └── .dockerignore
└── backend/
    ├── Dockerfile             # PocketBase container
    └── .dockerignore
```

**Deployment Steps:**

1. **Production Build:**

   ```bash
   docker-compose up -d --build
   ```

2. **Access Points:**

   - Frontend: http://your-domain.com
   - PocketBase Admin: http://your-domain.com/_/
   - API: http://your-domain.com/api/

3. **Data Persistence:**

   - PocketBase data is stored in a Docker volume named `pocketbase-data`
   - Survives container restarts and rebuilds
   - To backup: `docker run --rm -v wishlist_pocketbase-data:/data -v $(pwd):/backup alpine tar czf /backup/pb-backup.tar.gz /data`

4. **Environment Configuration:**

   - Update `frontend/.env.production` for different PocketBase URLs
   - Nginx proxies `/api/` and `/_/` to the backend container
   - Frontend and backend communicate via Docker network

5. **Logs:**
   ```bash
   docker-compose logs -f frontend
   docker-compose logs -f backend
   ```

### Alternative Deployment Options

#### Frontend Only (Vercel/Netlify)

1. Build the production version:

   ```bash
   cd frontend
   npm run build
   ```

2. Deploy the `dist` folder to your hosting service

3. Update `VITE_POCKETBASE_URL` environment variable to point to your PocketBase URL

#### PocketBase Only (VPS)

1. **VPS** (DigitalOcean, Linode, etc.)

   - Upload the PocketBase binary
   - Run as a systemd service
   - Use nginx as reverse proxy

2. **Railway/Render**
   - Deploy using their PocketBase templates
   - Mount persistent volume for `pb_data/`

### Environment Variables

**Development:**

```env
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

**Docker Production:**

```env
VITE_POCKETBASE_URL=/
```

(Nginx handles proxying)

**Separate Hosting:**

```env
VITE_POCKETBASE_URL=https://your-pocketbase-domain.com
```

## Customization

### Styling

- Edit `src/index.css` for global styles
- All colors use CSS variables for easy theming
- Mobile-responsive design included

### Features

- Add email notifications in PocketBase hooks
- Implement image upload instead of URLs
- Add categories/tags for items
- Create shopping lists from reservations

## Troubleshooting

### PocketBase Connection Issues

- Ensure PocketBase is running on `http://127.0.0.1:8090`
- Check CORS settings in PocketBase admin
- Verify `.env` file has correct URL

### Authentication Errors

- Clear browser localStorage and cookies
- Verify user roles are set correctly in PocketBase
- Check that parent account exists before adding children

### Child Login Issues

- Child IDs are the auto-generated record IDs from PocketBase
- Copy the exact ID from the parent dashboard
- PINs are case-sensitive

## Support & Contributing

This is a personal/family project template. Feel free to:

- Fork and customize for your needs
- Add features you find useful
- Share improvements

## License

MIT License - feel free to use and modify for personal use.

## Credits

Built with:

- React & Vite
- PocketBase
- Love for organized gift-giving! 🎁
