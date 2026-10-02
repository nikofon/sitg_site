import type {
  PlayerGameResource,
  PlayerGameTheme,
  PlayerPlacementKind,
  PlayerProfileGame,
  PlayerProfileGameParticipant,
  PlayerProfileResource,
} from "../api/types";
import type { I18n } from "../i18n";
import type { MessageKey } from "../i18n/en";
import { element } from "./dom";
import { sectionNavigation } from "./sections";

export interface ProfileHandlers {
  selectRuleset: (key: string) => void;
  openPlayer: (playerId: string) => void;
  openGame: (gameId: string) => void;
  section?: string;
  selectSection?: (section: string) => void;
}

export interface GameHandlers {
  back: () => void;
  openPlayer: (playerId: string) => void;
}

const PLACEMENT_LABELS: Record<PlayerPlacementKind, MessageKey> = {
  place_1: "profile.place_1",
  place_1_5: "profile.place_1_5",
  place_2: "profile.place_2",
  place_2_5: "profile.place_2_5",
  place_3: "profile.place_3",
  place_3_5: "profile.place_3_5",
  place_4: "profile.place_4",
  draw: "profile.draw",
  below_4: "profile.below_4",
};

function displayName(
  participant: Pick<PlayerProfileGameParticipant, "nickname" | "player_id">,
  i18n: I18n,
): string {
  return participant.nickname ?? `${i18n.t("profile.player")} ${participant.player_id.slice(0, 8)}`;
}

function playerAnchor(
  participant: Pick<PlayerProfileGameParticipant, "nickname" | "player_id">,
  i18n: I18n,
  openPlayer: (playerId: string) => void,
): HTMLElement {
  return element(
    "a",
    {
      href: `/players/${encodeURIComponent(participant.player_id)}`,
      onclick: ((event: Event) => {
        event.preventDefault();
        openPlayer(participant.player_id);
      }) as EventListener,
    },
    displayName(participant, i18n),
  );
}

function formatPlace(place: number | null): string {
  if (place === null) return "—";
  return Number.isInteger(place) ? String(place) : String(place);
}

function ratingGraph(
  history: Array<{ rating: number; played_at: string }>,
  i18n: I18n,
): SVGSVGElement | null {
  const series = history.map(point => ({ ...point, time: Date.parse(point.played_at) }))
    .filter(point => Number.isFinite(point.time) && Number.isFinite(point.rating))
    .sort((a, b) => a.time - b.time);
  if (series.length < 2) return null;
  const width = 360;
  const height = 190;
  const left = 58;
  const right = width - 12;
  const top = 12;
  const bottom = height - 44;
  const values = series.map(point => point.rating);
  const minimum = Math.floor(Math.min(...values)) - 1;
  const maximum = Math.ceil(Math.max(...values)) + 1;
  const start = series[0]!.time;
  const end = series[series.length - 1]!.time;
  const x = (time: number): number => end === start ? (left + right) / 2
    : left + (time - start) / (end - start) * (right - left);
  const y = (rating: number): number => bottom - (rating - minimum) / (maximum - minimum) * (bottom - top);
  const dateFormat = new Intl.DateTimeFormat(i18n.locale, { day: "numeric", month: "short", year: "2-digit" });
  const timeFormat = new Intl.DateTimeFormat(i18n.locale, { hour: "2-digit", minute: "2-digit" });
  const ratingFormat = new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 });
  const svgNode = (tag: string, attributes: Record<string, string | number>, text?: string): SVGElement => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "rating-graph");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `${i18n.t("profile.rating_history")}: ${series.map(point =>
      `${dateFormat.format(point.time)} ${timeFormat.format(point.time)}: ${ratingFormat.format(point.rating)}`).join(" → ")}`,
  );
  for (const value of [minimum, (minimum + maximum) / 2, maximum]) {
    svg.append(
      svgNode("line", { x1: left, x2: right, y1: y(value), y2: y(value), class: "rating-graph-grid" }),
      svgNode("text", { x: left - 8, y: y(value), "text-anchor": "end", "dominant-baseline": "middle",
        class: "rating-graph-label rating-graph-y-label" }, ratingFormat.format(value)),
    );
  }
  svg.append(svgNode("path", { d: `M ${left} ${top} V ${bottom} H ${right}`, class: "rating-graph-axis" }));
  const times = end === start ? [start] : [start, start + (end - start) / 2, end];
  times.forEach((time, index) => {
    const anchor = times.length === 1 ? "middle" : index === 0 ? "start" : index === times.length - 1 ? "end" : "middle";
    svg.append(
      svgNode("line", { x1: x(time), x2: x(time), y1: bottom, y2: bottom + 4, class: "rating-graph-axis" }),
      svgNode("text", { x: x(time), y: bottom + 18, "text-anchor": anchor,
        class: "rating-graph-label rating-graph-x-label" }, dateFormat.format(time)),
    );
    if (end - start < 2 * 24 * 60 * 60 * 1000) {
      svg.append(svgNode("text", { x: x(time), y: bottom + 33, "text-anchor": anchor,
        class: "rating-graph-label rating-graph-time-label" }, timeFormat.format(time)));
    }
  });
  const points = series.map(point => `${x(point.time).toFixed(1)},${y(point.rating).toFixed(1)}`).join(" ");
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("class", "rating-graph-line");
  svg.append(polyline);
  return svg;
}

