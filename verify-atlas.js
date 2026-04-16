const { MongoClient } = require('mongodb');
const nextEnv = require('@next/env');

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function verifyAtlas() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'mediturnos';
  const isAtlas = uri.startsWith('mongodb+srv://');
  
  console.log(`\n🔗 Intentando conectar a: ${uri.replace(/:[^:]*@/, ':***@')}`);
  console.log(`🌐 Destino detectado: ${isAtlas ? 'MongoDB Atlas' : 'MongoDB local'}`);
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log(`✅ Conexión exitosa a ${isAtlas ? 'MongoDB Atlas' : 'MongoDB local'}!\n`);
    
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    
    console.log(`Base de datos: ${dbName}`);
    console.log(`Colecciones: ${collections.map(c => c.name).join(', ') || 'Ninguna (BD vacía)'}\n`);
    
  } catch (err) {
    console.error('❌ Error de conexión:', err.message);
  } finally {
    await client.close();
  }
}

verifyAtlas();
