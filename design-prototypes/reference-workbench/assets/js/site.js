import { initializeArrangeMode } from "./arrange.js";

const THEME_KEY = "plurimath.reference-workbench.theme";

const searchIndex = [
  { kind: "Page", title: "Home", description: "What Plurimath converts", href: "index.html", terms: "overview representation formula" },
  { kind: "Tool", title: "Conversion workbench", description: "Convert with the local browser engine", href: "converter.html", terms: "convert asciimath latex mathml omml html unicodemath" },
  { kind: "Reference", title: "Functions", description: "Browse 108 documented functions", href: "functions.html", terms: "function syntax unary binary ternary" },
  { kind: "Function", title: "abs", description: "Absolute value across five representations", href: "function-abs.html", terms: "absolute asciimath latex mathml omml unicodemath" },
  { kind: "Reference", title: "Symbols", description: "Search 1,434 usable symbol records", href: "symbols.html", terms: "glyph alias alpha forall infinity" },
  { kind: "Reference", title: "API", description: "Ruby and JavaScript method surfaces", href: "api.html", terms: "parse serializer method arguments" },
  { kind: "Guide", title: "Getting started", description: "Install, parse, and serialize", href: "usage.html", terms: "ruby javascript npm bundle install" },
  { kind: "Tool", title: "Number formatter", description: "Create persistent formatting profiles", href: "formatter.html", terms: "locale precision decimal grouping scientific profile" },
  { kind: "Method", title: "Plurimath::NumberFormatter", description: "Ruby formatter configuration", href: "formatter.html", terms: "localized_number localizer_symbols" },
  { kind: "Concept", title: "Formula evaluator", description: "Inspect variable bindings and Ruby calls", href: "evaluator.html", terms: "evaluate variables binding" },
  { kind: "Page", title: "Blog", description: "Ten project articles", href: "blog.html", terms: "news updates intent unitsml fonts" },
  { kind: "Article", title: "Number formatting support", description: "Locale-aware number presentation", href: "article.html", terms: "formatter locale decimal grouping" }
];

const includePaths = {
  topbar: "../../partials/topbar.html",
  footer: "../../partials/footer.html",
  "search-dialog": "../../partials/search-dialog.html"
};

let menuReturnFocus = null;
let toastTimer = null;

async function loadIncludes() {
  const includeElements = Array.from(document.querySelectorAll("[data-include]"));

  await Promise.all(includeElements.map(async (element) => {
    const name = element.dataset.include;
    const relativePath = includePaths[name];

    if (!relativePath) return;

    try {
      const response = await fetch(new URL(relativePath, import.meta.url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      element.replaceWith(document.createRange().createContextualFragment(await response.text()));
    } catch (error) {
      element.textContent = `Unable to load the shared ${name} partial. Serve the repository root over HTTP.`;
      element.className = "notice notice--warning page-container";
    }
  }));
}

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme, persist = true) {
  const resolvedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = resolvedTheme;

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = resolvedTheme === "light" ? "#f4f7fb" : "#090d18";

  const button = document.querySelector("[data-theme-toggle]");

  if (button) button.setAttribute("aria-label", `Use ${resolvedTheme === "dark" ? "light" : "dark"} theme`);

  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, resolvedTheme);
    } catch (error) {
      // Theme persistence is optional; the visual control still works.
    }
  }
}

function initializeTheme() {
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  const previewTheme = new URLSearchParams(window.location.search).get("theme");
  applyTheme(["light", "dark"].includes(previewTheme) ? previewTheme : currentTheme(), false);
}

function activeNavigationKey() {
  return document.body.dataset.navGroup || document.body.dataset.page || "home";
}

function markActiveNavigation() {
  const current = activeNavigationKey();

  document.querySelectorAll("[data-nav-page]").forEach((link) => {
    if (link.dataset.navPage === current) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function focusableElements(container) {
  return Array.from(container.querySelectorAll(
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
  )).filter((element) => !element.hidden && element.offsetParent !== null);
}

function setMenuOpen(open, restoreFocus = false) {
  const drawer = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("#mobile-navigation");
  const scrim = document.querySelector("[data-mobile-scrim]");

  if (!drawer || !menu || !scrim) return;

  if (open) {
    menuReturnFocus = document.activeElement;
    menu.hidden = false;
    scrim.hidden = false;
    document.body.classList.add("has-open-menu");
    drawer.setAttribute("aria-expanded", "true");
    focusableElements(menu)[0]?.focus();
  } else {
    menu.hidden = true;
    scrim.hidden = true;
    document.body.classList.remove("has-open-menu");
    drawer.setAttribute("aria-expanded", "false");
    if (restoreFocus && menuReturnFocus instanceof HTMLElement) menuReturnFocus.focus();
  }
}

function initializeMobileNavigation() {
  const menu = document.querySelector("#mobile-navigation");

  document.querySelector("[data-menu-toggle]")?.addEventListener("click", () => setMenuOpen(true));
  document.querySelector("[data-menu-close]")?.addEventListener("click", () => setMenuOpen(false, true));
  document.querySelector("[data-mobile-scrim]")?.addEventListener("click", () => setMenuOpen(false, true));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu && !menu.hidden) {
      setMenuOpen(false, true);
      return;
    }

    if (event.key !== "Tab" || !menu || menu.hidden) return;

    const focusable = focusableElements(menu);
    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  window.matchMedia("(min-width: 70.01rem)").addEventListener("change", (event) => {
    if (event.matches) setMenuOpen(false);
  });
}

function resultElement(item) {
  const link = document.createElement("a");
  const kind = document.createElement("span");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const description = document.createElement("small");
  const arrow = document.createElement("span");

  link.className = "search-result";
  link.href = item.href;

  kind.className = "search-result__kind";
  kind.textContent = item.kind;

  title.textContent = item.title;
  description.textContent = item.description;
  copy.append(title, description);

  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");

  link.append(kind, copy, arrow);
  return link;
}

function renderSearchResults(query = "") {
  const results = document.querySelector("[data-search-results]");
  if (!results) return;

  const normalized = query.trim().toLowerCase();
  const matches = searchIndex.filter((item) => {
    const searchable = `${item.title} ${item.description} ${item.kind} ${item.terms}`.toLowerCase();
    return !normalized || searchable.includes(normalized);
  }).slice(0, 8);

  results.replaceChildren();

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = `No prototype pages match “${query}”. Try a format or method name.`;
    results.append(empty);
    return;
  }

  matches.forEach((item) => results.append(resultElement(item)));
}

function openSearch() {
  const dialog = document.querySelector("[data-search-dialog]");
  const input = document.querySelector("[data-search-input]");
  if (!(dialog instanceof HTMLDialogElement)) return;

  renderSearchResults(input?.value || "");
  dialog.showModal();
  window.setTimeout(() => input?.focus(), 0);
}

function initializeSearch() {
  const dialog = document.querySelector("[data-search-dialog]");
  const input = document.querySelector("[data-search-input]");

  document.querySelectorAll("[data-open-search]").forEach((button) => button.addEventListener("click", openSearch));
  document.querySelector("[data-close-search]")?.addEventListener("click", () => dialog?.close());
  input?.addEventListener("input", () => renderSearchResults(input.value));

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;

    if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openSearch();
    }
  });
}