function participantRows(
  game: Pick<PlayerProfileGame, "participants">,
  i18n: I18n,
  openPlayer: (playerId: string) => void,
): HTMLElement {
  return element(
    "ul",
    { className: "game-participants" },
    ...game.participants.map((participant) =>
      element(
        "li",
        { className: "game-participant" },
        element("span", { className: "game-participant-place" }, formatPlace(participant.place)),
        element("span", { className: "game-participant-identity" },
          playerAnchor(participant, i18n, openPlayer),
          element("span", { className: "game-participant-ratings", title: i18n.t("profile.ratings_after_game") },
            element("span", {}, `${i18n.t("profile.global_rating")}: ${formatRating(participant.global_rating_after, i18n)}`),
            participant.tournament_rating_after != null
              ? element("span", {}, `${i18n.t("profile.tournament_rating")}: ${formatRating(participant.tournament_rating_after, i18n)}`)
              : null)),
        element("span", { className: "game-participant-score" }, String(participant.score)),
      ),
    ),
  );
}

function formatRating(value: number | null | undefined, i18n: I18n): string {
  return value != null && Number.isFinite(value)
    ? value.toLocaleString(i18n.locale, { maximumFractionDigits: 1 }) : "—";
}

function gamePackets(game: Pick<PlayerProfileGame, "packets">, i18n: I18n): HTMLElement {
  return element("p", { className: "profile-game-packets" },
    element("strong", {}, `${i18n.t("profile.packets")}: `),
    game.packets == null ? i18n.t("profile.packets_unavailable")
      : game.packets.length ? game.packets.map(packet => packet.name ?? i18n.t("profile.packets_unavailable")).join(", ")
        : i18n.t("profile.no_packets"));
}

