import { indicateUpdate } from "./site.js";

const FORMATTER_KEY = "plurimath.reference-workbench.formatters";

const samples = {
  sum: { format: "asciimath", value: "sum_(i=1)^n i^3=((n(n+1))/2)^2" },
  quadratic: { format: "asciimath", value: "x=(-b+-sqrt(b^2-4ac))/(2a)" },
  fraction: { format: "latex", value: "\\frac{a}{b}" },
  abs: { format: "asciimath", value: "abs(x)" }
};

const browserMethods = {
  asciimath: "toAsciimath",
  latex: "toLatex",
  mathml: "toMathml",
  html: "toHtml",
  omml: "toOmml",
  unicodemath: "toUnicodemath"
};

const rubyMethods = {
  asciimath: "to_asciimath",
  latex: "to_latex",
  mathml: "to_mathml",
  html: "to_html",
  omml: "to_omml",
  unicodemath: "to_unicodemath"
};

const inputFromOutput = {
  asciimath: "asciimath",
  latex: "latex",
  mathml: "mathml",
  html: "html",
  omml: "omml",
  unicodemath: "unicode"
};

const outputFromInput = {
  asciimath: "asciimath",
  latex: "latex",
  mathml: "mathml",
  html: "html",
  omml: "omml",
  unicode: "unicodemath"
};

let BrowserPlurimath = null;
let conversionTimer = null;

function converterElement() {
  return document.querySelector("[data-converter]");
}

function field(name) {
  return converterElement()?.querySelector(`[data-${name}]`);
}

function rubyString(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function activeFormatterName() {
  const selected = field("formatter-profile")?.value;
  if (!selected || selected === "none") return null;

  try {
    const store = JSON.parse(localStorage.getItem(FORMATTER_KEY));
    return store?.profiles?.find((profile) => profile.id === selected)?.name || "Saved profile";
  } catch (error) {
    return "Saved profile";
  }
}

function generatedRubyCall() {
  const input = field("input-format").value;
  const output = field("output-format").value;
  const source = field("converter-source").value;
  const locale = field("locale").value;
  const options = [];
  const parseArguments = [rubyString(source), `:${input}`];
  const formatter = activeFormatterName();

  if (["asciimath", "latex", "html", "unicode"].includes(input) && locale !== "en") {
    parseArguments.push(`locale: ${rubyString(locale)}`);
  }

  if (formatter) options.push("formatter: formatter");
  if (field("unitsml").checked) options.push("unitsml: { xml: true }");
  if (output === "mathml" && field("intent").checked) options.push("intent: true");
  if (["mathml", "omml"].includes(output)) options.push(`display_style: ${field("display-style").checked}`);
  if (["mathml", "omml"].includes(output) && field("split-lines").checked) options.push("split_on_linebreak: true");
  if (output === "mathml" && !field("unary-spacing").checked) options.push("unary_function_spacing: false");

  const lines = [];
  if (formatter) lines.push(`# Load “${formatter}” from your application configuration`, "formatter = Plurimath::NumberFormatter.new(:en)", "");
  lines.push("formula = Plurimath::Math.parse(", `  ${parseArguments.join(",\n  ")}`, ")", "");

  let serializer = `formula.${rubyMethods[output]}`;
  if (options.length > 0) serializer += `(\n  ${options.join(",\n  ")}\n)`;
  lines.push(serializer);
  return lines.join("\n");
}

function renderPreview(formula) {
  const preview = field("converter-preview");
  preview.replaceChildren();

  try {
    const mathml = formula.toMathml(field("intent").checked);
    const documentFragment = new DOMParser().parseFromString(mathml, "application/xml");
    const math = documentFragment.documentElement;

    if (math.nodeName.toLowerCase() === "parsererror") throw new Error("Invalid MathML preview");
    preview.append(document.importNode(math, true));
  } catch (error) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "A MathML preview is unavailable for this expression.";
    preview.append(message);
  }
}

function setConversionError(message) {
  const box = document.querySelector("#converter-error");
  const text = field("converter-error");
  text.textContent = message;
  box.hidden = false;
}

function clearConversionError() {
  document.querySelector("#converter-error").hidden = true;
  field("converter-error").textContent = "";
}

