import { Router } from "express";

import { BadRequestError } from "../../shared/errors.js";
import { listInvoicesForUser, updateInvoiceSettingsForCard } from "./service.js";

function parseIntegerRouteParam(value: string | undefined, code: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: code, message: "Invalid route parameter." };
  }

  return { value: parsed };
}

export function createInvoicesRouter() {
  const router = Router();

  router.get("/", async (request, response) => {
    if (!request.auth) {
      throw new BadRequestError("missing_auth_context", "Authentication context is missing.");
    }

    const result = await listInvoicesForUser(request.auth.userId, {
      cardId: request.query.cardId,
      referenceStart: request.query.referenceStart,
      referenceEnd: request.query.referenceEnd,
      status: request.query.status,
      categoryId: request.query.categoryId,
      search: request.query.search,
    });

    response.json(result);
  });

  router.patch("/cards/:id/settings", async (request, response) => {
    if (!request.auth) {
      throw new BadRequestError("missing_auth_context", "Authentication context is missing.");
    }

    const cardId = parseIntegerRouteParam(request.params.id, "invalid_card_id");

    if ("error" in cardId) {
      response.status(400).json(cardId);
      return;
    }

    const card = await updateInvoiceSettingsForCard(request.auth.userId, cardId.value, request.body ?? {});
    response.json({ card });
  });

  return router;
}
