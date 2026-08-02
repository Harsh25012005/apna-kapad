import type { Tables, Enums } from '../lib/database.types';

export type Shop = Tables<'shops'>;
export type Customer = Tables<'customers'>;
export type Measurement = Tables<'measurements'>;
export type Order = Tables<'orders'>;
export type Bill = Tables<'bills'>;
export type Payment = Tables<'payments'>;
export type Staff = Tables<'staff'>;
export type StaffOrder = Tables<'staff_orders'>;

export type OrderStatus = Enums<'order_status'>;
export type OrderPriority = Enums<'order_priority'>;
export type PaymentStatus = Enums<'payment_status'>;
export type WageType = Enums<'wage_type'>;

/** A customer row augmented with their computed outstanding balance. */
export type CustomerWithBalance = Pick<Customer, 'id' | 'name' | 'phone'> & {
  balance: number;
};

/** Shapes returned by the nested `select()` queries used across screens. */
export type OrderWithRelations = Order & {
  customers: Pick<Customer, 'name' | 'phone'> | null;
  staff: Pick<Staff, 'name'> | null;
  measurements: Pick<Measurement, 'garment_type'> | null;
};

export type OrderListItem = Order & {
  customers: Pick<Customer, 'name' | 'phone'> | null;
};

export type BillWithRelations = Bill & {
  customers: Pick<Customer, 'name' | 'phone'> | null;
  payments: Payment[];
};
