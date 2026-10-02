import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./api/client";
import { WebsiteShell } from "./app";
import { Router } from "./routing/router";

const playerId = "00000000-0000-0000-0000-000000000001";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
let shell: WebsiteShell;
afterEach(() => { shell?.stop(); document.body.replaceChildren(); sessionStorage.clear(); vi.restoreAllMocks(); });

function start(path: string, resource: object, mutation = (_url: string, _options?: RequestInit) => json(resource)) {
  window.history.replaceState({}, "", path);
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    if (String(url) === "/api/website/session") return json({ csrf_token: "csrf-test", expires_at: "2099-01-01", locale: "en",
      viewer: { player_id: playerId, is_admin: true, is_manager: true, registration_status: "active" } });
    if (options?.method === "POST") return mutation(String(url), options);
    return json({ locale: "en", authorization: { allowed: true }, resource });
  });
  const root = document.createElement("div"); document.body.append(root);
  shell = new WebsiteShell(root, new ApiClient(fetcher), new Router()); shell.start();
  return { root, fetcher };
}
const button = (root: ParentNode, text: string) => [...root.querySelectorAll("button")].find(item => item.textContent === text)!;
const settings = () => ({
  kind: "manager_settings", state: "ready", settings_version: 4, finalized_at: "2026-09-01",
  available_actions: ["update_metadata"], policies: {}, default_parameters: {},
  player_mutable_parameters: [], author_names: [], authors: [], registration_requirements: [],
  type_options: ["classic"], ruleset_options: ["si"], registration_enabled: false,
  ignore_late_registrations: true, packet_assignment_count: 0, membership_count: 64,
  manager_count: 1, classic: { stages: [], schemes: [], players: [] },
  tournament: { id: "cup", name: "Cup", slug: "cup", description: "", status: "active",
    type_key: "classic", ruleset_key: "si", visibility: "public", language: "en",
    payment_type: "free", pricing_plans: [], authors: [] },
});

