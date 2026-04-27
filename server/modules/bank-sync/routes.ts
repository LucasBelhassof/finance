import type { Request } from "express";
import { Router } from "express";

import { ForbiddenError } from "../../shared/errors.js";
import {
  connectItem,
  createConnectToken,
  disconnectPluggy,
  getConnectionStatus,
  syncTransactions,
} from "./service.js";

function requirePremium(request: Request): void {
  if (!request.auth?.user?.isPremium) {
    throw new ForbiddenError("premium_required", "This feature requires a premium account.");
  }
}

export function createBankSyncRouter(): Router {
  const router = Router();

  /**
   * POST /api/bank-sync/pluggy/connect-token
   * Returns a short-lived Pluggy Connect Token for the widget.
   * Premium only.
   */
  router.post("/pluggy/connect-token", async (request, response) => {
    requirePremium(request);
    const userId = request.auth!.userId;
    const connectToken = await createConnectToken(userId);
    response.json({ connectToken });
  });

  /**
   * POST /api/bank-sync/pluggy/connect
   * Saves the Pluggy item and triggers initial sync.
   * Body: { itemId: string }
   */
  router.post("/pluggy/connect", async (request, response) => {
    requirePremium(request);
    const userId = request.auth!.userId;

    const itemId = request.body?.itemId;
    if (typeof itemId !== "string" || !itemId.trim()) {
      response.status(400).json({ error: "bad_request", message: "itemId is required." });
      return;
    }

    const result = await connectItem(userId, itemId.trim());
    response.json(result);
  });

  /**
   * GET /api/bank-sync/pluggy/status
   * Returns the current Pluggy connection status.
   */
  router.get("/pluggy/status", async (request, response) => {
    requirePremium(request);
    const userId = request.auth!.userId;
    const status = await getConnectionStatus(userId);
    response.json(status);
  });

  /**
   * POST /api/bank-sync/pluggy/sync
   * Triggers a manual re-sync of transactions.
   */
  router.post("/pluggy/sync", async (request, response) => {
    requirePremium(request);
    const userId = request.auth!.userId;
    const result = await syncTransactions(userId);
    response.json(result);
  });

  /**
   * DELETE /api/bank-sync/pluggy
   * Removes the Pluggy connection. Existing transactions are preserved.
   */
  router.delete("/pluggy", async (request, response) => {
    requirePremium(request);
    const userId = request.auth!.userId;
    await disconnectPluggy(userId);
    response.status(204).end();
  });

  return router;
}