function convertNow() {
  const source = field("converter-source").value.trim();
  const input = field("input-format").value;
  const output = field("output-format").value;
  const outputArea = field("converter-output");
  const outputMeta = field("output-meta");

  field("ruby-code").textContent = generatedRubyCall();

  if (!source) {
    outputArea.value = "";
    outputMeta.textContent = "Enter a source formula";
    field("converter-preview").replaceChildren();
    clearConversionError();
    return;
  }

  if (!BrowserPlurimath) {
    outputMeta.textContent = "Browser engine unavailable; Ruby call remains available";
    return;
  }

  try {
    const formula = new BrowserPlurimath(source, input);
    const method = browserMethods[output];
    const result = output === "mathml" ? formula[method](field("intent").checked) : formula[method]();

    outputArea.value = String(result);
    outputMeta.textContent = `${String(result).length.toLocaleString()} characters · ${output === "unicodemath" ? "UnicodeMath" : output.toUpperCase()}`;
    renderPreview(formula);
    indicateUpdate(outputArea);
    indicateUpdate(field("converter-preview"));
    clearConversionError();
  } catch (error) {
    outputArea.value = "";
    outputMeta.textContent = "Conversion failed";
    field("converter-preview").replaceChildren();
    setConversionError(error?.message || "The browser engine could not convert this formula. Check the source syntax and selected format.");
  }
}

function scheduleConversion() {
  window.clearTimeout(conversionTimer);
  conversionTimer = window.setTimeout(convertNow, 220);
}

function updateVisibleOptions() {
  const output = field("output-format").value;
  const input = field("input-format").value;
  const locale = field("locale");
  const localeSupported = ["asciimath", "latex", "html", "unicode"].includes(input);

  locale.disabled = !localeSupported;
  locale.closest(".field").style.opacity = localeSupported ? "1" : "0.48";

  document.querySelectorAll("[data-option-for]").forEach((row) => {
    row.hidden = !row.dataset.optionFor.split(",").includes(output);
  });

  const title = document.querySelector("[data-output-options-title]");
  title.textContent = output === "mathml" ? "MathML options" : output === "omml" ? "OMML options" : "Output-specific options";
}

function setSample(name) {
  const sample = samples[name];
  if (!sample) return;
  field("input-format").value = sample.format;
  field("converter-source").value = sample.value;
  updateVisibleOptions();
  convertNow();
}

function resetConverter() {
  field("input-format").value = "asciimath";
  field("output-format").value = "mathml";
  field("converter-source").value = samples.sum.value;
  field("locale").value = "en";
  field("formatter-profile").value = "none";
  field("unitsml").checked = false;
  field("intent").checked = false;
  field("display-style").checked = true;
  field("split-lines").checked = false;
  field("unary-spacing").checked = true;
  updateVisibleOptions();
  convertNow();
}

function swapFormats() {
  const input = field("input-format");
  const output = field("output-format");
  const source = field("converter-source");
  const result = field("converter-output");
  const nextInput = inputFromOutput[output.value];
  const nextOutput = outputFromInput[input.value];

  if (!nextInput || !nextOutput) return;
  input.value = nextInput;
  output.value = nextOutput;
  if (result.value) source.value = result.value;
  updateVisibleOptions();
  convertNow();
}

function populateFormatterProfiles() {
  const select = field("formatter-profile");
  const selected = select.value;
  select.replaceChildren(new Option("None", "none"));

  try {
    const store = JSON.parse(localStorage.getItem(FORMATTER_KEY));
    store?.profiles?.forEach((profile) => select.append(new Option(profile.name, profile.id)));
  } catch (error) {
    // A malformed optional store must not block conversion.
  }

  if (Array.from(select.options).some((option) => option.value === selected)) select.value = selected;
}

async function loadBrowserEngine() {
  const status = field("runtime-status");

  try {
    const moduleUrl = new URL("../../../../javascript/plurimath-js/dist/index.js", import.meta.url);
    const module = await import(moduleUrl.href);
    BrowserPlurimath = module.default;
    status.classList.add("is-ready");
    status.querySelector("strong").textContent = "Engine ready";
    status.querySelector("span").textContent = "Local browser bundle";
    convertNow();
  } catch (error) {
    status.querySelector("strong").textContent = "Engine unavailable";
    status.querySelector("span").textContent = "Generated Ruby call still works";
    setConversionError("The local conversion bundle could not load. Serve the repository root over HTTP to enable browser conversion.");
  }
}

function initializeConverter() {
  if (!converterElement()) return;

  populateFormatterProfiles();
  updateVisibleOptions();

  converterElement().querySelectorAll("input, select, textarea").forEach((control) => {
    control.addEventListener(control.tagName === "TEXTAREA" ? "input" : "change", () => {
      updateVisibleOptions();
      scheduleConversion();
    });
  });

  document.querySelectorAll("[data-converter-sample]").forEach((button) => {
    button.addEventListener("click", () => setSample(button.dataset.converterSample));
  });

  document.querySelector("[data-swap-formats]").addEventListener("click", swapFormats);
  document.querySelector("[data-converter-reset]").addEventListener("click", resetConverter);
  window.addEventListener("storage", populateFormatterProfiles);

  const requestedSample = new URLSearchParams(location.search).get("sample");
  if (requestedSample) setSample(requestedSample);

  field("ruby-code").textContent = generatedRubyCall();
  loadBrowserEngine();
}

initializeConverter();
