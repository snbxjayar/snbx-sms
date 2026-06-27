const axios = require("axios");
const { getLocation, setLocation } = require("./firebase");
 
async function refreshToken(locationId) {
  const loc = await getLocation(locationId);
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
  await setLocation(locationId, { access_token, refresh_token, expires_in });
  return access_token;
}
 
async function ghlApi(method, url, data, locationId) {
  const loc = await getLocation(locationId);
  if (!loc) throw new Error("No data for location " + locationId);
  const headers = {
    Authorization: `Bearer ${loc.access_token}`,
    "Content-Type": "application/json",
    Version: "2021-04-15",
  };
  try { return await axios({ method, url, data, headers }); }
  catch (e) {
    if (e.response?.status === 401) {
      headers.Authorization = `Bearer ${await refreshToken(locationId)}`;
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
 
module.exports = { ghlApi, refreshToken, formatPhone };
