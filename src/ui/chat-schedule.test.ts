import { describe, expect, it, vi } from "vitest";
import { I18n } from "../i18n";
import { renderChatSchedule } from "./chat-schedule";

describe("chat schedule", () => {
  it("converts a local date to ISO and can remove a shared planned time", () => {
    const set = vi.fn();
    const view = renderChatSchedule({ kind: "tournament_chat", state: "ready",
      chat_id: "c1", tournament_id: "t1", tournament_name: "Tournament",
      round_number: 2, match_number: 1, multiple_matches: true,
      planned_at: "2026-09-25T10:00:00Z", participants: [{ player_id: "p1", nickname: "Player" }],
    }, new I18n("en"), (value) => value ?? "", set);
    document.body.append(view);
    const input = view.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    input.value = "2026-09-26T14:30";
    view.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(set).toHaveBeenCalledWith(new Date("2026-09-26T14:30").toISOString());
    view.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    expect(set).toHaveBeenCalledWith(null);
    view.remove();
  });
});