export function renderPlayerProfile(
  resource: PlayerProfileResource,
  i18n: I18n,
  formatDate: (value?: string | null) => string,
  handlers: ProfileHandlers,
): HTMLElement {
  const player = resource.player;
  const heading = element(
    "h2",
    { className: "profile-name" },
    player.nickname ?? `${i18n.t("profile.player")} ${player.id.slice(0, 8)}`,
  );
  const identity = element("p", { className: "profile-identity" });
  if (player.real_name) identity.append(element("span", {}, `${i18n.t("profile.real_name")}: ${player.real_name}`));
  if (player.telegram_username) {
    identity.append(
      element("span", {}, `${i18n.t("profile.telegram")}: @${player.telegram_username}`),
    );
  }
  const controls = element("div", { className: "profile-controls" });
  if (resource.rulesets.length) {
    const select = element(
      "select",
      {
        className: "profile-ruleset-select",
        "aria-label": i18n.t("profile.ruleset"),
        onchange: ((event: Event) => {
          const target = event.currentTarget as HTMLSelectElement;
          handlers.selectRuleset(target.value);
        }) as EventListener,
      },
      ...resource.rulesets.map((ruleset) =>
        element("option", { value: ruleset.key }, ruleset.name),
      ),
    );
    if (resource.ruleset_key) select.value = resource.ruleset_key;
    controls.append(element("label", {}, `${i18n.t("profile.ruleset")}: `, select));
  }

  const rating = element(
    "section",
    { className: "profile-section profile-rating" },
    element("h3", {}, i18n.t("profile.rating")),
    element("p", { className: "profile-rating-value" }, String(Math.round(resource.rating.value))),
  );
  const graph = ratingGraph(resource.rating.history, i18n);
  if (graph) rating.append(graph);

  const stats = element("section", { className: "profile-section profile-stats" }, element("h3", {}, i18n.t("profile.win_rate")));
  const summary = element("dl", { className: "profile-stats-summary" });
  for (const [label, value] of [
    [i18n.t("profile.games"), String(resource.stats.games)],
    [i18n.t("profile.wins"), String(resource.stats.wins)],
    [i18n.t("profile.win_rate"), `${resource.stats.win_rate}%`],
  ] as const) {
    summary.append(
      element("div", { className: "profile-stat" }, element("dt", {}, label), element("dd", {}, value)),
    );
  }
  stats.append(summary);
  if (resource.stats.games) {
    stats.append(
      element(
        "ul",
        { className: "profile-distribution" },
        ...resource.stats.placements.map((placement) =>
          element(
            "li",
            { className: "profile-distribution-row" },
            element("span", { className: "profile-distribution-label" }, i18n.t(PLACEMENT_LABELS[placement.kind])),
            element(
              "span",
              {
                className: "profile-distribution-bar",
                "aria-hidden": "true",
              },
              element("span", {
                className: "profile-distribution-fill",
                style: `width:${Math.min(100, placement.percent)}%`,
              }),
            ),
            element(
              "span",
              { className: "profile-distribution-value" },
              `${placement.percent}% · ${placement.count}`,
            ),
          ),
        ),
      ),
    );
  }

  const general = element("div", { id: "player-general", className: "profile-general" },
    identity.childElementCount ? identity : null, rating, stats);
  const content = element(
    "section",
    { className: "route-content profile" },
    heading,
    controls,
  );
  if (resource.si_question_stats?.length) {
    const table = element(
      "table",
      { className: "profile-question-stats" },
      element(
        "thead",
        {},
        element(
          "tr",
          {},
          element("th", { scope: "col" }, i18n.t("profile.question_value")),
          element("th", { scope: "col" }, i18n.t("profile.correct")),
          element("th", { scope: "col" }, i18n.t("profile.incorrect")),
        ),
      ),
      element(
        "tbody",
        {},
        ...resource.si_question_stats.map((stat) =>
          element(
            "tr",
            {},
            element("th", { scope: "row" }, String(stat.value)),
            element("td", { className: "answer-correct-text" }, String(stat.correct)),
            element("td", { className: "answer-incorrect-text" }, String(stat.incorrect)),
          ),
        ),
      ),
    );
    general.append(
      element("section", { className: "profile-section" }, element("h3", {}, i18n.t("profile.question_stats")),
        element("div", { className: "table-scroll" }, table)),
    );
  }

  if (resource.ruleset_key === "si") {
    const si = resource.si_statistics;
    const number = (value: number | null | undefined): string =>
      value !== null && value !== undefined && Number.isFinite(value)
        ? value.toLocaleString(i18n.locale, { maximumFractionDigits: 2 }) : "—";
    general.append(element("section", { className: "profile-section profile-si-statistics" },
      element("h3", {}, i18n.t("profile.si_statistics")),
      element("dl", { className: "profile-stats-summary" },
        element("div", { className: "profile-stat" },
          element("dt", {}, i18n.t("profile.average_score")),
          element("dd", {}, number(si?.average_normalized_score)))),
      element("p", { className: "field-help" }, i18n.t("profile.normalized_score_help")),
      element("div", { className: "table-scroll" }, element("table", { className: "profile-question-stats" },
        element("thead", {}, element("tr", {},
          element("th", { scope: "col" }, i18n.t("profile.question_value")),
          element("th", { scope: "col" }, i18n.t("profile.average_buzz")),
          element("th", { scope: "col" }, i18n.t("profile.buzz_samples")))),
        element("tbody", {}, ...[10, 20, 30, 40, 50].map(value => {
          const buzz = si?.buzz_times.find(item => item.value === value);
          return element("tr", {}, element("th", { scope: "row" }, String(value)),
            element("td", {}, number(buzz?.samples ? buzz.average_seconds : null)),
            element("td", {}, number(buzz?.samples)));
        })))),
      element("p", { className: "field-help" }, i18n.t(si ? "profile.buzz_help" : "profile.statistics_unavailable")),
    ));
  }

  const search = element("input", { type: "search", "aria-label": i18n.t("profile.history_search") });
  const playerCount = element("select", { "aria-label": i18n.t("profile.player_count") },
    element("option", { value: "any" }, i18n.t("profile.any_players")),
    ...["1", "2", "3", "4", "5+"].map(value => element("option", { value }, value)));
  const order = element("select", { "aria-label": i18n.t("filters.order") },
    ...(["date_desc", "date_asc", "name_asc", "name_desc", "players_desc", "players_asc"] as const)
      .map(key => element("option", { value: key }, i18n.t(`profile.${key}`))));
  const count = element("p", { className: "field-help", "aria-live": "polite" });
  const gamesList = element(
    "ul",
    { className: "resource-list profile-games" },
  );
  const renderGames = (): void => {
    const query = search.value.trim().toLocaleLowerCase();
    const name = (game: PlayerProfileGame): string => game.tournament_name ?? i18n.t("profile.private_tournament");
    const games = resource.games.filter(game =>
      name(game).toLocaleLowerCase().includes(query) &&
      (playerCount.value === "any" || (playerCount.value === "5+"
        ? game.participants.length >= 5 : game.participants.length === Number(playerCount.value))));
    games.sort((a, b) => {
      const direction = order.value.endsWith("asc") ? 1 : -1;
      if (order.value.startsWith("name")) return direction * name(a).localeCompare(name(b));
      if (order.value.startsWith("players")) return direction * (a.participants.length - b.participants.length);
      const aTime = a.played_at ? Date.parse(a.played_at) : NaN;
      const bTime = b.played_at ? Date.parse(b.played_at) : NaN;
      if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0;
      if (!Number.isFinite(bTime)) return -1;
      return direction * (aTime - bTime);
    });
    count.textContent = `${games.length} / ${resource.games.length}`;
    gamesList.replaceChildren(...games.map((game) =>
      element(
        "li",
        {},
        element(
          "article",
          { className: "resource-card profile-game-card", "data-game-id": game.game_id },
          element(
            "h3",
            {},
            game.tournament_name ?? i18n.t("profile.private_tournament"),
          ),
          game.stage
            ? element("p", { className: "profile-game-stage" }, `${i18n.t("profile.stage")}: ${game.stage}`)
            : null,
          element("p", { className: "profile-game-date" }, formatDate(game.played_at)),
          gamePackets(game, i18n),
          element("p", { className: "field-help" }, `${i18n.t("profile.participants")}: ${game.participants.length}`),
          participantRows(game, i18n, handlers.openPlayer),
          element(
            "div",
            { className: "settings-actions" },
            element(
              "button",
              {
                type: "button",
                className: "primary-button",
                onclick: (() => handlers.openGame(game.game_id)) as EventListener,
              },
              i18n.t("profile.details"),
            ),
          ),
        ),
      ),
    ));
    if (!games.length) gamesList.append(element("li", { className: "field-help" },
      i18n.t(resource.games.length ? "profile.no_matches" : "profile.no_games")));
  };
  search.addEventListener("input", renderGames);
  playerCount.addEventListener("change", renderGames);
  order.addEventListener("change", renderGames);
  renderGames();
  const history = element("section", { id: "player-history", className: "profile-section" },
    element("h3", {}, i18n.t("profile.game_history")),
    element("p", { className: "field-help" }, i18n.t("profile.history_scope")),
    element("div", { className: "filters" },
      element("label", {}, i18n.t("profile.history_search"), search),
      element("label", {}, i18n.t("profile.player_count"), playerCount),
      element("label", {}, i18n.t("filters.order"), order)), count, gamesList);
  content.append(sectionNavigation(i18n.t("route.player_profile.title"), [
    { key: "general", label: i18n.t("profile.general"), panel: general },
    { key: "history", label: i18n.t("profile.game_history"), panel: history },
  ], handlers.section, handlers.selectSection), general, history);
  return content;
}

