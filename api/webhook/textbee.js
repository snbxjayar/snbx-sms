const { getAllLocations } = require("../../lib/firebase");
const { ghlApi } = require("../../lib/ghl");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    console.log("[Textbee Webhook] Raw payload:", JSON.stringify(req.body));

    const { webhookEvent, sender, message } = req.body;

    if (webhookEvent !== "MESSAGE_RECEIVED") {
      console.log("[Textbee Webhook] Skipping event:", webhookEvent);
      return res.json({ success: true, skipped: true });
    }

    console.log(`[Inbound] SMS from ${sender}: "${message?.substring(0, 60)}"`);

    console.log("[Inbound] Fetching all locations from Firestore...");
    const locations = await getAllLocations();
    console.log(`[Inbound] Found ${locations.length} locations`);

    if (locations.length === 0) {
      console.error("[Inbound] No locations in Firestore!");
      return res.json({ success: false, error: "No locations" });
    }

    let delivered = false;

    for (const loc of locations) {
      console.log(`[Inbound] Checking location ${loc.id}, has Textbee key: ${!!loc.textbee_api_key}`);
      if (!loc.textbee_api_key) continue;

      try {
        console.log(`[Inbound] Searching contact ${sender} in location ${loc.id}`);
        const searchRes = await ghlApi("get",
  `https://services.leadconnectorhq.com/contacts/?query=${encodeURIComponent(sender)}&locationId=${loc.id}&limit=5`,
  null, loc.id);

        const contacts = searchRes.data?.contacts || [];
        console.log(`[Inbound] Found ${contacts.length} contacts matching ${sender}`);

        const contact = contacts.find(c => {
          const cp = (c.phone || "").replace(/[^0-9+]/g, "");
          const sp = sender.replace(/[^0-9+]/g, "");
          return cp === sp || cp.endsWith(sp.slice(-10)) || sp.endsWith(cp.slice(-10));
        });

        if (!contact) {
          console.log(`[Inbound] No phone match in location ${loc.id}`);
          continue;
        }

        console.log(`[Inbound] Match found! Contact: ${contact.name || contact.id}, pushing to GHL...`);
        await ghlApi("post",
          "https://services.leadconnectorhq.com/conversations/messages/inbound",
          { type: "SMS", contactId: contact.id, body: message, direction: "inbound", status: "delivered", from: sender, to: contact.phone },
          loc.id);

        console.log(`[Inbound] SUCCESS — Pushed to GHL for ${contact.name || contact.id}`);
        delivered = true;
        break;
      } catch (e) {
        console.error(`[Inbound] Error (${loc.id}):`, e.response?.data || e.message);
      }
    }

    if (!delivered) console.warn(`[Inbound] No contact match for ${sender} in any location`);
    res.json({ success: delivered });

  } catch (err) {
    console.error("[Textbee Webhook] UNCAUGHT ERROR:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};