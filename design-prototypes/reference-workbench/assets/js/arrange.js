const STORAGE_KEY = "plurimath.reference-workbench.arrangements.v1";
const STORAGE_VERSION = 1;
const SNAP_SIZE = 8;
const COLLISION_GAP = 12;
const EDGE_SCROLL_ZONE = 80;
const MAX_EDGE_SCROLL_SPEED = 18;
const NARROW_LAYOUT = window.matchMedia("(max-width: 60rem)");

let storageAvailable = true;
let arrangementStore = loadArrangementStore();
let arrangeModeActive = false;
let surfaceStates = [];
let activePointerMove = null;
let activeKeyboardMove = null;
const undoStacks = { narrow: [], wide: [] };
let resizeTimer = null;
let initialized = false;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function defaultStore() {
  return { schemaVersion: STORAGE_VERSION, pages: {} };
}

function loadArrangementStore() {
  let storedValue;
  try {
    storedValue = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageAvailable = false;
    return defaultStore();
  }

  try {
    const saved = JSON.parse(storedValue);
    if (saved?.schemaVersion === STORAGE_VERSION && isRecord(saved.pages)) {
      return saved;
    }
  } catch (error) {
    // Invalid or unavailable storage falls back to the authored layout.
  }

  return defaultStore();
}

function saveArrangementStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arrangementStore));
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
  }

  updateToolbar();
}

function pageKey() {
  return document.body.dataset.page || "page";
}

function breakpointKey() {
  return NARROW_LAYOUT.matches ? "narrow" : "wide";
}

function pageLayouts(create = false) {
  const currentPage = pageKey();
  const currentBreakpoint = breakpointKey();

  if (create) {
    if (!isRecord(arrangementStore.pages)) arrangementStore.pages = {};
    if (!isRecord(arrangementStore.pages[currentPage])) arrangementStore.pages[currentPage] = {};
    if (!isRecord(arrangementStore.pages[currentPage][currentBreakpoint])) {
      arrangementStore.pages[currentPage][currentBreakpoint] = {};
    }
  }

  const layouts = arrangementStore.pages[currentPage]?.[currentBreakpoint];
  return isRecord(layouts) ? layouts : null;
}

function storedLayout(state) {
  const layout = pageLayouts()?.[state.id];
  return isRecord(layout) && isRecord(layout.items) ? layout : null;
}

function setStoredLayout(state, layout) {
  pageLayouts(true)[state.id] = clone(layout);
  saveArrangementStore();
}

function deleteStoredLayout(state) {
  const layouts = pageLayouts();
  if (!layouts?.[state.id]) return;
  delete layouts[state.id];
  saveArrangementStore();
}

function surfaceItems(element) {
  return Array.from(element.children).filter((child) => child.hasAttribute("data-arrange-item"));
}

function itemLabel(item) {
  return item.dataset.arrangeLabel || item.dataset.arrangeItem || "panel";
}

function itemId(item) {
  return item.dataset.arrangeItem;
}

function createMoveIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const path = document.createElementNS(namespace, "path");

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", "M8 5.5a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 8 5.5Zm5.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM8 12a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 8 12Zm5.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM8 18.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z");
  svg.append(path);
  return svg;
}

function createHandle(item, state) {
  const handle = document.createElement("button");
  handle.className = "arrange-handle";
  handle.type = "button";
  handle.hidden = !arrangeModeActive;
  handle.setAttribute("aria-label", `Move ${itemLabel(item)}`);
  handle.setAttribute("aria-describedby", "arrange-instructions");
  handle.setAttribute("aria-pressed", "false");
  handle.append(createMoveIcon());
  handle.addEventListener("pointerdown", (event) => beginPointerMove(event, state, item, handle));
  handle.addEventListener("keydown", (event) => handleMoveKey(event, state, item, handle));
  item.prepend(handle);
  return handle;
}

function decorateSurface(state) {
  state.items.forEach((entry, id) => {
    if (entry.element.parentElement === state.element) return;
    state.resizeObserver?.unobserve(entry.element);
    state.items.delete(id);
  });

  surfaceItems(state.element).forEach((item) => {
    const id = itemId(item);
    if (!id || state.items.has(id)) return;

    item.classList.add("arrange-item");
    const handle = createHandle(item, state);
    state.items.set(id, { element: item, handle, width: 0, height: 0 });
    setItemContentInert(item, handle, arrangeModeActive);
    state.resizeObserver?.observe(item);
  });
}

