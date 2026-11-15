// Home page (#/). Layout: sticky nav, hero, intro, feature cards, critter row, how to play, CTA band, footer.
import { config, critters } from "@shared/gameData";
import { getMe } from "../api";
import { navigate, type Page } from "../router";
import { critterIcon, typeChips } from "../ui/critterIcon";
import { h } from "../ui/dom";

const FEATURES = [
  {
    image: "/assets/home/feature-collect.png",
    title: "Collect",
    text: "20 critter lines across 8 types. Capture elites and bosses during a run to unlock them as starters for the next one.",
  },
  {
    image: "/assets/home/feature-position.png",
    title: "Position",
    text: "Every fight is on a grid. Push enemies into walls, block their line attacks, and hold the tiles that make your critters stronger.",
  },
  {
    image: "/assets/home/feature-survive.png",
    title: "Survive",
    text: "50 floors, 5 acts, 5 bosses. Lose a fight and the run ends. Win and you earn a badge. No permanent stat buffs, ever.",
  },
];

const HOW_TO_PLAY = [
  ["Pick your path", "Each act is a branching map of 10 floors. Choose between fights, shops, rest sites and events on the way to the boss."],
  ["Place your team", "You see the enemies first, then place your 3 active critters. Standing on a critter's favorite tiles gives it +10% damage."],
  ["Move, then act", "On its turn a critter moves first and then uses one move. Once it has attacked, it cannot move again."],
  ["Share your mana", "The whole team shares 3 mana each round. Unused mana is lost, so spend it."],
  ["Read enemy intents", "Enemies show where they will move and which tiles they will hit. Step off the red tiles to dodge."],
] as const;

const NAV_LINKS = [
  ["intro", "The Game"],
  ["features", "Features"],
  ["critters", "Critters"],
  ["how", "How to Play"],
] as const;

