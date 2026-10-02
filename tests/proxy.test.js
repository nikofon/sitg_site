// @vitest-environment node
import { createServer as createHttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { expect, it, vi } from "vitest";

it("preserves the website Host for API and login requests without Origin or Referer", async () => {
  const backend = createHttpServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.headers));
  });
  await new Promise(resolve => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  if (!address || typeof address === "string") throw new Error("Missing backend address");
  vi.stubEnv("SITG_WEBSITE_API_TARGET", `http://127.0.0.1:${address.port}`);
  let vite;
  try {
    vite = await createServer({
      configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
      logLevel: "silent",
      server: { port: 0, strictPort: false, hmr: false },
    });
    await vite.listen();
    const website = vite.httpServer.address();
    if (!website || typeof website === "string") throw new Error("Missing website address");
    const host = `127.0.0.1:${website.port}`;
    for (const path of [
      "/api/miniapp/routes/resolve?path=%2Fplayers",
      "/api/miniapp/routes/resolve?path=%2Ftournaments%3Finclude_managed_public%3Dtrue",
      "/auth/telegram",
    ]) {
      const response = await fetch(`http://${host}${path}`);
      expect(response.status).toBe(200);
      const headers = await response.json();
      expect(headers.host).toBe(host);
      expect(headers.origin).toBeUndefined();
      expect(headers.referer).toBeUndefined();
    }
  } finally {
    await vite?.close();
    await new Promise((resolve, reject) => backend.close(error => error ? reject(error) : resolve()));
    vi.unstubAllEnvs();
  }
});
