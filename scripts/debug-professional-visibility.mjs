import fs from 'fs';
import { MongoClient } from 'mongodb';

const env = fs.readFileSync('.env.local', 'utf8');
const uri = (env.match(/MONGODB_URI=(.*)/) || [])[1]?.trim();
const dbName = (env.match(/MONGODB_DB_NAME=(.*)/) || [])[1]?.trim();
const adminEmail = (env.match(/NEXT_PUBLIC_SUPER_ADMIN_EMAIL=(.*)/) || [])[1]?.trim().toLowerCase();

if (!uri || !dbName) {
  console.error('Faltan MONGODB_URI o MONGODB_DB_NAME');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const all = await db.collection('professionals').find({}, {
  projection: {
    id: 1,
    userId: 1,
    name: 1,
    email: 1,
    role: 1,
    isSuperAdmin: 1,
    publicProfile: 1,
    isActive: 1,
    updatedAt: 1,
  }
}).toArray();

const facundoZabala = await db.collection('professionals').findOne({
  $or: [
    { name: { $regex: '^facundo zabala$', $options: 'i' } },
    { email: { $regex: '^facumancusom@gmail.com$', $options: 'i' } },
  ],
});

const directoryFilter = {
  $and: [
    { $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: { $ne: true } }] },
    { $or: [{ 'publicProfile.enabled': true }, { 'publicProfile.enabled': { $exists: false } }] },
  ],
};

const clientsFilter = {
  $or: [{ isSuperAdmin: { $exists: false } }, { isSuperAdmin: { $ne: true } }],
};

const inDirectory = facundoZabala ? await db.collection('professionals').countDocuments({
  _id: facundoZabala._id,
  ...directoryFilter,
}) : 0;

const inClients = facundoZabala ? await db.collection('professionals').countDocuments({
  _id: facundoZabala._id,
  ...clientsFilter,
}) : 0;

console.log(JSON.stringify({
  adminEmail,
  totalProfessionals: all.length,
  professionals: all,
  facundoZabala,
  facundoVisible: {
    directory: inDirectory > 0,
    clients: inClients > 0,
  },
}, null, 2));

await client.close();
