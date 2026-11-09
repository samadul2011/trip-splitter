import fs from "fs";
import path from "path";
import crypto from "crypto";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { Expense, Profile, Trip } from "@/types/database";
import { roundCurrency } from "./settlement";

let neonInitialized = false;

export interface StoredUser extends Profile {
  password_hash: string;
}

export interface StoredSettlementStatus {
  trip_id: string;
  from_user: string;
  to_user: string;
  is_paid: boolean;
  paid_at: string | null;
}

interface LocalDbStructure {
  profiles: StoredUser[];
  trips: {
    id: string;
    name: string;
    created_by: string;
    is_completed: boolean;
    created_at: string;
  }[];
  trip_members: {
    trip_id: string;
    user_id: string;
    family_count?: number;
  }[];
  expenses: {
    id: string;
    trip_id: string;
    paid_by: string;
    amount: number;
    description: string;
    expense_date: string;
    created_at: string;
  }[];
  settlement_statuses?: StoredSettlementStatus[];
}

const BUNDLED_DB_PATH = path.join(process.cwd(), "database", "local-db.json");
const TMP_DB_PATH = path.join("/tmp", "trip-splitter-local-db.json");

let inMemoryDbCache: LocalDbStructure | null = null;

const DEFAULT_USERS: StoredUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    full_name: "Sabuj",
    password_hash: "123456",
    created_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    full_name: "Limon",
    password_hash: "123456",
    created_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    full_name: "Arian",
    password_hash: "123456",
    created_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    full_name: "Samadul",
    password_hash: "635504",
    created_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    full_name: "Tanha",
    password_hash: "123456",
    created_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    full_name: "Sabina",
    password_hash: "123456",
    created_at: new Date().toISOString(),
  },
  {
    id: "11111111-1111-4111-8111-111111111107",
    full_name: "Luto",
    password_hash: "123456",
    created_at: new Date().toISOString(),
  },
];

function readLocalDb(): LocalDbStructure {
  if (inMemoryDbCache) {
    return inMemoryDbCache;
  }

  // Prefer /tmp copy on serverless (Vercel) if it was already written during this instance's lifecycle
  const candidatePaths = [TMP_DB_PATH, BUNDLED_DB_PATH];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as LocalDbStructure;
        if (parsed && Array.isArray(parsed.profiles)) {
          if (!Array.isArray(parsed.settlement_statuses)) {
            parsed.settlement_statuses = [];
          }
          let updated = false;
          for (const defUser of DEFAULT_USERS) {
            const existing = parsed.profiles.find(
              (p) => p.full_name.toLowerCase() === defUser.full_name.toLowerCase()
            );
            if (!existing) {
              parsed.profiles.push(defUser);
              updated = true;
            }
          }
          inMemoryDbCache = parsed;
          if (updated) {
            writeLocalDb(parsed);
          }
          return parsed;
        }
      }
    } catch {
      // Try next path
    }
  }

  const initial: LocalDbStructure = {
    profiles: DEFAULT_USERS,
    trips: [],
    trip_members: [],
    expenses: [],
    settlement_statuses: [],
  };
  inMemoryDbCache = initial;
  writeLocalDb(initial);
  return initial;
}

function writeLocalDb(data: LocalDbStructure): void {
  inMemoryDbCache = data;
  const serialized = JSON.stringify(data, null, 2);

  // Try writing to project database/local-db.json first (works in local dev)
  try {
    const dir = path.dirname(BUNDLED_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BUNDLED_DB_PATH, serialized, "utf-8");
    return;
  } catch {
    // On Vercel serverless, /var/task is read-only; fall back to /tmp
  }

  try {
    fs.writeFileSync(TMP_DB_PATH, serialized, "utf-8");
  } catch (err) {
    console.error("Failed to write fallback local-db.json to /tmp:", err);
  }
}

export function getDatabaseUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.NEON_DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  for (const raw of candidates) {
    const url = raw?.trim();
    if (
      url &&
      url.startsWith("postgres") &&
      !url.includes("ep-example.ap-southeast-1.aws.neon.tech") &&
      !url.includes("your_password")
    ) {
      return url;
    }
  }
  return null;
}

