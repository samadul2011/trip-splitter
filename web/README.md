# Trip Expense Splitter (Next.js 14 + Neon PostgreSQL + Built-in JWT Auth)

A full-stack multi-user group trip expense tracker & settlement calculator built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Neon Serverless PostgreSQL**, and **Built-in JWT Auth** (`jose` + `bcryptjs`).

---

## 🗄️ 1. Neon PostgreSQL Setup (Takes 1 Minute)

1. Go to [Neon Console (https://console.neon.tech)](https://console.neon.tech) and sign in with GitHub or Google (Free tier gives **10 free projects**).
2. Click **New Project** (e.g., `trip-splitter`) and copy the **Connection String** (`postgresql://...`).
3. Paste the connection string into [`web/.env.local`](./.env.local):
   ```env
   DATABASE_URL=postgresql://neondb_owner:your_password@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   JWT_SECRET=super-secret-trip-splitter-jwt-key-2026
   ```
4. **Automatic Table Creation**:
   - On the very first API request or login, the app **automatically creates** the `profiles`, `trips`, `trip_members`, and `expenses` tables and seeds 4 starter accounts (`Rahim`, `Karim`, `Fahim`, `Sakib` with password `123456`).
   - You can also inspect or run [`database/schema.sql`](./database/schema.sql) in the Neon SQL Editor anytime.

---

## 👤 2. Adding New Users (Admin)

Open the **SQL Editor** in your Neon Dashboard and run:

```sql
INSERT INTO profiles (full_name, password_hash)
VALUES ('Tanvir', 'tanvir123');
```

Users can immediately log in on `/login` (or from the Android app) using their name (`Tanvir`) and password (`tanvir123`).

---

## 🚀 3. Run Locally

```powershell
cd web
npm install
npm run dev
```

Open **http://localhost:3000** in your browser!
