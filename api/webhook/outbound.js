const axios = require("axios");
const { getLocation, setLocation } = require("../../lib/firebase");
const { ghlApi, formatPhone } = require("../../lib/ghl");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { locationId, messageId, type, phone, message } = req.body;
  console.log(`[Outbound] SMS to ${phone}: "${message?.substring(0, 60)}..."`);

  if (type !== "SMS") return res.json({ success: true, skipped: true });

  // Get Textbee creds for this specific location
  let loc = await getLocation(locationId);

  // If this locationId doesn't exist yet, auto-create it so it shows in admin
  if (!loc) {
    await setLocation(locationId, { locationId, created_at: new Date().toISOString() });
    console.log(`[Outbound] Auto-created location entry: ${locationId}`);
    loc = await getLocation(locationId);
  }

  if (!loc?.textbee_api_key || !loc?.textbee_device_id) {
    console.error(`[Outbound] No Textbee credentials for location ${locationId}. Add them in /admin`);
    return res.json({ success: false, error: "No Textbee credentials configured" });
  }

  try {
    const smsRes = await axios.post(
      `https://api.textbee.dev/api/v1/gateway/devices/${loc.textbee_device_id}/send-sms`,
      { recipients: [formatPhone(phone)], message },
      { headers: { "Content-Type": "application/json", "x-api-key": loc.textbee_api_key } }
    );
    console.log("[Textbee] Sent:", JSON.stringify(smsRes.data));

    try {
      await ghlApi("put",
        `https://services.leadconnectorhq.com/conversations/messages/${messageId}/status`,
        { status: "delivered" }, locationId);
      console.log(`[GHL] Status: delivered (${messageId})`);
    } catch (se) {
      console.error("[GHL] Status update failed:", se.response?.data || se.message);
    }
    res.json({ success: true });
  } catch (e) {
    console.error("[Outbound] FAILED:", e.response?.data || e.message);
    try {
      await ghlApi("put",
        `https://services.leadconnectorhq.com/conversations/messages/${messageId}/status`,
        { status: "failed", error: { code: 500, message: "SMS failed" } }, locationId);
    } catch (_) {}
    res.json({ success: false, error: e.message });
  }
};