export function isNeonConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

async function getNeonSql(): Promise<NeonQueryFunction<false, false>> {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("Neon DATABASE_URL is not configured.");
  }
  const sql = neon(connectionString);
  if (neonInitialized) return sql;

  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS trips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS trip_members (
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      family_count INT NOT NULL DEFAULT 1,
      PRIMARY KEY (trip_id, user_id)
    )
  `;
  await sql`
    ALTER TABLE trip_members
    ADD COLUMN IF NOT EXISTS family_count INT NOT NULL DEFAULT 1
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      paid_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      description TEXT NOT NULL,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS settlement_statuses (
      trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      from_user TEXT NOT NULL,
      to_user TEXT NOT NULL,
      is_paid BOOLEAN NOT NULL DEFAULT FALSE,
      paid_at TIMESTAMPTZ,
      PRIMARY KEY (trip_id, from_user, to_user)
    )
  `;

  await sql`
    INSERT INTO profiles (id, full_name, password_hash)
    VALUES
      ('11111111-1111-4111-8111-111111111101'::uuid, 'Sabuj', '123456'),
      ('11111111-1111-4111-8111-111111111102'::uuid, 'Limon', '123456'),
      ('11111111-1111-4111-8111-111111111103'::uuid, 'Arian', '123456'),
      ('11111111-1111-4111-8111-111111111104'::uuid, 'Samadul', '635504'),
      ('11111111-1111-4111-8111-111111111105'::uuid, 'Tanha', '123456'),
      ('11111111-1111-4111-8111-111111111106'::uuid, 'Sabina', '123456'),
      ('11111111-1111-4111-8111-111111111107'::uuid, 'Luto', '123456')
    ON CONFLICT (full_name) DO UPDATE
      SET password_hash = EXCLUDED.password_hash
  `;

  // If Neon has 0 trips so far, seed any initial trips from bundled local-db.json
  try {
    const existingTripsCount = await sql`SELECT COUNT(*)::int AS cnt FROM trips`;
    if (existingTripsCount && Number(existingTripsCount[0]?.cnt) === 0) {
      const bundled = readLocalDb();
      const neonProfiles = await sql`SELECT id, full_name FROM profiles`;
      const nameToNeonId = new Map<string, string>();
      for (const np of neonProfiles) {
        nameToNeonId.set(String(np.full_name).toLowerCase(), String(np.id));
      }
      const localIdToNeonId = new Map<string, string>();
      for (const lp of bundled.profiles) {
        const mapped = nameToNeonId.get(lp.full_name.toLowerCase());
        if (mapped) {
          localIdToNeonId.set(lp.id, mapped);
        }
      }

      for (const t of bundled.trips) {
        const creatorNeonId =
          localIdToNeonId.get(t.created_by) ||
          nameToNeonId.get("samadul");
        if (!creatorNeonId) continue;

        await sql`
          INSERT INTO trips (id, name, created_by, is_completed, created_at)
          VALUES (${t.id}::uuid, ${t.name}, ${creatorNeonId}::uuid, ${Boolean(t.is_completed)}, ${t.created_at}::timestamptz)
          ON CONFLICT (id) DO NOTHING
        `;
      }

      for (const tm of bundled.trip_members) {
        const memberNeonId = localIdToNeonId.get(tm.user_id);
        if (!memberNeonId) continue;
        const fCount = Math.max(1, Number(tm.family_count) || 1);
        await sql`
          INSERT INTO trip_members (trip_id, user_id, family_count)
          VALUES (${tm.trip_id}::uuid, ${memberNeonId}::uuid, ${fCount})
          ON CONFLICT (trip_id, user_id) DO NOTHING
        `;
      }

      for (const exp of bundled.expenses) {
        const payerNeonId = localIdToNeonId.get(exp.paid_by);
        if (!payerNeonId) continue;
        await sql`
          INSERT INTO expenses (id, trip_id, paid_by, amount, description, expense_date, created_at)
          VALUES (
            ${exp.id}::uuid,
            ${exp.trip_id}::uuid,
            ${payerNeonId}::uuid,
            ${exp.amount},
            ${exp.description},
            ${exp.expense_date}::date,
            ${exp.created_at}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }
  } catch (seedErr) {
    console.warn("Initial Neon seed skipped:", seedErr);
  }

  neonInitialized = true;
  return sql;
}

