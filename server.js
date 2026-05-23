const express = require("express");
const path = require("path");
const { getCompanyIntel } = require("./services/company-intel");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/api/company-info", async (req, res) => {
  const companyName = typeof req.body?.companyName === "string" ? req.body.companyName.trim() : "";
  if (companyName.length < 2) {
    return res.status(400).json({
      error: "companyName must contain at least 2 characters",
    });
  }

  try {
    const result = await getCompanyIntel(companyName);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch company information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
