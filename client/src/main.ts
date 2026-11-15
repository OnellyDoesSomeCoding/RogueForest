import "./styles/base.css";
import "./styles/home.css";
import "./styles/login.css";
import "./styles/starter.css";
import { gamePage } from "./pages/game";
import { homePage } from "./pages/home";
import { loginPage } from "./pages/login";
import { starterPage } from "./pages/starter";
import { startRouter } from "./router";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element");

startRouter(root, {
  "/": homePage,
  "/login": loginPage,
  "/starter": starterPage,
  "/game": gamePage,
});