export async function dbFindUserByName(name: string): Promise<StoredUser | null> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      SELECT id, full_name, password_hash, created_at
      FROM profiles
      WHERE LOWER(full_name) = LOWER(${name})
      LIMIT 1
    `;
    if (!rows || rows.length === 0) return null;
    return {
      id: String(rows[0].id),
      full_name: String(rows[0].full_name),
      password_hash: String(rows[0].password_hash),
      created_at: String(rows[0].created_at),
    };
  }

  const db = readLocalDb();
  const found = db.profiles.find(
    (p) => p.full_name.toLowerCase() === name.toLowerCase()
  );
  return found || null;
}

export async function dbFindUserById(id: string): Promise<Profile | null> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      SELECT id, full_name, created_at
      FROM profiles
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    if (!rows || rows.length === 0) return null;
    return {
      id: String(rows[0].id),
      full_name: String(rows[0].full_name),
      created_at: String(rows[0].created_at),
    };
  }

  const db = readLocalDb();
  const found = db.profiles.find((p) => p.id === id);
  if (!found) return null;
  return {
    id: found.id,
    full_name: found.full_name,
    created_at: found.created_at,
  };
}

export async function dbSearchUsers(query: string): Promise<Profile[]> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = query
      ? await sql`
          SELECT id, full_name, created_at
          FROM profiles
          WHERE full_name ILIKE ${"%" + query + "%"}
          ORDER BY full_name ASC
          LIMIT 50
        `
      : await sql`
          SELECT id, full_name, created_at
          FROM profiles
          ORDER BY full_name ASC
          LIMIT 50
        `;
    return (rows || []).map((r: any) => ({
      id: String(r.id),
      full_name: String(r.full_name),
      created_at: String(r.created_at),
    }));
  }

  const db = readLocalDb();
  const q = query.toLowerCase();
  return db.profiles
    .filter((p) => !q || p.full_name.toLowerCase().includes(q))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      created_at: p.created_at,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function dbCreateUser(
  fullName: string,
  plainPassword?: string
): Promise<Profile> {
  const cleanName = fullName.trim();
  const password = plainPassword?.trim() || "123456";

  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      INSERT INTO profiles (full_name, password_hash)
      VALUES (${cleanName}, ${password})
      ON CONFLICT (full_name) DO UPDATE
        SET password_hash = EXCLUDED.password_hash
      RETURNING id, full_name, created_at
    `;
    return {
      id: String(rows[0].id),
      full_name: String(rows[0].full_name),
      created_at: String(rows[0].created_at),
    };
  }

  const db = readLocalDb();
  let existing = db.profiles.find(
    (p) => p.full_name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existing) {
    existing.password_hash = password;
    writeLocalDb(db);
    return {
      id: existing.id,
      full_name: existing.full_name,
      created_at: existing.created_at,
    };
  }

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    full_name: cleanName,
    password_hash: password,
    created_at: new Date().toISOString(),
  };
  db.profiles.push(newUser);
  writeLocalDb(db);
  return {
    id: newUser.id,
    full_name: newUser.full_name,
    created_at: newUser.created_at,
  };
}