function selectTab(button, updateUrl = true) {
  const tabList = button.closest("[role='tablist']");
  const group = tabList?.dataset.tabGroup;
  const tabName = button.dataset.tab;
  if (!tabList || !group || !tabName) return;

  tabList.querySelectorAll("[role='tab']").forEach((tab) => {
    const selected = tab === button;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  document.querySelectorAll(`[data-tab-panel-group="${group}"]`).forEach((panel) => {
    const selected = panel.dataset.tabPanel === tabName;
    panel.hidden = !selected;

    if (selected) {
      panel.classList.remove("is-tab-entering");
      window.requestAnimationFrame(() => panel.classList.add("is-tab-entering"));
    }
  });

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", `${group}:${tabName}`);
    window.history.replaceState({}, "", url);
  }
}

function connectTab(tab, panel, group, tabName) {
  const safeGroup = group.replace(/[^a-zA-Z0-9_-]/g, "-");
  const safeTabName = tabName.replace(/[^a-zA-Z0-9_-]/g, "-");
  const tabId = `${safeGroup}-${safeTabName}-tab`;
  const panelId = `${safeGroup}-${safeTabName}-panel`;

  tab.id = tabId;
  tab.setAttribute("aria-controls", panelId);
  panel.id = panelId;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tabId);
}

function initializeTabs() {
  document.querySelectorAll("[role='tablist']").forEach((tabList) => {
    const tabs = Array.from(tabList.querySelectorAll("[role='tab']"));
    const group = tabList.dataset.tabGroup;

    if (group) {
      tabs.forEach((tab) => {
        const panel = document.querySelector(`[data-tab-panel-group="${group}"][data-tab-panel="${tab.dataset.tab}"]`);
        if (panel && tab.dataset.tab) connectTab(tab, panel, group, tab.dataset.tab);
      });

      const requestedTab = new URLSearchParams(window.location.search).get("tab");
      const requestedButton = tabs.find((tab) => requestedTab === `${group}:${tab.dataset.tab}`);
      if (requestedButton) selectTab(requestedButton, false);
    }

    tabs.forEach((button, index) => {
      button.addEventListener("click", () => selectTab(button));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

        event.preventDefault();
        let nextIndex = index;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = tabs.length - 1;
        tabs[nextIndex].focus();
        selectTab(tabs[nextIndex]);
      });
    });
  });
}

export function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  if (!toast) return;

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

export function indicateUpdate(element) {
  if (!element) return;
  element.classList.remove("is-updated");
  window.requestAnimationFrame(() => element.classList.add("is-updated"));
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
  } catch (error) {
    const temporary = document.createElement("textarea");
    temporary.value = value;
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }

  showToast(successMessage);
}

function initializeCopyButtons() {
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.copyTarget);
      if (!target) return;
      const value = target.value ?? target.textContent ?? "";
      copyText(value, button.dataset.copyMessage || "Copied to clipboard");
    });
  });

  document.querySelectorAll("[data-copy-value]").forEach((button) => {
    button.addEventListener("click", () => {
      copyText(button.dataset.copyValue || "", button.dataset.copyMessage || "Copied to clipboard");
    });
  });
}

function initializeDesktopMenus() {
  document.addEventListener("click", (event) => {
    document.querySelectorAll(".nav-menu[open]").forEach((menu) => {
      if (!menu.contains(event.target)) menu.removeAttribute("open");
    });
  });
}

async function initializeSite() {
  await loadIncludes();
  initializeTheme();
  markActiveNavigation();
  initializeMobileNavigation();
  initializeSearch();
  initializeTabs();
  initializeCopyButtons();
  initializeDesktopMenus();
  initializeArrangeMode();
  document.documentElement.classList.add("site-ready");
  document.dispatchEvent(new CustomEvent("plurimath:site-ready"));
}

initializeSite();
