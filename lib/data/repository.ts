import * as Crypto from 'expo-crypto';
import { getDb, runExclusive } from './db';
import { runSync } from './sync';
import { supabase } from '../supabase';
import type { Tables, TablesInsert, TablesUpdate } from '../database.types';

/**
 * Reads go straight to the local SQLite mirror (populated by sync.ts) so
 * screens render instantly offline. Writes go to SQLite first, get queued in
 * `pending_ops`, and are pushed to Supabase on the next `runSync()` call —
 * screens never call `supabase.from()` directly for these entities.
 */

function nowIso() {
  return new Date().toISOString();
}

function fromSqlite<T>(row: Record<string, unknown>, jsonColumns: string[] = [], boolColumns: string[] = []): T {
  const out: Record<string, unknown> = { ...row };
  for (const c of jsonColumns) {
    if (typeof out[c] === 'string') {
      try {
        out[c] = JSON.parse(out[c] as string);
      } catch {
        // leave as-is if malformed
      }
    }
  }
  for (const c of boolColumns) {
    out[c] = out[c] === 1 || out[c] === true;
  }
  return out as T;
}

async function enqueueOp(entity: string, rowId: string, opType: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  const db = await getDb();
  await db.runAsync(
    'insert into pending_ops (op_id, entity, row_id, op_type, payload, created_at) values (?, ?, ?, ?, ?, ?)',
    [Crypto.randomUUID(), entity, rowId, opType, JSON.stringify(payload), nowIso()]
  );
}

