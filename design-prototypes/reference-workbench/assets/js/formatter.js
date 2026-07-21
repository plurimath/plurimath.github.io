import { indicateUpdate } from "./site.js";

const FORMATTER_KEY = "plurimath.reference-workbench.formatters";

const localeDefaults = {
  en: { decimal: ".", group: "," },
  fr: { decimal: ",", group: "\u202f" },
  de: { decimal: ",", group: "." },
  hy: { decimal: ".", group: "," }
};

const localeTags = {
  en: "en",
  fr: "fr",
  de: "de",
  hy: "hy"
};

const initialStore = {
  schemaVersion: 1,
  activeProfileId: "english-publication",
  profiles: [
    {
      id: "english-publication",
      name: "English publication",
      sample: "1234.56789",
      locale: "en",
      precision: 3,
      decimal: "",
      group: "",
      groupDigits: 3,
      significant: "",
      notation: "basic",
      api: "number"
    },
    {
      id: "french-reports",
      name: "French reports",
      sample: "1234.56789",
      locale: "fr",
      precision: 2,
      decimal: "",
      group: "",
      groupDigits: 3,
      significant: "",
      notation: "basic",
      api: "number"
    },
    {
      id: "engineering-logs",
      name: "Engineering logs",
      sample: "123456789",
      locale: "en",
      precision: 4,
      decimal: ".",
      group: "",
      groupDigits: 3,
      significant: "",
      notation: "engineering",
      api: "standard"
    }
  ]
};

let store = loadStore();
let storageAvailable = true;
let saveTimer = null;

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatterRoot() {
  return document.querySelector("[data-formatter]");
}

function control(name) {
  return formatterRoot()?.querySelector(`[data-${name}]`);
}

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(FORMATTER_KEY));
    if (saved?.schemaVersion === 1 && Array.isArray(saved.profiles) && saved.profiles.length > 0) return saved;
  } catch (error) {
    // Invalid or unavailable storage falls through to safe defaults.
  }

  return deepCopy(initialStore);
}

function activeProfile() {
  return store.profiles.find((profile) => profile.id === store.activeProfileId) || store.profiles[0];
}

