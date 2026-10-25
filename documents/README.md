# Focus Flair Documentation Suite

Welcome to the official documentation directory for the **Focus Flair** examination, live proctoring, adaptive practice, and analytics platform.

---

## Documentation Index

| Document | Purpose & Description | Target Audience |
| :--- | :--- | :--- |
| 📖 [**USER_MANUAL.md**](./USER_MANUAL.md) | **Step-by-step User Guide**: How to register, join live proctored exams, take tests, review scorecards, practice syllabus topics, solve PYQs, create exams, monitor examinees in real time, revert auto-submits, upload questions, and manage announcements. | Students, Teachers, Institute Admins |
| 🚀 [**FEATURE_DOCUMENT.md**](./FEATURE_DOCUMENT.md) | **Feature Specification Catalog**: Detailed breakdown of every working feature across the student and admin portals, user stories, workflows, and role-based access control (RBAC) matrix. | Product Managers, QA, Engineers, Stakeholders |
| ⚙️ [**TECH_STACK.md**](./TECH_STACK.md) | **Technical Stack & API Specifications**: Comprehensive guide to React 18, Vite, TypeScript, Tailwind, Node.js, Express 5, Socket.IO, Redis, BullMQ, MongoDB schemas, Redis key taxonomy, background queues, and complete REST API contracts. | Full-Stack Developers, DevOps, Architects |
| 🏗️ [**APP_ARCHITECTURE.md**](./APP_ARCHITECTURE.md) | **Complete Application Architecture**: Visual Mermaid system topologies, real-time WebSocket anti-cheat pub/sub diagrams, BullMQ async submission pipeline, adaptive practice state machine, and complete MongoDB Entity-Relationship (ER) diagram. | System Architects, Senior Engineers, SREs |

---

## Quick Reference Commands

### Start Backend
```bash
cd backend
npm install
npm start          # Runs on http://localhost:5000
npm run worker     # Runs BullMQ background worker (optional standalone)
```

### Start Frontend
```bash
cd focus-flair
npm install
npm run dev        # Runs on http://localhost:5173
```

### Run Tests
```bash
# Backend unit & integration test suite
cd backend
npm test

# Frontend TypeScript type check
cd focus-flair
npx tsc --noEmit
```