export async function dbGetTripsForUser(userId: string): Promise<Trip[]> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      SELECT
        t.id,
        t.name,
        t.created_by,
        t.is_completed,
        t.created_at,
        (
          SELECT COUNT(*)::int
          FROM trip_members tm2
          WHERE tm2.trip_id = t.id
        ) AS member_count,
        (
          SELECT COALESCE(SUM(COALESCE(tm3.family_count, 1)), 1)::int
          FROM trip_members tm3
          WHERE tm3.trip_id = t.id
        ) AS total_persons,
        COALESCE(
          (
            SELECT SUM(e.amount)::numeric
            FROM expenses e
            WHERE e.trip_id = t.id
          ),
          0
        ) AS total_spent
      FROM trips t
      INNER JOIN trip_members tm ON tm.trip_id = t.id
      WHERE tm.user_id = ${userId}::uuid
      ORDER BY t.created_at DESC
    `;

    return (rows || []).map((t: any) => ({
      id: String(t.id),
      name: String(t.name),
      created_by: String(t.created_by),
      is_completed: Boolean(t.is_completed),
      created_at: String(t.created_at),
      member_count: Number(t.member_count) || 1,
      total_persons: Number(t.total_persons) || Number(t.member_count) || 1,
      total_spent: roundCurrency(Number(t.total_spent) || 0),
    }));
  }

  const db = readLocalDb();
  const userTripIds = new Set(
    db.trip_members.filter((tm) => tm.user_id === userId).map((tm) => tm.trip_id)
  );

  return db.trips
    .filter((t) => userTripIds.has(t.id))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .map((t) => {
      const tripMembers = db.trip_members.filter((tm) => tm.trip_id === t.id);
      const memberCount = tripMembers.length || 1;
      const totalPersons = tripMembers.reduce(
        (sum, tm) => sum + Math.max(1, Number(tm.family_count) || 1),
        0
      );
      const totalSpent = roundCurrency(
        db.expenses
          .filter((e) => e.trip_id === t.id)
          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      );
      return {
        ...t,
        member_count: memberCount,
        total_persons: totalPersons || memberCount,
        total_spent: totalSpent,
      };
    });
}

export async function dbCreateTrip(
  name: string,
  creatorId: string,
  memberIds: string[],
  memberCounts: Record<string, number> = {}
): Promise<Trip & { member_ids: string[] }> {
  const uniqueMemberIds = Array.from(new Set([creatorId, ...memberIds]));

  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const createdRows = await sql`
      INSERT INTO trips (name, created_by, is_completed)
      VALUES (${name}, ${creatorId}::uuid, FALSE)
      RETURNING id, name, created_by, is_completed, created_at
    `;
    const createdTrip = createdRows[0];
    for (const memberId of uniqueMemberIds) {
      const fCount = Math.max(1, Number(memberCounts[memberId]) || 1);
      await sql`
        INSERT INTO trip_members (trip_id, user_id, family_count)
        VALUES (${createdTrip.id}::uuid, ${memberId}::uuid, ${fCount})
        ON CONFLICT (trip_id, user_id)
        DO UPDATE SET family_count = EXCLUDED.family_count
      `;
    }
    return {
      id: String(createdTrip.id),
      name: String(createdTrip.name),
      created_by: String(createdTrip.created_by),
      is_completed: Boolean(createdTrip.is_completed),
      created_at: String(createdTrip.created_at),
      member_ids: uniqueMemberIds,
    };
  }

  const db = readLocalDb();
  const newTrip = {
    id: crypto.randomUUID(),
    name,
    created_by: creatorId,
    is_completed: false,
    created_at: new Date().toISOString(),
  };
  db.trips.push(newTrip);
  for (const memberId of uniqueMemberIds) {
    const fCount = Math.max(1, Number(memberCounts[memberId]) || 1);
    db.trip_members.push({
      trip_id: newTrip.id,
      user_id: memberId,
      family_count: fCount,
    });
  }
  writeLocalDb(db);

  return {
    ...newTrip,
    member_ids: uniqueMemberIds,
  };
}

export async function dbUpdateTripMemberFamilyCount(params: {
  tripId: string;
  userId: string;
  familyCount: number;
}): Promise<void> {
  const { tripId, userId, familyCount } = params;
  const cleanCount = Math.max(1, Math.round(Number(familyCount) || 1));

  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    await sql`
      INSERT INTO trip_members (trip_id, user_id, family_count)
      VALUES (${tripId}::uuid, ${userId}::uuid, ${cleanCount})
      ON CONFLICT (trip_id, user_id)
      DO UPDATE SET family_count = EXCLUDED.family_count
    `;
    return;
  }

  const db = readLocalDb();
  const existing = db.trip_members.find(
    (tm) => tm.trip_id === tripId && tm.user_id === userId
  );
  if (existing) {
    existing.family_count = cleanCount;
  } else {
    db.trip_members.push({
      trip_id: tripId,
      user_id: userId,
      family_count: cleanCount,
    });
  }
  writeLocalDb(db);
}

export async function dbIsTripMember(
  tripId: string,
  userId: string
): Promise<boolean> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      SELECT trip_id
      FROM trip_members
      WHERE trip_id = ${tripId}::uuid
        AND user_id = ${userId}::uuid
      LIMIT 1
    `;
    return Boolean(rows && rows.length > 0);
  }

  const db = readLocalDb();
  return db.trip_members.some(
    (tm) => tm.trip_id === tripId && tm.user_id === userId
  );
}

