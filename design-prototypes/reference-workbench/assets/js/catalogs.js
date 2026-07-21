const functions = [
  { name: "abs", arity: "unary", category: "Numeric", description: "Wrap an expression as an absolute value.", formats: 5, syntax: "abs(x)", detail: true },
  { name: "sqrt", arity: "unary", category: "Numeric", description: "Create the principal square root of an expression.", formats: 5, syntax: "sqrt(x)" },
  { name: "matrix", arity: "unary", category: "Structure", description: "Represent a matrix without an enclosing delimiter.", formats: 2, syntax: "matrix(x)" },
  { name: "cases", arity: "unary", category: "Structure", description: "Build a piecewise expression with aligned cases.", formats: 1, syntax: "cases(x)" },
  { name: "vec", arity: "unary", category: "Style", description: "Place a vector arrow above an expression.", formats: 5, syntax: "vec(x)" },
  { name: "bold", arity: "unary", category: "Style", description: "Apply a bold mathematical style to content.", formats: 5, syntax: "bold(x)" },
  { name: "frac", arity: "binary", category: "Structure", description: "Place a numerator over a denominator.", formats: 5, syntax: "frac(x)(y)" },
  { name: "root", arity: "binary", category: "Numeric", description: "Create a radical with an explicit index.", formats: 5, syntax: "root(n)(x)" },
  { name: "color", arity: "binary", category: "Style", description: "Apply a color value to mathematical content.", formats: 5, syntax: "color(red)(x)" },
  { name: "overset", arity: "binary", category: "Structure", description: "Position one expression above another.", formats: 4, syntax: "overset(a)(b)" },
  { name: "sum", arity: "ternary", category: "Numeric", description: "Create a summation with lower and upper bounds.", formats: 5, syntax: "sum_(i=1)^n" },
  { name: "lim", arity: "ternary", category: "Numeric", description: "Represent a limit with a variable and destination.", formats: 4, syntax: "lim_(x→0)" }
];

const symbols = [
  { glyph: "∀", name: "For all", aliases: ["forall", "AA"], latex: "\\forall", asciimath: "forall", detail: true },
  { glyph: "α", name: "Greek small alpha", aliases: ["alpha", "Greek"], latex: "\\alpha", asciimath: "alpha" },
  { glyph: "β", name: "Greek small beta", aliases: ["beta", "Greek"], latex: "\\beta", asciimath: "beta" },
  { glyph: "∑", name: "N-ary summation", aliases: ["sum", "sigma"], latex: "\\sum", asciimath: "sum" },
  { glyph: "∫", name: "Integral", aliases: ["integral", "calculus"], latex: "\\int", asciimath: "int" },
  { glyph: "√", name: "Square root", aliases: ["root", "radical"], latex: "\\sqrt{}", asciimath: "sqrt()" },
  { glyph: "→", name: "Rightwards arrow", aliases: ["arrow", "to"], latex: "\\rightarrow", asciimath: "rarr" },
  { glyph: "∞", name: "Infinity", aliases: ["infinity", "infinite"], latex: "\\infty", asciimath: "oo" },
  { glyph: "≤", name: "Less-than or equal", aliases: ["less", "leq"], latex: "\\leq", asciimath: "<=" },
  { glyph: "∈", name: "Element of", aliases: ["in", "belongs"], latex: "\\in", asciimath: "in" },
  { glyph: "≈", name: "Approximately equal", aliases: ["approx", "similar"], latex: "\\approx", asciimath: "~~" },
  { glyph: "ℝ", name: "Double-struck capital R", aliases: ["reals", "numbers"], latex: "\\mathbb{R}", asciimath: "RR" }
];

function textMatches(values, query) {
  return values.join(" ").toLowerCase().includes(query.trim().toLowerCase());
}

