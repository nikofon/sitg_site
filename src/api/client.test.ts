import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError } from "./client";

const session = {
  csrf_token: "csrf-test-token",
  expires_at: "2099-01-01T00:00:00Z",
  locale: "en",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("preserves origin failures without attempting to sign in again", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "authentication_required" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "origin_not_allowed" } }, 403));
    const client = new ApiClient(fetcher);
    await expect(client.request("/api/miniapp/routes/resolve?path=/players"))
      .rejects.toMatchObject({ code: "origin_not_allowed", status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("browses public routes without Telegram and refuses anonymous mutations", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "authentication_required" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    const client = new ApiClient(fetcher);
    await expect(client.request("/api/miniapp/routes/resolve?path=/players")).resolves.toEqual({ items: [] });
    await expect(client.request("/api/miniapp/action", { method: "POST" })).rejects.toMatchObject({ code: "authentication_required" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/website/session");
    expect(fetcher.mock.calls[1]?.[1]?.credentials).toBe("omit");
  });

  it("continues anonymously when a saved website session expires while the page is idle", async () => {
    const unauthorized = () => jsonResponse({ error: { code: "authentication_required" } }, 401);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...session, expires_at: new Date(Date.now() + 30_000).toISOString() }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ items: ["public player"] }));
    const client = new ApiClient(fetcher);
    await client.request("/api/miniapp/players");
    await expect(client.request("/api/miniapp/players")).resolves.toEqual({ items: ["public player"] });
    expect(fetcher.mock.calls[4]?.[1]?.credentials).toBe("omit");
    expect(client.viewer).toBeUndefined();
  });

  it.each(["GET", "POST"] as const)("handles a revoked session during %s without retrying anonymous mutations", async method => {
    const unauthorized = () => jsonResponse({ error: { code: "authentication_required" } }, 401);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...session, viewer: { player_id: "player" } }))
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    const client = new ApiClient(fetcher);
    const result = client.request("/api/miniapp/resource", { method });
    if (method === "GET") {
      await expect(result).resolves.toEqual({ items: [] });
      expect(fetcher.mock.calls[4]?.[1]?.credentials).toBe("omit");
    } else {
      await expect(result).rejects.toMatchObject({ code: "authentication_required" });
      expect(fetcher).toHaveBeenCalledTimes(4);
    }
    expect(client.viewer).toBeUndefined();
  });

  it("keeps private pages protected during anonymous browsing", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      jsonResponse({ error: { code: "authentication_required" } }, 401));
    const client = new ApiClient(fetcher);
    await expect(client.request("/api/miniapp/routes/resolve?path=/library"))
      .rejects.toMatchObject({ code: "authentication_required" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]?.credentials).toBe("omit");
  });

  it("restores a website session and clears identity on logout", async () => {
    const viewer = { player_id: "player", is_admin: true, is_manager: true, registration_status: "active" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...session, viewer }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new ApiClient(fetcher);
    await client.request("/api/miniapp/items");
    expect(client.viewer).toEqual(viewer);
    await client.logout();
    expect(client.viewer).toBeUndefined();
    expect(fetcher.mock.calls[2]?.[0]).toBe("/api/website/logout");
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get("X-CSRF-Token")).toBe(session.csrf_token);
  });

  it("authenticates and protects mutations", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new ApiClient(fetcher);

    await client.request("/api/miniapp/action", { method: "POST", body: { value: 1 } });

    const authentication = fetcher.mock.calls[0];
    expect(authentication?.[0]).toBe("/api/website/session");
    const mutation = fetcher.mock.calls[1]?.[1];
    expect(new Headers(mutation?.headers).get("X-CSRF-Token")).toBe("csrf-test-token");
    expect(new Headers(mutation?.headers).get("X-Idempotency-Key")?.length).toBeGreaterThanOrEqual(8);
    expect(mutation?.credentials).toBe("include");
  });

  it("refreshes and retries once after an expired cookie", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({ error: { code: "authentication_required" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ ...session, csrf_token: "rotated-token" }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));
    const client = new ApiClient(fetcher);

    await expect(client.request("/api/miniapp/items")).resolves.toEqual({ items: [] });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "/api/website/session",
      "/api/miniapp/items",
      "/api/miniapp/session/refresh",
      "/api/miniapp/items",
    ]);
  });

  it("maps server failures to stable errors without exposing server text", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: "forbidden", message: "sensitive details" } }, 403),
      );
    const client = new ApiClient(fetcher);

    const failure = await client.request("/api/miniapp/private").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: "forbidden", message: "forbidden" });
  });
});
