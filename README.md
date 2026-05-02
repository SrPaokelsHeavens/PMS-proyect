# Hotel OS

Production-oriented hotel administration system for room control, reception, guest registration, products, charges, inventory and reports.

The old standalone HTML prototype remains in `../index.html`. This folder is the real application framework.

## Stack

- Web: React + Vite + TypeScript
- API: Fastify + TypeScript
- Database: Prisma ORM with SQLite for local development
- Shared contracts: Zod schemas and TypeScript types

For a multi-terminal hotel deployment, move the Prisma datasource to PostgreSQL before going live. SQLite is used here so the first iteration can run on this Windows machine without installing a database server.

## First Run

PowerShell blocks `npm.ps1` on this PC, so use `npm.cmd`.

```powershell
cd C:\Users\usuario\Desktop\hotel-dashboard\hotel-os
copy .env.example .env
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env
npm.cmd install
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Then open:

- Web app: http://localhost:5173
- API health: http://localhost:4000/health

Demo login:

- Username: `admin`
- Password: `admin123`

Change this password and `JWT_SECRET` before production.
