const { MongoClient } = require('mongodb');

async function cleanDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'mediturnos';
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    
    console.log(`\n🧹 Limpiando base de datos "${dbName}"...\n`);
    
    const collections = await db.listCollections().toArray();
    
    for (const col of collections) {
      await db.collection(col.name).deleteMany({});
      console.log(`✓ Colección "${col.name}" vaciada`);
    }
    
    console.log('\n✅ Base de datos limpiada correctamente\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

cleanDatabase();
