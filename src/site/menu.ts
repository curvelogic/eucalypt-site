/**
 * The header's menu on the homepage and /play, below 50rem: a disclosure.
 * The button toggles aria-expanded and the panel; Escape closes it and
 * returns focus to the button, as does a click outside the header or a
 * widening of the window past the breakpoint.
 */
const button = document.querySelector<HTMLButtonElement>("[data-menu-btn]");
const panel = document.querySelector<HTMLElement>("[data-menu]");

if (button && panel) {
  const header = button.closest("header") ?? button.parentElement!;
  const isOpen = () => button.getAttribute("aria-expanded") === "true";
  const set = (open: boolean, focus = false) => {
    button.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (!open && focus) button.focus();
  };

  button.addEventListener("click", () => set(!isOpen()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      set(false, panel.contains(document.activeElement) || document.activeElement === button);
    }
  });
  document.addEventListener("click", (e) => {
    if (isOpen() && !header.contains(e.target as Node)) set(false);
  });
  matchMedia("(min-width: 50.0625rem)").addEventListener("change", (e) => e.matches && set(false));
}
