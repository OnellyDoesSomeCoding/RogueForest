// Login page (#/login): Log in / Create account tabs.
import { credentialsSchema } from "@shared/schemas";
import { api, getMe } from "../api";
import { navigate, type Page } from "../router";
import { h } from "../ui/dom";

type Mode = "login" | "signup";

export const loginPage: Page = (root, ctx) => {
  let mode: Mode = "login";
  let busy = false;

  const username = h("input", { id: "username", name: "username", type: "text", autocomplete: "username", required: true, maxlength: 16, spellcheck: "false", autocapitalize: "none" });
  const password = h("input", { id: "password", name: "password", type: "password", autocomplete: "current-password", required: true, maxlength: 72 });
  const confirm = h("input", { id: "confirm", name: "confirm", type: "password", autocomplete: "new-password", maxlength: 72 });
  const confirmField = h("div", { class: "field" }, h("label", { for: "confirm" }, "Confirm password"), confirm);
  const hint = h("p", { class: "field__hint" }, "3–16 characters. Letters, numbers and underscores.");
  const passwordHint = h("p", { class: "field__hint" }, "8–72 characters.");
  const warning = h("p", { class: "notice notice--warning", role: "note" }, "No email means no password reset. Keep your password safe.");
  const error = h("p", { class: "notice notice--error", role: "alert" });
  const submit = h("button", { class: "btn btn--gold btn--block", type: "submit" }, "Log in");

  const tabLogin = h("button", { type: "button", role: "tab", class: "tab", onclick: () => setMode("login") }, "Log in");
  const tabSignup = h("button", { type: "button", role: "tab", class: "tab", onclick: () => setMode("signup") }, "Create account");

  function setMode(next: Mode) {
    mode = next;
    const signup = mode === "signup";
    tabLogin.classList.toggle("tab--active", !signup);
    tabSignup.classList.toggle("tab--active", signup);
    tabLogin.setAttribute("aria-selected", String(!signup));
    tabSignup.setAttribute("aria-selected", String(signup));
    confirmField.hidden = !signup;
    hint.hidden = !signup;
    passwordHint.hidden = !signup;
    warning.hidden = !signup;
    confirm.required = signup;
    password.autocomplete = signup ? "new-password" : "current-password";
    submit.textContent = signup ? "Create account" : "Log in";
    showError("");
  }

  function showError(message: string) {
    error.textContent = message;
    error.hidden = message === "";
  }

  async function onSubmit(event: Event) {
    event.preventDefault();
    if (busy) return;
    const creds = { username: username.value.trim(), password: password.value };

    // Client-side checks only on Create. A failed login always shows the same generic message.
    if (mode === "signup") {
      const parsed = credentialsSchema.safeParse(creds);
      if (!parsed.success) return showError(parsed.error.issues[0]?.message ?? "Check your username and password.");
      if (password.value !== confirm.value) return showError("The two passwords do not match.");
    }

    busy = true;
    submit.disabled = true;
    showError("");
    try {
      if (mode === "signup") await api.signup(creds.username, creds.password);
      else await api.login(creds.username, creds.password);
      if (ctx.isCurrent()) navigate("/starter");
    } catch (err) {
      if (ctx.isCurrent()) showError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      busy = false;
      submit.disabled = false;
    }
  }

  const form = h(
    "form",
    { class: "auth__form", novalidate: true, onsubmit: onSubmit },
    h("div", { class: "field" }, h("label", { for: "username" }, "Username"), username, hint),
    h("div", { class: "field" }, h("label", { for: "password" }, "Password"), password, passwordHint),
    confirmField,
    warning,
    error,
    submit,
  );

  root.append(
    h(
      "main",
      { class: "auth" },
      h(
        "div",
        { class: "panel auth__panel" },
        h(
          "button",
          { class: "auth__brand", type: "button", onclick: () => navigate("/") },
          h("img", { src: "/assets/logo-acorn.png", alt: "", width: 40, height: 40, class: "pixel" }),
          h("span", {}, "Rogue Forest"),
        ),
        h("div", { class: "tabs", role: "tablist" }, tabLogin, tabSignup),
        form,
        h("button", { class: "link", type: "button", onclick: () => navigate("/") }, "← Back to home"),
      ),
    ),
  );
  setMode("login");
  username.focus();

  // Already logged in: skip the form.
  getMe()
    .then((me) => {
      if (me && ctx.isCurrent()) navigate("/starter");
    })
    .catch(() => {
      if (ctx.isCurrent()) showError("Could not reach the server. Check your connection and try again.");
    });
};