/** Fire-and-forget: sync after a local write, without blocking the caller's UI update. */
function kickSync(shopId: string) {
  void runSync(shopId);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const customersRepo = {
  async list(shopId: string): Promise<Tables<'customers'>[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'select * from customers where shop_id = ? order by name asc',
      [shopId]
    );
    return rows.map((r) => fromSqlite<Tables<'customers'>>(r));
  },

  async get(id: string): Promise<Tables<'customers'> | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<Record<string, unknown>>('select * from customers where id = ?', [id]);
    return row ? fromSqlite<Tables<'customers'>>(row) : null;
  },

  async create(input: TablesInsert<'customers'>): Promise<Tables<'customers'>> {
    const db = await getDb();
    const row: Tables<'customers'> = {
      id: input.id ?? Crypto.randomUUID(),
      shop_id: input.shop_id,
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      book_number: input.book_number ?? null,
      created_at: input.created_at ?? nowIso(),
      updated_at: input.updated_at ?? nowIso(),
    };
    await db.runAsync(
      'insert into customers (id, shop_id, name, phone, address, book_number, created_at, updated_at) values (?,?,?,?,?,?,?,?)',
      [row.id, row.shop_id, row.name, row.phone, row.address, row.book_number, row.created_at, row.updated_at]
    );
    await enqueueOp('customers', row.id, 'insert', row);
    kickSync(row.shop_id);
    return row;
  },

  async update(id: string, shopId: string, patch: TablesUpdate<'customers'>): Promise<void> {
    const db = await getDb();
    const updated_at = nowIso();
    const existing = await this.get(id);
    if (!existing) throw new Error(`customer ${id} not found locally`);
    const merged = { ...existing, ...patch, updated_at };
    await db.runAsync(
      'update customers set name=?, phone=?, address=?, book_number=?, updated_at=? where id=?',
      [merged.name, merged.phone, merged.address, merged.book_number, updated_at, id]
    );
    await enqueueOp('customers', id, 'update', { id, ...patch, updated_at });
    kickSync(shopId);
  },

  /** Cascade-removes a customer's orders (with their bills/payments) and measurements, then the customer. */
  async remove(id: string, shopId: string): Promise<void> {
    const db = await getDb();
    const orders = await db.getAllAsync<{ id: string }>('select id from orders where customer_id = ?', [id]);
    for (const order of orders) {
      await ordersRepo.remove(order.id, shopId);
    }
    // Bills raised directly (no linked order) still belong to this customer.
    const bills = await db.getAllAsync<{ id: string }>('select id from bills where customer_id = ?', [id]);
    for (const bill of bills) {
      await billsRepo.remove(bill.id, shopId);
    }

    // Measurements aren't mirrored locally (screens read/write them via
    // Supabase directly), so their cleanup is a best-effort remote delete.
    try {
      await supabase.from('measurements').delete().eq('customer_id', id);
    } catch {
      // Non-fatal — an orphaned measurement row isn't worth blocking the delete over.
    }

    await db.runAsync('delete from customers where id = ?', [id]);
    await enqueueOp('customers', id, 'delete', { id });
    kickSync(shopId);
  },
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export const staffRepo = {
  async list(shopId: string, opts?: { activeOnly?: boolean }): Promise<Tables<'staff'>[]> {
    const db = await getDb();
    const sql = opts?.activeOnly
      ? 'select * from staff where shop_id = ? and is_active = 1 order by name asc'
      : 'select * from staff where shop_id = ? order by name asc';
    const rows = await db.getAllAsync<Record<string, unknown>>(sql, [shopId]);
    return rows.map((r) => fromSqlite<Tables<'staff'>>(r, [], ['is_active']));
  },

  async get(id: string): Promise<Tables<'staff'> | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<Record<string, unknown>>('select * from staff where id = ?', [id]);
    return row ? fromSqlite<Tables<'staff'>>(row, [], ['is_active']) : null;
  },

  async create(input: TablesInsert<'staff'>): Promise<Tables<'staff'>> {
    const db = await getDb();
    const row: Tables<'staff'> = {
      id: input.id ?? Crypto.randomUUID(),
      shop_id: input.shop_id,
      name: input.name,
      phone: input.phone ?? null,
      role: input.role ?? null,
      wage_type: input.wage_type ?? 'monthly',
      wage_amount: input.wage_amount ?? 0,
      wage_amount_pant: input.wage_amount_pant ?? null,
      wage_amount_shirt: input.wage_amount_shirt ?? null,
      wage_amount_pair: input.wage_amount_pair ?? null,
      is_active: input.is_active ?? true,
      created_at: input.created_at ?? nowIso(),
      updated_at: input.updated_at ?? nowIso(),
    };
    await db.runAsync(
      `insert into staff (id, shop_id, name, phone, role, wage_type, wage_amount, wage_amount_pant, wage_amount_shirt, wage_amount_pair, is_active, created_at, updated_at)
       values (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [row.id, row.shop_id, row.name, row.phone, row.role, row.wage_type, row.wage_amount, row.wage_amount_pant, row.wage_amount_shirt, row.wage_amount_pair, row.is_active ? 1 : 0, row.created_at, row.updated_at]
    );
    await enqueueOp('staff', row.id, 'insert', row);
    kickSync(row.shop_id);
    return row;
  },

  async update(id: string, shopId: string, patch: TablesUpdate<'staff'>): Promise<void> {
    const db = await getDb();
    const existing = await this.get(id);
    if (!existing) throw new Error(`staff ${id} not found locally`);
    const updated_at = nowIso();
    const merged = { ...existing, ...patch, updated_at };
    await db.runAsync(
      `update staff set name=?, phone=?, role=?, wage_type=?, wage_amount=?, wage_amount_pant=?, wage_amount_shirt=?, wage_amount_pair=?, is_active=?, updated_at=? where id=?`,
      [merged.name, merged.phone, merged.role, merged.wage_type, merged.wage_amount, merged.wage_amount_pant, merged.wage_amount_shirt, merged.wage_amount_pair, merged.is_active ? 1 : 0, updated_at, id]
    );
    await enqueueOp('staff', id, 'update', { id, ...patch, updated_at });
    kickSync(shopId);
  },

  /**
   * Unassigns this staff member from any orders (the orders themselves stay),
   * best-effort removes their work-entry/completion bookkeeping (not mirrored
   * locally — same "read straight from Supabase" pattern as measurements),
   * then removes the staff row itself.
   */
  async remove(id: string, shopId: string): Promise<void> {
    const db = await getDb();

    const assignedOrders = await db.getAllAsync<{ id: string }>(
      'select id from orders where assigned_staff_id = ?',
      [id]
    );
    for (const order of assignedOrders) {
      await ordersRepo.update(order.id, shopId, { assigned_staff_id: null });
    }

    try {
      await supabase.from('staff_work_entries').delete().eq('staff_id', id);
      await supabase.from('staff_orders').delete().eq('staff_id', id);
    } catch {
      // Non-fatal — orphaned bookkeeping rows aren't worth blocking the delete over.
    }

    await db.runAsync('delete from staff where id = ?', [id]);
    await enqueueOp('staff', id, 'delete', { id });
    kickSync(shopId);
  },
};

// ---------------------------------------------------------------------------
// Orders + line items
// ---------------------------------------------------------------------------

export type OrderItemInput = {
  garment_type: string;
  cloth_count: number;
  unit_price: number;
  notes?: string | null;
  measurement_id?: string | null;
};

export const ordersRepo = {
  async list(shopId: string): Promise<Tables<'orders'>[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'select * from orders where shop_id = ? order by delivery_date asc',
      [shopId]
    );
    return rows.map((r) => fromSqlite<Tables<'orders'>>(r, ['design_photo_urls'], ['is_rush']));
  },

  async get(id: string): Promise<Tables<'orders'> | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<Record<string, unknown>>('select * from orders where id = ?', [id]);
    return row ? fromSqlite<Tables<'orders'>>(row, ['design_photo_urls'], ['is_rush']) : null;
  },

  async listWithCustomer(shopId: string): Promise<(Tables<'orders'> & { customers: { name: string; phone: string | null } | null })[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `select o.*, c.name as customer_name, c.phone as customer_phone
       from orders o left join customers c on c.id = o.customer_id
       where o.shop_id = ? order by o.delivery_date asc`,
      [shopId]
    );
    return rows.map((r) => {
      const order = fromSqlite<Tables<'orders'>>(r, ['design_photo_urls'], ['is_rush']);
      const customers = r.customer_name ? { name: r.customer_name as string, phone: (r.customer_phone as string | null) ?? null } : null;
      return { ...order, customers };
    });
  },

  async itemsForOrder(orderId: string): Promise<Tables<'order_items'>[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'select * from order_items where order_id = ? order by created_at asc',
      [orderId]
    );
    return rows.map((r) => fromSqlite<Tables<'order_items'>>(r));
  },

  /** Counts open (not delivered) orders per staff member — used for backlog-based delivery date suggestions. */
  async openOrderCountByStaff(shopId: string): Promise<Record<string, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ assigned_staff_id: string; cnt: number }>(
      `select assigned_staff_id, count(*) as cnt from orders
       where shop_id = ? and status != 'delivered' and assigned_staff_id is not null
       group by assigned_staff_id`,
      [shopId]
    );
    const out: Record<string, number> = {};
    for (const r of rows) out[r.assigned_staff_id] = r.cnt;
    return out;
  },

  async create(
    shopId: string,
    order: Omit<TablesInsert<'orders'>, 'shop_id' | 'id' | 'order_number'> & { order_number: string },
    items: OrderItemInput[]
  ): Promise<Tables<'orders'>> {
    const db = await getDb();
    const id = Crypto.randomUUID();
    const created_at = nowIso();
    const row: Tables<'orders'> = {
      id,
      shop_id: shopId,
      order_number: order.order_number,
      customer_id: order.customer_id,
      cloth_type: order.cloth_type ?? null,
      cloth_count: order.cloth_count ?? null,
      design_photo_url: order.design_photo_url ?? null,
      design_photo_urls: order.design_photo_urls ?? [],
      measurement_id: order.measurement_id ?? null,
      order_date: order.order_date ?? created_at.slice(0, 10),
      delivery_date: order.delivery_date ?? null,
      trial_date: order.trial_date ?? null,
      status: order.status ?? 'order_taken',
      priority: order.priority ?? 'normal',
      is_rush: order.is_rush ?? false,
      rush_fee: order.rush_fee ?? null,
      assigned_staff_id: order.assigned_staff_id ?? null,
      bill_book_number: order.bill_book_number ?? null,
      total_amount: order.total_amount ?? null,
      paid_amount: order.paid_amount ?? 0,
      payment_mode: order.payment_mode ?? null,
      created_at,
      updated_at: created_at,
    };

    await runExclusive(() =>
      db.withTransactionAsync(async () => {
        await db.runAsync(
          `insert into orders (id, shop_id, order_number, customer_id, cloth_type, cloth_count, design_photo_url, design_photo_urls, measurement_id, order_date, delivery_date, trial_date, status, priority, is_rush, rush_fee, assigned_staff_id, bill_book_number, total_amount, paid_amount, payment_mode, created_at, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            row.id, row.shop_id, row.order_number, row.customer_id, row.cloth_type, row.cloth_count,
            row.design_photo_url, JSON.stringify(row.design_photo_urls), row.measurement_id, row.order_date,
            row.delivery_date, row.trial_date, row.status, row.priority, row.is_rush ? 1 : 0, row.rush_fee,
            row.assigned_staff_id, row.bill_book_number, row.total_amount, row.paid_amount, row.payment_mode,
            row.created_at, row.updated_at,
          ]
        );
        for (const item of items) {
          const itemId = Crypto.randomUUID();
          const itemRow = {
            id: itemId,
            shop_id: shopId,
            order_id: id,
            garment_type: item.garment_type,
            cloth_count: item.cloth_count,
            unit_price: item.unit_price,
            notes: item.notes ?? null,
            measurement_id: item.measurement_id ?? null,
            created_at,
          };
          await db.runAsync(
            'insert into order_items (id, shop_id, order_id, garment_type, cloth_count, unit_price, notes, measurement_id, created_at) values (?,?,?,?,?,?,?,?,?)',
            [itemRow.id, itemRow.shop_id, itemRow.order_id, itemRow.garment_type, itemRow.cloth_count, itemRow.unit_price, itemRow.notes, itemRow.measurement_id, itemRow.created_at]
          );
          await enqueueOp('order_items', itemId, 'insert', itemRow);
        }
      })
    );

    await enqueueOp('orders', row.id, 'insert', { ...row, design_photo_urls: row.design_photo_urls });
    kickSync(shopId);
    return row;
  },

  /** Deletes and re-inserts an order's line items — simplest way to keep edits consistent with create(). */
  async replaceItems(orderId: string, shopId: string, items: OrderItemInput[]): Promise<void> {
    const db = await getDb();
    const created_at = nowIso();
    const existing = await this.itemsForOrder(orderId);
    await runExclusive(() =>
      db.withTransactionAsync(async () => {
        await db.runAsync('delete from order_items where order_id = ?', [orderId]);
        for (const item of items) {
          const itemId = Crypto.randomUUID();
          const itemRow = {
            id: itemId,
            shop_id: shopId,
            order_id: orderId,
            garment_type: item.garment_type,
            cloth_count: item.cloth_count,
            unit_price: item.unit_price,
            notes: item.notes ?? null,
            measurement_id: item.measurement_id ?? null,
            created_at,
          };
          await db.runAsync(
            'insert into order_items (id, shop_id, order_id, garment_type, cloth_count, unit_price, notes, measurement_id, created_at) values (?,?,?,?,?,?,?,?,?)',
            [itemRow.id, itemRow.shop_id, itemRow.order_id, itemRow.garment_type, itemRow.cloth_count, itemRow.unit_price, itemRow.notes, itemRow.measurement_id, itemRow.created_at]
          );
          await enqueueOp('order_items', itemId, 'insert', itemRow);
        }
      })
    );
    // Old items are removed locally immediately; their removal is pushed as
    // best-effort deletes so a stale server-side row doesn't linger forever.
    for (const old of existing) {
      await enqueueOp('order_items', old.id, 'delete', { id: old.id });
    }
  },

  /** Removes an order, its line items, and any bill (with payments) raised against it, then queues the deletes for sync. */
  async remove(id: string, shopId: string): Promise<void> {
    const db = await getDb();
    const items = await this.itemsForOrder(id);
    const linkedBills = await db.getAllAsync<{ id: string }>('select id from bills where order_id = ?', [id]);

    for (const bill of linkedBills) {
      await billsRepo.remove(bill.id, shopId);
    }

    await runExclusive(() =>
      db.withTransactionAsync(async () => {
        await db.runAsync('delete from order_items where order_id = ?', [id]);
        await db.runAsync('delete from orders where id = ?', [id]);
      })
    );
    for (const item of items) {
      await enqueueOp('order_items', item.id, 'delete', { id: item.id });
    }
    await enqueueOp('orders', id, 'delete', { id });
    kickSync(shopId);
  },

  async update(id: string, shopId: string, patch: TablesUpdate<'orders'>): Promise<void> {
    const db = await getDb();
    const existing = await this.get(id);
    if (!existing) throw new Error(`order ${id} not found locally`);
    const updated_at = nowIso();
    const merged = { ...existing, ...patch, updated_at };
    await db.runAsync(
      `update orders set customer_id=?, cloth_type=?, cloth_count=?, design_photo_url=?, design_photo_urls=?, measurement_id=?, delivery_date=?, trial_date=?, status=?, priority=?, is_rush=?, rush_fee=?, assigned_staff_id=?, bill_book_number=?, total_amount=?, paid_amount=?, payment_mode=?, updated_at=? where id=?`,
      [
        merged.customer_id, merged.cloth_type, merged.cloth_count, merged.design_photo_url,
        JSON.stringify(merged.design_photo_urls), merged.measurement_id, merged.delivery_date, merged.trial_date,
        merged.status, merged.priority, merged.is_rush ? 1 : 0, merged.rush_fee, merged.assigned_staff_id,
        merged.bill_book_number, merged.total_amount, merged.paid_amount, merged.payment_mode, updated_at, id,
      ]
    );
    await enqueueOp('orders', id, 'update', { id, ...patch, updated_at });
    kickSync(shopId);
  },
};

