import type { TournamentProfileGame, TournamentProfileMatch, TournamentProfilePlayer, TournamentProfileResource } from "../api/types";
import type { I18n } from "../i18n";
import type { MessageKey } from "../i18n/en";
import { element } from "./dom";
import { sectionNavigation } from "./sections";

export interface TournamentProfileHandlers {
  openPlayer: (playerId: string) => void;
  openGame: (playerId: string, gameId: string) => void;
  selectSection?: (section: string) => void;
  section?: string;
}

type Section = "general" | "registrations" | "participants" | "games" | "leaders";
const sectionKeys: Record<Section, MessageKey> = {
  general: "tournament_profile.section_general",
  registrations: "tournament_profile.section_registrations",
  participants: "tournament_profile.section_participants",
  games: "tournament_profile.section_games",
  leaders: "tournament_profile.section_leaders",
};

function player(player: TournamentProfilePlayer, handlers: TournamentProfileHandlers): HTMLAnchorElement {
  const path = `/players/${encodeURIComponent(player.player_id)}`;
  return element("a", {
    href: path,
    onclick: ((event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      handlers.openPlayer(player.player_id);
    }) as EventListener,
  }, player.nickname);
}

function detail(label: string, value: string | null | undefined): HTMLElement | null {
  return value ? element("div", {}, element("dt", {}, label), element("dd", {}, value)) : null;
}

function stageName(kind: "first" | "playoff", i18n: I18n): string {
  return i18n.t(kind === "first" ? "tournament_profile.stage_first" : "tournament_profile.stage_playoff");
}

function gameCard(
  match: TournamentProfileMatch | TournamentProfileGame,
  title: string,
  i18n: I18n,
  formatDate: (value?: string | null) => string,
  handlers: TournamentProfileHandlers,
): HTMLElement {
  const participants = match.participants.length ? match.participants
    : "manual_results" in match && match.manual_results.length ? match.manual_results
      : "players" in match ? match.players : [];
  const gameId = "game_id" in match ? match.game_id : null;
  const examined = match.participants.find((item) => item.place !== null && item.place !== undefined);
  return element("article", { className: "resource-card tournament-game-card", "data-game-id": gameId ?? "" },
    element("h4", {}, title),
    match.played_at ? element("p", { className: "profile-game-date" }, formatDate(match.played_at)) : null,
    participants.length ? element("ul", { className: "game-participants" }, ...participants.map((item) =>
      element("li", { className: "game-participant" },
        element("span", { className: "game-participant-place" },
          "place" in item && item.place !== null ? String(item.place) : ""),
        player(item, handlers),
        element("span", { className: "game-participant-score" }, "score" in item ? String(item.score) : ""),
      ))) : element("p", { className: "field-help" }, i18n.t("tournament_profile.match_pending")),
    gameId && examined ? element("button", { type: "button", className: "secondary-button",
      onclick: (() => handlers.openGame(examined.player_id, gameId)) as EventListener,
    }, i18n.t("tournament_profile.open_game")) : null,
  );
}

function games(resource: TournamentProfileResource, i18n: I18n,
  formatDate: (value?: string | null) => string, handlers: TournamentProfileHandlers): HTMLElement {
  const panel = element("section", { className: "tournament-profile-section", id: "tournament-games" },
    element("h3", {}, i18n.t(sectionKeys.games)));
  if (resource.games.kind === "ladder") {
    panel.append(resource.games.items.length ? element("div", { className: "tournament-game-grid" },
      ...resource.games.items.map((game) => gameCard(game, formatDate(game.played_at), i18n, formatDate, handlers)))
      : element("p", { className: "field-help" }, i18n.t("tournament_profile.no_games")));
    return panel;
  }
  const stages = resource.games.stages.filter((stage) => stage.rounds.length);
  if (!stages.length) panel.append(element("p", { className: "field-help" }, i18n.t("tournament_profile.no_games")));
  for (const stage of stages) {
    const stagePanel = element("section", { className: "tournament-stage" },
      element("h4", {}, stageName(stage.kind, i18n)));
    const groups = stage.stage_type === "groups" && stage.kind === "first"
      ? stage.groups : [null];
    for (const group of groups) {
      const groupPanel = element("section", { className: "tournament-group" },
        group !== null ? element("h5", {}, `${i18n.t("tournament_profile.group")} ${group}`) : null);
      for (const round of stage.rounds) {
        const matches = group === null ? round.matches : round.matches.filter((match) => match.group === group);
        if (!matches.length) continue;
        groupPanel.append(element("section", { className: "tournament-round" },
          element("h6", {}, `${i18n.t("tournament_profile.round")} ${round.number}`),
          element("div", { className: "tournament-game-grid" },
            ...matches.map((match) => gameCard(match,
              `${i18n.t("tournament_profile.game")} ${match.number}`, i18n, formatDate, handlers))),
        ));
      }
      stagePanel.append(groupPanel);
    }
    panel.append(stagePanel);
  }
  return panel;
}

