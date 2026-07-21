import { indicateUpdate } from "./site.js";

const samples = {
  pythagorean: {
    expression: "sqrt(a^2 + b^2)",
    bindings: [{ name: "a", value: 3 }, { name: "b", value: 4 }],
    mathml: '<math display="block" aria-label="square root of a squared plus b squared"><msqrt><mrow><msup><mi>a</mi><mn>2</mn></msup><mo>+</mo><msup><mi>b</mi><mn>2</mn></msup></mrow></msqrt></math>'
  },
  trig: {
    expression: "sin(x)",
    bindings: [{ name: "x", value: 0 }],
    mathml: '<math display="block" aria-label="sine of x"><mrow><mi>sin</mi><mo>⁡</mo><mo>(</mo><mi>x</mi><mo>)</mo></mrow></math>'
  },
  sum: {
    expression: "sum_(i=1)^n i",
    bindings: [{ name: "n", value: 10 }],
    mathml: '<math display="block" aria-label="sum from i equals one to n of i"><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><mi>i</mi></math>'
  }
};

let bindings = samples.pythagorean.bindings.map((binding) => ({ ...binding }));

function evaluatorRoot() {
  return document.querySelector("[data-evaluator]");
}

function element(name) {
  return evaluatorRoot()?.querySelector(`[data-${name}]`);
}

function rubyString(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function renderBindings() {
  const list = element("binding-list");
  list.replaceChildren();

  bindings.forEach((binding, index) => {
    const row = document.createElement("div");
    const nameLabel = document.createElement("label");
    const nameText = document.createElement("span");
    const nameInput = document.createElement("input");
    const valueLabel = document.createElement("label");
    const valueText = document.createElement("span");
    const valueInput = document.createElement("input");
    const remove = document.createElement("button");

    row.className = "form-grid";
    nameLabel.className = "field";
    nameText.textContent = "Variable";
    nameInput.value = binding.name;
    nameInput.name = `binding-${index + 1}-name`;
    nameInput.autocomplete = "off";
    nameInput.setAttribute("aria-label", `Binding ${index + 1} variable name`);
    nameInput.addEventListener("input", () => {
      binding.name = nameInput.value.replace(/[^a-zA-Z0-9_]/g, "");
      if (nameInput.value !== binding.name) nameInput.value = binding.name;
      updateEvaluation();
    });
    nameLabel.append(nameText, nameInput);

    valueLabel.className = "field";
    valueText.textContent = "Numeric value";
    valueInput.type = "number";
    valueInput.step = "any";
    valueInput.value = binding.value;
    valueInput.name = `binding-${index + 1}-value`;
    valueInput.autocomplete = "off";
    valueInput.setAttribute("aria-label", `Binding ${index + 1} numeric value`);
    valueInput.addEventListener("input", () => {
      binding.value = Number(valueInput.value);
      updateEvaluation();
    });
    valueLabel.append(valueText, valueInput);

    remove.className = "button-quiet button-danger";
    remove.type = "button";
    remove.textContent = "Remove binding";
    remove.addEventListener("click", () => {
      bindings.splice(index, 1);
      renderBindings();
      updateEvaluation();
    });

    row.append(nameLabel, valueLabel, remove);
    list.append(row);
  });
}

function bindingMap() {
  return Object.fromEntries(bindings.filter((binding) => binding.name).map((binding) => [binding.name, Number(binding.value)]));
}

function approximateResult(expression) {
  const values = bindingMap();
  const compact = expression.replace(/\s+/g, "");

  if (compact === "sqrt(a^2+b^2)" && Number.isFinite(values.a) && Number.isFinite(values.b)) {
    return Math.sqrt(values.a ** 2 + values.b ** 2);
  }

  if (compact === "sin(x)" && Number.isFinite(values.x)) return Math.sin(values.x);

  if (compact === "sum_(i=1)^ni" && Number.isInteger(values.n) && values.n >= 0) {
    return values.n * (values.n + 1) / 2;
  }

  return null;
}

function generatedRubyCode(expression) {
  const renderedBindings = bindings
    .filter((binding) => binding.name)
    .map((binding) => `${binding.name}: ${Number(binding.value)}`)
    .join(", ");

  return [
    "formula = Plurimath::Math.parse(",
    `  ${rubyString(expression)},`,
    "  :asciimath",
    ")",
    "",
    `formula.evaluate(${renderedBindings})`
  ].join("\n");
}

function updateEvaluation() {
  const expression = element("expression").value.trim();
  const result = approximateResult(expression);

  element("evaluation-output").textContent = result === null ? "Run in Ruby" : Number(result.toFixed(10)).toString();
  element("evaluation-status").textContent = result === null
    ? "Custom expressions are not executed in this browser prototype."
    : "Recognized sample; generated Ruby is authoritative.";
  element("evaluation-code").textContent = generatedRubyCode(expression);
  indicateUpdate(element("evaluation-output"));
  indicateUpdate(element("evaluation-preview"));
}

function setSample(name) {
  const sample = samples[name];
  if (!sample) return;

  element("expression").value = sample.expression;
  bindings = sample.bindings.map((binding) => ({ ...binding }));
  renderBindings();
  element("evaluation-preview").innerHTML = sample.mathml;
  updateEvaluation();
}

function handleExpressionInput() {
  const message = document.createElement("p");
  message.className = "muted";
  message.textContent = "Choose a sample to restore the formula preview.";
  element("evaluation-preview").replaceChildren(message);
  updateEvaluation();
}

function addBinding() {
  bindings.push({ name: `x${bindings.length + 1}`, value: 0 });
  renderBindings();
  updateEvaluation();
}

function initializeEvaluator() {
  if (!evaluatorRoot()) return;

  renderBindings();
  updateEvaluation();
  element("expression").addEventListener("input", handleExpressionInput);
  element("add-binding").addEventListener("click", addBinding);

  evaluatorRoot().querySelectorAll("[data-evaluator-sample]").forEach((button) => {
    button.addEventListener("click", () => setSample(button.dataset.evaluatorSample));
  });
}

initializeEvaluator();