// ---------------------------------------------------------------------------
// Bills + payments
// ---------------------------------------------------------------------------

export const billsRepo = {
  async list(shopId: string): Promise<Tables<'bills'>[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>('select * from bills where shop_id = ? order by created_at desc', [shopId]);
    return rows.map((r) => fromSqlite<Tables<'bills'>>(r));
  },

  async get(id: string): Promise<Tables<'bills'> | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<Record<string, unknown>>('select * from bills where id = ?', [id]);
    return row ? fromSqlite<Tables<'bills'>>(row) : null;
  },

  /** Outstanding balance per customer: sum(bill.total_amount) - sum(payments.amount_paid), floored at 0. */
  async pendingBalanceByCustomer(shopId: string): Promise<Record<string, number>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ customer_id: string; total: number; paid: number }>(
      `select b.customer_id as customer_id,
              coalesce(sum(b.total_amount), 0) as total,
              coalesce((select sum(p.amount_paid) from payments p where p.bill_id = b.id), 0) as paid
       from bills b where b.shop_id = ? group by b.customer_id`,
      [shopId]
    );
    const out: Record<string, number> = {};
    for (const r of rows) out[r.customer_id] = Math.max(r.total - r.paid, 0);
    return out;
  },

  async listWithRelations(
    shopId: string
  ): Promise<(Tables<'bills'> & { customers: { name: string; phone: string | null } | null; payments: Tables<'payments'>[] })[]> {
    const db = await getDb();
    const billRows = await db.getAllAsync<Record<string, unknown>>(
      `select b.*, c.name as customer_name, c.phone as customer_phone
       from bills b left join customers c on c.id = b.customer_id
       where b.shop_id = ? order by b.created_at desc`,
      [shopId]
    );
    const paymentRows = await db.getAllAsync<Record<string, unknown>>('select * from payments where shop_id = ?', [shopId]);
    const payments = paymentRows.map((r) => fromSqlite<Tables<'payments'>>(r));

    return billRows.map((r) => {
      const bill = fromSqlite<Tables<'bills'>>(r);
      const customers = r.customer_name ? { name: r.customer_name as string, phone: (r.customer_phone as string | null) ?? null } : null;
      return { ...bill, customers, payments: payments.filter((p) => p.bill_id === bill.id) };
    });
  },

  async listWithPayments(shopId: string): Promise<(Tables<'bills'> & { paid: number })[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown> & { paid: number }>(
      `select b.*, coalesce((select sum(p.amount_paid) from payments p where p.bill_id = b.id), 0) as paid
       from bills b where b.shop_id = ? order by b.created_at desc`,
      [shopId]
    );
    return rows.map((r) => ({ ...fromSqlite<Tables<'bills'>>(r), paid: r.paid }));
  },

  async create(input: Omit<TablesInsert<'bills'>, 'id'>): Promise<Tables<'bills'>> {
    const db = await getDb();
    const id = Crypto.randomUUID();
    const created_at = nowIso();
    const total = Math.max(
      (input.fabric_cost ?? 0) + (input.stitching_charge ?? 0) + (input.tax ?? 0) - (input.discount ?? 0),
      0
    );
    const row: Tables<'bills'> = {
      id,
      shop_id: input.shop_id,
      order_id: input.order_id ?? null,
      customer_id: input.customer_id,
      fabric_cost: input.fabric_cost ?? 0,
      stitching_charge: input.stitching_charge ?? 0,
      discount: input.discount ?? 0,
      tax: input.tax ?? 0,
      total_amount: total,
      payment_status: input.payment_status ?? 'unpaid',
      created_at,
      updated_at: created_at,
    };
    await db.runAsync(
      'insert into bills (id, shop_id, order_id, customer_id, fabric_cost, stitching_charge, discount, tax, total_amount, payment_status, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?)',
      [row.id, row.shop_id, row.order_id, row.customer_id, row.fabric_cost, row.stitching_charge, row.discount, row.tax, row.total_amount, row.payment_status, row.created_at, row.updated_at]
    );
    // total_amount is a generated column server-side — don't push it, Postgres computes it.
    const { total_amount: _drop, ...pushPayload } = row;
    await enqueueOp('bills', row.id, 'insert', pushPayload);
    kickSync(row.shop_id);
    return row;
  },

  /** Removes a bill and its payments locally, then queues the deletes for sync. */
  async remove(id: string, shopId: string): Promise<void> {
    const db = await getDb();
    const payments = await db.getAllAsync<{ id: string }>('select id from payments where bill_id = ?', [id]);
    await runExclusive(() =>
      db.withTransactionAsync(async () => {
        await db.runAsync('delete from payments where bill_id = ?', [id]);
        await db.runAsync('delete from bills where id = ?', [id]);
      })
    );
    for (const payment of payments) {
      await enqueueOp('payments', payment.id, 'delete', { id: payment.id });
    }
    await enqueueOp('bills', id, 'delete', { id });
    kickSync(shopId);
  },
};

