import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogStats } from "./data/catalog.js";
import { agentRouter } from "./routes/agent.js";
import { channel3Router } from "./routes/channel3.js";
import { ordersRouter } from "./routes/orders.js";
import {
  paypalConfigured,
  paypalEnv,
  publicPaypalClientId,
} from "./services/paypalClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 8787);

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "shopmate-ai", time: new Date().toISOString() });
});

app.get("/api/config", (_req, res) => {
  res.json({
    paypalClientId: publicPaypalClientId,
    paypalConfigured,
    paypalEnv,
    channel3Configured: Boolean(process.env.CHANNEL3_API_KEY?.trim()),
    currency: "USD",
    simulationAvailable: true,
    llmConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
    catalog: catalogStats(),
    demoPrompts: [
      "Programming laptop under $700, 16GB RAM, strong battery for VS Code",
      "Wireless headphones for studying under $100, top comfort & ANC",
      "Simple smartphone for my mother under $250, big battery & great camera",
      "Bundle: Programming laptop + ANC study headphones under $750 total",
    ],
  });
});

app.use("/api", agentRouter);
app.use("/api", channel3Router);
app.use("/api", ordersRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

const clientDist = path.resolve(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(
  (
    error: Error & { statusCode?: number; details?: unknown },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[ShopMate checkout] unhandled server error", {
      timestamp: new Date().toISOString(),
      layer: "server",
      method: req.method,
      path: req.path,
      errorName: error.name,
      mainError: error.message,
      httpStatus: error.statusCode ?? 500,
    });
    res.status(error.statusCode ?? 500).json({
      error: error.message || "Unexpected server error",
      details: error.details,
    });
  },
);

app.listen(port, () => {
  console.log(`\n  ShopMate AI server  ·  http://localhost:${port}`);
  console.log(
    `  PayPal: ${paypalConfigured ? `${paypalEnv} credentials loaded` : "simulated sandbox (no credentials)"}`,
  );
  console.log(
    `  Channel3: ${process.env.CHANNEL3_API_KEY?.trim() ? "live search API key loaded" : "live search disabled (missing CHANNEL3_API_KEY)"}`,
  );
  console.log(
    `  Catalog: ${catalogStats().products} verified products across ${catalogStats().categories.length} categories\n`,
  );
});