function orderSurfaceChildren(state, itemOrder) {
  const orderedItems = itemOrder
    .map((id) => state.items.get(id)?.element)
    .filter(Boolean);
  const remainingItems = surfaceItems(state.element).filter((item) => !orderedItems.includes(item));
  const itemQueue = [...orderedItems, ...remainingItems];
  const orderedChildren = state.authoredChildren.map((child) => {
    return child.hasAttribute("data-arrange-item") ? itemQueue.shift() : child;
  });

  orderedChildren.filter(Boolean).forEach((child) => state.element.append(child));
  itemQueue.forEach((child) => state.element.append(child));
}

function restoreNaturalLayout(state) {
  orderSurfaceChildren(state, state.authoredOrder);
  state.element.classList.remove("has-arranged-layout", "is-arrange-surface-active");
  state.element.style.removeProperty("height");

  state.items.forEach(({ element }) => {
    element.style.removeProperty("width");
    element.style.removeProperty("transform");
    element.style.removeProperty("z-index");
    delete element.dataset.arrangeX;
    delete element.dataset.arrangeY;
  });
}

function measureNaturalLayout(state) {
  restoreNaturalLayout(state);
  const surfaceRect = state.element.getBoundingClientRect();
  const items = {};

  state.items.forEach((entry, id) => {
    const rect = entry.element.getBoundingClientRect();
    entry.width = rect.width;
    entry.height = rect.height;
    const maxX = Math.max(0, surfaceRect.width - rect.width);
    const x = Math.max(0, rect.left - surfaceRect.left);
    items[id] = {
      xRatio: maxX > 0 ? x / maxX : 0,
      y: Math.max(0, rect.top - surfaceRect.top)
    };
  });

  return {
    items,
    order: surfaceItems(state.element).map(itemId),
    frameHeight: Math.max(state.element.scrollHeight, state.element.getBoundingClientRect().height)
  };
}

function reconciledLayout(state, measured, saved) {
  const layout = clone(measured);
  if (!isRecord(saved?.items)) return layout;

  Object.keys(layout.items).forEach((id) => {
    const position = saved.items[id];
    if (!position || !Number.isFinite(position.xRatio) || !Number.isFinite(position.y)) return;
    layout.items[id] = {
      xRatio: Math.max(0, Math.min(1, position.xRatio)),
      y: Math.max(0, position.y)
    };
  });

  const knownIds = new Set(Object.keys(layout.items));
  const savedOrder = Array.isArray(saved.order)
    ? [...new Set(saved.order.filter((id) => knownIds.has(id)))]
    : [];
  const newIds = layout.order.filter((id) => !savedOrder.includes(id));
  layout.order = [...savedOrder, ...newIds];
  layout.frameHeight = measured.frameHeight;
  return layout;
}

function positionFor(state, id, layout = state.layout) {
  const entry = state.items.get(id);
  const stored = layout.items[id];
  const surfaceWidth = state.element.getBoundingClientRect().width;
  const maxX = Math.max(0, surfaceWidth - entry.width);

  return {
    x: NARROW_LAYOUT.matches ? 0 : Math.round(stored.xRatio * maxX),
    y: stored.y
  };
}

function setItemPosition(state, id, position) {
  const entry = state.items.get(id);
  const surfaceWidth = state.element.getBoundingClientRect().width;
  const maxX = Math.max(0, surfaceWidth - entry.width);
  const x = NARROW_LAYOUT.matches ? 0 : Math.max(0, Math.min(maxX, position.x));
  const y = Math.max(0, position.y);

  entry.element.dataset.arrangeX = String(x);
  entry.element.dataset.arrangeY = String(y);
  entry.element.style.width = `${entry.width}px`;
  entry.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  state.layout.items[id] = {
    xRatio: maxX > 0 ? x / maxX : 0,
    y
  };
}

function writeLayoutPosition(state, layout, id, position) {
  const entry = state.items.get(id);
  const surfaceWidth = state.element.getBoundingClientRect().width;
  const maxX = Math.max(0, surfaceWidth - entry.width);
  layout.items[id] = {
    xRatio: maxX > 0 ? position.x / maxX : 0,
    y: position.y
  };
}

function orderedIdsForLayout(state, layout) {
  return Array.from(state.items.keys()).sort((firstId, secondId) => {
    const first = positionFor(state, firstId, layout);
    const second = positionFor(state, secondId, layout);
    return first.y - second.y || first.x - second.x;
  });
}

function sortLayoutOrder(state, layout = state.layout) {
  layout.order = orderedIdsForLayout(state, layout);
}

function reconcileCollisions(state) {
  const candidate = clone(state.layout);
  const occupiedRectangles = [];

  for (const id of candidate.order) {
    const requested = positionFor(state, id, candidate);
    const resolved = nearestFreeAgainstRectangles(state, id, requested, occupiedRectangles);
    if (!resolved) {
      state.layout = clone(state.measured);
      sortLayoutOrder(state);
      return false;
    }

    writeLayoutPosition(state, candidate, id, resolved);
    occupiedRectangles.push(itemRectangle(state, id, resolved));
  }

  state.layout = candidate;
  state.layout.frameHeight = state.measured.frameHeight;
  sortLayoutOrder(state);
  return true;
}