function leaders(resource: TournamentProfileResource, i18n: I18n, handlers: TournamentProfileHandlers): HTMLElement {
  const panel = element("section", { className: "tournament-profile-section", id: "tournament-leaders" },
    element("h3", {}, i18n.t(sectionKeys.leaders)));
  if (resource.leaders.kind === "ladder") {
    panel.append(resource.leaders.items.length ? element("ol", { className: "tournament-leaders" },
      ...resource.leaders.items.map((item) => element("li", {}, player(item, handlers),
        element("span", {}, String(item.rating)))))
      : element("p", { className: "field-help" }, i18n.t("tournament_profile.no_leaders")));
    return panel;
  }
  if (!resource.leaders.stages.length) panel.append(element("p", { className: "field-help" }, i18n.t("tournament_profile.no_leaders")));
  for (const stage of resource.leaders.stages) {
    const entries = stage.standings?.length ? stage.standings : stage.places ?? [];
    panel.append(element("section", { className: "tournament-stage" },
      element("h4", {}, stageName(stage.kind, i18n)),
      entries.length ? element("div", { className: "table-scroll" }, element("table", { className: "leader-table" },
        element("thead", {}, element("tr", {},
          ...["place", "participant", ...(stage.standings?.length ? ["points", "score"] : [])]
            .map((key) => element("th", { scope: "col" }, i18n.t(`tournament_profile.${key}` as MessageKey))),
          stage.stage_type === "swiss" ? element("th", { scope: "col" }, i18n.t("classic.opponent_place_sum")) : null)),
        element("tbody", {}, ...entries.map((item, index) => element("tr", {},
          element("th", { scope: "row" }, "place" in item ? item.place : String(index + 1)),
          element("td", {}, player(item, handlers)),
          "points" in item ? element("td", {}, item.points) : null,
          "score" in item ? element("td", {}, item.score) : null,
          stage.stage_type === "swiss" ? element("td", {}, "opponent_place_sum" in item ? item.opponent_place_sum ?? "—" : "—") : null,
        ))))) : element("p", { className: "field-help" }, i18n.t("tournament_profile.no_leaders")),
    ));
  }
  return panel;
}

