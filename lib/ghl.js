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

async function getLocationToken(companyToken, companyId, locationId) {
  console.log(`[Token] Getting location token for ${locationId} from company ${companyId}`);
  const r = await axios.post(
    "https://services.leadconnectorhq.com/oauth/locationToken",
    { companyId, locationId },
    {
      headers: {
        Authorization: `Bearer ${companyToken}`,
        "Content-Type": "application/json",
        Version: "2021-04-15",
      },
    }
  );
  const { access_token, expires_in } = r.data;
  // Save this location-specific token
  await setLocation(locationId, {
    access_token,
    expires_in,
    locationId,
    tokenType: "location",
    derived_from_company: companyId,
    updated_at: new Date().toISOString(),
  });
  console.log(`[Token] Location token saved for ${locationId}`);
  return access_token;
}

async function refreshToken(locationId, tokenData) {
  const loc = tokenData || await findToken(locationId);
  if (!loc?.refresh_token) throw new Error("No refresh token for " + locationId);

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
  // First try: find a location-level token for this specific locationId
  let loc = await getLocation(locationId);

  // If no token or it's a company token, try to get a location token
  if (!loc?.access_token || loc?.tokenType === "company") {
    // Find the company token
    const all = await getAllLocations();
    const companyLoc = all.find(l => l.tokenType === "company" && l.access_token);

    if (companyLoc) {
      try {
        const locToken = await getLocationToken(
          companyLoc.access_token,
          companyLoc.companyId || companyLoc.locationId || companyLoc.id,
          locationId
        );
        // Refresh loc with the new location token
        loc = await getLocation(locationId);
      } catch (e) {
        // If locationToken call fails with 401, refresh company token first
        if (e.response?.status === 401) {
          const newCompanyToken = await refreshToken(companyLoc._docId || companyLoc.id, companyLoc);
          const locToken = await getLocationToken(newCompanyToken, companyLoc.companyId || companyLoc.id, locationId);
          loc = await getLocation(locationId);
        } else {
          console.error("[Token] Failed to get location token:", e.response?.data || e.message);
          // Fall back to whatever token we have
          if (!loc?.access_token) loc = companyLoc;
        }
      }
    }
  }

  if (!loc?.access_token) throw new Error("No token found for " + locationId);

  const headers = {
    Authorization: `Bearer ${loc.access_token}`,
    "Content-Type": "application/json",
    Version: "2021-04-15",
  };
  const config = { method, url, headers };
  if (data && method !== "get") config.data = data;

  try {
    return await axios(config);
  } catch (e) {
    if (e.response?.status === 401) {
      // Try refreshing the token
      if (loc.refresh_token) {
        config.headers.Authorization = `Bearer ${await refreshToken(locationId, loc)}`;
      } else {
        // Location token with no refresh - re-derive from company token
        const all = await getAllLocations();
        const companyLoc = all.find(l => l.tokenType === "company" && l.refresh_token);
        if (companyLoc) {
          const freshCompanyToken = await refreshToken(companyLoc.id, companyLoc);
          const locToken = await getLocationToken(freshCompanyToken, companyLoc.companyId || companyLoc.id, locationId);
          config.headers.Authorization = `Bearer ${locToken}`;
        } else {
          throw e;
        }
      }
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