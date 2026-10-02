import { element } from "./dom";

export function sectionNavigation(
  label: string,
  sections: Array<{ key: string; label: string; panel: HTMLElement }>,
  initial = sections[0]?.key,
  onSelect?: (key: string) => void,
): HTMLElement {
  const nav = element("nav", { className: "profile-navigation", "aria-label": label });
  const select = (key: string): void => {
    sections.forEach((section, index) => {
      section.panel.hidden = section.key !== key;
      nav.children[index]?.setAttribute("aria-pressed", String(section.key === key));
    });
  };
  for (const section of sections) {
    nav.append(element("button", {
      type: "button", "aria-controls": section.panel.id,
      onclick: (() => { select(section.key); onSelect?.(section.key); }) as EventListener,
    }, section.label));
  }
  select(sections.some(section => section.key === initial) ? initial! : sections[0]!.key);
  return nav;
}
