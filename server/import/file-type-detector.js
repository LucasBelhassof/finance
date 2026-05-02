export function detectFileType({ contentType, filename, fileBuffer }) {
  const normalizedContentType = String(contentType ?? "").toLowerCase();
  const normalizedFilename = String(filename ?? "").toLowerCase();
  const header = Buffer.isBuffer(fileBuffer) ? fileBuffer.subarray(0, 8) : Buffer.alloc(0);

  if (header.length >= 4 && header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return "pdf";
  }

  if (header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    return "xlsx";
  }

  if (/\.(xlsx)$/i.test(normalizedFilename) || normalizedContentType.includes("spreadsheetml")) {
    return "xlsx";
  }

  if (/\.(xls)$/i.test(normalizedFilename) || normalizedContentType.includes("application/vnd.ms-excel")) {
    return "xls";
  }

  if (/\.(ofx)$/i.test(normalizedFilename) || normalizedContentType.includes("ofx")) {
    return "ofx";
  }

  if (/\.(qif)$/i.test(normalizedFilename) || normalizedContentType.includes("qif")) {
    return "qif";
  }

  if (/\.(json)$/i.test(normalizedFilename) || normalizedContentType.includes("json")) {
    return "json";
  }

  if (/\.(csv)$/i.test(normalizedFilename) || normalizedContentType.includes("csv")) {
    return "csv";
  }

  if (/\.(tsv)$/i.test(normalizedFilename) || normalizedContentType.includes("tab-separated-values")) {
    return "tsv";
  }

  if (/\.(txt)$/i.test(normalizedFilename) || normalizedContentType.startsWith("text/")) {
    return "txt";
  }

  return "unknown";
}
