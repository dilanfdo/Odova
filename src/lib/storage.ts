// AsyncStorage equivalents of the web app's localStorage keys (ndl_fuel_code, ndl_fuel_currency).
// Same key names kept only for documentation clarity — the two apps do not share device storage.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CODE_KEY = 'ndl_fuel_code';
const CURRENCY_KEY = 'ndl_fuel_currency';
const THEME_MODE_KEY = 'odova_theme_mode';
const UNIT_SYSTEM_KEY = 'odova_unit_system';

export async function getStoredCode(): Promise<string | null> {
  return AsyncStorage.getItem(CODE_KEY);
}

export async function setStoredCode(code: string): Promise<void> {
  await AsyncStorage.setItem(CODE_KEY, code);
}

export async function clearStoredCode(): Promise<void> {
  await AsyncStorage.removeItem(CODE_KEY);
}

export async function getStoredCurrency(): Promise<string | null> {
  return AsyncStorage.getItem(CURRENCY_KEY);
}

export async function setStoredCurrency(code: string): Promise<void> {
  await AsyncStorage.setItem(CURRENCY_KEY, code);
}

export async function getStoredThemeMode(): Promise<string | null> {
  return AsyncStorage.getItem(THEME_MODE_KEY);
}

export async function setStoredThemeMode(mode: string): Promise<void> {
  await AsyncStorage.setItem(THEME_MODE_KEY, mode);
}

export async function getStoredUnitSystem(): Promise<string | null> {
  return AsyncStorage.getItem(UNIT_SYSTEM_KEY);
}

export async function setStoredUnitSystem(system: string): Promise<void> {
  await AsyncStorage.setItem(UNIT_SYSTEM_KEY, system);
}