function functionCard(item) {
  const element = document.createElement(item.detail ? "a" : "article");
  const top = document.createElement("div");
  const arity = document.createElement("span");
  const formatCount = document.createElement("span");
  const title = document.createElement("h2");
  const description = document.createElement("p");
  const meta = document.createElement("div");
  const syntax = document.createElement("code");
  const state = document.createElement("span");

  element.className = "catalog-card";
  element.dataset.arity = item.arity;
  element.style.setProperty("--card-accent", item.category === "Structure" ? "var(--model)" : item.category === "Style" ? "var(--format-latex)" : "var(--action)");
  if (item.detail) element.href = "function-abs.html";

  top.className = "catalog-card__top";
  arity.className = "meta-badge";
  arity.textContent = item.arity;
  formatCount.className = "meta-badge";
  formatCount.textContent = `${item.formats} formats`;
  top.append(arity, formatCount);

  title.textContent = item.name;
  description.textContent = item.description;

  meta.className = "catalog-card__meta";
  syntax.textContent = item.syntax;
  state.textContent = item.detail ? "Open record →" : "Catalog sample";
  meta.append(syntax, state);

  element.append(top, title, description, meta);
  return element;
}

function symbolCard(item) {
  const element = document.createElement("article");
  const glyph = document.createElement("div");
  const title = document.createElement("h2");
  const aliases = document.createElement("div");
  const meta = document.createElement("div");
  const latex = document.createElement("code");
  const copy = document.createElement("button");

  element.className = "catalog-card";
  element.style.setProperty("--card-accent", "var(--model)");

  glyph.className = "symbol-glyph";
  glyph.setAttribute("aria-label", item.name);
  glyph.textContent = item.glyph;
  if (item.detail) {
    const detailLink = document.createElement("a");
    detailLink.href = "symbol-forall.html";
    detailLink.textContent = `${item.name} →`;
    title.append(detailLink);
  } else {
    title.textContent = item.name;
  }

  aliases.className = "symbol-aliases";
  item.aliases.forEach((alias) => {
    const code = document.createElement("code");
    code.textContent = alias;
    aliases.append(code);
  });

  meta.className = "catalog-card__meta";
  latex.textContent = item.latex;
  copy.className = "copy-button";
  copy.type = "button";
  copy.setAttribute("aria-live", "polite");
  copy.textContent = "Copy LaTeX";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(item.latex);
      copy.textContent = "Copied";
      window.setTimeout(() => { copy.textContent = "Copy LaTeX"; }, 1600);
    } catch (error) {
      copy.textContent = "Copy failed — select the value";
    }
  });
  meta.append(latex, copy);

  element.append(glyph, title, aliases, meta);
  return element;
}

function initializeFunctionCatalog() {
  const catalog = document.querySelector("[data-function-catalog]");
  if (!catalog) return;

  const results = catalog.querySelector("[data-function-results]");
  const search = catalog.querySelector("[data-function-search]");
  const count = catalog.querySelector("[data-function-count]");
  let activeArity = "all";

  function render() {
    const query = search.value;
    const matches = functions.filter((item) => {
      const arityMatches = activeArity === "all" || item.arity === activeArity;
      const queryMatches = textMatches([item.name, item.arity, item.category, item.description, item.syntax], query);
      return arityMatches && queryMatches;
    });

    results.replaceChildren();
    matches.forEach((item) => results.append(functionCard(item)));
    count.textContent = `Showing ${matches.length} of 12 prototype records`;

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent = "No prototype records match. Try a function name or choose another arity.";
      results.append(empty);
    }
  }

  catalog.querySelectorAll("[data-function-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeArity = button.dataset.functionFilter;
      catalog.querySelectorAll("[data-function-filter]").forEach((item) => {
        item.setAttribute("aria-pressed", String(item.dataset.functionFilter === activeArity));
      });
      render();
    });
  });

  search.addEventListener("input", render);
  render();
}

function initializeSymbolCatalog() {
  const catalog = document.querySelector("[data-symbol-catalog]");
  if (!catalog) return;

  const results = catalog.querySelector("[data-symbol-results]");
  const search = catalog.querySelector("[data-symbol-search]");
  const count = catalog.querySelector("[data-symbol-count]");

  function render() {
    const query = search.value;
    const matches = symbols.filter((item) => textMatches([
      item.glyph,
      item.name,
      item.aliases.join(" "),
      item.latex,
      item.asciimath
    ], query));

    results.replaceChildren();
    matches.forEach((item) => results.append(symbolCard(item)));
    count.textContent = `Showing ${matches.length} of 12 prototype records`;

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent = "No prototype symbols match. Try a glyph, name, or alias.";
      results.append(empty);
    }
  }

  search.addEventListener("input", render);
  render();
}

initializeFunctionCatalog();
initializeSymbolCatalog();
