import { randomInt } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const portValue = process.env.PORT ?? "3000";
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const configuredBaseUrl =
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const parsedBaseUrl = new URL(configuredBaseUrl);
if (
  !["http:", "https:"].includes(parsedBaseUrl.protocol) ||
  parsedBaseUrl.username ||
  parsedBaseUrl.password
) {
  throw new Error("BASE_URL must be an HTTP(S) origin");
}
const baseUrl = parsedBaseUrl.origin;

const configuredPublicDir = process.env.PUBLIC_DIR;
let publicDir;
if (configuredPublicDir) {
  try {
    publicDir = await realpath(resolve(configuredPublicDir));
    if (!(await stat(publicDir)).isDirectory()) {
      throw new Error("PUBLIC_DIR must point to a directory");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "PUBLIC_DIR must point to a directory") {
      throw error;
    }
    if (error?.code !== "ENOENT") throw error;
    publicDir = resolve(configuredPublicDir);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function newCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (links.has(code));
  return code;
}

async function findPublicFile(pathname) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const requestedPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const candidate = resolve(publicDir, requestedPath);
  const relativePath = relative(publicDir, candidate);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    return null;
  }

  try {
    const resolvedCandidate = await realpath(candidate);
    const resolvedRelativePath = relative(publicDir, resolvedCandidate);
    if (
      resolvedRelativePath === ".." ||
      resolvedRelativePath.startsWith(`..${sep}`) ||
      isAbsolute(resolvedRelativePath) ||
      !(await stat(resolvedCandidate)).isFile()
    ) {
      return null;
    }
    return Bun.file(resolvedCandidate);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const withCors = (response) => {
      for (const [name, value] of Object.entries(corsHeaders)) {
        response.headers.set(name, value);
      }
      return response;
    };

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return withCors(jsonResponse({ error: "Invalid JSON" }, 400));
      }

      if (!body || typeof body.url !== "string") {
        return withCors(jsonResponse({ error: "A valid HTTP(S) URL is required" }, 400));
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(body.url);
      } catch {
        return withCors(jsonResponse({ error: "A valid HTTP(S) URL is required" }, 400));
      }
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return withCors(jsonResponse({ error: "A valid HTTP(S) URL is required" }, 400));
      }

      const code = newCode();
      const link = {
        code,
        url: parsedUrl.href,
        shortUrl: `${baseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return withCors(jsonResponse(link, 201));
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return withCors(jsonResponse(Array.from(links.values())));
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const publicFile = await findPublicFile(pathname);
      if (publicFile) return withCors(new Response(publicFile));
    }

    if (request.method === "GET" && pathname !== "/" && !pathname.slice(1).includes("/")) {
      let code;
      try {
        code = decodeURIComponent(pathname.slice(1));
      } catch {
        return withCors(jsonResponse({ error: "Link not found" }, 404));
      }
      const link = links.get(code);
      if (!link) return withCors(jsonResponse({ error: "Link not found" }, 404));

      link.hits += 1;
      return withCors(new Response(null, { status: 302, headers: { Location: link.url } }));
    }

    return withCors(jsonResponse({ error: "Not found" }, 404));
  },
});

console.log(`Snip backend listening on ${server.url}`);
