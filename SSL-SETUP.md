# SSL Setup Guide

Free SSL certificate setup using Let's Encrypt with automatic renewal.

## Prerequisites

- Domain name (e.g., `alswingl.ddns.net` via No-IP)
- Ports 80 and 443 forwarded to your server
- Docker installed on the server

## Setup Steps

### Step 1: Configure Environment Variables

Edit `.env` on the remote server:

```bash
DOMAIN_NAME=alswingl.ddns.net
LETSENCRYPT_EMAIL=your-email@example.com
```

### Step 2: Port Forwarding

On your router, forward these ports to your server:

| External Port | Internal Port | Protocol |
|---------------|---------------|----------|
| 80            | 80            | TCP      |
| 443           | 443           | TCP      |

### Step 3: Run SSL Initialization (One-Time)

SSH into the remote server and run the init script:

```bash
ssh aaron@microbot
cd c:\wishlist
./init-ssl.sh
```

This script will:
1. Start a temporary nginx container
2. Request a certificate from Let's Encrypt
3. Store the certificate in `./certs/`

### Step 4: Deploy the Application

```bash
./deploy-all.sh
```

Your site will be available at: `https://alswingl.ddns.net`

## How It Works

- **nginx** handles SSL termination and redirects HTTP → HTTPS
- **certbot** container runs in the background, checking for renewal every 12 hours
- Certificates auto-renew when within 30 days of expiry
- Certs stored in `./certs/` directory (mounted as volume)

## Troubleshooting

### Check if ports are open

```bash
# From outside your network
curl -I http://alswingl.ddns.net
```

### View certbot logs

```bash
docker logs wishlist-certbot
```

### Manually renew certificate

```bash
docker exec wishlist-certbot certbot renew --force-renewal
```

### Certificate paths

- Certificate: `./certs/live/alswingl.ddns.net/fullchain.pem`
- Private key: `./certs/live/alswingl.ddns.net/privkey.pem`

## Files Modified

- `docker-compose.yml` - Added certbot container, SSL volumes, port 443
- `frontend/nginx.conf` - Added HTTPS server block with redirect
- `.env` - Added `DOMAIN_NAME` and `LETSENCRYPT_EMAIL`
- `init-ssl.sh` - One-time SSL initialization script
