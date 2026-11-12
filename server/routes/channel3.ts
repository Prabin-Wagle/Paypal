import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import {
  Channel3ApiError,
  getChannel3ProductDetails,
  searchChannel3Products,
} from "../services/channel3Client.js";

export const channel3Router = Router();

const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

channel3Router.post(
  "/channel3/search",
  asyncHandler(async (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
    if (query.length < 2 || query.length > 300) {
      console.warn("[ShopMate Channel3] search rejected", {
        reason: "invalid-query-length",
        queryLength: query.length,
      });
      res.status(400).json({ error: "Enter a search query between 2 and 300 characters." });
      return;
    }

    const mode = req.body?.mode === "agentic" ? "agentic" : req.body?.mode === "default" || req.body?.mode === undefined ? "default" : null;
    if (!mode) {
      res.status(400).json({ error: "Search mode must be default or agentic." });
      return;
    }
    const requestedLimit = Number(req.body?.limit ?? 6);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 8) {
      res.status(400).json({ error: "Result limit must be between 1 and 8." });
      return;
    }

    try {
      const products = await searchChannel3Products(query, { mode, limit: requestedLimit });
      res.json({ provider: "channel3", query, products, count: products.length });
    } catch (error) {
      if (error instanceof Channel3ApiError) {
        res.status(error.statusCode).json({
          error: error.message,
          channel3_status: error.upstreamStatus,
          channel3_request_id: error.requestId,
        });
        return;
      }
      throw error;
    }
  }),
);

channel3Router.post(
  "/channel3/products/:productId",
  asyncHandler(async (req, res) => {
    const productId = req.params.productId.trim();
    if (!productId || productId.length > 180) {
      res.status(400).json({ error: "A valid Channel3 product ID is required." });
      return;
    }

    const rawOptions: unknown = req.body?.selectedOptions ?? {};
    if (
      typeof rawOptions !== "object" ||
      rawOptions === null ||
      Array.isArray(rawOptions) ||
      Object.keys(rawOptions).length > 10 ||
      Object.entries(rawOptions).some(
        ([name, value]) => !name.trim() || name.length > 80 || typeof value !== "string" || value.length > 80,
      )
    ) {
      res.status(400).json({ error: "Variant selections must contain at most 10 valid options." });
      return;
    }

    try {
      const product = await getChannel3ProductDetails(productId, rawOptions as Record<string, string>);
      res.json(product);
    } catch (error) {
      if (error instanceof Channel3ApiError) {
        res.status(error.statusCode).json({
          error: error.message,
          channel3_status: error.upstreamStatus,
          channel3_request_id: error.requestId,
        });
        return;
      }
      throw error;
    }
  }),
);