function themeGrid(
  themes: PlayerGameTheme[],
  participants: PlayerProfileGameParticipant[],
  i18n: I18n,
  openPlayer: (playerId: string) => void,
): HTMLElement {
  const groups = element("tr", {},
    element("th", { scope: "col", rowspan: "2", className: "result-player" }, i18n.t("profile.participants")),
    element("th", { scope: "col", rowspan: "2" }, i18n.t("tournament_profile.place")),
    element("th", { scope: "col", rowspan: "2" }, i18n.t("tournament_profile.score")));
  const head = element("tr");
  for (const theme of themes) {
    if (!theme.questions.length) continue;
    groups.append(element("th", { scope: "colgroup", colspan: String(theme.questions.length), className: "theme-start" },
      `${i18n.t("profile.theme")} ${theme.index}`));
    theme.questions.forEach((question, index) => head.append(element("th", {
      scope: "col", className: index === 0 ? "theme-start" : "",
    }, String(question.value))));
  }
  const body = element("tbody");
  const questions = themes.flatMap(theme => theme.questions.map((question, index) => ({ question, first: index === 0 })));
  for (const participant of participants) {
    const row = element("tr", {}, element("th", { scope: "row", className: "result-player" }, playerAnchor(participant, i18n, openPlayer)),
      element("td", {}, formatPlace(participant.place)), element("td", {}, String(participant.score)));
    for (const { question, first } of questions) {
      const status = question.answers[participant.participant_id];
      row.append(
        element(
          "td",
          { className: `answer-cell${first ? " theme-start" : ""}` },
          element("span", {
            className:
              status === "correct"
                ? "answer-mark answer-correct"
                : status === "incorrect"
                  ? "answer-mark answer-incorrect"
                  : "answer-mark answer-none",
            title:
              status === "correct"
                ? i18n.t("profile.correct")
                : status === "incorrect"
                  ? i18n.t("profile.incorrect")
                  : i18n.t("profile.no_answer"),
            "aria-label":
              status === "correct"
                ? i18n.t("profile.correct")
                : status === "incorrect"
                  ? i18n.t("profile.incorrect")
                  : i18n.t("profile.no_answer"),
          }),
        ),
      );
    }
    body.append(row);
  }
  return element(
    "table",
    { className: "player-game-grid" },
    element("caption", {}, i18n.t("profile.results")),
    element("thead", {}, groups, head),
    body,
  );
}

