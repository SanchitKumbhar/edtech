# Backend Setup: Connect a New MongoDB

This guide explains how to connect a new MongoDB database to this backend in very simple steps.

## 1) Open this backend folder

Use this folder:

- backend

## 2) Create or update the .env file

In the backend root, create a file named .env (if not already there).

Add these values:

PORT=5000
MONGODB_URI=your_mongodb_connection_string_here

Important:

- This backend reads database URL from any one of these keys:
  - MONGODB_URI (recommended)
  - MONGO_URI
  - DATABASE_URL
- Use at least one of them. MONGODB_URI is easiest.

## 3) Get your MongoDB connection string

### Option A: MongoDB Atlas (cloud)

1. Create a cluster in Atlas.
2. Create a database user (username + password).
3. In Network Access, allow your IP.
4. Click Connect -> Drivers and copy the URI.
5. Replace username, password, and database name in the URI.

Example:

mongodb+srv://myUser:myPass@cluster0.xxxxx.mongodb.net/myDatabase?retryWrites=true&w=majority

### Option B: Local MongoDB

If MongoDB is running on your system:

mongodb://127.0.0.1:27017/myDatabase

## 4) Install dependencies

Run in backend folder:

npm install

## 5) Start the backend

For development:

npm run dev

Or normal start:

npm start

## 6) Confirm connection is working

Check terminal logs after start.
You should see a line like:

MongoDB connected (host/dbName)

Also check health endpoint:

http://localhost:5000/api/health

## Common errors and quick fixes

- MongoDB URI is missing:
  - Add MONGODB_URI in backend/.env
- Authentication failed:
  - Recheck username/password in URI
- Could not connect / timeout:
  - Atlas IP allowlist may be missing your current IP
  - Check internet/firewall
- Wrong URI format:
  - URI must start with mongodb:// or mongodb+srv://

## Notes

- Do not share your .env file publicly.
- Keep database credentials private.