function slug(value) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "formatter";
  let candidate = base;
  let suffix = 2;
  while (store.profiles.some((profile) => profile.id === candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function saveStore() {
  const status = control("save-status");
  const storageStatus = control("storage-status");

  try {
    localStorage.setItem(FORMATTER_KEY, JSON.stringify(store));
    storageAvailable = true;
    status.textContent = "Saved locally";
    storageStatus.textContent = "Local";
  } catch (error) {
    storageAvailable = false;
    status.textContent = "Saved for this page only";
    storageStatus.textContent = "Memory only";
  }
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  control("save-status").textContent = "Saving…";
  saveTimer = window.setTimeout(saveStore, 180);
}

function renderProfileList() {
  const list = control("profile-list");
  list.replaceChildren();

  store.profiles.forEach((profile) => {
    const button = document.createElement("button");
    const name = document.createElement("strong");
    const summary = document.createElement("small");

    button.className = "profile-item";
    button.type = "button";
    button.setAttribute("aria-pressed", String(profile.id === store.activeProfileId));
    name.textContent = profile.name;
    summary.textContent = `${profile.locale} · ${profile.notation}`;
    button.append(name, summary);

    button.addEventListener("click", () => {
      store.activeProfileId = profile.id;
      loadProfileIntoControls();
      renderProfileList();
      saveStore();
    });

    list.append(button);
  });
}

function setControl(name, value) {
  const element = control(name);
  if (element) element.value = value ?? "";
}

function loadProfileIntoControls() {
  const profile = activeProfile();
  setControl("profile-name", profile.name);
  setControl("sample-value", profile.sample);
  setControl("formatter-locale", profile.locale);
  setControl("precision", profile.precision);
  setControl("decimal", profile.decimal);
  setControl("group", profile.group);
  setControl("group-digits", profile.groupDigits);
  setControl("significant", profile.significant);
  setControl("notation", profile.notation);
  setControl("formatter-api", profile.api);
  updatePreviewAndCode();
}

function readControlsIntoProfile() {
  const profile = activeProfile();
  profile.name = control("profile-name").value.trim() || "Untitled formatter";
  profile.sample = control("sample-value").value.trim() || "0";
  profile.locale = control("formatter-locale").value;
  profile.precision = control("precision").value;
  profile.decimal = control("decimal").value;
  profile.group = control("group").value;
  profile.groupDigits = Number(control("group-digits").value || 3);
  profile.significant = control("significant").value;
  profile.notation = control("notation").value;
  profile.api = control("formatter-api").value;
}

function groupInteger(value, separator, size) {
  if (!separator || size < 1) return value;
  const sign = value.startsWith("-") ? "-" : "";
  const digits = sign ? value.slice(1) : value;
  const groups = [];

  for (let end = digits.length; end > 0; end -= size) {
    groups.unshift(digits.slice(Math.max(0, end - size), end));
  }

  return `${sign}${groups.join(separator)}`;
}

function engineeringParts(number, precision) {
  if (number === 0) return { coefficient: "0", exponent: 0 };
  const exponent = Math.floor(Math.log10(Math.abs(number)) / 3) * 3;
  const coefficient = number / (10 ** exponent);
  return { coefficient: coefficient.toFixed(precision), exponent };
}

function parseSampleNumber(value, locale) {
  const defaults = localeDefaults[locale] || localeDefaults.en;
  const compact = String(value).replace(/[\s\u00a0\u202f]/g, "");

  if (defaults.decimal !== "." && compact.includes(defaults.decimal)) {
    return Number(compact.split(defaults.group).join("").replace(defaults.decimal, "."));
  }

  return Number(compact.split(defaults.group).join(""));
}

function approximatePreview(profile) {
  const number = parseSampleNumber(profile.sample, profile.locale);
  if (!Number.isFinite(number)) return "Enter a numeric sample";

  const precision = profile.precision === "" ? 3 : Math.max(0, Math.min(12, Number(profile.precision)));
  const defaults = localeDefaults[profile.locale] || localeDefaults.en;
  const decimal = profile.decimal || defaults.decimal;
  const group = profile.group || defaults.group;

  if (profile.notation === "basic" && !profile.decimal && !profile.group && profile.groupDigits === 3) {
    const options = { useGrouping: true };

    if (profile.significant) {
      options.minimumSignificantDigits = Number(profile.significant);
      options.maximumSignificantDigits = Number(profile.significant);
    } else {
      options.minimumFractionDigits = precision;
      options.maximumFractionDigits = precision;
    }

    return new Intl.NumberFormat(localeTags[profile.locale] || "en", options).format(number);
  }

  if (profile.notation === "e") return number.toExponential(precision).replace("e", "E");

  if (profile.notation === "scientific") {
    const [coefficient, exponent] = number.toExponential(precision).split("e");
    return `${coefficient.replace(".", decimal)} × 10^${Number(exponent)}`;
  }

  if (profile.notation === "engineering") {
    const parts = engineeringParts(number, precision);
    return `${parts.coefficient.replace(".", decimal)} × 10^${parts.exponent}`;
  }

  let rendered = profile.significant ? number.toPrecision(Number(profile.significant)) : number.toFixed(precision);
  let [integer, fraction] = rendered.split(".");
  integer = groupInteger(integer, group, profile.groupDigits || 3);
  return fraction ? `${integer}${decimal}${fraction}` : integer;
}

function rubyValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function generatedRuby(profile) {
  const standard = profile.api === "standard";
  const className = standard ? "Plurimath::Formatter::Standard" : "Plurimath::NumberFormatter";
  const options = {};
  const defaults = localeDefaults[profile.locale] || localeDefaults.en;

  if (profile.decimal && profile.decimal !== defaults.decimal) options.decimal = profile.decimal;
  if (profile.group && profile.group !== defaults.group) options.group = profile.group;
  if (profile.groupDigits && profile.groupDigits !== 3) options.group_digits = Number(profile.groupDigits);
  if (profile.significant) options.significant = Number(profile.significant);
  if (profile.notation !== "basic") options.notation = profile.notation;

  const argumentsList = [standard ? `locale: :${profile.locale}` : `:${profile.locale}`];
  if (profile.precision !== "") argumentsList.push(`precision: ${Number(profile.precision)}`);

  if (Object.keys(options).length > 0) {
    const optionLines = Object.entries(options).map(([key, value]) => {
      const rendered = typeof value === "number" ? value : rubyValue(value);
      return `    ${key}: ${rendered},`;
    });
    const argumentName = standard ? "options" : "localizer_symbols";
    argumentsList.push(`${argumentName}: {\n${optionLines.join("\n")}\n  }`);
  }

  return [
    `formatter = ${className}.new(`,
    `  ${argumentsList.join(",\n  ")}`,
    ")",
    "",
    `formatter.localized_number(${rubyValue(profile.sample)})`
  ].join("\n");
}

function updatePreviewAndCode() {
  const profile = activeProfile();
  control("formatter-output").textContent = approximatePreview(profile);
  control("formatter-code").textContent = generatedRuby(profile);
  control("preview-note").textContent = storageAvailable
    ? "Settings only are stored. Formula history is never persisted."
    : "Browser storage is unavailable. Profiles remain in memory for this page.";
  indicateUpdate(control("formatter-output"));
}

function handleControlChange() {
  readControlsIntoProfile();
  renderProfileList();
  updatePreviewAndCode();
  scheduleSave();
}

function createProfile() {
  const profile = {
    ...deepCopy(initialStore.profiles[0]),
    id: slug("new-formatter"),
    name: "New formatter"
  };
  store.profiles.push(profile);
  store.activeProfileId = profile.id;
  renderProfileList();
  loadProfileIntoControls();
  saveStore();
  control("profile-name").select();
}

function duplicateProfile() {
  const source = activeProfile();
  const duplicate = deepCopy(source);
  duplicate.id = slug(`${source.name}-copy`);
  duplicate.name = `${source.name} copy`;
  store.profiles.push(duplicate);
  store.activeProfileId = duplicate.id;
  renderProfileList();
  loadProfileIntoControls();
  saveStore();
}

function deleteProfile() {
  if (store.profiles.length === 1) {
    control("save-status").textContent = "Keep at least one profile";
    return;
  }

  const profile = activeProfile();
  if (!window.confirm(`Delete “${profile.name}”?`)) return;

  store.profiles = store.profiles.filter((item) => item.id !== profile.id);
  store.activeProfileId = store.profiles[0].id;
  renderProfileList();
  loadProfileIntoControls();
  saveStore();
}

function initializeFormatter() {
  if (!formatterRoot()) return;

  renderProfileList();
  loadProfileIntoControls();
  saveStore();

  [
    "profile-name",
    "sample-value",
    "formatter-locale",
    "precision",
    "decimal",
    "group",
    "group-digits",
    "significant",
    "notation",
    "formatter-api"
  ].forEach((name) => {
    const element = control(name);
    element.addEventListener(element.tagName === "SELECT" ? "change" : "input", handleControlChange);
  });

  control("profile-create").addEventListener("click", createProfile);
  control("profile-duplicate").addEventListener("click", duplicateProfile);
  control("profile-delete").addEventListener("click", deleteProfile);
}

initializeFormatter();
