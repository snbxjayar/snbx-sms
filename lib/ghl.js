const axios = require("axios");
const { getLocation, setLocation, getAllLocations } = require("./firebase");

async function findToken(locationId) {
  // First try exact match
  const loc = await getLocation(locationId);
  if (loc?.access_token) return loc;

  // Fallback: search all locations for a company-level token
  const all = await getAllLocations();
  const companyToken = all.find(l => l.access_token && l.tokenType === "company");
  if (companyToken) return companyToken;

  // Last resort: any token
  return all.find(l => l.access_token) || null;
}

async function refreshToken(locationId, tokenData) {
  const loc = tokenData || await findToken(locationId);
  if (!loc?.refresh_token) throw new Error("No refresh token for " + locationId);
  const r = await axios.post("https://services.leadconnectorhq.com/oauth/token",
    new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: loc.refresh_token,
      user_type: "Location",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const { access_token, refresh_token, expires_in } = r.data;
  const saveId = loc.locationId || loc.id || locationId;
  await setLocation(saveId, { access_token, refresh_token, expires_in });
  return access_token;
}

async function ghlApi(method, url, data, locationId) {
  const loc = await findToken(locationId);
  if (!loc) throw new Error("No token found for " + locationId);
  const headers = {
    Authorization: `Bearer ${loc.access_token}`,
    "Content-Type": "application/json",
    Version: "2021-04-15",
  };
  try { return await axios({ method, url, data, headers }); }
  catch (e) {
    if (e.response?.status === 401) {
      headers.Authorization = `Bearer ${await refreshToken(locationId, loc)}`;
      return await axios({ method, url, data, headers });
    }
    throw e;
  }
}

function formatPhone(phone) {
  let n = phone.replace(/[^0-9+]/g, "");
  if (n.startsWith("+63") && n.length === 13) return n;
  if (n.startsWith("63") && n.length === 12) return "+" + n;
  if (n.startsWith("0") && n.length === 11) return "+63" + n.slice(1);
  return n;
}

module.exports = { ghlApi, refreshToken, formatPhone, findToken };