export function renderPlayerGame(
  resource: PlayerGameResource,
  i18n: I18n,
  formatDate: (value?: string | null) => string,
  handlers: GameHandlers,
): HTMLElement {
  const header = element(
    "section",
    { className: "profile-section" },
    element(
      "div",
      { className: "settings-actions" },
      element(
        "button",
        {
          type: "button",
          className: "secondary-button",
          onclick: (() => handlers.back()) as EventListener,
        },
        i18n.t("common.back"),
      ),
    ),
    element("h2", { className: "profile-name" }, resource.tournament_name ?? i18n.t("profile.private_tournament")),
    resource.stage
      ? element("p", { className: "profile-game-stage" }, `${i18n.t("profile.stage")}: ${resource.stage}`)
      : null,
    element("p", { className: "profile-game-date" }, formatDate(resource.played_at)),
    gamePackets(resource, i18n),
  );
  const themeView = element("section", { className: "profile-section player-game-themes" },
    element("h3", {}, i18n.t("profile.results")),
    element("div", { className: "table-scroll", tabindex: "0", role: "region", "aria-label": i18n.t("profile.results") },
      themeGrid(resource.themes, resource.participants, i18n, handlers.openPlayer)));
  return element(
    "section",
    { className: "route-content profile player-game" },
    header,
    themeView,
  );
}
