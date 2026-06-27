const { getAllLocations } = require("../lib/firebase");
 
module.exports = async (req, res) => {
  // Simple password check
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    // Show login form
    res.setHeader("Content-Type", "text/html");
    return res.end(`<!DOCTYPE html><html><body style="font-family:Arial;max-width:500px;margin:60px auto">
      <h2 style="color:#0B6E4F">SNBXSF SMS Admin</h2>
      <form id="f"><input id="pw" type="password" placeholder="Admin password" style="padding:10px;width:100%;margin:10px 0;border:1px solid #ccc;border-radius:6px">
      <button style="padding:10px 24px;background:#0B6E4F;color:white;border:none;border-radius:6px;cursor:pointer">Login</button></form>
      <script>document.getElementById("f").onsubmit=e=>{e.preventDefault();
        localStorage.setItem("ap",document.getElementById("pw").value);
        location.reload()};
        if(localStorage.getItem("ap")){
          fetch("/admin",{headers:{Authorization:"Bearer "+localStorage.getItem("ap")}}).then(r=>r.text()).then(h=>{document.open();document.write(h);document.close()})}</script>
    </body></html>`);
  }
 
  // Authenticated — show locations
  const locations = await getAllLocations();
  const rows = locations.map(loc => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;font-size:13px">${loc.id}</td>
      <td style="padding:8px;border:1px solid #ddd">
        <input name="api_key_${loc.id}" value="${loc.textbee_api_key || ""}" placeholder="Textbee API Key" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
      </td>
      <td style="padding:8px;border:1px solid #ddd">
        <input name="device_id_${loc.id}" value="${loc.textbee_device_id || ""}" placeholder="Device ID" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
      </td>
      <td style="padding:8px;border:1px solid #ddd">
        <input name="phone_${loc.id}" value="${loc.textbee_phone || ""}" placeholder="+639XXXXXXXXX" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px">
      </td>
      <td style="padding:8px;border:1px solid #ddd">
        <button onclick="saveCreds(this.dataset.id)" data-id="${loc.id}" style="padding:6px 16px;background:#0B6E4F;color:white;border:none;border-radius:4px;cursor:pointer">Save</button>
      </td>
    </tr>
  `).join("");
 
  res.setHeader("Content-Type", "text/html");
  res.end(`<!DOCTYPE html><html><body style="font-family:Arial;max-width:1000px;margin:40px auto">
    <h2 style="color:#0B6E4F">SNBXSF SMS — Admin Panel</h2>
    <p>Enter each sub-account Textbee credentials after installing the app.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:20px">
      <tr style="background:#0B6E4F;color:white">
        <th style="padding:10px;text-align:left">Location ID</th>
        <th style="padding:10px;text-align:left">Textbee API Key</th>
        <th style="padding:10px;text-align:left">Device ID</th>
        <th style="padding:10px;text-align:left">Phone Number</th>
        <th style="padding:10px">Action</th>
      </tr>
      ${rows}
    </table>
    <div id="msg" style="margin-top:16px"></div>
    <script>
      function saveCreds(locId) {
        const d = {
          locationId: locId,
          textbee_api_key: document.querySelector("[name=api_key_"+locId+"]").value,
          textbee_device_id: document.querySelector("[name=device_id_"+locId+"]").value,
          textbee_phone: document.querySelector("[name=phone_"+locId+"]").value,
        };
        fetch("/admin/save", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("ap") },
          body: JSON.stringify(d),
        }).then(r=>r.json()).then(r=>{
          document.getElementById("msg").innerHTML = r.success
            ? "<p style=color:green>Saved for " + locId + "</p>"
            : "<p style=color:red>Error: " + r.error + "</p>";
        });
      }
    </script>
  </body></html>`);
};
