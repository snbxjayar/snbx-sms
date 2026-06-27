module.exports = (req, res) => {
  const scopes = "conversations/message.write conversations.readonly conversations.write contacts.readonly contacts.write";
  const url = "https://marketplace.gohighlevel.com/oauth/chooselocation"
    + "?response_type=code"
    + `&client_id=${process.env.GHL_CLIENT_ID}`
    + `&redirect_uri=${encodeURIComponent(process.env.BASE_URL + "/api/oauth/callback")}`
    + `&scope=${encodeURIComponent(scopes)}`;
  res.setHeader("Content-Type", "text/html");
  res.end(`<!DOCTYPE html><html><body style="font-family:Arial;max-width:600px;margin:60px auto;text-align:center">
    <h1 style="color:#0B6E4F">SNBXSF SMS</h1>
    <p>Two-way SMS for GHL sub-accounts via Textbee.</p>
    <a href="${url}" style="display:inline-block;padding:14px 32px;background:#0B6E4F;color:white;text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold">Install on Sub-Account</a>
    <br><br><a href="/admin" style="color:#888;font-size:14px">Admin Panel</a>
  </body></html>`);
};
