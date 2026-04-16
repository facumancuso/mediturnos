const { MongoClient } = require('mongodb');

async function inspect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const admin = client.db().admin();
    
    // Listar todas las bases de datos
    const databases = await admin.listDatabases();
    console.log('\n📚 Bases de datos disponibles:\n');
    
    for (const db of databases.databases) {
      console.log(`  📁 ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      
      const dbInstance = client.db(db.name);
      const collections = await dbInstance.listCollections().toArray();
      
      for (const col of collections) {
        const count = await dbInstance.collection(col.name).countDocuments();
        console.log(`     └─ ${col.name} (${count} docs)`);
      }
    }
    
    // Detallar la BD mediturnos
    console.log('\n\n🔍 Contenido detallado de "mediturnos":\n');
    const mediturnos = client.db('mediturnos');
    
    const collections = await mediturnos.listCollections().toArray();
    for (const col of collections) {
      const count = await mediturnos.collection(col.name).countDocuments();
      console.log(`\n${col.name} (${count} documentos):`);
      
      const docs = await mediturnos.collection(col.name).find({}).limit(2).toArray();
      console.log(JSON.stringify(docs, null, 2));
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.close();
  }
}

inspect();
