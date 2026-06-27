const axios = require("axios");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const API_KEY = process.env.FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function parseDoc(doc) {
  const data = {};
  if (!doc.fields) return data;
  for (const [key, val] of Object.entries(doc.fields)) {
    if (val.stringValue !== undefined) data[key] = val.stringValue;
    else if (val.integerValue !== undefined) data[key] = Number(val.integerValue);
    else if (val.booleanValue !== undefined) data[key] = val.booleanValue;
    else if (val.nullValue !== undefined) data[key] = null;
    else data[key] = Object.values(val)[0];
  }
  return data;
}

function toFields(data) {
  const fields = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === null || val === undefined) fields[key] = { nullValue: null };
    else if (typeof val === "boolean") fields[key] = { booleanValue: val };
    else if (typeof val === "number") fields[key] = { integerValue: String(val) };
    else fields[key] = { stringValue: String(val) };
  }
  return fields;
}

async function getLocation(locationId) {
  try {
    const r = await axios.get(`${BASE}/locations/${locationId}?key=${API_KEY}`);
    return parseDoc(r.data);
  } catch (e) {
    if (e.response?.status === 404) return null;
    throw e;
  }
}

async function setLocation(locationId, data) {
  const existing = await getLocation(locationId) || {};
  const merged = { ...existing, ...data };
  await axios.patch(
    `${BASE}/locations/${locationId}?key=${API_KEY}`,
    { fields: toFields(merged) }
  );
}

async function getAllLocations() {
  try {
    const r = await axios.get(`${BASE}/locations?key=${API_KEY}`);
    if (!r.data.documents) return [];
    return r.data.documents.map(doc => {
      const id = doc.name.split("/").pop();
      return { id, ...parseDoc(doc) };
    });
  } catch (e) {
    return [];
  }
}

module.exports = { getLocation, setLocation, getAllLocations };