function updateSurfaceHeight(state) {
  let requiredHeight = state.measured.frameHeight;

  state.items.forEach((entry, id) => {
    const position = positionFor(state, id);
    requiredHeight = Math.max(requiredHeight, position.y + entry.element.offsetHeight);
  });

  state.layout.frameHeight = requiredHeight;
  state.element.style.height = `${requiredHeight}px`;
}

function applyAbsoluteLayout(state, reorderChildren = true) {
  sortLayoutOrder(state);
  if (reorderChildren) orderSurfaceChildren(state, state.layout.order);
  state.element.classList.add("has-arranged-layout");
  state.element.classList.toggle("is-arrange-surface-active", arrangeModeActive);
  state.layout.order.forEach((id) => {
    if (!state.items.has(id)) return;
    setItemPosition(state, id, positionFor(state, id));
  });
  updateSurfaceHeight(state);
}

function prepareSurface(state, force = false) {
  decorateSurface(state);
  const saved = storedLayout(state);
  if (!saved && !arrangeModeActive && !force) {
    restoreNaturalLayout(state);
    state.layout = null;
    return;
  }

  state.measured = measureNaturalLayout(state);
  state.frameLimit = NARROW_LAYOUT.matches
    ? state.measured.frameHeight
    : state.measured.frameHeight + Math.max(480, window.innerHeight);
  state.layout = reconciledLayout(state, state.measured, saved);
  if (saved) reconcileCollisions(state);
  applyAbsoluteLayout(state);
}

function refreshSurface(state) {
  const hadLayout = Boolean(storedLayout(state)) || arrangeModeActive;
  restoreNaturalLayout(state);
  window.cancelAnimationFrame(state.refreshFrame);
  state.refreshFrame = window.requestAnimationFrame(() => prepareSurface(state, hadLayout));
}

function createToolbar() {
  const toolbar = document.createElement("div");
  toolbar.className = "arrange-toolbar";
  toolbar.hidden = true;
  toolbar.setAttribute("role", "region");
  toolbar.setAttribute("aria-label", "Page arrangement controls");
  toolbar.innerHTML = `
    <div class="arrange-toolbar__copy">
      <strong>Arrange layout</strong>
      <span data-arrange-status>Drag, or use the keyboard instructions on each handle.</span>
    </div>
    <div class="arrange-toolbar__actions">
      <button class="button-quiet" type="button" data-arrange-undo disabled>Undo</button>
      <button class="button-quiet" type="button" data-arrange-reset>Reset</button>
      <button class="button" type="button" data-arrange-done>Done</button>
    </div>
    <p class="sr-only" id="arrange-instructions">Press Space or Enter to pick up and drop a panel. Use arrow keys to move it. Press Escape to cancel a move.</p>
    <p class="sr-only" data-arrange-live aria-live="polite"></p>
  `;
  const main = document.querySelector("main");
  if (main) main.before(toolbar);
  else document.body.append(toolbar);
  toolbar.querySelector("[data-arrange-done]").addEventListener("click", exitArrangeMode);
  toolbar.querySelector("[data-arrange-reset]").addEventListener("click", resetCurrentLayouts);
  toolbar.querySelector("[data-arrange-undo]").addEventListener("click", undoLastLayoutChange);
  return toolbar;
}

function toolbar() {
  return document.querySelector(".arrange-toolbar");
}

function announce(message) {
  const liveRegion = toolbar()?.querySelector("[data-arrange-live]");
  if (liveRegion) liveRegion.textContent = message;
}

function updateArrangeToggle() {
  const toggle = document.querySelector("[data-arrange-toggle]");
  if (!toggle) return;
  const hasSavedLayout = surfaceStates.some((state) => Boolean(storedLayout(state)));
  toggle.classList.toggle("has-saved-arrangement", hasSavedLayout);
  toggle.setAttribute("aria-label", hasSavedLayout ? "Arrange page; custom layout saved" : "Arrange page");
  toggle.title = hasSavedLayout ? "Custom layout saved" : "Arrange page";
}

function updateToolbar() {
  updateArrangeToggle();
  const status = toolbar()?.querySelector("[data-arrange-status]");
  const undo = toolbar()?.querySelector("[data-arrange-undo]");
  if (undo) undo.disabled = currentUndoStack().length === 0;
  if (!status) return;

  const view = NARROW_LAYOUT.matches ? "Phone layout · vertical movement" : "Desktop layout · two-dimensional movement";
  const storage = storageAvailable ? "Saved in this browser" : "This session only";
  status.textContent = `${view}. ${storage}. Space or Enter picks up and drops; arrows move; Escape cancels.`;
}

