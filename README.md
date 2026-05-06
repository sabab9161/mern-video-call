# MERN Video Calling App

Full-stack video calling project with React, Tailwind, Node.js, Express, MongoDB, Socket.IO, PeerJS, and JWT.

## Folder Structure

```text
mern-video-call/
  backend/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      socket/
  frontend/
    src/
      components/
      context/
      pages/
      utils/
```

## Run

1. Install dependencies:

```bash
cd mern-video-call
npm install
npm run install:all
```

2. Create environment files:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

3. Start MongoDB locally, or set `MONGO_URI` in `backend/.env`.

4. Run both apps:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend API: `http://localhost:5000`
