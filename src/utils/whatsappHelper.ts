import { TenkoExamination } from '../types';

/**
 * Normalizes Indonesian phone numbers into international WhatsApp standard (e.g. 6281234567890).
 */
export function formatWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  // If starts with 08..., convert to 628...
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  } else if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Returns the public-accessible base URL of the TENKO application.
 * Automatically resolves development/iframe origins to the shared public domain.
 */
export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://ais-pre-f3dzdt6eyvj6xnvopihyse-490667840615.asia-southeast1.run.app';
  }

  const origin = window.location.origin;

  // If running inside AI Studio dev container, local emulator, or iframe, use the public Shared App URL
  if (
    origin.includes('aistudio.google.com') ||
    origin.includes('ais-dev-') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  ) {
    return 'https://ais-pre-f3dzdt6eyvj6xnvopihyse-490667840615.asia-southeast1.run.app';
  }

  return origin;
}

/**
 * Builds the canonical public Driver Pass URL (for viewing only the Digital Tenko Card on driver's phone).
 */
export function generateTenkoDriverPassUrl(exam: TenkoExamination): string {
  const baseUrl = getPublicBaseUrl();
  const searchId = exam.tenkoId || exam.tenkoDocumentId;
  return `${baseUrl}/?pass=${encodeURIComponent(searchId)}`;
}

/**
 * Builds the canonical Security Gate Scan URL (encoded in the Card QR Code for security officers to verify medical recap and clear gate).
 */
export function generateTenkoSecurityScanUrl(exam: TenkoExamination): string {
  const baseUrl = getPublicBaseUrl();
  const searchId = exam.tenkoId || exam.tenkoDocumentId;
  return `${baseUrl}/?scan=gate&verify=${encodeURIComponent(searchId)}`;
}

/**
 * Backward compatibility alias for Driver Pass URL.
 */
export function generateTenkoVerificationUrl(exam: TenkoExamination): string {
  return generateTenkoDriverPassUrl(exam);
}

/**
 * Builds a structured, official WhatsApp text message for the driver.
 */
export function buildTenkoWhatsAppMessage(exam: TenkoExamination): string {
  const driverPassUrl = generateTenkoDriverPassUrl(exam);

  let statusEmoji = '🟢';
  let statusText = 'FIT TO DRIVE (LAYAK MENGEMUDI)';
  if (exam.recommendation === 'FIT TO WORK WITH NOTE') {
    statusEmoji = '🟡';
    statusText = 'FIT DENGAN CATATAN (LAYAK BERSYARAT)';
  } else if (exam.recommendation === 'UNFIT TO WORK') {
    statusEmoji = '🔴';
    statusText = 'UNFIT (TIDAK LAYAK MENGEMUDI / DILARANG JALAN)';
  }

  const examTime = exam.finishTime
    ? new Date(exam.finishTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '';

  const notesText = exam.note && exam.note.trim() !== '-' && exam.note.trim() !== ''
    ? exam.note.trim()
    : 'Kondisi prima. Jaga fokus, patuhi batas kecepatan & istirahat teratur.';

  return `*PT PANCARAN DARAT TRANSPORT*
*KARTU HASIL TENKO DIGITAL (DIGITAL TENKO PASS)*
━━━━━━━━━━━━━━━━━━━━━━
👤 *Nama:* ${exam.driverNameSnapshot}
🆔 *ID Driver:* ${exam.driverId} (${exam.positionSnapshot})
🏢 *Group/Armada:* ${exam.driverGroupSnapshot || '-'}
📅 *Tanggal Periksa:* ${exam.examinationDate} ${examTime ? `pukul ${examTime} WIB` : ''}
📍 *Lokasi Pool:* ${exam.locationNameSnapshot || 'Pool Pancaran'}
🩺 *Pemeriksa:* ${exam.examinerName || 'Nakes Pemeriksa'}

${statusEmoji} *STATUS KELAYAKAN:*
*${statusText}*

📊 *Ringkasan Hasil Medis:*
• Tekanan Darah: *${exam.bloodPressureResult || `${exam.bloodPressureSystolic}/${exam.bloodPressureDiastolic} mmHg`}*
• Suhu Tubuh: *${exam.temperature}°C*
• Denyut Nadi: *${exam.heartRate} bpm*
• Alkohol Test: *${exam.alcoholTest}*
• Narkoba Test: *${exam.drugTest}*
• Jam Istirahat/Tidur: *${exam.offDutySleepDuration} Jam*

📝 *Catatan / Rekomendasi Nakes:*
_${notesText}_

🔒 *Tautan Kartu Tenko Digital Driver:*
👉 ${driverPassUrl}

━━━━━━━━━━━━━━━━━━━━━━
⚠️ *PENTING - ATURAN KESELAMATAN:*
_Tunjukkan QR Code / Barcode di dalam Kartu Tenko kepada Petugas Security saat keluar gerbang pool._
*NO TENKO, NO GET OUT!*`;
}

/**
 * Triggers opening WhatsApp Web / Mobile App with pre-filled message and target phone.
 */
export function openTenkoWhatsApp(exam: TenkoExamination, customPhone?: string): void {
  const targetPhone = customPhone || exam.driverPhoneSnapshot || '';
  const cleanedPhone = formatWhatsAppPhone(targetPhone);
  const message = buildTenkoWhatsAppMessage(exam);
  const encodedText = encodeURIComponent(message);

  let waUrl = '';
  if (cleanedPhone) {
    waUrl = `https://wa.me/${cleanedPhone}?text=${encodedText}`;
  } else {
    // If no phone number provided, open generic share link where user can choose recipient
    waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
