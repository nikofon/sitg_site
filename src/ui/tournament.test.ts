import { describe, expect, it, vi } from "vitest";
import type { TournamentProfileResource } from "../api/types";
import { I18n } from "../i18n";
import { renderTournamentProfile } from "./tournament";

const playerId = "00000000-0000-0000-0000-000000000001";
const gameId = "00000000-0000-0000-0000-000000000002";

const resource: TournamentProfileResource = {
  kind: "tournament_profile", state: "ready", type_key: "classic",
  tournament: { id: gameId, name: "Example", slug: "example" },
  general: {
    name: "Example <script>", slug: "example", description: "Description", status: "active",
    moderation_status: "active", visibility: "public", language: "en", payment_type: "free",
    type: null, ruleset: null, registration: { open: true },
    managers: [], authors: [], registration_count: 1, participant_count: 1,
  },
  registrations: [{ player_id: playerId, nickname: "Player", status: "active" }],
  participants: [{ player_id: playerId, nickname: "Player" }],
  games: { kind: "classic", stages: [{
    kind: "first", stage_type: "groups", scheme_key: null, groups: [1, 2],
    rounds: [1, 2].map((number) => ({ number, matches: [1, 2].map((group) => ({
      id: `${group}-${number}`, group, number, game_id: gameId,
      participants: [{ player_id: playerId, nickname: "Player", score: 10, place: 1 }],
      players: [], manual_results: [],
    })) })),
  }, {
    kind: "playoff", stage_type: "playoff", scheme_key: null, groups: [],
    rounds: [1, 2].map((number) => ({ number, matches: [{
      id: `playoff-${number}`, group: 1, number, game_id: null,
      participants: [], players: [{ player_id: playerId, nickname: "Player" }], manual_results: [],
    }] })),
  }] },
  leaders: { kind: "classic", stages: [{ kind: "first", standings: [{ player_id: playerId, nickname: "Player", points: "2", score: "10" }] }] },
};

describe("desktop tournament profile", () => {
  it("shows organizer details and the Swiss tie breaker", () => {
    const root = renderTournamentProfile({ ...resource,
      general: { ...resource.general, organizer_contacts: "Organizer <script>", channel: "@cup" },
      leaders: { kind: "classic", stages: [{ kind: "first", stage_type: "swiss", standings: [
        { player_id: playerId, nickname: "Player", points: "4", score: "100", opponent_place_sum: "7" },
      ] }] },
    }, new I18n("en"), () => "—", { openPlayer: vi.fn(), openGame: vi.fn() });
    expect(root.querySelector("#tournament-general")?.textContent).toContain("Organizer <script>");
    expect(root.querySelector("#tournament-general")?.textContent).toContain("@cup");
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("#tournament-leaders")?.textContent).toContain("Sum of opponents’ places");
    expect(root.querySelector("#tournament-leaders td:last-child")?.textContent).toBe("7");
  });

  it("shows every group and round, safely renders names, and opens settled games", () => {
    const openGame = vi.fn();
    const root = renderTournamentProfile(resource, new I18n("en"), (value) => value ?? "—", {
      openPlayer: vi.fn(), openGame,
    });
    document.body.append(root);
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelectorAll(".tournament-profile-layout > section:not([hidden])")).toHaveLength(1);
    expect(root.querySelector<HTMLElement>("#tournament-general")!.hidden).toBe(false);
    const gamesButton = root.querySelector<HTMLButtonElement>('[aria-controls="tournament-games"]')!;
    gamesButton.click();
    expect(gamesButton.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector<HTMLElement>("#tournament-general")!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>("#tournament-games")!.hidden).toBe(false);
    expect(root.querySelectorAll(".tournament-profile-layout > section:not([hidden])")).toHaveLength(1);
    expect(root.querySelectorAll(".tournament-stage")).toHaveLength(3);
    expect(root.querySelectorAll(".tournament-round")).toHaveLength(6);
    expect(root.querySelectorAll(".tournament-game-card")).toHaveLength(6);
    expect(root.querySelector(".pagination")).toBeNull();
    root.querySelector<HTMLButtonElement>(".tournament-game-card button")!.click();
    expect(openGame).toHaveBeenCalledWith(playerId, gameId);
    root.remove();
  });

  it("opens the requested section and falls back for sections unavailable to the tournament type", () => {
    const handlers = { openPlayer: vi.fn(), openGame: vi.fn(), section: "leaders" };
    const render = (value: typeof resource) => renderTournamentProfile(value, new I18n("en"), () => "—", handlers);
    expect(render(resource).querySelector<HTMLElement>("#tournament-leaders")!.hidden).toBe(false);
    handlers.section = "participants";
    expect(render({ ...resource, type_key: "ladder" }).querySelector<HTMLElement>("#tournament-general")!.hidden).toBe(false);
  });
});
