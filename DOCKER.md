# Docker Setup Guide

## Architecture

The Christmas Wishlist app uses a **two-container architecture**:

```
┌─────────────────────────────────────────────────┐
│  Container 1: Frontend (nginx + React build)    │
│  Port: 80                                        │
│  - Serves static React files                    │
│  - Proxies /api/ → backend:8090                 │
│  - Proxies /_/ → backend:8090 (admin UI)        │
└─────────────────┬───────────────────────────────┘
                  │
         Docker Network (wishlist-network)
                  │
┌─────────────────▼───────────────────────────────┐
│  Container 2: Backend (PocketBase)              │
│  Port: 8090 (internal)                          │
│  - SQLite database                              │
│  - REST API                                      │
│  - Admin UI                                      │
│  - Persistent volume: pocketbase-data           │
└─────────────────────────────────────────────────┘
```

## Why Two Containers?

### ✅ Advantages

1. **Separation of Concerns**

   - Frontend handles UI/UX
   - Backend handles data/business logic

2. **Independent Scaling**

   - Scale frontend for traffic
   - Scale backend for database load
   - Different resource allocations

3. **Easy Updates**

   - Update frontend without touching backend
   - Update backend without rebuilding frontend
   - Zero-downtime deployments possible

4. **Development Parity**

   - Matches local dev environment (two processes)
   - Easier debugging and testing

5. **Deployment Flexibility**
   - Frontend → CDN/static hosting
   - Backend → VPS with persistent storage
   - Or run both together with Docker Compose

### 🔧 Technical Benefits

- **Frontend Container**

  - Multi-stage build: Node.js build → nginx serve
  - Small final image (~25MB)
  - Nginx handles compression, caching, proxying
  - No Node.js runtime in production

- **Backend Container**
  - Single binary (PocketBase)
  - Alpine Linux base (~15MB)
  - Data in separate volume (survives rebuilds)
  - Built-in admin UI and API

## Quick Start

### 1. Start Everything

```bash
# Build and start both containers
docker-compose up --build

# Or in detached mode (background)
docker-compose up -d --build
```

### 2. Access the Application

- **App**: http://localhost
- **PocketBase Admin**: http://localhost/\_/

### 3. Initial Setup

1. Visit http://localhost/\_/
2. Create PocketBase admin account
3. Schema loads automatically from `pb_schema.json`
4. Go to Collections → users → New record
5. Create parent user (set role to "parent")
6. Login at http://localhost

## Docker Commands

### Start Services

```bash
# Start (rebuilds if needed)
docker-compose up --build

# Start in background
docker-compose up -d

# Start only backend
docker-compose up backend

# Start only frontend
docker-compose up frontend
```

### Stop Services

```bash
# Stop containers (keeps data)
docker-compose down

# Stop and remove volumes (deletes data!)
docker-compose down -v
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Frontend only
docker-compose logs -f frontend

# Backend only
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Rebuild Containers

```bash
# Rebuild everything
docker-compose build

# Rebuild specific service
docker-compose build frontend
docker-compose build backend

# No cache (clean rebuild)
docker-compose build --no-cache
```

### Container Management

```bash
# List running containers
docker-compose ps

# Execute command in container
docker-compose exec backend sh
docker-compose exec frontend sh

# Restart a service
docker-compose restart backend
```

## Data Management

### Volumes

PocketBase data is stored in a Docker volume:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect wishlist_pocketbase-data

# Remove volume (DELETES DATA!)
docker volume rm wishlist_pocketbase-data
```

### Backup Database

```bash
# Backup to tar.gz
docker run --rm \
  -v wishlist_pocketbase-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pb-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup by copying pb_data directory
docker-compose exec backend tar czf - pb_data > pb-backup-$(date +%Y%m%d).tar.gz
```

### Restore Database

```bash
# Restore from tar.gz
docker run --rm \
  -v wishlist_pocketbase-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/pb-backup-YYYYMMDD.tar.gz"

# Restart backend after restore
docker-compose restart backend
```

## Development Workflow

### Local Development (No Docker)

Use when actively developing:

```bash
# Terminal 1: Start PocketBase
cd backend
./pocketbase serve

# Terminal 2: Start Vite dev server
cd frontend
npm run dev
```

Benefits:

- Hot module replacement (instant updates)
- Better debugging
- Faster iteration

