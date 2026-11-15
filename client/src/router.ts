// Minimal hash router: #/, #/login, #/starter, #/game.

export interface PageContext {
  /** False once the user has navigated away. Async pages check this before touching the DOM. */
  isCurrent: () => boolean;
  /** Query string after the hash path, e.g. #/starter?dev=1. */
  query: URLSearchParams;
}

/** A page renders into `root`. It may return a cleanup function. */
export type Page = (root: HTMLElement, ctx: PageContext) => void | (() => void);

let cleanup: (() => void) | void;
let renderId = 0;

export function navigate(path: string): void {
  const target = "#" + path;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = target;
}

export function startRouter(root: HTMLElement, routes: Record<string, Page>): void {
  const render = () => {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [pathPart = "/", queryPart = ""] = raw.split("?");
    const page = routes[pathPart];
    if (!page) {
      navigate("/");
      return;
    }
    const id = ++renderId;
    cleanup?.();
    root.replaceChildren();
    root.dataset.page = pathPart;
    window.scrollTo(0, 0);
    cleanup = page(root, { isCurrent: () => id === renderId, query: new URLSearchParams(queryPart) });
  };
  window.addEventListener("hashchange", render);
  render();
}
