import * as SQLite from 'expo-sqlite';

/**
 * Local mirror of the Supabase tables an offline session needs to read/write.
 * Column sets intentionally match the server schema (see database.types.ts)
 * so rows can be copied in either direction without a translation layer.
 */
const SCHEMA_SQL = `
create table if not exists customers (
  id text primary key,
  shop_id text not null,
  name text not null,
  phone text,
  address text,
  created_at text not null,
  updated_at text not null
);

create table if not exists orders (
  id text primary key,
  shop_id text not null,
  order_number text not null,
  customer_id text not null,
  cloth_type text,
  cloth_count integer,
  design_photo_url text,
  design_photo_urls text not null default '[]',
  measurement_id text,
  order_date text not null,
  delivery_date text,
  trial_date text,
  status text not null,
  priority text not null,
  is_rush integer not null default 0,
  rush_fee real,
  assigned_staff_id text,
  bill_book_number text,
  total_amount real,
  paid_amount real not null default 0,
  payment_mode text,
  created_at text not null,
  updated_at text not null
);

create table if not exists order_items (
  id text primary key,
  shop_id text not null,
  order_id text not null,
  garment_type text not null,
  cloth_count integer not null default 1,
  unit_price real not null default 0,
  notes text,
  measurement_id text,
  created_at text not null
);

create table if not exists staff (
  id text primary key,
  shop_id text not null,
  name text not null,
  phone text,
  role text,
  wage_type text not null,
  wage_amount real not null default 0,
  wage_amount_pant real,
  wage_amount_shirt real,
  wage_amount_pair real,
  is_active integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create table if not exists bills (
  id text primary key,
  shop_id text not null,
  order_id text,
  customer_id text not null,
  fabric_cost real not null default 0,
  stitching_charge real not null default 0,
  discount real not null default 0,
  tax real not null default 0,
  total_amount real,
  payment_status text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists payments (
  id text primary key,
  shop_id text not null,
  bill_id text not null,
  customer_id text not null,
  amount_paid real not null,
  payment_mode text,
  payment_date text not null
);

-- Local-only bookkeeping (never synced to Supabase directly).
create table if not exists pending_ops (
  op_id text primary key,
  entity text not null,
  row_id text not null,
  op_type text not null check (op_type in ('insert', 'update', 'delete')),
  payload text not null,
  created_at text not null
);

create table if not exists sync_meta (
  entity text primary key,
  last_synced_at text
);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('measuresone_offline.db').then(async (db) => {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync(SCHEMA_SQL);
      return db;
    });
  }
  return dbPromise;
}

/**
 * expo-sqlite's BEGIN/COMMIT-based transactions aren't safe to overlap on a
 * single connection — SQLite has no nested transactions, so a second
 * `withTransactionAsync` starting while the first is still mid-flight fails
 * with "cannot rollback - no transaction is active". Local writes
 * (repository.ts) and the sync engine (sync.ts) both open transactions and
 * can genuinely race (a write's fire-and-forget sync kicks off while the
 * write's own transaction is still closing), so every transactional call
 * funnels through this queue to force them to run one at a time.
 */
let dbQueue: Promise<unknown> = Promise.resolve();

export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = dbQueue.then(fn, fn);
  dbQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export const SYNCED_ENTITIES = [
  'customers',
  'orders',
  'order_items',
  'staff',
  'bills',
  'payments',
] as const;

export type SyncedEntity = (typeof SYNCED_ENTITIES)[number];