export const paymentsRepo = {
  async create(input: Omit<TablesInsert<'payments'>, 'id'>): Promise<Tables<'payments'>> {
    const db = await getDb();
    const id = Crypto.randomUUID();
    const row: Tables<'payments'> = {
      id,
      shop_id: input.shop_id,
      bill_id: input.bill_id,
      customer_id: input.customer_id,
      amount_paid: input.amount_paid,
      payment_mode: input.payment_mode ?? null,
      payment_date: input.payment_date ?? nowIso(),
    };
    await db.runAsync(
      'insert into payments (id, shop_id, bill_id, customer_id, amount_paid, payment_mode, payment_date) values (?,?,?,?,?,?,?)',
      [row.id, row.shop_id, row.bill_id, row.customer_id, row.amount_paid, row.payment_mode, row.payment_date]
    );
    await enqueueOp('payments', row.id, 'insert', row);

    // The server recalculates bills.payment_status via a trigger, but that
    // only reaches this device after a full push+pull sync round-trip —
    // recalculating it locally too means the badge is correct immediately
    // instead of still reading "unpaid" right after recording a payment.
    const bill = await billsRepo.get(row.bill_id);
    if (bill) {
      const payments = await db.getAllAsync<{ amount_paid: number }>(
        'select amount_paid from payments where bill_id = ?',
        [row.bill_id]
      );
      const paidTotal = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
      const totalAmount = Number(bill.total_amount ?? 0);
      const status: Tables<'bills'>['payment_status'] =
        paidTotal <= 0 ? 'unpaid' : paidTotal >= totalAmount ? 'paid' : 'partial';
      if (status !== bill.payment_status) {
        await db.runAsync('update bills set payment_status = ? where id = ?', [status, row.bill_id]);
      }
    }

    kickSync(row.shop_id);
    return row;
  },

  async listForShop(shopId: string): Promise<Tables<'payments'>[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Record<string, unknown>>('select * from payments where shop_id = ? order by payment_date desc', [shopId]);
    return rows.map((r) => fromSqlite<Tables<'payments'>>(r));
  },
};