export const homePage: Page = (root, ctx) => {
  let loggedIn = false;
  const play = () => navigate(loggedIn ? "/starter" : "/login");
  const playButton = (extraClass = "") => h("button", { class: `btn btn--gold ${extraClass}`, type: "button", onclick: play }, "Play");
  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ---- nav ----
  const account = h("div", { class: "nav__account" });
  const nav = h(
    "header",
    { class: "nav" },
    h(
      "button",
      { class: "nav__brand", type: "button", "aria-label": "Rogue Forest, back to top", onclick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
      h("img", { src: "/assets/logo-acorn.png", alt: "", width: 32, height: 32, class: "pixel" }),
      h("span", {}, "Rogue Forest"),
    ),
    h("nav", { class: "nav__links", "aria-label": "Page sections" }, ...NAV_LINKS.map(([id, label]) => h("button", { type: "button", onclick: scrollTo(id) }, label))),
    h("div", { class: "nav__right" }, account, playButton("btn--small")),
  );

  // ---- hero ----
  const fireflies = h("div", { class: "hero__fireflies", "aria-hidden": "true" });
  for (let i = 0; i < 14; i++) {
    const dot = h("span");
    dot.style.left = `${(i * 37 + 11) % 100}%`;
    dot.style.top = `${30 + ((i * 53) % 55)}%`;
    dot.style.animationDelay = `${(i * 0.7) % 6}s`;
    dot.style.animationDuration = `${5 + (i % 5)}s`;
    fireflies.append(dot);
  }
  const hero = h(
    "section",
    { class: "hero" },
    fireflies,
    h(
      "div",
      { class: "hero__content" },
      h("h1", { class: "hero__title" }, h("span", {}, "Rogue"), h("span", {}, "Forest")),
      h("p", { class: "hero__tagline" }, "Reclaim the forest. One critter at a time."),
      h("p", { class: "hero__genre" }, "Turn-based roguelike", h("span", { "aria-hidden": "true" }, " • "), "Plays in your browser"),
      playButton("btn--large"),
    ),
    h("button", { class: "hero__scroll", type: "button", "aria-label": "Scroll to learn more", onclick: scrollTo("intro") }, "▼"),
  );

  // ---- intro ----
  const intro = h(
    "section",
    { class: "section intro", id: "intro" },
    divider(),
    h("h2", {}, "A forest worth fighting for"),
    h(
      "p",
      { class: "intro__pitch" },
      "You are a Druid whose power was stolen. Gather a team of forest critters, fight across a tactical grid, and climb 50 floors to take it back. Every boss holds a piece of your power. The last one is the thief.",
    ),
  );

  // ---- features ----
  const features = h(
    "section",
    { class: "section section--alt", id: "features" },
    h("h2", {}, "Game features"),
    h(
      "div",
      { class: "features" },
      ...FEATURES.map((f) =>
        h(
          "article",
          { class: "feature" },
          h("div", { class: "feature__art" }, h("img", { src: f.image, alt: "", class: "pixel", loading: "lazy", width: 240, height: 150 })),
          h("h3", {}, f.title),
          h("p", {}, f.text),
        ),
      ),
    ),
  );

  // ---- critter showcase ----
  const starters = critters.filter((c) => config.starter.defaultUnlocks.includes(c.line));
  const mystery = critters.filter((c) => !config.starter.defaultUnlocks.includes(c.line)).slice(0, 5);
  const showcase = h(
    "section",
    { class: "section", id: "critters" },
    h("h2", {}, "Meet your first critters"),
    h("p", { class: "section__lead" }, `Every Druid starts with three. The other ${critters.length - starters.length} are out there, waiting to be found.`),
    h(
      "div",
      { class: "showcase" },
      ...starters.map((c) => h("div", { class: "showcase__card" }, critterIcon(c), h("strong", {}, c.stages[0]?.name ?? c.line), typeChips(c), h("span", { class: "showcase__role" }, c.role))),
      ...mystery.map((c) => h("div", { class: "showcase__card showcase__card--locked" }, critterIcon(c, { locked: true }), h("strong", {}, "???"), h("span", { class: "showcase__role" }, "Undiscovered"))),
    ),
  );

  // ---- how to play ----
  const how = h(
    "section",
    { class: "section section--alt", id: "how" },
    h("h2", {}, "How to play"),
    h(
      "ol",
      { class: "steps" },
      ...HOW_TO_PLAY.map(([title, text], i) => h("li", { class: "step" }, h("span", { class: "step__number", "aria-hidden": "true" }, i + 1), h("div", {}, h("h3", {}, title), h("p", {}, text)))),
    ),
  );

  // ---- call to action ----
  const cta = h(
    "section",
    { class: "cta" },
    h("div", { class: "cta__content" }, h("h2", {}, "The thief is waiting"), h("p", {}, "Fifty floors stand between you and your stolen power. Pick three critters and start climbing."), playButton("btn--large")),
  );

  // ---- footer ----
  const footer = h(
    "footer",
    { class: "footer" },
    h("div", { class: "footer__brand" }, h("img", { src: "/assets/logo-acorn.png", alt: "", width: 32, height: 32, class: "pixel" }), h("span", {}, "Rogue Forest")),
    h("p", {}, `Version ${config.version}`),
    h("p", {}, "Credits: game design and code by the Rogue Forest team. Built with TypeScript, Vite and Phaser."),
    h("p", { class: "footer__note" }, "All art on this page is placeholder art."),
  );

  root.append(nav, h("main", {}, hero, intro, features, showcase, how, cta), footer);

  // Show who is logged in, once we know.
  getMe()
    .then((me) => {
      if (!ctx.isCurrent()) return;
      loggedIn = Boolean(me);
      account.replaceChildren(
        me
          ? h("span", { class: "nav__user" }, me.username)
          : h("button", { class: "nav__login", type: "button", onclick: () => navigate("/login") }, "Log in"),
      );
    })
    .catch(() => {
      // Server unreachable: the Play button still leads to the login page, which shows the error.
    });

  const onScroll = () => nav.classList.toggle("nav--solid", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  return () => window.removeEventListener("scroll", onScroll);
};

function divider(): HTMLElement {
  return h("div", { class: "divider", "aria-hidden": "true" }, h("span", {}), h("img", { src: "/assets/logo-acorn.png", alt: "", width: 24, height: 24, class: "pixel" }), h("span", {}));
}
