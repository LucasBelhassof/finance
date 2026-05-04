import type { NextFunction, Request, Response } from "express";
import { Router } from "express";

import { env } from "../../shared/env.js";
import { ForbiddenError, UnauthorizedError } from "../../shared/errors.js";
import {
  assertImportWithinFreeLimit,
  assertPremiumAccess,
  cancelBillingSubscription,
  createBillingCheckout,
  getBillingSubscription,
  processAsaasWebhook,
  syncBillingSubscription,
} from "./service.js";
import type { PremiumFeature } from "./types.js";

function getAuthenticatedUserId(request: Request) {
  if (!request.auth) {
    throw new UnauthorizedError("authorization_header_missing", "Authorization header is required.");
  }

  return request.auth.userId;
}

export function requirePremiumFeature(feature: PremiumFeature) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      await assertPremiumAccess(getAuthenticatedUserId(request), feature);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function enforceFreeImportLimit(request: Request) {
  await assertImportWithinFreeLimit(getAuthenticatedUserId(request), request.body?.items);
}

export function createBillingRouter() {
  const router = Router();

  router.get("/subscription", async (request, response) => {
    response.json(await getBillingSubscription(getAuthenticatedUserId(request)));
  });

  router.post("/checkout", async (request, response) => {
    response.status(201).json(await createBillingCheckout(getAuthenticatedUserId(request)));
  });

  router.post("/cancel", async (request, response) => {
    response.json(await cancelBillingSubscription(getAuthenticatedUserId(request)));
  });

  router.post("/sync", async (request, response) => {
    response.json(await syncBillingSubscription(getAuthenticatedUserId(request)));
  });

  return router;
}

export function createAsaasWebhookRouter() {
  const router = Router();

  router.post("/", async (request, response) => {
    const expectedToken = env.billing.asaasWebhookToken;
    const receivedToken = request.get("asaas-access-token");

    if (!expectedToken || receivedToken !== expectedToken) {
      throw new ForbiddenError("asaas_webhook_forbidden", "Asaas webhook token is invalid.");
    }

    const result = await processAsaasWebhook(request.body ?? {});
    response.status(200).json(result);
  });

  return router;
}
