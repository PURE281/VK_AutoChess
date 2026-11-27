import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

type HandlerMap = {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  onClickCapture: (event: ReactMouseEvent) => void;
  onContextMenu: (event: ReactMouseEvent) => void;
};

/** Touch-friendly long press without adding a dependency. The click that follows
 * a completed long press is swallowed so it does not buy/select the unit. */
export function longPressHandlers(callback: () => void, delay = 520): HandlerMap {
  let timer = 0;
  let fired = false;
  let startX = 0;
  let startY = 0;
  const clear = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };
  return {
    onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      fired = false;
      startX = event.clientX;
      startY = event.clientY;
      clear();
      timer = window.setTimeout(() => {
        fired = true;
        callback();
      }, delay);
    },
    onPointerMove(event) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 12) clear();
    },
    onPointerUp() {
      clear();
    },
    onPointerCancel() {
      clear();
    },
    onClickCapture(event) {
      if (!fired) return;
      fired = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu(event) {
      event.preventDefault();
    },
  };
}
