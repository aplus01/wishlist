# Deployment Guide

Scripts to deploy the Wishlist app to the remote server (microbot).

## Prerequisites

- `pv` installed locally for progress bars: `sudo apt install pv` or `brew install pv`
- SSH access to microbot configured
- Docker installed on both local and remote machines

## Deployment Scripts

### Frontend Only
Deploy just the frontend (React app):
```bash
./deploy.sh
```

### Backend Only
Deploy just the backend (PocketBase):
```bash
./deploy-backend.sh
```

### Full Deploy
Deploy both frontend and backend:
```bash
./deploy-all.sh
```

## Configuration

Edit the scripts to change these variables if needed:
- `REMOTE_HOST`: SSH host (default: `aaron@microbot`)
- `REMOTE_PATH`: Path to docker-compose.yml on remote (default: `c:\wishlist`)

## What Each Script Does

1. **Builds** the Docker image(s) locally
2. **Transfers** the image(s) to the remote host using `docker save | ssh | docker load`
3. **Restarts** the container(s) using `docker-compose up -d --force-recreate`
4. **Shows** the container status

## Troubleshooting

If deployment fails, you can manually check:

```bash
# Check remote containers
ssh aaron@microbot docker ps

# Check remote logs
ssh aaron@microbot docker logs wishlist-frontend
ssh aaron@microbot docker logs wishlist-backend

# Manually restart on remote
ssh aaron@microbot "cd c:\\wishlist && docker-compose up -d"
```

## Quick Commands

```bash
# View remote logs
ssh aaron@microbot docker logs -f wishlist-frontend

# Restart containers on remote
ssh aaron@microbot "cd c:\\wishlist && docker-compose restart"

# Stop everything on remote
ssh aaron@microbot "cd c:\\wishlist && docker-compose down"
```