describe("website feature integrations", () => {
  it.each([false, true])("preserves rejected-answer lists in packet saves (published=%s)", async (published) => {
    const resource = {
      kind: "packet_draft", state: "ready", draft_id: "draft", version: 2,
      assignment_id: published ? "assignment" : undefined,
      status: "awaiting_confirmation", source_filename: "packet.json", ruleset_key: "si", ruleset_version: 1,
      errors: [], warnings: [], can_publish: true, can_reject: true,
      packet: { name: "Packet", language: "en", lead_author: "Ada", year: 2026,
        themes: [{ name: "Theme", author: "Ada", questions: [{ value: 10, form: "", text: "Question",
          answer: "Correct", accepted_answers: [], rejected_answers: ["Old"], commentary: "", source: "", author: "Ada" }] }] },
      editor: { schema: "si.packet.v1", page_collection: "themes", packet_fields: ["name"],
        theme_fields: ["name"], question_fields: ["rejected_answers"], question_values: [10] },
    };
    const mutations: unknown[] = [];
    const { root } = start("/manager/packets/ref/edit", resource, (url, options) => {
      expect(url).toBe(published ? "/api/miniapp/manager/tournaments/ref/packets/assignment/save" : "/api/miniapp/manager/packets/ref");
      mutations.push(JSON.parse(String(options?.body)));
      return json(published ? { kind: "manager_management", state: "ready", sections: [],
        available_actions: [], tournament: { id: "cup", status: "active", type_key: "ladder" },
        registrations: [], packets: [] } : resource);
    });
    await vi.waitFor(() => expect(root.querySelector('[data-question-field="rejected_answers"]')).not.toBeNull());
    const answers = root.querySelector<HTMLTextAreaElement>('[data-question-field="rejected_answers"]')!;
    expect(answers.value).toBe("Old"); expect(answers.disabled).toBe(published);
    if (published) answers.closest("label")!.querySelector<HTMLButtonElement>(".is-substitution")!.click();
    answers.value = "Wrong one\nWrong two";
    root.querySelector("form.packet-editor")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(mutations).toHaveLength(1));
    expect(mutations[0]).toMatchObject({ expected_version: 2, content: { themes: [{ questions: [
      { rejected_answers: ["Wrong one", "Wrong two"] },
    ] }] }, ...(published ? { changes: { "themes.0.questions.0.rejected_answers": "substitution" } } : {}) });
  });

  it("opens the author catalogue from desktop navigation and restores its filters", async () => {
    const { root } = start("/authors", { kind: "authors", state: "ready", items: [
      { id: playerId, display_name: "Ada <script>", tournament_count: 2, question_count: 10 },
      { id: "00000000-0000-0000-0000-000000000002", display_name: "Bob", tournament_count: 1, question_count: 20 },
    ] });
    await vi.waitFor(() => expect(root.querySelectorAll("[data-author-id]")).toHaveLength(2));
    expect(root.querySelector('nav button[data-path="/authors"]')?.getAttribute("aria-current")).toBe("page");
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = "ada"; search.dispatchEvent(new Event("input"));
    expect(root.querySelectorAll("[data-author-id]")).toHaveLength(1);
    expect(root.querySelector("script")).toBeNull();
    root.querySelector<HTMLAnchorElement>("[data-author-id] a")!.click();
    expect(window.location.pathname).toBe(`/authors/${playerId}`);
    root.querySelector<HTMLButtonElement>('nav button[data-path="/authors"]')!.click();
    await vi.waitFor(() => expect(root.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("ada"));
    expect(root.querySelectorAll("[data-author-id]")).toHaveLength(1);
  });

  it("saves Swiss configuration through the versioned Classic endpoint", async () => {
    const resource = settings();
    const mutations: unknown[] = [];
    const { root } = start("/manager/tournaments/ref/settings", resource, (url, options) => {
      expect(url).toBe("/api/miniapp/manager/tournaments/ref/classic");
      mutations.push(JSON.parse(String(options?.body))); return json(resource);
    });
    await vi.waitFor(() => expect(root.querySelector(".classic-settings")).not.toBeNull());
    const first = root.querySelector<HTMLFieldSetElement>(".classic-settings fieldset")!;
    const type = first.querySelector<HTMLSelectElement>("select")!;
    type.value = "swiss"; type.dispatchEvent(new Event("change"));
    const field = (label: string) => [...first.querySelectorAll("label")].find(item => item.textContent === label)!.querySelector<HTMLInputElement>("input")!;
    field("Rounds").value = "8"; field("Players per game").value = "3";
    first.querySelector<HTMLButtonElement>("button")!.click();
    await vi.waitFor(() => expect(mutations).toHaveLength(1));
    expect(mutations[0]).toMatchObject({ expected_version: 4, command: "configure", kind: "first",
      values: { stage_type: "swiss", round_count: 8, players_per_game: 3 } });
  });

  it("saves contacts, registration requirements, and all-themes settings with CSRF and idempotency", async () => {
    const resource = { ...settings(), classic: null,
      tournament: { ...settings().tournament, type_key: "ladder" },
      setting_descriptors: [{ name: "theme_count", value: 3, value_type: "integer", description_key: "setting.theme_count.label", options: [] }],
      policy_descriptors: [],
      registration_requirements: [{ kind: "has-played-tournament", target_id: playerId, target_name: "Qualifier", failure_message: "Play first" }],
    };
    const mutations: unknown[] = [];
    const { root } = start("/manager/tournaments/ref/settings", resource, (url, options) => {
      expect(url).toBe("/api/miniapp/manager/tournaments/ref/settings");
      const headers = new Headers(options?.headers);
      expect(headers.get("X-CSRF-Token")).toBe("csrf-test");
      expect(headers.get("X-Idempotency-Key")).toBeTruthy();
      mutations.push(JSON.parse(String(options?.body))); return json(resource);
    });
    await vi.waitFor(() => expect(root.querySelector('[name="organizer_contacts"]')).not.toBeNull());
    root.querySelector<HTMLTextAreaElement>('[name="organizer_contacts"]')!.value = "Contact organizer";
    root.querySelector<HTMLInputElement>('[name="channel"]')!.value = "@cup";
    root.querySelector<HTMLInputElement>('[name="setting:theme_count:max"]')!.click();
    root.querySelector<HTMLFormElement>("form.settings-form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(mutations).toHaveLength(1));
    expect(mutations[0]).toMatchObject({ expected_version: 4,
      organizer_contacts: "Contact organizer", channel: "@cup", default_parameters: { theme_count: "max" },
      registration_requirements: [{ kind: "has-played-tournament", target_id: playerId, failure_message: "Play first" }],
    });
  });

  it("creates and assigns subscriptions with the latest version and reloads stale state", async () => {
    const resource = {
      kind: "manager_management", state: "ready", settings_version: 4,
      sections: ["subscriptions"], available_actions: ["subscriptions"],
      tournament: { id: "cup", type_key: "ladder", status: "active" },
      registrations: [], packets: [], registered_count: 0, approved_count: 0, participant_count: 1, packet_count: 0,
      subscriptions: { cards: [{ id: "card", name: "Yearly", packet_count: 12, readable: null, playable: true, discoverable: true }],
        players: [{ id: playerId, name: "Ada", active: true }], instances: [] },
    };
    const mutations: unknown[] = [];
    const { root, fetcher } = start("/manager/tournaments/ref/management", resource, (url, options) => {
      expect(url).toBe("/api/miniapp/manager/tournaments/ref/subscriptions");
      mutations.push(JSON.parse(String(options?.body))); resource.settings_version += 1;
      return mutations.length === 2 ? json({ error: { code: "stale_write" } }, 409) : json(resource);
    });
    await vi.waitFor(() => expect(root.querySelector(".subscription-regions")).not.toBeNull());
    root.querySelector<HTMLInputElement>('[aria-label="Subscription card name"]')!.value = "New card";
    root.querySelector(".subscription-regions form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(mutations).toHaveLength(1));
    await vi.waitFor(() => expect(root.querySelector<HTMLInputElement>('[aria-label="Subscription card name"]')!.value).toBe(""));
    const picker = root.querySelector<HTMLSelectElement>('[aria-label="Participant"]')!;
    picker.value = playerId; picker.dispatchEvent(new Event("change"));
    button(root, "Assign subscription card").click();
    await vi.waitFor(() => expect(mutations).toHaveLength(2));
    expect(mutations).toEqual([
      { expected_version: 4, command: "create", values: { name: "New card", packet_count: 1, discoverable: null, readable: null, playable: null } },
      { expected_version: 5, command: "assign", values: { card_id: "card", player_id: playerId } },
    ]);
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/routes/resolve"))).toHaveLength(2));
    await vi.waitFor(() => expect(root.querySelector<HTMLSelectElement>('[aria-label="Participant"]')?.value).toBe(playerId));
  });

  it("saves admin rating weight only after explicit confirmation", async () => {
    const resource = { kind: "admin_management", state: "ready", section: "tournaments", items: [
      { id: "cup", name: "Cup", moderation_status: "normal", settings_version: 7, settings: { policies: { ruleset_rating_weight: 1 } } },
    ] };
    const mutations: unknown[] = [];
    const { root } = start("/admin/management", resource, (url, options) => {
      expect(url).toBe("/api/miniapp/admin/management/tournaments/cup/rating_weight");
      mutations.push(JSON.parse(String(options?.body))); return json({});
    });
    await vi.waitFor(() => expect(root.querySelector('input[type="range"]')).not.toBeNull());
    const slider = root.querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.value = "0.5"; slider.dispatchEvent(new Event("input"));
    expect(mutations).toHaveLength(0);
    button(root, "V").click();
    await vi.waitFor(() => expect(mutations).toEqual([{ weight: 0.5, expected_version: 7 }]));
  });
});
