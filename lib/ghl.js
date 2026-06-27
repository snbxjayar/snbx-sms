const axios = require("axios");
const { getLocation, setLocation, getAllLocations } = require("./firebase");

async function findToken(locationId) {
  const loc = await getLocation(locationId);
  if (loc?.access_token) return { ...loc, _docId: locationId };

  const all = await getAllLocations();
  const companyToken = all.find(l => l.access_token && l.tokenType === "company");
  if (companyToken) return { ...companyToken, _docId: companyToken.id };

  const anyToken = all.find(l => l.access_token);
  if (anyToken) return { ...anyToken, _docId: anyToken.id };

  return null;
}

async function refreshToken(locationId, tokenData) {
  const loc = tokenData || await findToken(locationId);
  if (!loc?.refresh_token) throw new Error("No refresh token for " + locationId);

  // Use the SAME user_type that was used during OAuth
  const userType = loc.tokenType === "company" ? "Company" : "Location";

  const r = await axios.post("https://services.leadconnectorhq.com/oauth/token",
    new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: loc.refresh_token,
      user_type: userType,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  const { access_token, refresh_token, expires_in } = r.data;
  const saveId = loc._docId || loc.locationId || locationId;
  await setLocation(saveId, { access_token, refresh_token, expires_in });
  console.log(`[Token] Refreshed for ${saveId} (userType: ${userType})`);
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
  const config = { method, url, headers };
  if (data && method !== "get") config.data = data;
  try { return await axios(config); }
  catch (e) {
    if (e.response?.status === 401) {
      config.headers.Authorization = `Bearer ${await refreshToken(locationId, loc)}`;
      return await axios(config);
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