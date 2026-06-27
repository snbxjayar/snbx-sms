const { setLocation } = require("../lib/firebase");
 
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { locationId, textbee_api_key, textbee_device_id, textbee_phone } = req.body;
  if (!locationId) return res.status(400).json({ error: "Missing locationId" });
  try {
    await setLocation(locationId, { textbee_api_key, textbee_device_id, textbee_phone });
    console.log(`[Admin] Saved Textbee creds for ${locationId}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
