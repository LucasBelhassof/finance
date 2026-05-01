import { normalizeAmountInput, normalizeDateInput } from "./tabular-utils.js";

function readTagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([^<\\r\\n]+)`, "i"));
  return match?.[1]?.trim() ?? "";
}

export function parseOfxBuffer(fileBuffer) {
  const text = fileBuffer.toString("utf8");
  const blocks = text.split(/<STMTTRN>/i).slice(1);

  return blocks
    .map((block) => {
      const rawDate = readTagValue(block, "DTPOSTED").slice(0, 8);
      const occurredOn = normalizeDateInput(`${rawDate.slice(6, 8)}/${rawDate.slice(4, 6)}/${rawDate.slice(0, 4)}`);
      const description = readTagValue(block, "MEMO") || readTagValue(block, "NAME");
      const amount = normalizeAmountInput(readTagValue(block, "TRNAMT"));

      if (!occurredOn || !description || amount === null) {
        return null;
      }

      return {
        occurredOn,
        description,
        amount,
        sourceRow: {
          fitId: readTagValue(block, "FITID"),
          type: readTagValue(block, "TRNTYPE"),
        },
      };
    })
    .filter(Boolean);
}
