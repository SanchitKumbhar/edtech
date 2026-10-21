# Focus Flair: Production Deployment & Scaling Guide

This guide describes how to deploy Focus Flair as a horizontally scalable system across multiple API instances, dedicated background workers, Redis, and MongoDB.

---

## 1. Prerequisites

- **Node.js:** v18.18+ or v20+
- **MongoDB:** v6.0+ (Replica Set recommended for production transactions and oplog)
- **Redis:** v6.2+ or v7.0+ (Standalone, Sentinel, or Redis Cluster)
- **Reverse Proxy / Load Balancer:** Nginx, HAProxy, AWS ALB, or Cloudflare

---

## 2. Environment Configuration

Copy `.env.example` in `backend/` to `.env`:

```bash
cd backend
cp .env.example .env
```

Ensure the following variables are configured:

```env
PORT=5000
NODE_ENV=production
TRUST_PROXY=1
CORS_ORIGIN=https://app.focusflair.com

# MongoDB URI (Replica Set)
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/exam_prep_db?retryWrites=true&w=majority
MONGO_MAX_POOL_SIZE=50
MONGO_MIN_POOL_SIZE=10

# Redis Infrastructure
REDIS_URL=redis://:your-redis-password@redis-host:6379/0

# Authentication
JWT_SECRET=use-a-strong-256-bit-random-secret
JWT_EXPIRES_IN=7d
STRICT_SOCKET_AUTH=true

# Background Worker Mode
# Set to 'false' in multi-instance API deployments where dedicated worker processes run 'npm run worker'
RUN_EMBEDDED_WORKER=false
```

---

## 3. Architecture Topologies

### Option A: PM2 Cluster Deployment (Single or Multi-Core VM)

Use PM2 to manage multiple Node.js API processes and dedicated background workers:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "focus-flair-api",
      script: "index.js",
      cwd: "./backend",
      instances: "max",       // Spawn 1 instance per CPU core
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        RUN_EMBEDDED_WORKER: "false"
      }
    },
    {
      name: "focus-flair-worker",
      script: "workers/index.js",
      cwd: "./backend",
      instances: 2,           // Dedicated worker processes
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
```

Start the services:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

### Option B: Docker Compose Multi-Instance Setup

```yaml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "512mb", "--maxmemory-policy", "volatile-lru"]
    volumes:
      - redis_data:/data

  api-1:
    build: ./backend
    restart: always
    environment:
      - PORT=5000
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - RUN_EMBEDDED_WORKER=false
    depends_on:
      - redis

  api-2:
    build: ./backend
    restart: always
    environment:
      - PORT=5000
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - RUN_EMBEDDED_WORKER=false
    depends_on:
      - redis

  worker:
    build: ./backend
    command: ["npm", "run", "worker"]
    restart: always
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api-1
      - api-2

volumes:
  redis_data:
```

---

## 4. Nginx Load Balancer Configuration

The following configuration supports round-robin API routing and WebSocket upgrade support:

```nginx
upstream focus_flair_backend {
    # Hash on client IP for sticky sessions if long-polling fallback is active
    ip_hash;
    server 127.0.0.1:5000;
    server 127.0.0.1:5001;
    keepalive 64;
}

server {
    listen 80;
    server_name api.focusflair.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.focusflair.com;

    ssl_certificate /etc/letsencrypt/live/api.focusflair.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.focusflair.com/privkey.pem;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Max body size
    client_max_body_size 5M;

    # Socket.IO WebSocket and Long-Polling Endpoint
    location /socket.io/ {
        proxy_pass http://focus_flair_backend;
        proxy_http_version 1.1;

        # WebSocket Upgrade Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings for long-lived sockets
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # REST API Routes
    location / {
        proxy_pass http://focus_flair_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 10s;
        proxy_read_timeout 30s;
    }
}
```

---

## 5. Health Probes & Monitoring

Focus Flair exposes dedicated endpoints for orchestration platforms (Kubernetes / AWS ECS):

| Endpoint | Purpose | Success Code | Failure Code |
| :--- | :--- | :--- | :--- |
| `/api/health` | Basic application uptime | `200 OK` | `500` |
| `/api/health/liveness` | Container process liveness probe | `200 OK` | `500` |
| `/api/health/readiness` | Checks DB and Redis connections | `200 OK` | `503 Service Unavailable` |

---

## 6. Zero-Downtime Deployment Checklist

1. **Database Migration:** Ensure any new schema indexes are built in the background:
   ```bash
   node -e "require('./config/db').connectDB().then(() => console.log('Connected'))"
   ```
2. **Start Redis:** Confirm Redis is operational with `redis-cli ping` -> `PONG`.
3. **Start Workers First:** Launch background worker processes (`npm run worker`) so pending jobs are picked up immediately.
4. **Deploy API Instances:** Perform a rolling restart of API instances (e.g. `pm2 reload all` or rolling Kubernetes Deployment).
5. **Verify Probes:** Run `curl -i http://localhost:5000/api/health/readiness` to verify readiness.
