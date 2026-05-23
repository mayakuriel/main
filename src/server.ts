import express from "express";
import path from "node:path";
import { generateCompanyBrief } from "./lib/intelligence/brief-generator";
import { briefRequestSchema } from "./api/brief-request";

const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const app = express();
const port = Number(process.env.PORT ?? "3000");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/api/brief", async (req, res) => {
  try {
    const parsed = briefRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request payload.",
        details: parsed.error.flatten(),
      });
    }

    const response = await generateCompanyBrief(parsed.data);
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to generate company brief.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Company Brief Generator running on http://localhost:${port}`);
});
