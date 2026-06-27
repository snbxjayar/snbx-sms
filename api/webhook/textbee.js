const { getAllLocations } = require("../../lib/firebase");
const { ghlApi } = require("../../lib/ghl");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  console.log("[Textbee Webhook] Raw payload:", JSON.stringify(req.body));

  const { webhookEvent, sender, message } = req.body;

  if (webhookEvent !== "MESSAGE_RECEIVED") {
    console.log("[Textbee Webhook] Skipping event:", webhookEvent);
    return res.json({ success: true, skipped: true });
  }

  console.log(`[Inbound] SMS from ${sender}: "${message?.substring(0, 60)}..."`);

  const locations = await getAllLocations();
  let delivered = false;

  for (const loc of locations) {
    if (!loc.textbee_api_key) continue;

    try {
      const searchRes = await ghlApi("get",
        `https://services.leadconnectorhq.com/contacts/search?query=${encodeURIComponent(sender)}&locationId=${loc.id}`,
        null, loc.id);

      const contacts = searchRes.data?.contacts || [];
      const contact = contacts.find(c => {
        const cp = (c.phone || "").replace(/[^0-9+]/g, "");
        const sp = sender.replace(/[^0-9+]/g, "");
        return cp === sp || cp.endsWith(sp.slice(-10)) || sp.endsWith(cp.slice(-10));
      });

      if (!contact) continue;

      await ghlApi("post",
        "https://services.leadconnectorhq.com/conversations/messages/inbound",
        { type: "SMS", contactId: contact.id, body: message, direction: "inbound", status: "delivered", from: sender, to: contact.phone },
        loc.id);

      console.log(`[Inbound] Pushed to GHL — Contact: ${contact.name || contact.id}`);
      delivered = true;
      break;
    } catch (e) {
      console.error(`[Inbound] Error (${loc.id}):`, e.response?.data || e.message);
    }
  }

  if (!delivered) console.warn(`[Inbound] No contact match for ${sender}`);
  res.json({ success: delivered });
};