export async function dbGetTripById(tripId: string): Promise<Trip | null> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const tripRows = await sql`
      SELECT id, name, created_by, is_completed, created_at
      FROM trips
      WHERE id = ${tripId}::uuid
      LIMIT 1
    `;
    if (!tripRows || tripRows.length === 0) return null;

    const members = await sql`
      SELECT p.id, p.full_name, COALESCE(tm.family_count, 1) AS family_count
      FROM trip_members tm
      INNER JOIN profiles p ON p.id = tm.user_id
      WHERE tm.trip_id = ${tripId}::uuid
      ORDER BY p.full_name ASC
    `;

    const t = tripRows[0];
    const mappedMembers = members.map((m: any) => ({
      id: String(m.id),
      full_name: String(m.full_name),
      family_count: Math.max(1, Number(m.family_count) || 1),
    }));
    const totalPersons = mappedMembers.reduce(
      (sum, m) => sum + (m.family_count || 1),
      0
    );

    return {
      id: String(t.id),
      name: String(t.name),
      created_by: String(t.created_by),
      is_completed: Boolean(t.is_completed),
      created_at: String(t.created_at),
      member_count: mappedMembers.length,
      total_persons: totalPersons,
      members: mappedMembers,
    };
  }

  const db = readLocalDb();
  const trip = db.trips.find((t) => t.id === tripId);
  if (!trip) return null;

  const tripMemberMap = new Map<string, number>();
  for (const tm of db.trip_members) {
    if (tm.trip_id === tripId) {
      tripMemberMap.set(tm.user_id, Math.max(1, Number(tm.family_count) || 1));
    }
  }

  const members = db.profiles
    .filter((p) => tripMemberMap.has(p.id))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      family_count: tripMemberMap.get(p.id) || 1,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const totalPersons = members.reduce(
    (sum, m) => sum + (m.family_count || 1),
    0
  );

  return {
    ...trip,
    member_count: members.length,
    total_persons: totalPersons,
    members,
  };
}

