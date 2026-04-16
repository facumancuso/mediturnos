const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'mediturnos';
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    
    const count = await db.collection('professionals').countDocuments();
    console.log(`\n✓ Conectado a ${dbName}`);
    console.log(`✓ Total de profesionales: ${count}\n`);
    
    if (count === 0) {
      console.log('⚠️  La colección está vacía. Insertando datos de prueba...\n');
      
      const sample = [
        {
          id: 'prof-001',
          userId: 'prof-001',
          name: 'Dr. Juan Pérez García',
          email: 'juan@mediturnos.com',
          specialty: 'Cardiología',
          licenseNumber: 'MP-123456',
          whatsappNumber: '+5491123456789',
          address: 'Av. Corrientes 1234, CABA',
          photoURL: 'https://picsum.photos/seed/prof-001/100/100',
          coverImageUrl: 'https://picsum.photos/seed/prof-001-cover/600/200',
          appointmentDuration: 30,
          publicProfile: {
            enabled: true,
            verified: true,
            slug: 'juan-perez-garcia',
            bio: 'Cardiólogo especializado en enfermedades coronarias con 15 años de experiencia.',
            insurances: ['OSDE', 'Swiss Medical', 'Galeno'],
            rating: 4.8,
            reviewCount: 24,
            mapUrl: 'https://maps.google.com/?q=Av.+Corrientes+1234'
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'prof-002',
          userId: 'prof-002',
          name: 'Dra. María López Sánchez',
          email: 'maria@mediturnos.com',
          specialty: 'Dermatología',
          licenseNumber: 'MP-654321',
          whatsappNumber: '+5491198765432',
          address: 'Calle Florida 567, CABA',
          photoURL: 'https://picsum.photos/seed/prof-002/100/100',
          coverImageUrl: 'https://picsum.photos/seed/prof-002-cover/600/200',
          appointmentDuration: 45,
          publicProfile: {
            enabled: true,
            verified: true,
            slug: 'maria-lopez-sanchez',
            bio: 'Dermatóloga con especialización en dermatología estética. Miembro de la Sociedad Argentina de Dermatología.',
            insurances: ['OSDE', 'Prev-Salud'],
            rating: 4.9,
            reviewCount: 31,
            mapUrl: 'https://maps.google.com/?q=Calle+Florida+567'
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'prof-003',
          userId: 'prof-003',
          name: 'Dr. Carlos Martínez Rodríguez',
          email: 'carlos@mediturnos.com',
          specialty: 'Traumatología',
          licenseNumber: 'MP-789012',
          whatsappNumber: '+5491155443322',
          address: 'Zona del Parque, La Plata',
          photoURL: 'https://picsum.photos/seed/prof-003/100/100',
          coverImageUrl: 'https://picsum.photos/seed/prof-003-cover/600/200',
          appointmentDuration: 30,
          publicProfile: {
            enabled: true,
            verified: false,
            slug: 'carlos-martinez-rodriguez',
            bio: 'Traumatólogo especializado en cirugía de rodilla y cadera.',
            insurances: ['Swiss Medical', 'Galeno'],
            rating: 4.6,
            reviewCount: 18,
            mapUrl: 'https://maps.google.com/?q=La+Plata'
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      await db.collection('professionals').insertMany(sample);
      console.log('✓ Insertados 3 profesionales de prueba\n');
      console.log(JSON.stringify(sample, null, 2));
    } else {
      const docs = await db.collection('professionals').find({}).limit(3).toArray();
      console.log('Primeros profesionales en la BD:');
      console.log(JSON.stringify(docs, null, 2));
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

check();
