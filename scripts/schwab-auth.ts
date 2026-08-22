/**
 * Standalone, host-only script that performs the interactive Schwab OAuth handshake.
 *
 * Why this isn't part of the Next.js app: the redirect URI registered in the Schwab
 * Developer Portal (SCHWAB_REDIRECT_URI, e.g. https://127.0.0.1:8182) must be reachable
 * by the user's browser and match exactly. Running this as a one-off host process avoids
 * binding the containerized web app to that host/port, and refresh tokens expire every
 * ~7 days, so this is meant to be re-run periodically, independent of the running app.
 *
 * One-time setup: generate a local dev TLS cert with mkcert so the browser trusts it:
 *   mkcert -install
 *   mkdir -p certs && mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem 127.0.0.1
 *
 * Run with: npm run schwab:auth
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { exec } from "node:child_process";

import {
  loadOAuthConfigFromEnv,
  generateState,
  buildAuthorizationUrl,
} from "../lib/schwab/oauth";
import { completeAuthorization } from "../lib/schwab/client";
import { DbTokenStore } from "../lib/schwab/token-store";

const CERT_PATH = process.env.SCHWAB_AUTH_TLS_CERT ?? "certs/localhost.pem";
const KEY_PATH = process.env.SCHWAB_AUTH_TLS_KEY ?? "certs/localhost-key.pem";
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

function requireCert(): { cert: Buffer; key: Buffer } {
  if (!existsSync(CERT_PATH) || !existsSync(KEY_PATH)) {
    console.error(
      `Missing local TLS cert/key at ${CERT_PATH} / ${KEY_PATH}.\n` +
        "Generate one with mkcert (see the comment at the top of this script), " +
        "or set SCHWAB_AUTH_TLS_CERT / SCHWAB_AUTH_TLS_KEY to point elsewhere."
    );
    process.exit(1);
  }
  return { cert: readFileSync(CERT_PATH), key: readFileSync(KEY_PATH) };
}

function tryOpenBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? `open "${url}"` : process.platform === "win32" ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(command, (err) => {
    if (err) {
      // Non-fatal — the user can still open the printed URL manually.
      console.log("Could not auto-open a browser; open the URL above manually.");
    }
  });
}

function htmlResponse(title: string, message: string): string {
  return `<!doctype html><html><head><title>${title}</title></head>` +
    `<body style="font-family: sans-serif; padding: 2rem;"><h1>${title}</h1><p>${message}</p>` +
    `<p>You can close this tab and return to the terminal.</p></body></html>`;
}

async function main(): Promise<void> {
  const config = loadOAuthConfigFromEnv();
  const redirectUrl = new URL(config.redirectUri);
  const state = generateState();
  const authorizationUrl = buildAuthorizationUrl(config, state);
  const { cert, key } = requireCert();
  const tokenStore = new DbTokenStore();

  let server: Server;
  const timeout = setTimeout(() => {
    console.error(`Timed out after ${CALLBACK_TIMEOUT_MS / 1000}s waiting for the Schwab redirect.`);
    server.close(() => process.exit(1));
  }, CALLBACK_TIMEOUT_MS);

  server = createServer({ cert, key }, (req, res) => {
    const requestUrl = new URL(req.url ?? "/", redirectUrl);
    if (requestUrl.pathname !== redirectUrl.pathname) {
      res.writeHead(404).end();
      return;
    }

    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code");
    const returnedState = requestUrl.searchParams.get("state");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/html" }).end(htmlResponse("Schwab authorization failed", error));
      console.error(`Schwab returned an error: ${error}`);
      clearTimeout(timeout);
      server.close(() => process.exit(1));
      return;
    }

    if (!code || returnedState !== state) {
      res.writeHead(400, { "Content-Type": "text/html" }).end(
        htmlResponse("Invalid callback", "Missing authorization code or state mismatch.")
      );
      return;
    }

    completeAuthorization(tokenStore, code, config)
      .then(() => {
        res.writeHead(200, { "Content-Type": "text/html" }).end(
          htmlResponse("Schwab connected", "Tokens were saved successfully.")
        );
        console.log("Schwab tokens saved successfully.");
        clearTimeout(timeout);
        server.close(() => process.exit(0));
      })
      .catch((err: unknown) => {
        res.writeHead(500, { "Content-Type": "text/html" }).end(
          htmlResponse("Token exchange failed", "See the terminal for details.")
        );
        console.error("Failed to exchange the authorization code for tokens:", err);
        clearTimeout(timeout);
        server.close(() => process.exit(1));
      });
  });

  server.listen(Number(redirectUrl.port), redirectUrl.hostname, () => {
    console.log(`Listening on ${config.redirectUri} — waiting for the Schwab redirect.`);
    console.log(`Open this URL to log in to Schwab:\n${authorizationUrl}\n`);
    tryOpenBrowser(authorizationUrl);
  });
}

main().catch((err: unknown) => {
  console.error("schwab-auth failed:", err);
  process.exit(1);
});
