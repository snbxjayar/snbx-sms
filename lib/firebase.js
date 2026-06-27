const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

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