export function renderTournamentProfile(resource: TournamentProfileResource, i18n: I18n,
  formatDate: (value?: string | null) => string, handlers: TournamentProfileHandlers): HTMLElement {
  const general = resource.general;
  const sections: Section[] = resource.type_key === "classic"
    ? ["general", "registrations", "participants", "games", "leaders"]
    : ["general", "registrations", "games", "leaders"];
  const registrationUrl = general.registration_link?.url;
  const safeRegistrationUrl = registrationUrl && /^https:\/\/t\.me\//.test(registrationUrl) ? registrationUrl : null;
  const localized = (key: string, fallback: string): string =>
    i18n.t(key as MessageKey) ?? fallback;
  const generalPanel = element("section", { className: "tournament-profile-section", id: "tournament-general" },
    element("h3", {}, i18n.t(sectionKeys.general)),
    general.description ? element("p", { className: "tournament-description" }, general.description) : null,
    element("dl", { className: "tournament-profile-details" },
      detail(i18n.t("tournament_profile.status"), localized(`tournament.status.${general.status}`, general.status)),
      detail(i18n.t("tournament_profile.type"), general.type?.name ?? resource.type_key),
      detail(i18n.t("tournament_profile.ruleset"), general.ruleset?.name),
      detail(i18n.t("tournament_profile.managers"), general.managers.map((item) => item.name).join(", ")),
      detail(i18n.t("tournament_profile.authors"), general.authors.join(", ")),
      detail(i18n.t("tournament_profile.organizer_contacts"), general.organizer_contacts),
      detail(i18n.t("tournament_profile.channel"), general.channel),
      detail(i18n.t("tournament_profile.language"), general.language),
      detail(i18n.t("tournament_profile.payment"), localized(`tournament.payment.${general.payment_type}`, general.payment_type)),
      detail(i18n.t("tournament_profile.visibility"), localized(`tournament.visibility.${general.visibility}`, general.visibility)),
      detail(i18n.t("tournament_profile.starts_at"), formatDate(general.starts_at)),
      detail(i18n.t("tournament_profile.ends_at"), formatDate(general.actual_ends_at ?? general.planned_ends_at)),
      detail(i18n.t("tournament_profile.registration_window"),
        `${general.registration.open ? i18n.t("tournament_profile.registration_open") : i18n.t("tournament_profile.registration_closed")}` +
        (general.registration.starts_at || general.registration.ends_at
          ? ` · ${general.registration.starts_at ? formatDate(general.registration.starts_at) : "…"} – ` +
            `${general.registration.ends_at ? formatDate(general.registration.ends_at) : "…"}` : "")),
      detail(i18n.t("tournament_profile.counts"), `${general.registration_count} / ${general.participant_count}`),
    ),
    safeRegistrationUrl ? element("a", { href: safeRegistrationUrl, target: "_blank", rel: "noopener noreferrer" },
      i18n.t("tournament_profile.registration_link")) : null,
  );
  const registrationsPanel = element("section", { className: "tournament-profile-section", id: "tournament-registrations" },
    element("h3", {}, i18n.t(sectionKeys.registrations)),
    resource.registrations.length ? element("ul", { className: "tournament-registrations" },
      ...resource.registrations.map((item) => element("li", {}, player(item, handlers),
        element("span", { className: "badge" }, i18n.t(({
          invited: "tournament_profile.status_invited", registered: "tournament_profile.status_registered",
          approved: "tournament_profile.status_approved", active: "tournament_profile.status_active",
          rejected: "tournament_profile.status_rejected",
        } as Record<string, MessageKey>)[item.status] ?? "tournament_profile.status_other")),
        item.registered_at ? element("time", {}, formatDate(item.registered_at)) : null)))
      : element("p", { className: "field-help" }, i18n.t("tournament_profile.no_registrations")));
  const participantsPanel = element("section", { className: "tournament-profile-section", id: "tournament-participants" },
    element("h3", {}, i18n.t(sectionKeys.participants)),
    resource.participants?.length ? element("ul", { className: "tournament-registrations" },
      ...resource.participants.map((item) => element("li", {}, player(item, handlers))))
      : element("p", { className: "field-help" }, i18n.t("tournament_profile.no_participants")));
  const panels: Record<Section, HTMLElement> = {
    general: generalPanel, registrations: registrationsPanel, participants: participantsPanel,
    games: games(resource, i18n, formatDate, handlers), leaders: leaders(resource, i18n, handlers),
  };
  return element("section", { className: "route-content tournament-profile" },
    element("h2", { className: "tournament-name" }, general.name),
    sectionNavigation(i18n.t("route.tournament_profile.title"), sections.map(key => ({
      key, label: i18n.t(sectionKeys[key]), panel: panels[key],
    })), handlers.section, handlers.selectSection),
    element("div", { className: "tournament-profile-layout" }, ...sections.map((section) => panels[section])),
  );
}