export async function dbUpdateTripStatus(
  tripId: string,
  isCompleted: boolean
): Promise<Trip | null> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      UPDATE trips
      SET is_completed = ${isCompleted}
      WHERE id = ${tripId}::uuid
      RETURNING id, name, created_by, is_completed, created_at
    `;
    if (!rows || rows.length === 0) return null;
    return {
      id: String(rows[0].id),
      name: String(rows[0].name),
      created_by: String(rows[0].created_by),
      is_completed: Boolean(rows[0].is_completed),
      created_at: String(rows[0].created_at),
    };
  }

  const db = readLocalDb();
  const trip = db.trips.find((t) => t.id === tripId);
  if (!trip) return null;
  trip.is_completed = isCompleted;
  writeLocalDb(db);
  return { ...trip };
}

export async function dbGetTripExpenses(tripId: string): Promise<Expense[]> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      SELECT
        e.id,
        e.trip_id,
        e.paid_by,
        e.amount,
        e.description,
        TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date,
        e.created_at,
        p.full_name AS user_name
      FROM expenses e
      INNER JOIN profiles p ON p.id = e.paid_by
      WHERE e.trip_id = ${tripId}::uuid
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;

    return (rows || []).map((row: any) => ({
      id: String(row.id),
      trip_id: String(row.trip_id),
      paid_by: String(row.paid_by),
      user_name: String(row.user_name || "Unknown"),
      amount: Number(row.amount),
      description: String(row.description),
      expense_date: String(row.expense_date),
      created_at: String(row.created_at),
    }));
  }

  const db = readLocalDb();
  const profileMap = new Map(db.profiles.map((p) => [p.id, p.full_name]));

  return db.expenses
    .filter((e) => e.trip_id === tripId)
    .sort((a, b) => {
      const dateCmp = b.expense_date.localeCompare(a.expense_date);
      if (dateCmp !== 0) return dateCmp;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    })
    .map((e) => ({
      ...e,
      user_name: profileMap.get(e.paid_by) || "Unknown",
    }));
}

export async function dbAddTripExpense(params: {
  tripId: string;
  paidBy: string;
  userName?: string;
  amount: number;
  description: string;
  expenseDate: string;
}): Promise<Expense> {
  const { tripId, paidBy, amount, description, expenseDate } = params;
  const payerProfile = await dbFindUserById(paidBy);
  const resolvedUserName =
    payerProfile?.full_name || params.userName || "Unknown";

  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      INSERT INTO expenses (trip_id, paid_by, amount, description, expense_date)
      VALUES (${tripId}::uuid, ${paidBy}::uuid, ${amount}, ${description}, ${expenseDate}::date)
      RETURNING
        id,
        trip_id,
        paid_by,
        amount,
        description,
        TO_CHAR(expense_date, 'YYYY-MM-DD') AS expense_date,
        created_at
    `;
    const created = rows[0];
    return {
      id: String(created.id),
      trip_id: String(created.trip_id),
      paid_by: String(created.paid_by),
      user_name: resolvedUserName,
      amount: Number(created.amount),
      description: String(created.description),
      expense_date: String(created.expense_date),
      created_at: String(created.created_at),
    };
  }

  const db = readLocalDb();
  const newExpense = {
    id: crypto.randomUUID(),
    trip_id: tripId,
    paid_by: paidBy,
    amount: Number(amount),
    description,
    expense_date: expenseDate,
    created_at: new Date().toISOString(),
  };
  db.expenses.push(newExpense);
  writeLocalDb(db);

  return {
    ...newExpense,
    user_name: resolvedUserName,
  };
}

export async function dbUpdateTripExpense(params: {
  tripId: string;
  expenseId: string;
  paidBy?: string;
  amount: number;
  description: string;
  expenseDate: string;
}): Promise<Expense | null> {
  const { tripId, expenseId, paidBy, amount, description, expenseDate } =
    params;

  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = paidBy
      ? await sql`
          UPDATE expenses
          SET
            paid_by = ${paidBy}::uuid,
            amount = ${amount},
            description = ${description},
            expense_date = ${expenseDate}::date
          WHERE id = ${expenseId}::uuid AND trip_id = ${tripId}::uuid
          RETURNING
            id,
            trip_id,
            paid_by,
            amount,
            description,
            TO_CHAR(expense_date, 'YYYY-MM-DD') AS expense_date,
            created_at
        `
      : await sql`
          UPDATE expenses
          SET
            amount = ${amount},
            description = ${description},
            expense_date = ${expenseDate}::date
          WHERE id = ${expenseId}::uuid AND trip_id = ${tripId}::uuid
          RETURNING
            id,
            trip_id,
            paid_by,
            amount,
            description,
            TO_CHAR(expense_date, 'YYYY-MM-DD') AS expense_date,
            created_at
        `;
    if (!rows || rows.length === 0) return null;
    const updated = rows[0];
    const payer = await dbFindUserById(String(updated.paid_by));
    return {
      id: String(updated.id),
      trip_id: String(updated.trip_id),
      paid_by: String(updated.paid_by),
      user_name: payer?.full_name || "Unknown",
      amount: Number(updated.amount),
      description: String(updated.description),
      expense_date: String(updated.expense_date),
      created_at: String(updated.created_at),
    };
  }

  const db = readLocalDb();
  const exp = db.expenses.find(
    (e) => e.id === expenseId && e.trip_id === tripId
  );
  if (!exp) return null;

  if (paidBy) {
    exp.paid_by = paidBy;
  }
  exp.amount = Number(amount);
  exp.description = description;
  exp.expense_date = expenseDate;
  writeLocalDb(db);

  const payer = db.profiles.find((p) => p.id === exp.paid_by);
  return {
    ...exp,
    user_name: payer?.full_name || "Unknown",
  };
}

