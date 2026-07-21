# Plurimath Reference Workbench design review

This is a multi-page design-review artifact. It is not a production Jekyll
implementation and must not be merged as the finished site. It uses the
repository's canonical Plurimath logo and existing project facts while testing
the proposed navigation, visual system, responsive behavior, and interactions.

Serve the repository root so shared partials and the local browser bundle can
load:

```sh
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173/design-prototypes/reference-workbench/
```

Review the pages as separate documents in this order:

1. Home
2. Functions and the `abs` record
3. Converter
4. Symbols, API, and getting started
5. Number formatter and evaluator concept
6. Blog and article

The converter uses `javascript/plurimath-js/dist/index.js`. NumberFormatter
profiles and theme preference use browser local storage. Formatter and evaluator
execution are explicitly labeled as prototype behavior where the current
browser wrapper does not expose the Ruby API.

Converter, evaluator, and NumberFormatter also expose an **Arrange** control.
Open a workbench with `?arrange=1` to enter that mode directly, for example:

```text
http://localhost:4173/design-prototypes/reference-workbench/converter.html?arrange=1
```

Use the panel handles to position modules, then choose **Done**. Layouts remain
local to the browser and can be undone or reset from the arrangement toolbar.

Before production integration, preserve the existing public routes, MathJax and
native-renderer demo options, rendering-tree output, authored posts, and full
generated function and symbol data. New API, formatter, and evaluator pages
remain explicit product-scope decisions rather than automatic redesign scope.
