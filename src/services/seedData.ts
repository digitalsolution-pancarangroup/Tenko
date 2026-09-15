import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Driver, DriverGroup, LocationMaster, Nakes, TenkoExamination, User, HealthIndication, VitaminItem, DriverHealthRecord } from '../types';
import { ALL_166_DRIVER_GROUPS } from '../data/driverGroupsData';
import { generateDriverDocId, generateLocationDocId, generateVitaminDocId, sanitizeCode } from '../utils/idGenerators';

export const INITIAL_HEALTH_INDICATIONS: HealthIndication[] = [
  { indicationId: 'IND-01', name: 'Hipertensi', note: 'Tekanan darah cenderung tinggi', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-02', name: 'Rest Hours', note: 'Istirahat <3 jam', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-03', name: 'Hiperglikemia', note: 'Kadar gula darah >200', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-04', name: 'Hiperurisemia', note: 'Kadar asam urat darah >7', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-05', name: 'Hipertermia', note: 'Suhu tubuh >37,5', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-06', name: 'Nyeri Kronis', note: 'Nyeri mendadak berlangsung <3 bulan', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-07', name: 'Nyeri Akut', note: 'Nyeri yang berlangsung lama akibat cedera >3 bulan', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-08', name: 'Hiperlipidemia', note: 'Kadar kolesterol darah >200', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-09', name: 'Hipotensi', note: 'Tekanan darah cenderung rendah', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-10', name: 'Selesma', note: 'Common cold flu batuk', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { indicationId: 'IND-11', name: 'Resiko Hipoksemia', note: 'Saturasi 90-95%', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
];

export const INITIAL_VITAMINS: VitaminItem[] = [
  { vitaminId: 'VTM-01', name: 'Vitamin C 500mg', category: 'Daya Tahan Tubuh', dosageUnit: 'Tablet', description: 'Meningkatkan imunitas & pemulihan stamina', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-02', name: 'Vitamin B Kompleks (B1, B6, B12)', category: 'Saraf & Stamina', dosageUnit: 'Tablet', description: 'Mencegah kram, pegal otot & kelelahan sistem saraf', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-03', name: 'Multivitamin & Mineral Harian', category: 'Stamina Umum', dosageUnit: 'Kapsul', description: 'Suplemen vitalitas harian untuk kerja jarak jauh', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-04', name: 'Vitamin D3 1000 IU', category: 'Daya Tahan Tubuh', dosageUnit: 'Tablet', description: 'Menjaga imunitas & kesehatan muskuloskeletal', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-05', name: 'Tablet Tambah Darah / Zat Besi', category: 'Pencegah Anemia', dosageUnit: 'Tablet', description: 'Mencegah pusing, lemas & rasa kantuk saat berkendara', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-06', name: 'Paracetamol 500mg', category: 'Analgesik Ringan', dosageUnit: 'Kaplet', description: 'Pereda demam, sakit kepala & pegal ringan', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-07', name: 'Antasida Doen', category: 'Lambung & Pencernaan', dosageUnit: 'Tablet Kunyah', description: 'Meredakan mual, kembung & perih lambung', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { vitaminId: 'VTM-08', name: 'Minyak Ikan / Omega 3', category: 'Kardiovaskular', dosageUnit: 'Kapsul Lunak', description: 'Menjaga kesehatan sirkulasi darah & jantung', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
];

export const INITIAL_DRIVER_HEALTH_RECORDS: DriverHealthRecord[] = [
  {
    recordId: 'DH-202609-0001',
    tenkoId: 'TENKO-20260904-0001',
    examinationDate: '2026-09-04',
    driverId: '319260066',
    driverName: 'SOPIYAN',
    driverGroup: 'ADPTR - Pancaran Energi Transport',
    position: 'KENEK',
    tenkoResult: 'FIT TO WORK WITH NOTE',
    indication: 'Rest Hours',
    analyze: 'Driver tidur kurang dari 4 jam karena antrean muatan malam, mata sedikit merah namun refleks baik.',
    measurement: 'Edukasi istirahat 30 menit sebelum keberangkatan, hidrasi air putih minimal 1.5L, tidak memaksakan bila kantuk.',
    vitamin: 'Vitamin B Kompleks (1 Tablet), Vitamin C 500mg (1 Tablet)',
    evaluation: '',
    status: 'ACTIVE',
    createdAt: '2026-09-04T08:14:00.000Z',
    createdBy: 'USR-NAKES-01',
    examinerName: 'Ns. Ratna Sari, S.Kep',
  },
  {
    recordId: 'DH-202609-0002',
    tenkoId: 'TENKO-20260903-0004',
    examinationDate: '2026-09-03',
    driverId: 'DRV-00125',
    driverName: 'Bambang Supriyanto',
    driverGroup: 'Armada A - Wingbox',
    position: 'DRIVER',
    tenkoResult: 'FIT TO WORK',
    indication: 'Selesma',
    analyze: 'Gejala flu ringan, bersin dan tenggorokan agak gatal, suhu normal 36.6 C.',
    measurement: 'Hindari minuman dingin, gunakan masker saat bekerja.',
    vitamin: 'Vitamin C 500mg (1 Tablet)',
    evaluation: 'Kondisi membaik pada pemeriksaan 4 September, flu sudah reda.',
    status: 'SOLVED',
    solvedAt: '2026-09-04T07:30:00.000Z',
    solvedBy: 'Ns. Ratna Sari, S.Kep',
    solvedTenkoId: 'TENKO-20260904-0002',
    createdAt: '2026-09-03T07:20:00.000Z',
    createdBy: 'USR-NAKES-01',
    examinerName: 'Ns. Ratna Sari, S.Kep',
  },
];

export const INITIAL_DRIVER_GROUPS: DriverGroup[] = ALL_166_DRIVER_GROUPS.map((g) => ({
  ...g,
  groupDocumentId: g.groupId.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
  driverGroupId: g.groupId,
  driverGroupName: g.groupName,
  createdAt: new Date().toISOString(),
  createdBy: 'SYSTEM SEED',
}));

export const INITIAL_LOCATIONS: LocationMaster[] = [
  { locationId: 'LOC-01', locationName: 'Pool Marunda - Jakarta Utara', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { locationId: 'LOC-02', locationName: 'Pool Cikarang Central - Bekasi', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { locationId: 'LOC-03', locationName: 'Pool Tanjung Perak - Surabaya', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { locationId: 'LOC-04', locationName: 'Pool Tanjung Emas - Semarang', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { locationId: 'LOC-05', locationName: 'Pool Belawan - Medan', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
  { locationId: 'LOC-06', locationName: 'Pool Tanah Merdeka - Cilincing', status: 'ACTIVE', createdAt: new Date().toISOString(), createdBy: 'SYSTEM' },
];

export const INITIAL_DRIVERS: Driver[] = [
  {
    driverDocumentId: 'DRV_00125',
    driverNumber: '1',
    driverId: 'DRV-00125',
    fullName: 'Bambang Supriyanto',
    driverGroupId: 'Armada A - Wingbox',
    joinDate: '2023-01-15',
    position: 'DRIVER',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    createdBy: 'Admin Operasional',
  },
  {
    driverDocumentId: 'DRV_00126',
    driverNumber: '2',
    driverId: 'DRV-00126',
    fullName: 'Agus Setiawan',
    driverGroupId: 'Armada B - Trailer Container',
    joinDate: '2023-03-20',
    position: 'DRIVER',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 50).toISOString(),
    createdBy: 'Admin Operasional',
  },
  {
    driverDocumentId: 'DRV_KNK_00042',
    driverNumber: '3',
    driverId: 'KNK-00042',
    fullName: 'Dedi Kurniawan',
    driverGroupId: 'Armada A - Wingbox',
    joinDate: '2023-05-10',
    position: 'KENEK',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 40).toISOString(),
    createdBy: 'Admin Operasional',
  },
  {
    driverDocumentId: 'DRV_00127',
    driverNumber: '4',
    driverId: 'DRV-00127',
    fullName: 'Hendra Wijaya',
    driverGroupId: 'Armada C - Cold Chain / Reefer',
    joinDate: '2022-11-01',
    position: 'DRIVER',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    createdBy: 'Admin Operasional',
  },
  {
    driverDocumentId: 'DRV_KNK_00043',
    driverNumber: '5',
    driverId: 'KNK-00043',
    fullName: 'Rizky Pratama',
    driverGroupId: 'Armada C - Cold Chain / Reefer',
    joinDate: '2024-02-14',
    position: 'KENEK',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    createdBy: 'Admin Operasional',
  },
  {
    driverDocumentId: 'DRV_00128',
    driverNumber: '6',
    driverId: 'DRV-00128',
    fullName: 'Joko Susilo',
    driverGroupId: 'Armada D - CDE / CDD Box',
    joinDate: '2023-08-01',
    position: 'DRIVER',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    createdBy: 'Admin Operasional',
  },
  {
    driverDocumentId: 'DRV_00129',
    driverNumber: '7',
    driverId: 'DRV-00129',
    fullName: 'Suryadi Pratama',
    driverGroupId: 'Vendor & Sub-Contractor',
    joinDate: '2024-01-10',
    position: 'DRIVER',
    status: 'ACTIVE',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    createdBy: 'Admin Operasional',
  }
];

export const INITIAL_NAKES: Nakes[] = [
  {
    nakesId: 'NKS-001',
    userId: 'usr_nakes_01',
    fullName: 'Ns. Ratna Sari, S.Kep',
    email: 'ratna.nakes@pancaran-logistic.id',
    sipNumber: 'SIP.503/446/NAKES/2023',
    phoneNumber: '081289123456',
    locationId: 'Pool Marunda - Jakarta Utara',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: 'Super Admin',
  },
  {
    nakesId: 'NKS-002',
    userId: 'usr_nakes_02',
    fullName: 'dr. Siti Rahmawati',
    email: 'siti.rahma@pancaran-logistic.id',
    sipNumber: 'SIP.503/112/IDI/2022',
    phoneNumber: '081398765432',
    locationId: 'Pool Cikarang Central - Bekasi',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    createdBy: 'Super Admin',
  }
];

export async function seedDatabaseIfEmpty() {
  try {
    // Check if new tenko db already seeded in this session
    if (localStorage.getItem('tenko_seeded_done_tenko_db_v1')) {
      return;
    }

    const groupSnap = await getDocs(collection(db, 'driverGroups'));
    if (groupSnap.empty) {
      console.log('Seeding initial TENKO master data to database tenko...');
      const batch = writeBatch(db);

      // Seed driver groups
      INITIAL_DRIVER_GROUPS.forEach(g => {
        const ref = doc(db, 'driverGroups', g.driverGroupId || g.groupId);
        batch.set(ref, g);
      });

      // Seed locations
      INITIAL_LOCATIONS.forEach(l => {
        const locDocId = generateLocationDocId(l.locationId);
        const ref = doc(db, 'locations', locDocId);
        batch.set(ref, { ...l, locationDocumentId: locDocId });
      });

      // Seed drivers with structured DRV_ ID
      INITIAL_DRIVERS.forEach(d => {
        const drvDocId = generateDriverDocId(d.driverId);
        const ref = doc(db, 'drivers', drvDocId);
        batch.set(ref, { ...d, driverDocumentId: drvDocId });
      });

      // Seed Nakes
      INITIAL_NAKES.forEach(n => {
        const ref = doc(db, 'nakes', n.nakesId);
        batch.set(ref, n);
      });

      // Seed Health Indications
      INITIAL_HEALTH_INDICATIONS.forEach(ind => {
        const indDocId = sanitizeCode(ind.indicationId, 'IND');
        const ref = doc(db, 'healthIndications', indDocId);
        batch.set(ref, { ...ind, indicationDocumentId: indDocId });
      });

      // Seed Vitamins
      INITIAL_VITAMINS.forEach(vit => {
        const vitDocId = generateVitaminDocId(vit.vitaminId);
        const ref = doc(db, 'vitamins', vitDocId);
        batch.set(ref, { ...vit, vitaminDocumentId: vitDocId });
      });

      await batch.commit();
      console.log('TENKO Database seeded successfully with structured custom IDs.');
    }
    localStorage.setItem('tenko_seeded_done_tenko_db_v1', 'true');
  } catch (err: any) {
    // If quota exceeded or offline, skip silently and remember state
    if (err?.message?.includes('Quota limit exceeded') || err?.message?.includes('quota')) {
      localStorage.setItem('tenko_seeded_done_tenko_db_v1', 'true');
    }
    console.warn('Seed data skipped or quota reached:', err?.message || err);
  }
}

export async function syncAll166DriverGroups(): Promise<number> {
  try {
    const existingSnap = await getDocs(collection(db, 'driverGroups'));
    const existingIds = new Set<string>();
    const existingNames = new Set<string>();
    existingSnap.docs.forEach(d => {
      const data = d.data();
      existingIds.add(d.id.toLowerCase());
      if (data.groupId) existingIds.add(String(data.groupId).toLowerCase());
      if (data.groupName) existingNames.add(String(data.groupName).toLowerCase());
      if (data.driverGroupName) existingNames.add(String(data.driverGroupName).toLowerCase());
    });

    const batch = writeBatch(db);
    let count = 0;

    for (const group of INITIAL_DRIVER_GROUPS) {
      const docId = (group.groupId || 'grp').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const grpName = (group.groupName || '').toLowerCase();
      // Set or update doc
      const ref = doc(db, 'driverGroups', docId);
      batch.set(ref, {
        groupDocumentId: docId,
        groupId: group.groupId,
        groupName: group.groupName,
        driverGroupId: group.groupId,
        driverGroupName: group.groupName,
        description: group.description || '',
        status: group.status || 'ACTIVE',
        createdAt: group.createdAt || new Date().toISOString(),
        createdBy: 'ADMIN SEED 166',
      }, { merge: true });
      count++;
    }

    if (count > 0) {
      await batch.commit();
      console.log(`Successfully synced ${count} driver groups to Firestore.`);
    }
    return count;
  } catch (err) {
    console.error('Failed to sync 166 driver groups:', err);
    return 0;
  }
}

export const seedInitialMasterData = seedDatabaseIfEmpty;

