import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import enCommon from '../locales/en/common.json';
import enOrders from '../locales/en/orders.json';
import enCustomers from '../locales/en/customers.json';
import enStaff from '../locales/en/staff.json';
import enBilling from '../locales/en/billing.json';
import enDashboard from '../locales/en/dashboard.json';
import enSettings from '../locales/en/settings.json';
import enAuth from '../locales/en/auth.json';
import enRevenue from '../locales/en/revenue.json';

import guCommon from '../locales/gu/common.json';
import guOrders from '../locales/gu/orders.json';
import guCustomers from '../locales/gu/customers.json';
import guStaff from '../locales/gu/staff.json';
import guBilling from '../locales/gu/billing.json';
import guDashboard from '../locales/gu/dashboard.json';
import guSettings from '../locales/gu/settings.json';
import guAuth from '../locales/gu/auth.json';
import guRevenue from '../locales/gu/revenue.json';

import hiCommon from '../locales/hi/common.json';
import hiOrders from '../locales/hi/orders.json';
import hiCustomers from '../locales/hi/customers.json';
import hiStaff from '../locales/hi/staff.json';
import hiBilling from '../locales/hi/billing.json';
import hiDashboard from '../locales/hi/dashboard.json';
import hiSettings from '../locales/hi/settings.json';
import hiAuth from '../locales/hi/auth.json';
import hiRevenue from '../locales/hi/revenue.json';

export const SUPPORTED_LANGUAGES = ['en', 'gu', 'hi'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'apna-kapad:language';

const resources = {
  en: {
    common: enCommon,
    orders: enOrders,
    customers: enCustomers,
    staff: enStaff,
    billing: enBilling,
    dashboard: enDashboard,
    settings: enSettings,
    auth: enAuth,
    revenue: enRevenue,
  },
  gu: {
    common: guCommon,
    orders: guOrders,
    customers: guCustomers,
    staff: guStaff,
    billing: guBilling,
    dashboard: guDashboard,
    settings: guSettings,
    auth: guAuth,
    revenue: guRevenue,
  },
  hi: {
    common: hiCommon,
    orders: hiOrders,
    customers: hiCustomers,
    staff: hiStaff,
    billing: hiBilling,
    dashboard: hiDashboard,
    settings: hiSettings,
    auth: hiAuth,
    revenue: hiRevenue,
  },
};

function detectDeviceLanguage(): AppLanguage {
  const tag = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(tag) ? (tag as AppLanguage) : 'en';
}

/** Loads a persisted language choice, falling back to the device locale on first run. */
export async function initI18n(): Promise<void> {
  let language: AppLanguage;
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    language = stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)
      ? (stored as AppLanguage)
      : detectDeviceLanguage();
  } catch {
    language = detectDeviceLanguage();
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    ns: ['common', 'orders', 'customers', 'staff', 'billing', 'dashboard', 'settings', 'auth', 'revenue'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Non-fatal — the choice just won't persist across restarts.
  }
}

export default i18n;