export async function dbDeleteTripExpense(
  tripId: string,
  expenseId: string
): Promise<boolean> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    await sql`
      DELETE FROM expenses
      WHERE id = ${expenseId}::uuid AND trip_id = ${tripId}::uuid
    `;
    return true;
  }

  const db = readLocalDb();
  const before = db.expenses.length;
  db.expenses = db.expenses.filter(
    (e) => !(e.id === expenseId && e.trip_id === tripId)
  );
  if (db.expenses.length !== before) {
    writeLocalDb(db);
    return true;
  }
  return false;
}

export async function dbGetSettlementStatuses(
  tripId: string
): Promise<StoredSettlementStatus[]> {
  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    const rows = await sql`
      SELECT trip_id, from_user, to_user, is_paid, paid_at
      FROM settlement_statuses
      WHERE trip_id = ${tripId}::uuid
    `;
    return (rows || []).map((r: any) => ({
      trip_id: String(r.trip_id),
      from_user: String(r.from_user),
      to_user: String(r.to_user),
      is_paid: Boolean(r.is_paid),
      paid_at: r.paid_at ? String(r.paid_at) : null,
    }));
  }

  const db = readLocalDb();
  return (db.settlement_statuses || []).filter((s) => s.trip_id === tripId);
}

export async function dbToggleSettlementPaid(params: {
  tripId: string;
  fromUser: string;
  toUser: string;
  isPaid: boolean;
}): Promise<StoredSettlementStatus> {
  const { tripId, fromUser, toUser, isPaid } = params;
  const paidAt = isPaid ? new Date().toISOString() : null;

  if (isNeonConfigured()) {
    const sql = await getNeonSql();
    await sql`
      INSERT INTO settlement_statuses (trip_id, from_user, to_user, is_paid, paid_at)
      VALUES (${tripId}::uuid, ${fromUser}, ${toUser}, ${isPaid}, ${paidAt})
      ON CONFLICT (trip_id, from_user, to_user)
      DO UPDATE SET is_paid = EXCLUDED.is_paid, paid_at = EXCLUDED.paid_at
    `;
    return {
      trip_id: tripId,
      from_user: fromUser,
      to_user: toUser,
      is_paid: isPaid,
      paid_at: paidAt,
    };
  }

  const db = readLocalDb();
  if (!Array.isArray(db.settlement_statuses)) {
    db.settlement_statuses = [];
  }

  const existing = db.settlement_statuses.find(
    (s) =>
      s.trip_id === tripId &&
      s.from_user === fromUser &&
      s.to_user === toUser
  );

  if (existing) {
    existing.is_paid = isPaid;
    existing.paid_at = paidAt;
  } else {
    db.settlement_statuses.push({
      trip_id: tripId,
      from_user: fromUser,
      to_user: toUser,
      is_paid: isPaid,
      paid_at: paidAt,
    });
  }
  writeLocalDb(db);

  return {
    trip_id: tripId,
    from_user: fromUser,
    to_user: toUser,
    is_paid: isPaid,
    paid_at: paidAt,
  };
}
