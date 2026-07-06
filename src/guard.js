// URL normalisation + safety checks.
//
// Auditing a user-supplied URL means the server makes an outbound request on
// their behalf — a classic SSRF risk. We therefore reject anything that isn't a
// public http(s) address (no localhost, private ranges, or cloud metadata IPs).

export function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (["localhost", "::1", "0.0.0.0", "[::1]"].includes(h)) return true;
  // IPv4 private / loopback / link-local (incl. cloud metadata 169.254.169.254)
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

/**
 * Parse + validate a URL string. Adds https:// if no scheme is given.
 * Throws an httpError(400) for anything invalid or unsafe.
 */
export function safeUrl(input) {
  let raw = String(input || "").trim();
  if (!raw) throw httpError(400, "Please enter a URL to audit.");
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw httpError(400, "That doesn't look like a valid URL.");
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw httpError(400, "Only http and https URLs can be audited.");
  }
  if (isPrivateHost(url.hostname)) {
    throw httpError(400, "For security, local and private network addresses can't be audited.");
  }
  if (!url.hostname.includes(".")) {
    throw httpError(400, "Please enter a full domain, e.g. example.com");
  }
  return url;
}
