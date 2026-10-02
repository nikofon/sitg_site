import type { TournamentChatResource } from "../api/types";
import type { I18n } from "../i18n";
import { element } from "./dom";

function localDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number): string => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function renderChatSchedule(resource: TournamentChatResource, i18n: I18n,
  formatDate: (value?: string | null) => string, set: (value: string | null) => void): HTMLElement {
  const input = element("input", { type: "datetime-local", step: "60", value: localDateTime(resource.planned_at),
    required: true, "aria-label": i18n.t("chat_schedule.datetime") });
  const status = element("p", { role: "status", className: "field-help" });
  const form = element("form", { className: "settings-form" },
    element("label", {}, i18n.t("chat_schedule.datetime"), input),
    element("div", { className: "settings-actions" },
      element("button", { type: "submit", className: "primary-button" }, i18n.t("chat_schedule.save")),
      resource.planned_at ? element("button", { type: "button", className: "danger-button",
        onclick: (() => set(null)) as EventListener }, i18n.t("chat_schedule.remove")) : null), status);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const date = new Date(input.value);
    if (!input.value || Number.isNaN(date.getTime())) {
      status.textContent = i18n.t("chat_schedule.invalid");
      return;
    }
    set(date.toISOString());
  });
  return element("section", { className: "route-content chat-schedule" },
    element("h2", {}, `${i18n.t("tournament_chat.round")} ${resource.round_number}` +
      (resource.multiple_matches ? ` · ${i18n.t("tournament_chat.game")} ${resource.match_number}` : "")),
    element("dl", { className: "tournament-profile-details" },
      element("div", {}, element("dt", {}, i18n.t("chat_schedule.tournament")), element("dd", {}, resource.tournament_name)),
      element("div", {}, element("dt", {}, i18n.t("chat_schedule.participants")),
        element("dd", {}, resource.participants.map((item) => item.nickname).join(", "))),
      element("div", {}, element("dt", {}, i18n.t("chat_schedule.current")),
        element("dd", {}, resource.planned_at ? formatDate(resource.planned_at) : i18n.t("chat_schedule.no_time"))),
    ),
    element("p", { className: "resource-summary" }, i18n.t("chat_schedule.advisory")), form);
}
