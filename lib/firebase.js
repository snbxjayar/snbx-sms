const admin = require("firebase-admin");
 
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
 
const db = admin.firestore();
 
async function getLocation(locationId) {
  const doc = await db.collection("locations").doc(locationId).get();
  return doc.exists ? doc.data() : null;
}
 
async function setLocation(locationId, data) {
  await db.collection("locations").doc(locationId).set(data, { merge: true });
}
 
async function getAllLocations() {
  const snapshot = await db.collection("locations").get();
  const locations = [];
  snapshot.forEach(doc => locations.push({ id: doc.id, ...doc.data() }));
  return locations;
}
 
module.exports = { db, getLocation, setLocation, getAllLocations };