function setItemContentInert(item, handle, inert) {
  Array.from(item.children).forEach((child) => {
    if (child !== handle) child.inert = inert;
  });
}

function setHandleVisibility(visible) {
  surfaceStates.forEach((state) => {
    state.items.forEach(({ element, handle }) => {
      handle.hidden = !visible;
      setItemContentInert(element, handle, visible);
    });
  });
}

function enterArrangeMode() {
  if (arrangeModeActive) return;
  arrangeModeActive = true;
  document.body.classList.add("is-arranging");
  document.querySelector("[data-arrange-toggle]")?.setAttribute("aria-pressed", "true");
  surfaceStates.forEach((state) => prepareSurface(state, true));
  setHandleVisibility(true);
  toolbar().hidden = false;
  updateToolbar();
  announce("Arrange mode started. Choose a panel handle, then drag it or press Space or Enter.");
}

function clearArrangeQueryParameter() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("arrange")) return;
  url.searchParams.delete("arrange");
  window.history.replaceState(window.history.state, "", url);
}

function exitArrangeMode() {
  cancelActiveMove();
  arrangeModeActive = false;
  document.body.classList.remove("is-arranging");
  document.querySelector("[data-arrange-toggle]")?.setAttribute("aria-pressed", "false");
  setHandleVisibility(false);
  toolbar().hidden = true;
  surfaceStates.forEach((state) => {
    state.element.classList.remove("is-arrange-surface-active");
    if (!storedLayout(state)) restoreNaturalLayout(state);
  });
  clearArrangeQueryParameter();
  document.querySelector("[data-arrange-toggle]")?.focus();
}

function toggleArrangeMode() {
  if (arrangeModeActive) exitArrangeMode();
  else enterArrangeMode();
}

function moveSnapshot(state) {
  return {
    surfaceId: state.id,
    breakpoint: breakpointKey(),
    layout: clone(storedLayout(state))
  };
}

function currentUndoStack() {
  return undoStacks[breakpointKey()];
}

function rememberForUndo(snapshots) {
  const group = Array.isArray(snapshots) ? snapshots : [snapshots];
  const stack = undoStacks[group[0]?.breakpoint || breakpointKey()];
  if (!stack || group.length === 0) return;
  stack.push(group);
  if (stack.length > 20) stack.shift();
  updateToolbar();
}

function restoreSnapshot(snapshot) {
  const state = surfaceStates.find((candidate) => candidate.id === snapshot.surfaceId);
  if (!state || snapshot.breakpoint !== breakpointKey()) return;

  if (snapshot.layout) setStoredLayout(state, snapshot.layout);
  else deleteStoredLayout(state);
  refreshSurface(state);
}

function undoLastLayoutChange() {
  const snapshots = currentUndoStack().pop();
  if (!snapshots) return;
  snapshots.forEach(restoreSnapshot);
  updateToolbar();
  announce("Previous layout restored.");
}

function resetCurrentLayouts() {
  cancelActiveMove();
  const snapshots = surfaceStates.filter(storedLayout).map(moveSnapshot);
  rememberForUndo(snapshots);
  surfaceStates.forEach((state) => {
    deleteStoredLayout(state);
    refreshSurface(state);
  });
  announce(`The ${breakpointKey()} layout was reset.`);
}

function itemRectangle(state, id, position = positionFor(state, id)) {
  const entry = state.items.get(id);
  return {
    left: position.x,
    top: position.y,
    right: position.x + entry.width,
    bottom: position.y + entry.element.offsetHeight
  };
}

function rectanglesOverlap(first, second) {
  return !(
    first.right + COLLISION_GAP <= second.left ||
    second.right + COLLISION_GAP <= first.left ||
    first.bottom + COLLISION_GAP <= second.top ||
    second.bottom + COLLISION_GAP <= first.top
  );
}

function positionIsFreeAgainst(state, id, position, occupiedRectangles) {
  const rectangle = itemRectangle(state, id, position);
  return occupiedRectangles.every((occupied) => !rectanglesOverlap(rectangle, occupied));
}

function positionBounds(state, id) {
  const entry = state.items.get(id);
  const surfaceWidth = state.element.getBoundingClientRect().width;
  return {
    maxX: Math.max(0, surfaceWidth - entry.width),
    maxY: Math.max(0, state.frameLimit - entry.element.offsetHeight)
  };
}

