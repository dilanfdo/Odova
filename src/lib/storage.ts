// AsyncStorage equivalents of the web app's localStorage keys (ndl_fuel_code, ndl_fuel_currency).
// Same key names kept only for documentation clarity — the two apps do not share device storage.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CODE_KEY = 'ndl_fuel_code';
const CURRENCY_KEY = 'ndl_fuel_currency';

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
