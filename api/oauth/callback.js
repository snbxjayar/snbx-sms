const axios = require("axios");
const { setLocation } = require("../../lib/firebase");

module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code.");
  try {
    const r = await axios.post("https://services.leadconnectorhq.com/oauth/token",
      new URLSearchParams({
        client_id: process.env.GHL_CLIENT_ID,
        client_secret: process.env.GHL_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.BASE_URL + "/api/oauth/callback",
        user_type: "Location",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log("[OAuth] GHL response keys:", Object.keys(r.data));
    const { access_token, refresh_token, expires_in, locationId, companyId, userId } = r.data;
    const locId = locationId || companyId || userId;
    await setLocation(locId, {
      access_token, refresh_token, expires_in,
      locationId: locId,
      companyId: companyId || null,
      tokenType: locationId ? "location" : "company",
      installed_at: new Date().toISOString(),
    });
    console.log(`[OAuth] SUCCESS: ${locId} (type: ${locationId ? "location" : "company"})`);
    res.setHeader("Content-Type", "text/html");
    res.end(`<!DOCTYPE html><html><body style="font-family:Arial;max-width:600px;margin:60px auto;text-align:center">
      <h1 style="color:#0B6E4F">Installed!</h1>
      <p>ID: <strong>${locId}</strong></p>
      <p>Next: <a href="/admin">Go to Admin Panel</a> to enter Textbee credentials.</p>
      <p>Then: Settings > Phone System > Additional Settings > Telephony Provider > select SNBXSF SMS > Save.</p>
    </body></html>`);
  } catch (e) {
    console.error("[OAuth] FAILED:", e.response?.data || e.message);
    res.status(500).send("OAuth failed: " + (e.response?.data?.error_description || e.message));
  }
};