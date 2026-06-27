const { getAllLocations } = require("../../lib/firebase");
const { ghlApi } = require("../../lib/ghl");
 
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
 
  // LOG THE RAW PAYLOAD so we can see what Textbee actually sends
  console.log("[Textbee Webhook] Raw payload:", JSON.stringify(req.body));
  
  const { event, data } = req.body;
  if (event !== "MESSAGE_RECEIVED") return res.json({ success: true, skipped: true });
 
  const senderPhone = data.sender;
  const messageBody = data.message;
  console.log(`[Inbound] SMS from ${senderPhone}: "${messageBody?.substring(0, 60)}..."`);
 
  // Find which location this inbound belongs to by matching the Textbee device
  const locations = await getAllLocations();
  let delivered = false;
 
  for (const loc of locations) {
    if (!loc.textbee_api_key) continue;
 
    try {
      const searchRes = await ghlApi("get",
        `https://services.leadconnectorhq.com/contacts/search?query=${encodeURIComponent(senderPhone)}&locationId=${loc.id}`,
        null, loc.id);
 
      const contacts = searchRes.data?.contacts || [];
      const contact = contacts.find(c => {
        const cp = (c.phone || "").replace(/[^0-9+]/g, "");
        const sp = senderPhone.replace(/[^0-9+]/g, "");
        return cp === sp || cp.endsWith(sp.slice(-10)) || sp.endsWith(cp.slice(-10));
      });
 
      if (!contact) continue;
 
      await ghlApi("post",
        "https://services.leadconnectorhq.com/conversations/messages/inbound",
        { type: "SMS", contactId: contact.id, body: messageBody, direction: "inbound", status: "delivered", from: senderPhone, to: contact.phone },
        loc.id);
 
      console.log(`[Inbound] Pushed to GHL — Contact: ${contact.name || contact.id}`);
      delivered = true;
      break;
    } catch (e) {
      console.error(`[Inbound] Error (${loc.id}):`, e.response?.data || e.message);
    }
  }
 
  if (!delivered) console.warn(`[Inbound] No match for ${senderPhone}`);
  res.json({ success: delivered });
};
