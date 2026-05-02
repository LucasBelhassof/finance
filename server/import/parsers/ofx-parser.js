import { normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

function readTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([^<\\r\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function normalizeOfxDate(value) {
  const compact = String(value ?? "").replace(/\D/g, "");

  if (compact.length < 8) {
    return null;
  }

  return normalizeDateInput(`${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`);
}

export function parseOfxBuffer(fileBuffer) {
  const text = fileBuffer.toString("utf8");
  const accountId = readTagValue(text, "ACCTID") || null;
  const bankId = readTagValue(text, "BANKID") || null;
  const currency = readTagValue(text, "CURDEF") || null;
  const statementCurrency = readTagValue(text, "CURRENCY") || currency;
  const blocks = text.split(/<STMTTRN>/i).slice(1);

  return blocks
    .map((block) => {
      const occurredOn = normalizeOfxDate(readTagValue(block, "DTPOSTED"));
      const description = readTagValue(block, "MEMO") || readTagValue(block, "NAME");
      const amount = normalizeAmountInput(readTagValue(block, "TRNAMT"));
      const externalId = readTagValue(block, "FITID") || null;

      if (!occurredOn || !description || amount === null) {
        return null;
      }

      return {
        occurredOn,
        description,
        amount,
        externalId,
        currency: statementCurrency,
        confidence: externalId ? 0.98 : 0.9,
        issues: [],
        sourceRow: {
          fitid: externalId,
          trntype: readTagValue(block, "TRNTYPE"),
          memo: readTagValue(block, "MEMO"),
          source: "OFX",
        },
        raw: {
          source: "OFX",
          text: block,
        },
        bankAccountHint: {
          bankId,
          accountId,
        },
      };
    })
    .filter(Boolean);
}
