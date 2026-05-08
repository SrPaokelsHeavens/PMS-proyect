# Hotel OS

Production-oriented hotel administration system for room control, reception, guest registration, products, charges, inventory and reports.

The old standalone HTML prototype remains in `../index.html`. This folder is the real application framework.

## Stack

- Web: React + Vite + TypeScript
- API: Fastify + TypeScript
- Database: PostgreSQL + Prisma ORM
- Realtime sync: Socket.IO events + TanStack Query cache invalidation
- Shared contracts: Zod schemas and TypeScript types

PostgreSQL is now the source of truth. Rooms, room groups, day groups, hour plans, rates and overtime rules are read from the API/DB and mirrored into the UI through query invalidation and realtime events.

## First Run

PowerShell blocks `npm.ps1` on this PC, so use `npm.cmd`.

```powershell
cd C:\Users\usuario\Desktop\hotel-dashboard\hotel-os
copy .env.example .env
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env
npm.cmd install
docker compose up -d postgres
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

If Docker is not installed on the machine, install PostgreSQL locally and create a database named `hotel_os`, then keep the same `DATABASE_URL` format.

Then open:

- Web app: http://localhost:5173
- API health: http://localhost:4000/health

For a server deployment use `npm.cmd run db:deploy` instead of `db:migrate` after setting `DATABASE_URL` to the production PostgreSQL connection string.

Demo login:

- Username: `admin`
- Password: `admin123`

Change this password and `JWT_SECRET` before production.
