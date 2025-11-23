# Container Architecture Diagram

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │ http://localhost
                             │ http://localhost/_/
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    DOCKER COMPOSE NETWORK                           │
│                    (wishlist-network)                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  FRONTEND CONTAINER                                        │   │
│  │  Name: wishlist-frontend                                   │   │
│  │  Image: nginx:alpine (~25MB)                               │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │  Port Mapping: 80:80                                       │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  nginx Web Server                                    │  │   │
│  │  │  • Serves React SPA from /usr/share/nginx/html      │  │   │
│  │  │  • Handles React Router (SPA routing)               │  │   │
│  │  │  • Gzip compression                                 │  │   │
│  │  │  • Static asset caching (1 year)                    │  │   │
│  │  │  • Security headers                                  │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  Proxy Rules:                                              │   │
│  │  • /api/*  → http://backend:8090/api/*                    │   │
│  │  • /_/*    → http://backend:8090/_/* (admin UI)           │   │
│  │  • /*      → /index.html (React Router fallback)          │   │
│  └───────────────────────────┬─────────────────────────────────┘   │
│                              │                                     │
│                              │ Internal network                    │
│                              │ (backend:8090)                      │
│                              │                                     │
│  ┌───────────────────────────▼─────────────────────────────────┐   │
│  │  BACKEND CONTAINER                                          │   │
│  │  Name: wishlist-backend                                     │   │
│  │  Image: alpine:latest + pocketbase (~15MB)                  │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  Port: 8090 (internal only, not exposed externally)        │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  PocketBase Server                                   │  │   │
│  │  │  • REST API (CRUD operations)                        │  │   │
│  │  │  • Authentication (JWT)                              │  │   │
│  │  │  • Admin Dashboard UI                                │  │   │
│  │  │  • Realtime subscriptions                            │  │   │
│  │  │  • File uploads                                      │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                              │                              │   │
│  │                              ▼                              │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  SQLite Database                                     │  │   │
│  │  │  Location: /app/pb_data/data.db                      │  │   │
│  │  │                                                       │  │   │
│  │  │  Collections:                                        │  │   │
│  │  │  • users (parents & family members)                  │  │   │
│  │  │  • children (with PIN auth)                          │  │   │
│  │  │  • items (wishlist items)                            │  │   │
│  │  │  • reservations (gift claims)                        │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                              │                              │   │
│  │                              ▼                              │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │  Docker Volume: pocketbase-data                      │  │   │
│  │  │  • Persists across container restarts               │  │   │
│  │  │  • Survives container deletion                       │  │   │
│  │  │  • Stores database, migrations, uploads              │  │   │
│  │  │  • Can be backed up with 'make backup'              │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  │                                                             │   │
│  │  Health Check:                                             │   │
│  │  • curl http://localhost:8090/api/health                  │   │
│  │  • Interval: 30s                                           │   │
│  │  • Retries: 3                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Examples

### 1. Loading the App

```
User Browser
    │
    ├─> GET http://localhost/
    │
    ▼
Frontend Container (nginx)
    │
    ├─> Serves /usr/share/nginx/html/index.html
    │
    ▼
User Browser (React App Loads)
```

### 2. Fetching Wishlist Items

```
React App (Browser)
    │
    ├─> GET /api/collections/items/records
    │
    ▼
Frontend Container (nginx)
    │
    ├─> Proxy to http://backend:8090/api/collections/items/records
    │
    ▼
Backend Container (PocketBase)
    │
    ├─> Query SQLite database
    ├─> Apply security rules
    ├─> Return JSON response
    │
    ▼
Frontend Container (nginx)
    │
    ├─> Forward response
    │
    ▼
React App (Renders items)
```

### 3. Creating a New Item

```
React App (Browser)
    │
    ├─> POST /api/collections/items/records
    │   Body: { title, price, child, ... }
    │
    ▼
Frontend Container (nginx)
    │
    ├─> Proxy to http://backend:8090/api/collections/items/records
    │
    ▼
Backend Container (PocketBase)
    │
    ├─> Validate auth token
    ├─> Check permissions
    ├─> INSERT INTO items ...
    ├─> Save to SQLite
    │
    ▼
Docker Volume (Persistent)
    │
    ├─> Data written to pb_data/data.db
    │
    ▼
Backend Container (PocketBase)
    │
    ├─> Return created record
    │
    ▼
React App (Updates UI)
```

### 4. Accessing Admin Dashboard

```
User Browser
    │
    ├─> GET http://localhost/_/
    │
    ▼
Frontend Container (nginx)
    │
    ├─> Proxy to http://backend:8090/_/
    │
    ▼
Backend Container (PocketBase)
    │
    ├─> Serve admin UI
    │
    ▼
User Browser (Admin Dashboard)
```

## Build Process

### Frontend Multi-Stage Build

```
Stage 1: Builder (node:18-alpine)
    │
    ├─> COPY package*.json
    ├─> npm ci (install dependencies)
    ├─> COPY source code
    ├─> npm run build
    │   └─> Vite compiles React → /app/dist
    │
    ▼
Stage 2: Production (nginx:alpine)
    │
    ├─> COPY --from=builder /app/dist → /usr/share/nginx/html
    ├─> COPY nginx.conf → /etc/nginx/conf.d/default.conf
    │
    ▼
Final Image (~25MB)
    • No Node.js runtime
    • Just nginx + static files
```

### Backend Build

```
Base: alpine:latest
    │
    ├─> apk add ca-certificates curl unzip
    ├─> Download PocketBase v0.22.0
    ├─> Extract binary
    ├─> COPY pb_schema.json
    ├─> COPY pb_migrations/
    │
    ▼
Final Image (~15MB)
    • Single PocketBase binary
    • Schema and migrations
    • Ready to serve
```

## Network Communication

```
┌──────────────────┐
│  External World  │
│  (Port 80)       │
└────────┬─────────┘
         │
         │ Docker port mapping
         │ (80:80)
         │
┌────────▼─────────┐
│  wishlist-network│ (bridge driver)
│                  │
│  frontend:80     │◄─── Accessible as "frontend" hostname
│  backend:8090    │◄─── Accessible as "backend" hostname
│                  │
└──────────────────┘

Internal DNS:
  • frontend → 172.xx.0.2:80
  • backend  → 172.xx.0.3:8090
```

## Volume Management

```
┌─────────────────────────────────────┐
│  Host Machine                       │
│  /var/lib/docker/volumes/           │
│  wishlist_pocketbase-data/_data/    │
└──────────────┬──────────────────────┘
               │
               │ Mounted at
               │
┌──────────────▼──────────────────────┐
│  Backend Container                  │
│  /app/pb_data/                      │
│  ├── data.db                        │
│  ├── data.db-shm                    │
│  ├── data.db-wal                    │
│  ├── logs.db                        │
│  └── storage/                       │
│      └── (uploaded files)           │
└─────────────────────────────────────┘
```

## Container Lifecycle

```
docker-compose up
    │
    ├─> Pull/Build images
    ├─> Create network (wishlist-network)
    ├─> Create volume (pocketbase-data)
    │
    ├─> Start backend container
    │   └─> Wait for health check (30s interval)
    │       └─> curl http://localhost:8090/api/health
    │
    ├─> Start frontend container (after backend healthy)
    │   └─> nginx starts serving
    │
    ▼
Running State
    │
    ├─> Automatic restart on failure (unless-stopped policy)
    ├─> Health checks continue (every 30s)
    │
    ▼
docker-compose down
    │
    ├─> Stop containers
    ├─> Remove containers
    ├─> Remove network
    ├─> Keep volume (data persists!)
    │
    ▼
Stopped State
```

## Security Architecture

```
External Request
    │
    ├─> Only port 80 exposed to host
    │
    ▼
nginx (Frontend Container)
    │
    ├─> Add security headers
    ├─> X-Frame-Options: SAMEORIGIN
    ├─> X-Content-Type-Options: nosniff
    ├─> X-XSS-Protection: 1; mode=block
    │
    ├─> Proxy authenticated requests only
    │
    ▼
PocketBase (Backend Container)
    │
    ├─> Port 8090 NOT exposed to host
    ├─> Only accessible via Docker network
    │
    ├─> Validate JWT tokens
    ├─> Apply collection rules
    ├─> Row-level security
    │
    ▼
SQLite Database (Volume)
    │
    └─> Data persists securely
```

This architecture ensures:

- ✅ Clear separation of concerns
- ✅ Production-ready with health checks
- ✅ Secure communication paths
- ✅ Data persistence
- ✅ Easy scaling and updates
- ✅ Minimal attack surface
