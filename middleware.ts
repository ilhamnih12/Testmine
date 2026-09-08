import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * COOP/COEP header policy for the Luanti WASM client.
 *
 * SharedArrayBuffer (pthreads inside the engine) requires the ENGINE DOCUMENT
 * to be cross-origin isolated:
 *
 *  - /play            → COOP only. It hosts the engine iframe. It must NOT
 *                       set COEP, because in mirror mode the iframe is
 *                       cross-origin and a COEP on the parent would force
 *                       CORP/CORS on the mirror's documents.
 *  - /engine/index.html → COOP + COEP (self-hosted mode; no-cache so launcher
 *                       changes are picked up).
 *  - /engine/*         → COOP + COEP + immutable cache (wasm, packs, js).
 *
 * The landing page (/) needs no isolation headers at all.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  if (pathname === "/play" || pathname === "/play/") {
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    return res;
  }

  if (pathname.startsWith("/engine")) {
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    res.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
    if (pathname === "/engine/index.html") {
      res.headers.set("Cache-Control", "no-cache, must-revalidate");
    } else {
      res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }
    return res;
  }

  if (pathname === "/sw.js" || pathname === "/manifest.json") {
    res.headers.set("Cache-Control", "no-cache, must-revalidate");
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/play", "/play/", "/engine/:path*", "/sw.js", "/manifest.json"],
};
