import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { catalog, catalogStats, getProduct } from "../data/catalog.js";
import { refineAgent, rerunWithRequirements, runAgent } from "../services/agentPipeline.js";
import type { Requirements } from "../types.js";

export const agentRouter = Router();

const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

agentRouter.get("/catalog", (_req, res) => {
  res.json({ ...catalogStats(), products: catalog });
});

agentRouter.get("/catalog/:id", (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) {
    res.status(404).json({ error: "Product not found in the verified catalog" });
    return;
  }
  res.json({ product });
});

agentRouter.post(
  "/agent/query",
  asyncHandler(async (req, res) => {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt || prompt.length > 1200) {
      res.status(400).json({ error: "Provide a shopping brief between 1 and 1200 characters." });
      return;
    }
    const result = await runAgent(prompt);
    res.json({ ...result, prompt });
  }),
);

agentRouter.post("/agent/refine", (req, res) => {
  const requirements = req.body?.requirements as Requirements | undefined;
  const removed = req.body?.removed;
  if (!requirements || typeof requirements !== "object") {
    res.status(400).json({ error: "requirements object is required" });
    return;
  }
  if (!Array.isArray(removed) || removed.some((key) => typeof key !== "string")) {
    res.status(400).json({ error: "removed must be an array of constraint keys" });
    return;
  }
  res.json(refineAgent(requirements, removed));
});

agentRouter.post("/agent/search", (req, res) => {
  const requirements = req.body?.requirements as Requirements | undefined;
  if (!requirements || typeof requirements !== "object") {
    res.status(400).json({ error: "requirements object is required" });
    return;
  }
  res.json(rerunWithRequirements(requirements));
});
