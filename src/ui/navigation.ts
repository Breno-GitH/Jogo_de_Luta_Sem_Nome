/** Menu input never enters the combat command buffer. Text fields keep typing. */
export class MenuNavigation {
  constructor(
    private container: HTMLElement,
    private active: () => boolean,
    private back: () => void,
    private cue: () => void,
  ) {
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.active() || e.defaultPrevented) return;
        if (e.code === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) this.back();
          return;
        }
        if (!(e.target instanceof HTMLElement)) return;
        const target = e.target;
        if (
          target.matches(
            'input:not([type="radio"]):not([type="checkbox"]):not([type="range"]),textarea,[contenteditable="true"]',
          )
        )
          return;
        if (!["KeyW", "KeyS", "ArrowUp", "ArrowDown", "Enter"].includes(e.code))
          return;
        const items = Array.from(
          this.container.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary",
          ),
        ).filter(
          (el) => el.getClientRects().length > 0 && !el.closest("[hidden]"),
        );
        if (!items.length) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (
          target instanceof HTMLSelectElement &&
          ["KeyW", "KeyS", "ArrowUp", "ArrowDown"].includes(e.code)
        ) {
          const delta = ["KeyW", "ArrowUp"].includes(e.code) ? -1 : 1;
          target.selectedIndex = Math.max(
            0,
            Math.min(target.options.length - 1, target.selectedIndex + delta),
          );
          target.dispatchEvent(new Event("change", { bubbles: true }));
          this.cue();
          return;
        }
        if (e.code === "Enter") {
          const el = items.includes(target) ? target : items[0];
          if (
            el instanceof HTMLSelectElement ||
            (el instanceof HTMLInputElement && el.type === "range")
          )
            items[(items.indexOf(el) + 1) % items.length].focus();
          else el.click();
        } else {
          const index = items.indexOf(target),
            delta = ["KeyW", "ArrowUp"].includes(e.code) ? -1 : 1;
          const next =
            items[
              index < 0
                ? delta > 0
                  ? 0
                  : items.length - 1
                : (index + delta + items.length) % items.length
            ];
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest" });
          this.cue();
        }
      },
      true,
    );
  }
  focus() {
    this.container
      .querySelector<HTMLElement>(
        "button:not(:disabled),input:checked, input:not(:disabled),a[href]",
      )
      ?.focus({ preventScroll: true });
  }
}