function clampPosition(state, id, position) {
  const { maxX, maxY } = positionBounds(state, id);
  return {
    x: NARROW_LAYOUT.matches ? 0 : Math.max(0, Math.min(maxX, Math.round(position.x / SNAP_SIZE) * SNAP_SIZE)),
    y: Math.max(0, Math.min(maxY, Math.round(position.y / SNAP_SIZE) * SNAP_SIZE))
  };
}

function snapPoints(maximum) {
  const points = [];
  for (let value = 0; value <= maximum; value += SNAP_SIZE) points.push(value);
  if (points[points.length - 1] !== maximum) points.push(maximum);
  return points;
}

function nearestFreeAgainstRectangles(state, id, requested, occupiedRectangles) {
  const desired = clampPosition(state, id, requested);
  if (positionIsFreeAgainst(state, id, desired, occupiedRectangles)) return desired;

  const { maxX, maxY } = positionBounds(state, id);
  const xPoints = NARROW_LAYOUT.matches ? [0] : snapPoints(maxX);
  const yPoints = snapPoints(maxY);
  let nearest = null;

  for (const y of yPoints) {
    for (const x of xPoints) {
      const position = { x, y };
      if (!positionIsFreeAgainst(state, id, position, occupiedRectangles)) continue;
      const distance = Math.hypot(x - desired.x, y - desired.y);
      if (!nearest || distance < nearest.distance) nearest = { x, y, distance };
    }
  }

  return nearest ? { x: nearest.x, y: nearest.y } : null;
}

