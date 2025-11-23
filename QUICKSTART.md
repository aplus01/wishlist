# 🚀 Quick Start Guide

Get your Christmas Wishlist app running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A web browser

## Installation

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
./setup.sh

# Start PocketBase
./pocketbase serve

# In a new terminal, start the frontend
npm run dev
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Download PocketBase from https://pocketbase.io/docs/
# Extract and place the binary in this folder

# 3. Create environment file
cp .env.example .env

# 4. Start PocketBase
./pocketbase serve

# 5. In a new terminal, start frontend
npm run dev
```

## First-Time Configuration

### 1. Set Up PocketBase Admin

1. Open http://127.0.0.1:8090/_/
2. Create an admin account (first time only)
3. Click **Settings** → **Import collections**
4. Upload `pb_schema.json`
5. Click **Import**

### 2. Create Your Parent Account

1. In PocketBase admin, go to **Collections** → **users**
2. Click **+ New record**
3. Fill in:
   - email: your@email.com
   - password: your_password
   - name: Your Name
   - role: **parent** (important!)
4. Click **Save**

### 3. Start Using the App

1. Open http://localhost:3000
2. Login with your parent credentials
3. Add your children
4. Share login credentials with family members

## User Roles Quick Reference

### Parent
- **Login**: http://localhost:3000 → Select "Parent"
- **Can do**: Add children, approve/reject items, view equity dashboard, manage family

### Child
- **Login**: http://localhost:3000 → Select "Child" → Use Child ID + PIN
- **Can do**: Add wishlist items, view item status
- **Note**: Get Child ID and PIN from parent dashboard

### Family Member
- **Signup**: http://localhost:3000/signup
- **Login**: http://localhost:3000 → Select "Family"
- **Can do**: View approved items, reserve gifts, mark as purchased

## Testing the App

Want to test with sample data?

1. Login as parent
2. Add a child (e.g., "Tommy", PIN: "1234")
3. Note the Child ID
4. Logout
5. Login as child with that ID and PIN
6. Add some wishlist items
7. Logout and login as parent again
8. Approve some items
9. Sign up as a family member
10. Reserve some items!

## Troubleshooting

**Can't connect to PocketBase?**
- Make sure PocketBase is running (`./pocketbase serve`)
- Check that it's accessible at http://127.0.0.1:8090

**Login not working?**
- Verify you created a user with the correct role
- Check that you imported the schema
- Try clearing browser cache/localStorage

**Child can't login?**
- Copy the exact Child ID from parent dashboard
- PINs are case-sensitive
- Make sure the child profile exists

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Customize the styling in `src/index.css`
- Deploy to production (see README.md deployment section)

## Support

Found a bug? Want to add a feature? Check out the main README.md for more info!

Happy gift organizing! 🎁🎄
