# Technology Stack & Architecture

## Backend
- **Node.js**: JavaScript runtime for server-side logic
- **Express.js**: Web framework for RESTful APIs
- **MongoDB**: NoSQL database for durable persistent records (exams, attempts, users, sessions)
- **Mongoose**: ODM for MongoDB models, validation, and compound indexes
- **Redis (ioredis)**: In-memory distributed store for cache-aside reads, sliding-window rate limiting, anti-cheat deduplication, and ephemeral presence leases
- **Socket.IO & @socket.io/redis-adapter**: Cross-instance real-time bidirectional communication with room isolation and JWT authentication
- **BullMQ**: Distributed queue for asynchronous background jobs (ranking, percentiles, badges, snapshots)
- **dotenv**: Environment variable management
- **CORS**: Configured for cross-origin frontend-backend communication

### Backend Structure
- `index.js`: Main server entry point (trust proxy, security headers, health probes, graceful shutdown)
- `config/`: Database (`db.js`), Redis client pool (`redis.js`), and BullMQ queues (`queue.js`)
- `socket/`: Socket.IO server initialization, JWT auth middleware, and room management (`index.js`)
- `workers/`: Dedicated background worker processes (`examWorker.js`, `index.js`)
- `controllers/`: Business logic for each resource
- `models/`: Mongoose schemas with compound indexes
- `routes/`: API endpoints (including `/api/health` liveness/readiness probes)
- `middleware/`: Authentication (`auth.js`), distributed rate limiting (`rateLimiter.js`), error handling (`error.js`)
- `utils/`: Cache-aside wrapper (`cache.js`), presence & deduplication (`presence.js`), JWT helpers (`auth.js`)
- `test/`: Native Node.js automated test suites (health, cache, rate limits, presence)
- `load-tests/`: Load testing scenarios (HTTP throughput, Socket.IO scale, Artillery config)
- `scripts/`: Zero-dependency local load balancer (`local-load-balancer.js`), seeds, and utilities

## Horizontal Scalability & Load Balancing
- **Nginx / ALB / HAProxy**: Distributes incoming HTTP & WebSocket connections across multiple API instances
- **`nginx.conf` & `docker-compose.yml`**: Out-of-the-box configuration for running multiple containerized API replicas behind Nginx
- **`npm run lb`**: Zero-dependency local load balancer script for testing multi-instance setups locally

## Frontend
- **React**: Component-based UI library
- **Vite**: Fast build tool and dev server
- **TypeScript**: Type safety for frontend code
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO Client**: Authenticated real-time event handling with debounced monitoring updates
- **Playwright**: End-to-end browser testing
- **Vitest**: Unit testing

### Frontend Structure
- `src/`: Main source code
  - `components/`: UI components
  - `pages/`: Route-based pages (`ExamLive.tsx`, `LiveMonitoring.tsx`, etc.)
  - `lib/`: API client (`api.ts`), Auth state (`auth.ts`), Socket client (`socket.ts`), utilities (`utils.ts`)
  - `hooks/`: Custom React hooks
  - `public/`: Static assets

## Security & Resilience
- **JWT Authentication**: Stateless, cross-instance JWT verification for HTTP and Socket.IO
- **Distributed Rate Limiting**: Redis Sorted-Set sliding window rate limits on auth and exam endpoints
- **Atomic CAS Exam Submission**: Prevents duplicate submissions and autosave race conditions
- **Server-Side Timers**: Strict server-side duration enforcement preventing client clock tampering
- **Graceful Shutdown**: Traps `SIGTERM`/`SIGINT` to safely drain HTTP connections, workers, and database pools

---

# Documentation References
- See `SCALABILITY_AUDIT.md` for the deep architectural audit and Redis key taxonomy
- See `DEPLOYMENT.md` for production deployment, clustering, and scaling guides
