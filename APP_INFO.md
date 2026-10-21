# Application Overview

## Project Name
Focus Flair (Assumed from folder structure)

## Description
Focus Flair is a full-stack web application designed for online exam management, live monitoring, practice sessions, leaderboards, and user profiles. It features a robust backend built with Node.js, Express, MongoDB, and Socket.IO for real-time communication, and a modern frontend (likely React + Vite) for a seamless user experience.

## Key Features
- User authentication and profile management
- Exam creation, assignment, and live monitoring
- Practice questions and topic-wise practice
- Leaderboards and badges
- Notices and announcements
- Syllabus and topic tracking
- Real-time anti-cheat monitoring (tab switch detection)
- Admin dashboard and controls

## Folder Structure
- `backend/`: Node.js/Express API, Socket.IO server, MongoDB models, routes, controllers, middleware
- `focus-flair/`: Frontend (React + Vite), UI components, pages, hooks, utilities

## API Endpoints
- `/api/auth`: Authentication
- `/api/dashboard`: Dashboard data
- `/api/exams`: Exam management
- `/api/practice`: Practice questions
- `/api/leaderboard`: Leaderboards
- `/api/monitoring`: Live monitoring
- `/api/pyq`: Previous year questions
- `/api/profile`: User profiles
- `/api/syllabus`: Syllabus/topics
- `/api/notices` & `/api/notice`: Notices

## Real-Time Features
- Socket.IO for live monitoring and admin notifications (e.g., tab switch events)

## Health Check
- `/` and `/api/health` endpoints for status and uptime

## Environment
- `.env` file for configuration (not included in repo)

---

# Getting Started

1. Install dependencies in both `backend/` and `focus-flair/` folders
2. Configure environment variables in `backend/.env`
3. Start backend: `npm start` or `node index.js`
4. Start frontend: `npm run dev` (in `focus-flair/`)

---

# Authors & Contributors
- [Add your names here]

# License
- [Specify license here]
