# Chatly

A real-time messaging app with one-to-one and group chats, end-to-end encrypted messages, audio/video calling, and a built-in AI assistant.

## Features

- **Real-time messaging** — powered by Socket.IO, with typing indicators, delivery/read receipts, and online presence.
- **End-to-end encryption** — direct messages are encrypted client-side with TweetNaCl (Curve25519), so the server never sees plaintext content.
- **Group chats** — create groups, invite/approve members, assign roles, pin messages, and manage join requests.
- **Friend requests** — send, accept, reject, or withdraw connection requests; unfriend or block users.
- **Audio & video calls** — peer-to-peer WebRTC calls signaled over Socket.IO, with STUN/TURN support.
- **AI chat assistant** — an in-app assistant backed by Google's Gemini API.
- **Notifications** — in-app notifications for requests, messages, and group activity.
- **Rich messaging** — edit, delete, and react to messages; clear chat history.
- **Profiles & media** — avatars and chat media uploads via Cloudinary.
- **Auth & account security** — JWT access/refresh tokens, email verification, and password reset via email OTP.
- **API documentation** — interactive Swagger UI at `/api/docs`.

## Tech Stack

**Frontend**
- React 18 + TypeScript, built with Vite
- Tailwind CSS
- Zustand (state management)
- React Router
- React Hook Form + Zod (forms & validation)
- Socket.IO client
- TweetNaCl / tweetnacl-util (client-side E2E encryption)

**Backend**
- Node.js + Express + TypeScript
- MongoDB with Mongoose
- Socket.IO (real-time events & call signaling)
- JSON Web Tokens (access + refresh) with bcrypt password hashing
- Cloudinary (image/media storage)
- EmailJS (verification & password-reset emails)
- Swagger (swagger-jsdoc + swagger-ui-express) for API docs
- Winston + Morgan (logging)
- Helmet, express-rate-limit, hpp, express-mongo-sanitize (security hardening)
- Jest + Supertest + mongodb-memory-server (testing)

## Project Structure

```
PROJECT-1/
├── backend/
│   └── src/
│       ├── config/         # DB, mail, socket, Cloudinary, Swagger config
│       ├── controllers/    # Route handlers
│       ├── middleware/     # Auth, validation, rate limiting, error handling
│       ├── models/         # Mongoose schemas (User, Chat, Message, ...)
│       ├── routes/         # Express route definitions
│       ├── services/       # Business logic
│       ├── sockets/        # Socket.IO event handlers (chat, calls, notifications)
│       ├── utils/          # Helpers (logger, validators, errors, tokens)
│       ├── __tests__/      # Jest test suites
│       ├── app.ts          # Express app setup
│       └── server.ts       # Entry point
└── frontend/
    └── src/
        ├── api/            # Axios client & endpoint definitions
        ├── components/     # Reusable UI components
        ├── context/        # React context (sockets, calls)
        ├── lib/            # Socket client, utilities
        ├── pages/          # Route-level pages (Login, Chats, Profile, ...)
        ├── store/          # Zustand stores (auth)
        ├── types/          # Shared TypeScript types
        └── utils/          # E2E encryption helpers
```

## Prerequisites

- Node.js 18+
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A [Cloudinary](https://cloudinary.com/) account (for avatar/media uploads)
- An [EmailJS](https://www.emailjs.com/) account (for verification & password-reset emails)
- A [Google Gemini API key](https://ai.google.dev/) (for the AI chat assistant)

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd PROJECT-1
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with the variables listed below, then start the server:

```bash
npm run dev      # starts the API with hot-reload
```

The API will be available at `http://localhost:5000`, with Swagger docs at `http://localhost:5000/api/docs`.

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in `frontend/` with the variables listed below, then start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Port the API server listens on (default `5000`) |
| `NODE_ENV` | `development` \| `production` \| `test` |
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_URL` | Allowed frontend origin(s) for CORS, comma-separated |
| `JWT_SECRET` | Secret used to sign JWTs |
| `JWT_EXPIRE` | Access token expiry (e.g. `15m`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `EMAILJS_SERVICE_ID` | EmailJS service ID |
| `EMAILJS_OTP_TEMPLATE_ID` | EmailJS template ID for OTP emails |
| `EMAILJS_PUBLIC_KEY` | EmailJS public key |
| `EMAILJS_PRIVATE_KEY` | EmailJS private key |
| `GEMINI_API_KEY` | Google Gemini API key for the AI chat assistant |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend REST API (e.g. `http://localhost:5000/api`) |
| `VITE_SOCKET_URL` | Base URL of the backend Socket.IO server (e.g. `http://localhost:5000`) |
| `VITE_TURN_URL` | (Optional) TURN server URL for WebRTC calls behind restrictive NATs |
| `VITE_TURN_USERNAME` | (Optional) TURN server username |
| `VITE_TURN_CREDENTIAL` | (Optional) TURN server credential |

## Testing

Backend tests use Jest, Supertest, and an in-memory MongoDB instance:

```bash
cd backend
npm test
```

## API Documentation

Once the backend is running, interactive API docs are available at:

```
http://localhost:5000/api/docs
```

## License
MIT license has been specified for this project.
