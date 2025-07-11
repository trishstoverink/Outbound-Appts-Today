const express = require("express");
const axios = require("axios");
const { ConfidentialClientApplication } = require("@azure/msal-node");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Setup EJS and public folder
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.static("public")); // optional: for js/css

// MSAL config for service principal auth
const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET
  }
};

const cca = new ConfidentialClientApplication(msalConfig);

// 🔁 Shared function to fetch Power BI embed data
async function getPowerBIEmbedData() {
  try {
    // 1. Acquire Azure AD token
    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://analysis.windows.net/powerbi/api/.default"]
    });

    const accessToken = result.accessToken;

    // 2. Get the report's embed URL
    const reportDetails = await axios.get(
      `https://api.powerbi.com/v1.0/myorg/groups/${process.env.WORKSPACE_ID}/reports/${process.env.REPORT_ID}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    // 3. Generate an embed token
    const embedTokenResponse = await axios.post(
      `https://api.powerbi.com/v1.0/myorg/groups/${process.env.WORKSPACE_ID}/reports/${process.env.REPORT_ID}/GenerateToken`,
      { accessLevel: "view" },
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    return {
      accessToken: embedTokenResponse.data.token,
      embedUrl: reportDetails.data.embedUrl,
      reportId: process.env.REPORT_ID,
      tokenType: 1
    };
  } catch (err) {
    console.error("❌ Power BI token/embed error:", err.response?.data || err.message);
    throw err;
  }
}

// Route: homepage
app.get("/", async (req, res) => {
  try {
    const embedData = await getPowerBIEmbedData();
    res.render("index", embedData);
  } catch (err) {
    res.status(500).send("Failed to load report");
  }
});


// Route group: 15 custom Power BI pages
const reportPages = [
  "appatar", "callstars", "crocodials", "green", "magic", "mandalorians",
  "nfl", "nightmare", "space", "empire", "hogs",
  "pirates", "wolves", "tune", "witches"
];

reportPages.forEach(page => {
  app.get(`/${page}`, async (req, res) => {
    try {
      const embedData = await getPowerBIEmbedData();
      res.render(page, embedData);
    } catch (err) {
      console.error(`❌ Error loading ${page}:`, err.response?.data || err.message);
      res.status(500).send(`Failed to load ${page} report`);
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
