# 🎄 Docker Quick Reference

## 🚀 Getting Started

```bash
# First time setup
./docker-setup.sh

# Or manually
docker-compose up -d --build
```

**Access:**

- App: http://localhost
- Admin: http://localhost/\_/

---

## 📋 Common Commands

### Using Make (Recommended)

```bash
make up          # Start services
make down        # Stop services
make logs        # View all logs
make restart     # Restart all
make backup      # Backup database
make help        # Show all commands
```

### Using Docker Compose

```bash
docker-compose up -d              # Start in background
docker-compose down               # Stop services
docker-compose logs -f            # Follow logs
docker-compose logs -f backend    # Backend logs only
docker-compose ps                 # Show status
docker-compose restart            # Restart all
```

---

## 🔧 Troubleshooting

### View Logs

```bash
make logs-backend    # Backend only
make logs-frontend   # Frontend only
docker-compose logs --tail=50 backend
```

### Check Health

```bash
make health
docker-compose ps
```

### Rebuild

```bash
make rebuild                      # Full rebuild
docker-compose build --no-cache   # No cache
```

### Access Container

```bash
make shell-backend    # Open backend shell
make shell-frontend   # Open frontend shell
```

---

## 💾 Backup & Restore

### Backup

```bash
make backup
# Creates: backups/pb-backup-YYYYMMDD-HHMMSS.tar.gz
```

### Restore

```bash
make restore BACKUP_FILE=backups/pb-backup-YYYYMMDD-HHMMSS.tar.gz
```

---

## 📁 Project Structure

```
wishlist/
├── docker-compose.yml          # Orchestration
├── docker-setup.sh             # Setup script
├── Makefile                    # Common commands
├── DOCKER.md                   # Full documentation
│
├── frontend/
│   ├── Dockerfile             # Multi-stage: Node → nginx
│   ├── nginx.conf             # Proxy config
│   ├── .dockerignore          # Exclude from build
│   ├── .env.production        # Production env vars
│   └── .env.development       # Dev env vars
│
└── backend/
    ├── Dockerfile             # PocketBase container
    ├── .dockerignore          # Exclude from build
    ├── pb_schema.json         # Database schema
    └── pb_migrations/         # Database migrations
```

---

## 🌐 Container Architecture

```
Frontend (nginx:80)
  ├── Serves React app
  ├── Proxies /api/ → backend
  └── Proxies /_/ → backend
            ↓
    Docker Network
            ↓
Backend (pocketbase:8090)
  ├── REST API
  ├── SQLite database
  └── Volume: pocketbase-data
```

---

## 🔄 Development Workflow

### Local Development (No Docker)

```bash
# Terminal 1
cd backend && ./pocketbase serve

# Terminal 2
cd frontend && npm run dev
```

### Docker Development

```bash
# Make changes to code
# Rebuild and restart
make rebuild
```

---

## 🚢 Deployment

### VPS/Cloud Server

```bash
ssh user@your-server
git clone <repo>
cd wishlist
./docker-setup.sh
# Configure domain/SSL with nginx or Caddy
```

### Separate Hosting

- Frontend → Vercel/Netlify
- Backend → Railway/Render with volume

---

## ⚠️ Important Notes

- **Don't use `-v` flag** when stopping (deletes data!)

  ```bash
  docker-compose down     # ✅ Keeps data
  docker-compose down -v  # ❌ Deletes data!
  ```

- **Backup regularly** before updates

  ```bash
  make backup
  ```

- **Check logs** if services fail
  ```bash
  make logs
  ```

---

## 📚 Documentation

- `DOCKER.md` - Full Docker guide
- `DOCKER_IMPLEMENTATION.md` - Implementation details
- `README.md` - App features and usage
- `ARCHITECTURE.md` - System architecture

---

## 🆘 Quick Fixes

### Port Already in Use

```bash
# Change port in docker-compose.yml
ports:
  - "8080:80"  # Use 8080 instead of 80
```

### Services Won't Start

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Database Corruption

```bash
# Restore from backup
make restore BACKUP_FILE=backups/pb-backup-YYYYMMDD.tar.gz
```

### Clean Slate

```bash
make clean  # Removes everything (prompts for confirmation)
```

---

**Need help?** Run `make help` or check `DOCKER.md`