function arraysMatch(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function desktopLayoutPlan(move, requestedPosition) {
  const state = move.state;
  const candidate = clone(move.startLayout);
  const desired = clampPosition(state, move.id, requestedPosition);
  const movingRectangle = itemRectangle(state, move.id, desired);
  const occupiedRectangles = [movingRectangle];
  const displacedIds = [];

  writeLayoutPosition(state, candidate, move.id, desired);
  orderedIdsForLayout(state, move.startLayout).forEach((id) => {
    if (id === move.id) return;
    const rectangle = itemRectangle(state, id, positionFor(state, id, move.startLayout));
    if (rectanglesOverlap(movingRectangle, rectangle)) displacedIds.push(id);
    else occupiedRectangles.push(rectangle);
  });

  for (const [index, id] of displacedIds.entries()) {
    const requested = index === 0 ? move.startPosition : positionFor(state, id, move.startLayout);
    const resolved = nearestFreeAgainstRectangles(state, id, requested, occupiedRectangles);
    if (!resolved) return null;
    writeLayoutPosition(state, candidate, id, resolved);
    occupiedRectangles.push(itemRectangle(state, id, resolved));
  }

  sortLayoutOrder(state, candidate);
  candidate.frameHeight = Math.max(
    state.measured.frameHeight,
    ...candidate.order.map((id) => {
      const position = positionFor(state, id, candidate);
      return position.y + state.items.get(id).element.offsetHeight;
    })
  );
  return { layout: candidate, position: desired, displacedCount: displacedIds.length };
}

function layoutsMatch(state, first, second) {
  return Array.from(state.items.keys()).every((id) => {
    const firstPosition = positionFor(state, id, first);
    const secondPosition = positionFor(state, id, second);
    return Math.abs(firstPosition.x - secondPosition.x) < 0.5 && Math.abs(firstPosition.y - secondPosition.y) < 0.5;
  });
}

function previewDesktopMove(move, requestedPosition) {
  const plan = desktopLayoutPlan(move, requestedPosition);
  if (!plan) return false;
  move.previewLayout = plan.layout;
  move.previewDisplacedCount = plan.displacedCount;
  move.currentPosition = plan.position;
  move.state.layout = clone(plan.layout);
  applyAbsoluteLayout(move.state, false);
  return true;
}

function commitNarrowMove(move, requestedPosition) {
  const originalOrder = orderedIdsForLayout(move.state, move.startLayout);
  const otherIds = originalOrder.filter((id) => id !== move.id);
  const desired = clampPosition(move.state, move.id, requestedPosition);
  const { maxY } = positionBounds(move.state, move.id);
  const targetIndex = maxY > 0 ? Math.round((desired.y / maxY) * otherIds.length) : 0;
  const nextOrder = [...otherIds];
  nextOrder.splice(targetIndex, 0, move.id);

  if (arraysMatch(originalOrder, nextOrder)) {
    restoreMove(move);
    announce(`${move.label} stayed in its previous position.`);
    return false;
  }

  const nextLayout = clone(move.startLayout);
  const totalItemHeight = nextOrder.reduce((total, id) => {
    return total + move.state.items.get(id).element.offsetHeight;
  }, 0);
  const gap = nextOrder.length > 1
    ? Math.max(COLLISION_GAP, (move.state.measured.frameHeight - totalItemHeight) / (nextOrder.length - 1))
    : 0;
  let y = 0;

  nextOrder.forEach((id) => {
    writeLayoutPosition(move.state, nextLayout, id, { x: 0, y });
    y += move.state.items.get(id).element.offsetHeight + gap;
  });
  nextLayout.order = nextOrder;
  nextLayout.frameHeight = move.state.measured.frameHeight;

  rememberForUndo(move.snapshot);
  move.state.layout = nextLayout;
  applyAbsoluteLayout(move.state);
  setStoredLayout(move.state, move.state.layout);
  announce(`${move.label} moved to position ${targetIndex + 1}.`);
  return true;
}

function commitMove(move, requestedPosition) {
  if (NARROW_LAYOUT.matches) return commitNarrowMove(move, requestedPosition);

  const plan = move.previewLayout
    ? { layout: move.previewLayout, position: move.currentPosition, displacedCount: move.previewDisplacedCount }
    : desktopLayoutPlan(move, requestedPosition);
  if (!plan) {
    restoreMove(move);
    announce(`${move.label} could not fit there.`);
    return false;
  }

  if (layoutsMatch(move.state, move.startLayout, plan.layout)) {
    restoreMove(move);
    announce(`${move.label} stayed in its previous position.`);
    return false;
  }

  rememberForUndo(move.snapshot);
  move.state.layout = clone(plan.layout);
  applyAbsoluteLayout(move.state);
  setStoredLayout(move.state, move.state.layout);
  const reflowed = plan.displacedCount > 0 ? ` ${plan.displacedCount} nearby panel${plan.displacedCount === 1 ? "" : "s"} reflowed.` : "";
  announce(`${move.label} moved to row ${Math.round(plan.position.y / SNAP_SIZE) + 1}, column ${Math.round(plan.position.x / SNAP_SIZE) + 1}.${reflowed}`);
  return true;
}

function restoreMove(move) {
  move.state.layout = clone(move.startLayout);
  applyAbsoluteLayout(move.state);
  announce(`${move.label} returned to its previous position.`);
}

function beginPointerMove(event, state, item, handle) {
  if (!arrangeModeActive || event.button !== 0) return;
  event.preventDefault();
  cancelActiveMove();
  const id = itemId(item);
  const startPosition = positionFor(state, id);

  activePointerMove = {
    state,
    item,
    handle,
    id,
    label: itemLabel(item),
    pointerId: event.pointerId,
    startPointer: { x: event.clientX, y: event.clientY },
    startScrollY: window.scrollY,
    lastPointer: { x: event.clientX, y: event.clientY },
    startPosition,
    currentPosition: startPosition,
    startLayout: clone(state.layout),
    snapshot: moveSnapshot(state),
    moved: false,
    scrollFrame: 0,
    previewLayout: null,
    previewDisplacedCount: 0
  };

  handle.setPointerCapture(event.pointerId);
  handle.addEventListener("pointermove", updatePointerMove);
  handle.addEventListener("pointerup", finishPointerMove);
  handle.addEventListener("pointercancel", cancelPointerMove);
  handle.addEventListener("lostpointercapture", cancelPointerMove);
}

function updatePointerMove(event) {
  const move = activePointerMove;
  if (!move || event.pointerId !== move.pointerId) return;
  event.preventDefault();
  move.lastPointer = { x: event.clientX, y: event.clientY };
  const deltaX = event.clientX - move.startPointer.x;
  const deltaY = event.clientY - move.startPointer.y + window.scrollY - move.startScrollY;
  if (!move.moved && Math.hypot(deltaX, deltaY) < 6) return;

  if (!move.moved) {
    move.moved = true;
    move.item.classList.add("is-being-arranged");
    move.handle.setAttribute("aria-pressed", "true");
  }

  const requestedPosition = clampPosition(move.state, move.id, {
    x: move.startPosition.x + deltaX,
    y: move.startPosition.y + deltaY
  });
  if (NARROW_LAYOUT.matches) {
    move.currentPosition = requestedPosition;
    setItemPosition(move.state, move.id, move.currentPosition);
  } else if (!previewDesktopMove(move, requestedPosition)) {
    announce(`${move.label} cannot fit farther in that direction.`);
  }
  schedulePointerAutoScroll(move);
}

function edgeScrollSpeed(pointerY) {
  if (pointerY < EDGE_SCROLL_ZONE) {
    const intensity = Math.min(1, Math.max(0, 1 - pointerY / EDGE_SCROLL_ZONE));
    return -MAX_EDGE_SCROLL_SPEED * intensity;
  }

  const distanceFromBottom = window.innerHeight - pointerY;
  if (distanceFromBottom < EDGE_SCROLL_ZONE) {
    const intensity = Math.min(1, Math.max(0, 1 - distanceFromBottom / EDGE_SCROLL_ZONE));
    return MAX_EDGE_SCROLL_SPEED * intensity;
  }

  return 0;
}

function schedulePointerAutoScroll(move) {
  if (move.scrollFrame || !move.moved) return;
  move.scrollFrame = window.requestAnimationFrame(() => autoScrollPointerMove(move));
}

function autoScrollPointerMove(move) {
  move.scrollFrame = 0;
  if (activePointerMove !== move) return;

  const speed = edgeScrollSpeed(move.lastPointer.y);
  if (speed === 0) return;
  const previousScrollY = window.scrollY;
  window.scrollBy({ top: speed, behavior: "auto" });
  if (window.scrollY !== previousScrollY) {
    const deltaX = move.lastPointer.x - move.startPointer.x;
    const deltaY = move.lastPointer.y - move.startPointer.y + window.scrollY - move.startScrollY;
    const requestedPosition = clampPosition(move.state, move.id, {
      x: move.startPosition.x + deltaX,
      y: move.startPosition.y + deltaY
    });
    if (NARROW_LAYOUT.matches) {
      move.currentPosition = requestedPosition;
      setItemPosition(move.state, move.id, move.currentPosition);
    } else {
      previewDesktopMove(move, requestedPosition);
    }
  }
  schedulePointerAutoScroll(move);
}

function removePointerListeners(move) {
  window.cancelAnimationFrame(move.scrollFrame);
  move.handle.removeEventListener("pointermove", updatePointerMove);
  move.handle.removeEventListener("pointerup", finishPointerMove);
  move.handle.removeEventListener("pointercancel", cancelPointerMove);
  move.handle.removeEventListener("lostpointercapture", cancelPointerMove);
  if (move.handle.hasPointerCapture(move.pointerId)) {
    move.handle.releasePointerCapture(move.pointerId);
  }
  move.item.classList.remove("is-being-arranged");
  move.handle.setAttribute("aria-pressed", "false");
}

function finishPointerMove(event) {
  const move = activePointerMove;
  if (!move || event.pointerId !== move.pointerId) return;
  removePointerListeners(move);
  if (move.moved) commitMove(move, move.currentPosition);
  activePointerMove = null;
}

function cancelPointerMove(event) {
  const move = activePointerMove;
  if (!move || (event && event.pointerId !== move.pointerId)) return;
  removePointerListeners(move);
  if (move.moved) restoreMove(move);
  activePointerMove = null;
}

function beginKeyboardMove(state, item, handle) {
  const id = itemId(item);
  const startLayout = clone(state.layout);
  activeKeyboardMove = {
    state,
    item,
    handle,
    id,
    label: itemLabel(item),
    startPosition: positionFor(state, id),
    currentPosition: positionFor(state, id),
    startLayout,
    snapshot: moveSnapshot(state),
    targetIndex: orderedIdsForLayout(state, startLayout).indexOf(id),
    moved: false,
    previewLayout: null,
    previewDisplacedCount: 0
  };
  item.classList.add("is-being-arranged");
  handle.setAttribute("aria-pressed", "true");
  announce(`${itemLabel(item)} picked up. Use arrow keys to move it.`);
}

function finishKeyboardMove() {
  const move = activeKeyboardMove;
  if (!move) return;
  move.item.classList.remove("is-being-arranged");
  move.handle.setAttribute("aria-pressed", "false");
  if (move.moved) commitMove(move, move.currentPosition);
  else {
    move.state.layout = clone(move.startLayout);
    applyAbsoluteLayout(move.state);
    announce(`${move.label} stayed in its previous position.`);
  }
  move.handle.focus();
  activeKeyboardMove = null;
}

function cancelKeyboardMove() {
  const move = activeKeyboardMove;
  if (!move) return;
  move.item.classList.remove("is-being-arranged");
  move.handle.setAttribute("aria-pressed", "false");
  restoreMove(move);
  move.handle.focus();
  activeKeyboardMove = null;
}

function handleMoveKey(event, state, item, handle) {
  if (!arrangeModeActive) return;
  const isCurrentMove = activeKeyboardMove?.handle === handle;

  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    if (isCurrentMove) finishKeyboardMove();
    else {
      cancelKeyboardMove();
      beginKeyboardMove(state, item, handle);
    }
    return;
  }

  if (!isCurrentMove) return;
  if (event.key === "Escape") {
    event.preventDefault();
    cancelKeyboardMove();
    return;
  }

  if (event.key === "Tab") {
    finishKeyboardMove();
    return;
  }

  if (!event.key.startsWith("Arrow")) return;
  event.preventDefault();

  if (NARROW_LAYOUT.matches) {
    if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const lastIndex = activeKeyboardMove.state.items.size - 1;
    const direction = event.key === "ArrowUp" ? -1 : 1;
    const nextIndex = Math.max(0, Math.min(lastIndex, activeKeyboardMove.targetIndex + direction));
    if (nextIndex === activeKeyboardMove.targetIndex) {
      announce(`${itemLabel(item)} is already at position ${nextIndex + 1}.`);
      return;
    }

    activeKeyboardMove.targetIndex = nextIndex;
    activeKeyboardMove.moved = true;
    const { maxY } = positionBounds(state, itemId(item));
    activeKeyboardMove.currentPosition = {
      x: 0,
      y: lastIndex > 0 ? (nextIndex / lastIndex) * maxY : 0
    };
    setItemPosition(state, itemId(item), activeKeyboardMove.currentPosition);
    announce(`${itemLabel(item)} will move to position ${nextIndex + 1}.`);
    return;
  }

  const distance = event.shiftKey ? SNAP_SIZE * 4 : SNAP_SIZE;
  const delta = { x: 0, y: 0 };
  if (event.key === "ArrowLeft" && !NARROW_LAYOUT.matches) delta.x = -distance;
  if (event.key === "ArrowRight" && !NARROW_LAYOUT.matches) delta.x = distance;
  if (event.key === "ArrowUp") delta.y = -distance;
  if (event.key === "ArrowDown") delta.y = distance;

  const nextPosition = clampPosition(state, itemId(item), {
    x: activeKeyboardMove.currentPosition.x + delta.x,
    y: activeKeyboardMove.currentPosition.y + delta.y
  });
  if (
    nextPosition.x !== activeKeyboardMove.currentPosition.x ||
    nextPosition.y !== activeKeyboardMove.currentPosition.y
  ) {
    activeKeyboardMove.moved = true;
  }
  if (!previewDesktopMove(activeKeyboardMove, nextPosition)) {
    announce(`${itemLabel(item)} cannot fit farther in that direction.`);
    return;
  }
  announce(`${itemLabel(item)} at row ${Math.round(activeKeyboardMove.currentPosition.y / SNAP_SIZE) + 1}, column ${Math.round(activeKeyboardMove.currentPosition.x / SNAP_SIZE) + 1}.`);
}

