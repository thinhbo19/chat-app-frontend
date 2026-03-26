# Chat app — Frontend

Ứng dụng chat (React, Vite, TypeScript). **API và Socket.IO** nằm ở repo backend riêng: `chat-app-backend`.

## Chạy local

```bash
npm install
cp .env.example .env   # chỉnh VITE_API_URL trỏ tới backend (vd: http://localhost:5000)
npm run dev
```

## Deploy Netlify

Repo đã có `netlify.toml` (`npm run build`, publish `dist`) và `public/_redirects` để SPA (vd. `/chat`) không 404 khi reload.

Trên Netlify → **Environment variables**: đặt `VITE_API_URL` = URL HTTPS backend (vd. `https://your-app.fly.dev`).

## Git

Đây là **một repo Git độc lập** (chỉ frontend). Không còn monorepo chung với backend.
