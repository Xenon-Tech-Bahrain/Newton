import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NewtonError } from "@/lib/newton/errors";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 12_000;
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export type FetchedPage = {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  truncated: boolean;
};

function ipv4IsPrivate(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6IsPrivate(address: string) {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return true;

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return ipv4IsPrivate(mapped[1]);

  return (
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  );
}

function assertPublicAddress(address: string) {
  const version = isIP(address);
  const blocked =
    version === 4
      ? ipv4IsPrivate(address)
      : version === 6
        ? ipv6IsPrivate(address)
        : true;

  if (blocked) {
    throw new NewtonError(
      "That address is not allowed. Use a public web page.",
      422,
      "unsafe_url",
    );
  }
}

async function assertSafeUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new NewtonError("Enter a valid web address.", 422, "invalid_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new NewtonError(
      "Only http and https links can be fetched.",
      422,
      "invalid_url",
    );
  }
  if (url.username || url.password) {
    throw new NewtonError(
      "Links with embedded credentials are not allowed.",
      422,
      "unsafe_url",
    );
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new NewtonError(
      "Only standard web ports are allowed.",
      422,
      "unsafe_url",
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    assertPublicAddress(hostname);
  } else {
    const addresses = await lookup(hostname, { all: true }).catch(() => []);
    if (addresses.length === 0) {
      throw new NewtonError(
        "That site could not be found.",
        422,
        "url_not_found",
      );
    }
    for (const entry of addresses) assertPublicAddress(entry.address);
  }

  return url;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    rdquo: "”",
    ldquo: "“",
    hellip: "…",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg|canvas)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6]|blockquote|pre)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html: string, fallback: string) {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (og) return decodeEntities(og[1]).trim().slice(0, 200);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title) return decodeEntities(title[1]).replace(/\s+/g, " ").trim().slice(0, 200);
  return fallback;
}

async function readLimited(response: Response) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let text = "";
  let received = 0;
  let truncated = false;

  try {
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (received >= MAX_BYTES) {
        truncated = true;
        break;
      }
    }
    text += decoder.decode();
  } finally {
    reader.cancel().catch(() => undefined);
  }

  return { text, truncated };
}

/**
 * Fetches a public web page on the server and returns readable text.
 *
 * This is a deliberate, narrow substitute for "Aria can browse the web": the
 * user names one URL, the server validates it, strips scripts and markup, and
 * hands the text to the model as an attachment. Private, loopback and link-local
 * addresses are rejected so the feature cannot be used to probe the network.
 */
export async function fetchWebPage(rawUrl: string): Promise<FetchedPage> {
  let url = await assertSafeUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          accept: "text/html, text/plain;q=0.9, application/xhtml+xml;q=0.9",
          "user-agent":
            "Mozilla/5.0 (compatible; NewtonAria/1.0; +https://newtonbh.vercel.app)",
        },
      });
    } catch {
      throw new NewtonError(
        "That page could not be reached. Check the link and try again.",
        502,
        "fetch_failed",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      response.body?.cancel().catch(() => undefined);
      if (!location) break;
      url = await assertSafeUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
      throw new NewtonError(
        response.status === 404
          ? "That page was not found (404)."
          : `That page returned an error (${response.status}).`,
        502,
        "fetch_failed",
      );
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain") &&
      !contentType.includes("application/xhtml") &&
      !contentType.includes("application/xml") &&
      !contentType.includes("text/xml")
    ) {
      response.body?.cancel().catch(() => undefined);
      throw new NewtonError(
        "That link is not a readable web page.",
        415,
        "unsupported_content",
      );
    }

    const { text: body, truncated: bytesTruncated } = await readLimited(response);

    const html = body.slice(0, 800_000);
    const isHtml = contentType.includes("html") || contentType.includes("xml");
    const plain = isHtml ? htmlToText(html) : body.trim();
    const title = isHtml
      ? extractTitle(html, url.hostname)
      : url.pathname.split("/").filter(Boolean).at(-1) || url.hostname;

    if (!plain) {
      throw new NewtonError(
        "That page had no readable text.",
        422,
        "empty_page",
      );
    }

    const truncated = bytesTruncated || plain.length > MAX_TEXT_CHARS;

    return {
      url: rawUrl.trim(),
      finalUrl: url.toString(),
      title: title || url.hostname,
      text: plain.slice(0, MAX_TEXT_CHARS),
      truncated,
    };
  }

  throw new NewtonError(
    "That link redirected too many times.",
    422,
    "too_many_redirects",
  );
}