function cancelActiveMove() {
  cancelPointerMove();
  cancelKeyboardMove();
}

function refreshForViewportChange() {
  cancelActiveMove();
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    surfaceStates.forEach(refreshSurface);
    updateToolbar();
  }, 160);
}

function scheduleRefreshForItemResize(state, entries) {
  if (!state.layout || activePointerMove?.state === state || activeKeyboardMove?.state === state) return;

  const dimensionsChanged = entries.some(({ target }) => {
    const entry = state.items.get(itemId(target));
    if (!entry) return false;
    const rectangle = target.getBoundingClientRect();
    return Math.abs(rectangle.width - entry.width) > 1 || Math.abs(rectangle.height - entry.height) > 1;
  });
  if (!dimensionsChanged) return;

  window.clearTimeout(state.itemResizeTimer);
  state.itemResizeTimer = window.setTimeout(() => refreshSurface(state), 80);
}

export function initializeArrangeMode() {
  if (initialized) return;
  const elements = Array.from(document.querySelectorAll("[data-arrange-surface]"));
  const toggle = document.querySelector("[data-arrange-toggle]");
  if (elements.length === 0 || !toggle) return;
  initialized = true;

  surfaceStates = elements.map((element) => {
    const state = {
      element,
      id: element.dataset.arrangeSurface,
      items: new Map(),
      authoredChildren: Array.from(element.children),
      authoredOrder: surfaceItems(element).map(itemId),
      measured: null,
      layout: null,
      frameLimit: 0,
      refreshFrame: 0,
      itemResizeTimer: 0,
      resizeObserver: null
    };
    if ("ResizeObserver" in window) {
      state.resizeObserver = new ResizeObserver((entries) => scheduleRefreshForItemResize(state, entries));
    }
    return state;
  });
  surfaceStates.forEach(decorateSurface);

  createToolbar();
  toggle.hidden = false;
  updateArrangeToggle();
  toggle.addEventListener("click", toggleArrangeMode);
  window.addEventListener("resize", refreshForViewportChange);
  NARROW_LAYOUT.addEventListener("change", refreshForViewportChange);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    if (activePointerMove) cancelPointerMove();
    else if (arrangeModeActive) exitArrangeMode();
  });

  window.requestAnimationFrame(() => surfaceStates.forEach((state) => prepareSurface(state)));

  if (new URLSearchParams(window.location.search).get("arrange") === "1") {
    window.requestAnimationFrame(enterArrangeMode);
  }
}
