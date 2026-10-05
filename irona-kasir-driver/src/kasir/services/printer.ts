import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import {
  connectToPrinter,
  connectedAddress,
  ensureBluetoothPermission,
  findPrinters,
  isBluetoothEnabled,
  isConnected,
  printBytes,
} from '@ricka7x/expo-thermal-printer';
import type { SavedPrinter } from '@/kasir/types/printer';

/**
 * Semua urusan printer Bluetooth ada di sini, supaya layar tidak perlu tahu library printernya.
 * Kalau nanti library diganti, cukup file ini yang diubah.
 *
 * Modul native printer tidak ada di Expo Go. Library ini baru memuatnya saat fungsinya
 * dipanggil, jadi import di atas aman; kita cukup cek isPrinterSupported() sebelum memakai.
 */

const STORAGE_KEY = 'irona.kasir.printer';

/** false di Expo Go; true di aplikasi Irona Kasir (development build) */
export function isPrinterSupported(): boolean {
  return requireOptionalNativeModule('ThermalPrinter') !== null;
}

async function prepareBluetooth(): Promise<void> {
  if (!isPrinterSupported()) {
    throw new Error(
      'Printer hanya bisa dipakai di aplikasi Irona Kasir (development build), tidak di Expo Go.'
    );
  }
  if (!(await ensureBluetoothPermission())) {
    throw new Error('Izin Bluetooth ditolak. Izinkan di Pengaturan tablet → Aplikasi → Irona Kasir.');
  }
  if (!isBluetoothEnabled()) throw new Error('Bluetooth tablet masih mati. Nyalakan dulu.');
}

export async function getSavedPrinter(): Promise<SavedPrinter | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as SavedPrinter) : null;
}

export async function savePrinter(printer: SavedPrinter | null): Promise<void> {
  if (printer) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(printer));
  else await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Printer yang sudah di-pairing di Pengaturan Bluetooth tablet */
export async function findPairedPrinters(): Promise<SavedPrinter[]> {
  await prepareBluetooth();
  const devices = await findPrinters();
  return devices.map((d) => ({ name: d.name || 'Tanpa nama', address: d.address }));
}

/** Kirim data ESC/POS ke printer tersimpan (disambungkan dulu kalau belum tersambung) */
export async function sendToPrinter(bytes: Uint8Array): Promise<void> {
  const saved = await getSavedPrinter();
  if (!saved) throw new Error('Printer belum dipilih. Buka menu Printer di sidebar.');
  await prepareBluetooth();

  if (!isConnected() || connectedAddress() !== saved.address) {
    try {
      await connectToPrinter(saved.address);
    } catch {
      throw new Error(`Tidak bisa tersambung ke ${saved.name}. Pastikan printer menyala & dekat.`);
    }
  }
  await printBytes(bytes);
}