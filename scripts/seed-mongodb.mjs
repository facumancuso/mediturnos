import { MongoClient } from 'mongodb';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'mediturnos';

// Acepta un UID real como argumento: node scripts/seed-mongodb.mjs TU_UID_REAL
const argUid = process.argv[2];
const professionalId = argUid || 'prof-demo-001';
const patientId = 'pac-demo-001';

console.log(`Usando professionalId: ${professionalId}`);
if (!argUid) {
  console.log('Tip: podés pasar tu UID de Firebase como argumento:');
  console.log('  npm run seed:mongodb -- TU_FIREBASE_UID');
}

async function dropCollections(db) {
  for (const col of ['professionals', 'patients', 'appointments']) {
    try {
      await db.collection(col).drop();
      console.log(`Colección "${col}" eliminada.`);
    } catch {
      // No existe aún, ignorar
    }
  }
}

async function runSeed() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const now = new Date();

    console.log('Reseteando colecciones...');
    await dropCollections(db);

    // --- Profesional ---
    await db.collection('professionals').insertOne({
      id: professionalId,
      userId: professionalId,
      name: 'Dra. Ana Martínez',
      specialty: 'Odontología',
      email: 'ana.martinez@demo.com',
      phone: '+54 11 5555-1000',
      whatsappNumber: '+5491155551000',
      address: 'Av. Corrientes 1234, CABA',
      licenseNumber: 'MN-12345',
      appointmentDuration: 30,
      avatarUrl: 'https://picsum.photos/seed/prof-demo-001/100/100',
      publicProfile: {
        enabled: true,
        slug: 'dra-ana-martinez',
        bio: 'Profesional de ejemplo para pruebas locales.',
        insurances: ['OSDE', 'Swiss Medical'],
        rating: 4.8,
        reviewCount: 12,
        verified: true,
        mapUrl: '',
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // --- Pacientes ---
    const patients = [
      {
        id: patientId,
        professionalId,
        dni: '30111222',
        name: 'Juan Pérez',
        email: 'juan.perez@demo.com',
        phone: '+54 11 5555-2000',
        insurance: 'OSDE',
        lastVisit: now.toISOString(),
        totalVisits: 5,
        missedAppointments: 1,
        avatarUrl: 'https://picsum.photos/seed/pac-demo-001/100/100',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pac-demo-002',
        professionalId,
        dni: '28999333',
        name: 'María García',
        email: 'maria.garcia@demo.com',
        phone: '+54 11 5555-3000',
        insurance: 'Swiss Medical',
        lastVisit: now.toISOString(),
        totalVisits: 3,
        missedAppointments: 0,
        avatarUrl: 'https://picsum.photos/seed/pac-demo-002/100/100',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'pac-demo-003',
        professionalId,
        dni: '25444555',
        name: 'Carlos Rodríguez',
        email: 'carlos.rodriguez@demo.com',
        phone: '+54 11 5555-4000',
        insurance: 'Particular',
        lastVisit: now.toISOString(),
        totalVisits: 1,
        missedAppointments: 0,
        avatarUrl: 'https://picsum.photos/seed/pac-demo-003/100/100',
        createdAt: now,
        updatedAt: now,
      },
    ];
    await db.collection('patients').insertMany(patients);

    // --- Turnos (hoy + próximos días) ---
    const makeDate = (offsetDays, hour, minute = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(hour, minute, 0, 0);
      return d;
    };

    const appointments = [
      { id: 'appt-001', professionalId, patientId: 'pac-demo-001', patientName: 'Juan Pérez',    patientAvatarUrl: 'https://picsum.photos/seed/pac-demo-001/100/100', date: makeDate(0, 9),  time: '09:00', duration: 30, type: 'Consulta',  status: 'confirmed' },
      { id: 'appt-002', professionalId, patientId: 'pac-demo-002', patientName: 'María García',  patientAvatarUrl: 'https://picsum.photos/seed/pac-demo-002/100/100', date: makeDate(0, 10), time: '10:00', duration: 30, type: 'Control',   status: 'confirmed' },
      { id: 'appt-003', professionalId, patientId: 'pac-demo-003', patientName: 'Carlos Rodríguez', patientAvatarUrl: 'https://picsum.photos/seed/pac-demo-003/100/100', date: makeDate(0, 11), time: '11:00', duration: 30, type: 'Consulta',  status: 'pending' },
      { id: 'appt-004', professionalId, patientId: 'pac-demo-001', patientName: 'Juan Pérez',    patientAvatarUrl: 'https://picsum.photos/seed/pac-demo-001/100/100', date: makeDate(1, 9),  time: '09:00', duration: 30, type: 'Control',   status: 'confirmed' },
      { id: 'appt-005', professionalId, patientId: 'pac-demo-002', patientName: 'María García',  patientAvatarUrl: 'https://picsum.photos/seed/pac-demo-002/100/100', date: makeDate(1, 15), time: '15:00', duration: 30, type: 'Consulta',  status: 'confirmed' },
      { id: 'appt-006', professionalId, patientId: 'pac-demo-003', patientName: 'Carlos Rodríguez', patientAvatarUrl: 'https://picsum.photos/seed/pac-demo-003/100/100', date: makeDate(2, 10), time: '10:00', duration: 30, type: 'Consulta',  status: 'confirmed' },
    ].map(a => ({ ...a, createdAt: now, updatedAt: now }));

    await db.collection('appointments').insertMany(appointments);

    console.log(`\nSeed completo en MongoDB: "${dbName}"`);
    console.log(`  professionals : 1`);
    console.log(`  patients      : ${patients.length}`);
    console.log(`  appointments  : ${appointments.length}`);
    console.log(`\nprofessionalId usado: ${professionalId}`);
  } finally {
    await client.close();
  }
}

runSeed().catch((error) => {
  console.error('Error ejecutando seed MongoDB:', error);
  process.exit(1);
});