### Docker Development

Use for testing production-like environment:

```bash
# Run with Docker
docker-compose up --build

# Make changes to code
# Rebuild to see changes
docker-compose up --build
```

## Customization

### Change Ports

Edit `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - '3000:80' # Access at http://localhost:3000

  backend:
    ports:
      - '8090:8090' # Already exposed for direct access
```

### Change Environment Variables

**Frontend** (`frontend/.env.production`):

```env
VITE_POCKETBASE_URL=/
```

**Backend** (`docker-compose.yml`):

```yaml
services:
  backend:
    environment:
      - TZ=America/New_York # Your timezone
```

### Add HTTPS

Use a reverse proxy like Caddy or Traefik:

```yaml
services:
  caddy:
    image: caddy:latest
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
```

`Caddyfile`:

```
wishlist.example.com {
    reverse_proxy frontend:80
}
```

## Troubleshooting

### Frontend Can't Connect to Backend

Check docker-compose logs:

```bash
docker-compose logs backend
```

Verify backend is healthy:

```bash
docker-compose ps
```

Should show `healthy` status for backend.

### Database Changes Not Persisting

Make sure you're not using `-v` flag when stopping:

```bash
# WRONG (deletes data):
docker-compose down -v

# RIGHT (keeps data):
docker-compose down
```

### Slow Builds

Use BuildKit for faster builds:

```bash
DOCKER_BUILDKIT=1 docker-compose build
```

Or add to `.env`:

```
COMPOSE_DOCKER_CLI_BUILD=1
DOCKER_BUILDKIT=1
```

### Port Already in Use

If port 80 is taken:

```bash
# Find what's using it
sudo lsof -i :80

# Or change the port in docker-compose.yml
ports:
  - "8080:80"
```

### Container Won't Start

Check detailed logs:

```bash
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 frontend
```

Rebuild without cache:

```bash
docker-compose build --no-cache
docker-compose up
```

## Production Deployment

### On a VPS (DigitalOcean, Linode, etc.)

1. **Install Docker & Docker Compose**

   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

2. **Clone Repository**

   ```bash
   git clone <your-repo>
   cd wishlist
   ```

3. **Configure for Production**

   Create `.env` file:

   ```env
   COMPOSE_PROJECT_NAME=wishlist
   ```

4. **Start Services**

   ```bash
   docker-compose up -d --build
   ```

5. **Set Up Reverse Proxy** (nginx/Caddy)

   Point domain to your VPS IP, configure SSL

### Using Docker Hub

Build and push images:

```bash
# Login
docker login

# Build and tag
docker build -t yourusername/wishlist-frontend:latest ./frontend
docker build -t yourusername/wishlist-backend:latest ./backend

# Push
docker push yourusername/wishlist-frontend:latest
docker push yourusername/wishlist-backend:latest
```

Update `docker-compose.yml` to use images:

```yaml
services:
  frontend:
    image: yourusername/wishlist-frontend:latest
  backend:
    image: yourusername/wishlist-backend:latest
```

## Performance Optimization

### Frontend

- Images are served with 1-year cache headers
- Gzip compression enabled
- Static assets have immutable cache headers

### Backend

- Health checks prevent traffic to unhealthy containers
- SQLite database is fast for this use case
- Consider pg/mysql for high traffic

### Network

- Internal Docker network for frontend ↔ backend
- Only ports 80 exposed externally
- Backend port 8090 available for debugging

## Security Considerations

1. **Don't expose backend port in production**

   ```yaml
   backend:
     # ports:
     #   - "8090:8090"  # Comment out in production
   ```

2. **Use secrets for sensitive data**

   ```yaml
   backend:
     secrets:
       - pocketbase_admin_password
   ```

3. **Regular backups**

   ```bash
   # Daily backup cron
   0 2 * * * cd /app/wishlist && docker-compose exec -T backend tar czf - pb_data > backup-$(date +\%Y\%m\%d).tar.gz
   ```

4. **Update images regularly**
   ```bash
   docker-compose pull
   docker-compose up -d --build
   ```

## Next Steps

- [ ] Set up automated backups
- [ ] Configure SSL/HTTPS
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log rotation
- [ ] Set up CI/CD pipeline
- [ ] Configure resource limits (memory/CPU)

## Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PocketBase Documentation](https://pocketbase.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
