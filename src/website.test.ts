import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api/client";
import { WebsiteShell } from "./app";
import { Router } from "./routing/router";
import type { TournamentListItem } from "./api/types";

const playerId = "00000000-0000-0000-0000-000000000005";
const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

describe("Website", () => {
  let shell: WebsiteShell;
  afterEach(() => {
    shell?.stop();
    document.body.replaceChildren();
    sessionStorage.clear();
  });

  function start(authenticated = false, supportedOrders?: string[]) {
    window.history.replaceState({}, "", "/players");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url) === "/api/website/session") return authenticated
        ? response({ csrf_token: "csrf-token", expires_at: "2099-01-01T00:00:00Z", locale: "en",
          viewer: { player_id: playerId, is_manager: true, is_admin: true, registration_status: "active" } })
        : response({ error: { code: "authentication_required" } }, 401);
      return response({ locale: "en", authorization: { allowed: true }, resource: {
        kind: "players", state: "ready", items: [{ id: playerId, label: "Player <script>", rating: 1250.5, games: 12 }],
        rulesets: [{ key: "si", name: "SI" }, { key: "other", name: "Other" }],
        ruleset_key: new URL(String(url), window.location.origin).searchParams.get("path")?.includes("ruleset=other") ? "other" : "si",
        total: 21, next_offset: 20,
        supported_orders: supportedOrders,
      } });
    });
    const root = document.createElement("div");
    document.body.append(root);
    shell = new WebsiteShell(root, new ApiClient(fetcher), new Router());
    shell.start();
    return { root, fetcher };
  }

  it("renders public names safely, provides sidebar navigation, search, sorting and pagination", async () => {
    const { root, fetcher } = start();
    await vi.waitFor(() => expect(root.textContent).toContain("Player <script>"));
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("header")?.textContent).toContain("Sign in with Telegram");
    expect(root.querySelector("nav")?.textContent).not.toContain("Sign in with Telegram");
    expect(root.querySelector('button[data-path="/library"]')).not.toBeNull();
    expect(root.querySelector('button[data-path="/players"]')?.getAttribute("aria-current")).toBe("page");
    expect(root.querySelector("nav a")).toBeNull();
    expect(root.querySelector("nav")?.textContent).not.toContain("Return to bot");
    expect(root.textContent).toContain("Rating: 1250.5");
    expect(root.textContent).toContain("Games: 12");
    expect(root.querySelector<HTMLSelectElement>("#players-ruleset")?.value).toBe("si");
    const menu = root.querySelector<HTMLButtonElement>(".website-menu-toggle")!;
    menu.click();
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    Array.from(root.querySelectorAll("button")).find(button => button.textContent === "Next page")!.click();
    await vi.waitFor(() => expect(window.location.search).toContain("offset=20"));
    await vi.waitFor(() => expect(root.querySelector("#players-ruleset")).not.toBeNull());
    const ruleset = root.querySelector<HTMLSelectElement>("#players-ruleset")!;
    ruleset.value = "other";
    ruleset.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(window.location.search).toContain("ruleset=other"));
    expect(window.location.search).not.toContain("offset");
    await vi.waitFor(() => expect(root.querySelector<HTMLSelectElement>("#players-ruleset")?.value).toBe("other"));
    const search = root.querySelector<HTMLInputElement>("#filter-search")!;
    search.value = "Alice";
    search.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(window.location.search).toContain("search=Alice"));
    expect(window.location.search).not.toContain("offset");
    const order = root.querySelector<HTMLSelectElement>("#filter-order")!;
    expect([...order.options].map(option => option.value)).toEqual(["name_asc", "name_desc"]);
    order.value = "name_desc";
    order.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(window.location.search).toContain("order=name_desc"));
    expect(fetcher.mock.calls.filter(call => call[0] === "/api/website/session")).toHaveLength(1);
  });

  it("enables rating and game-count ordering only when advertised by the server", async () => {
    const orders = ["name_asc", "name_desc", "rating_desc", "rating_asc", "games_desc", "games_asc"];
    const { root, fetcher } = start(false, orders);
    await vi.waitFor(() => expect(
      [...root.querySelector<HTMLSelectElement>("#filter-order")!.options].map(option => option.value),
    ).toEqual(orders));
    for (const value of orders.slice(2)) {
      const order = root.querySelector<HTMLSelectElement>("#filter-order")!;
      order.value = value;
      order.dispatchEvent(new Event("change", { bubbles: true }));
      await vi.waitFor(() => expect(root.querySelector<HTMLSelectElement>("#filter-order")?.value).toBe(value));
      expect(window.location.search).toContain(`order=${value}`);
      expect(fetcher.mock.calls.some(([url]) => {
        const path = new URL(String(url), window.location.origin).searchParams.get("path");
        return path?.includes(`order=${value}`);
      })).toBe(true);
    }
  });

  it("offers own profile and management routes after restoring identity", async () => {
    const { root } = start(true);
    await vi.waitFor(() => expect(root.textContent).toContain("My profile"));
    expect(root.querySelector(`nav button[data-path="/players/${playerId}"]`)).not.toBeNull();
    expect(root.querySelector('nav button[data-path="/tournaments?role=manager"]')).not.toBeNull();
    expect(root.querySelector('nav button[data-path="/admin/management"]')).not.toBeNull();
    expect(root.querySelector("header")?.textContent).toContain("Sign out");
    expect(root.querySelector("nav")?.textContent).not.toContain("Sign out");
    root.querySelector<HTMLButtonElement>('nav button[data-path="/library"]')!.click();
    expect(window.location.pathname).toBe("/library");
  });

  it("renders tournament tiles with status colors and preserves actions", async () => {
    window.history.replaceState({}, "", "/tournaments");
    const item: TournamentListItem = {
      id: "00000000-0000-0000-0000-000000000001", name: "Open Cup", slug: "open",
      status: "active", phase: "ongoing", visibility: "public", language: "en",
      payment_type: "free", pricing_plans: [], registration_open: true, authors: [],
      type_key: "classic", type_version: 1, ruleset_key: "si", ruleset_version: 1,
      managed: false, policy_version: 1, available_actions: ["info"],
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => String(url) === "/api/website/session"
      ? response({ error: { code: "authentication_required" } }, 401)
      : response({ locale: "en", authorization: { allowed: true }, resource: {
        kind: "tournaments", state: "ready", role: "player", navigation_version: 1, total: 2,
        items: [item, { ...item, id: "00000000-0000-0000-0000-000000000002", name: "Closed Cup", phase: "past", visibility: "private", registration_open: false }],
      } }));
    const root = document.createElement("div");
    document.body.append(root);
    shell = new WebsiteShell(root, new ApiClient(fetcher), new Router());
    shell.start();
    await vi.waitFor(() => expect(root.querySelectorAll(".tournament-list > li")).toHaveLength(2));
    const cards = root.querySelectorAll(".tournament-card");
    expect(cards[0]!.querySelectorAll(".badge-success")).toHaveLength(2);
    expect(cards[1]!.querySelector(".badge-success")).toBeNull();
    expect(cards[1]!.querySelector(".badge-warning")).not.toBeNull();
    cards[0]!.querySelector<HTMLButtonElement>(".tournament-actions button")!.click();
    expect(window.location.pathname).toBe(`/tournaments/${item.id}`);
  });
});
