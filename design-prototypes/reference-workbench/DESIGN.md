# Plurimath Reference Workbench

## Purpose and audience

This prototype serves developers integrating Plurimath and technical authors
who need to inspect mathematical representations. A first-time visitor should
understand the conversion model and reach a working converter quickly. A
returning visitor should reach a function, symbol, method, or formatter profile
without crossing an unrelated marketing page.

## Direction

**Reference Workbench** assigns each inspiration one job:

- LutaML contributes a calm, readable documentation shell.
- Relaton contributes the technical narrative and live representation tabs.
- Geolexica contributes searchable catalogs and structured record pages.
- Plurimath contributes the representation seam: each format keeps a stable
  color and label wherever it appears.

The aesthetic risk is restrained editorial type inside a precise application
shell. Serif type identifies mathematical objects and page theses; interface
copy remains sans-serif; syntax remains monospace. It avoids both a generic
documentation template and a generic gradient dashboard.

## Information architecture

```text
Home
├── Learn
│   ├── Getting started
│   └── API reference
├── Reference
│   ├── Functions
│   ├── Function record: abs
│   └── Symbols
├── Tools
│   ├── Converter
│   ├── Evaluator concept
│   └── Number formatter
└── Updates
    ├── Blog index
    └── Article
```

Each node is a real HTML document. Shared CSS, JavaScript, and shell partials
keep the system coherent without recreating a single-page application.

## Palette

### Dark

| Role | Value |
| --- | --- |
| Canvas | `#090D18` |
| Surface | `#111827` |
| Raised surface | `#18243A` |
| Primary text | `#F3F6FB` |
| Muted text | `#A9B5C8` |
| Rule | `#2A3852` |
| Action blue | `#4C8DFF` |
| Model teal | `#32D2B2` |
| Conversion coral | `#FF806C` |
| Warning amber | `#F2C66D` |

### Light

| Role | Value |
| --- | --- |
| Canvas | `#F4F7FB` |
| Surface | `#FFFFFF` |
| Raised surface | `#EAF0F8` |
| Primary text | `#152033` |
| Muted text | `#59677B` |
| Rule | `#CAD5E4` |
| Action blue | `#185DCC` |
| Model teal | `#087F6C` |
| Conversion coral | `#C74A38` |
| Warning amber | `#8A6300` |

Color is never the only state indicator. Selected formats also use labels,
weight, borders, and `aria-selected`.

## Typography

- Display and record titles: `Bitstream Charter`, `Charter`, `Palatino`, serif.
- Interface and prose: `Source Sans 3`, `Avenir Next`, `Segoe UI`, system sans-serif.
- Code and serialized forms: `Ubuntu Mono`, `ui-monospace`, `Consolas`.
- Body text is 16–18px with a 1.55–1.7 line height and a 68-character reading
  measure.

No remote font request is required for the prototype. Production should bundle
the approved faces and their licenses so typography does not vary by platform.

## Identity and motion

The header uses the repository's canonical Plurimath cube from
`assets/symbol.svg`. Representation colors remain interface wayfinding rather
than a replacement brand identity. Header controls use one SVG icon language.

Motion explains state rather than decorating scroll. The home representation
seam traces once; tabs crossfade; drawers, dialogs, feedback, and arrangement
controls use 140–360ms transitions. Reduced-motion preferences collapse these
effects to effectively instantaneous changes.

## Personal arrangement

Converter, evaluator, and NumberFormatter are workbenches, so each exposes an
explicit **Arrange** mode. Normal browsing never starts a drag.

- A dedicated 44px handle moves each top-level workbench panel.
- Wide layouts support bounded two-dimensional placement on an 8px grid.
- Occupied positions reflow nearby panels live instead of silently changing the
  requested drop location.
- Narrow layouts retain full-width cards; each arrow or drop changes their
  vertical order by position.
- Panels may overlap while moving, but never after they are dropped.
- Keyboard users pick up a panel with Space or Enter, move with arrow keys,
  drop with Space or Enter, and cancel with Escape.
- Pointer movement scrolls at viewport edges, while panel controls are inert
  until arrangement ends.
- Layouts persist per page and responsive view in browser storage. Undo, reset,
  malformed-data fallback, a saved-layout indicator, and a `?arrange=1` review
  URL are supported. Choosing Done removes that review parameter.

Reading and reference structures remain fixed: navigation, article prose,
chronological posts, catalogs, representation tabs, and ordered conversion
explanations. Their sequence communicates content rather than personal layout.

## Components

- Global top bar, command search, theme control, and mobile navigation drawer.
- Representation tabs with stable format colors.
- Catalog search, filter chips, compact result records, and result count.
- Record detail with preview, source, metadata, and direct converter action.
- Workbench panels for source, options, output, preview, and generated API call.
- Browser-persistent formatter profiles with create, duplicate, rename, delete,
  and active selection.
- Browser-persistent workbench layouts with explicit arrange, undo, and reset
  controls.
- Status notices that distinguish live browser behavior from Ruby-only concepts.

## Math and code accommodation

Native MathML remains in the DOM as the prototype's visual and accessible
source. Display math uses `currentColor`, normal line height, and its own
horizontal overflow container. Complex production rendering should evaluate
build-time MathJax 4 output; this prototype does not claim native MathML parity
for complex matrices and stretchy operators.

Code preserves whitespace, has an accessible label, and scrolls inside its own
panel rather than widening the page.

## Accessibility baseline

- Skip link, semantic landmarks, ordered headings, and explicit form labels.
- Visible `:focus-visible` styles and minimum 44px primary touch targets.
- Navigation drawer returns focus when closed and closes with Escape.
- 320px reflow and 200% zoom do not create page-level horizontal scrolling.
- Theme follows system preference and is user-overridable.
- Reduced-motion preference removes nonessential transitions.

## Prototype boundaries

- This directory is a design-review artifact, not a production implementation
  or merge-ready replacement for the Jekyll site.
- Representative records demonstrate page behavior; they are not a generated
  replacement for the full function or symbol corpus.
- Formatter and evaluator browser execution are design prototypes and say so.
- Existing public paths remain production migration constraints.
- Production integration must retain the current demo's MathJax/native renderer
  choice and rendering-tree output.
