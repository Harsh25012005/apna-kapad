import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ConfirmEmail: { email: string };
  ComponentShowcase: undefined;
};

/** Screens shared across several stacks (orders/bills reachable from many tabs). */
type SharedOrderRoutes = {
  OrderForm: { customerId?: string; orderId?: string } | undefined;
  OrderDetail: { orderId: string };
  BillForm: { orderId?: string; customerId?: string } | undefined;
  BillDetail: { billId: string };
};

export type CustomersStackParamList = SharedOrderRoutes & {
  CustomerList: undefined;
  CustomerDetail: { customerId: string; initialTab?: 'info' | 'orders' | 'bills' };
  CustomerForm: { customerId?: string } | undefined;
  MeasurementForm: { customerId: string; measurementId?: string };
};

export type OrdersStackParamList = SharedOrderRoutes & {
  OrderList: undefined;
};

export type BillingStackParamList = {
  BillingList: undefined;
  BillForm: { orderId?: string; customerId?: string } | undefined;
  BillDetail: { billId: string };
};

export type DashboardStackParamList = SharedOrderRoutes & {
  Dashboard: undefined;
  Notifications: undefined;
  Calendar: undefined;
  Transactions: undefined;
  Search: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  ShopEdit: undefined;
  Staff: undefined;
  StaffForm: { staffId?: string } | undefined;
  StaffDetail: { staffId: string };
  StaffWorkEntryForm: { staffId: string };
  Revenue: undefined;
  /** The whole Billing stack, nested here since Billing is no longer a tab. */
  Billing: undefined;
};

/**
 * Four tabs plus a centre "Add" action button (the Add button is not a tab —
 * it opens the QuickAddMenu instead of navigating).
 */
export type MainTabParamList = {
  DashboardTab: undefined;
  CustomersTab: undefined;
  OrdersTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  ShopSetup: undefined;
  Main: undefined;
  ResetPassword: undefined;
};

/**
 * Union of every in-app route. Screens that are registered in more than one
 * stack (OrderForm, OrderDetail, BillForm) type against this so they can be
 * reused without re-declaring props per stack.
 */
export type AppParamList = CustomersStackParamList &
  OrdersStackParamList &
  BillingStackParamList &
  DashboardStackParamList &
  SettingsStackParamList;

export type AppScreenProps<T extends keyof AppParamList> = NativeStackScreenProps<AppParamList, T>;

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
export type CustomersScreenProps<T extends keyof CustomersStackParamList> = NativeStackScreenProps<
  CustomersStackParamList,
  T
>;
export type OrdersScreenProps<T extends keyof OrdersStackParamList> = NativeStackScreenProps<
  OrdersStackParamList,
  T
>;
export type BillingScreenProps<T extends keyof BillingStackParamList> = NativeStackScreenProps<
  BillingStackParamList,
  T
>;
export type DashboardScreenProps<T extends keyof DashboardStackParamList> = NativeStackScreenProps<
  DashboardStackParamList,
  T
>;
export type SettingsScreenProps<T extends keyof SettingsStackParamList> = NativeStackScreenProps<
  SettingsStackParamList,
  T
>;
