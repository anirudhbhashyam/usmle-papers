(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const app = byId("app");
  const screen = byId("screen");
  const scrollpane = byId("scrollpane");
  const workstation = byId("workstation");
  const dialog = byId("dialog");
  const dialogContent = byId("dialog-content");
  const data = window.EXAM_DATA;
  const items = Array.isArray(data?.items) ? data.items : [];
  const icons = {
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .3c0 1.5-2.5 2-2.5 3.7m0 3h.01"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7.5h7m-7 5h1m5 0h1m-7 4h1m5 0h1"/>',
    labs: '<path d="M9 4h6m-5 0v6l-5 7.5A1.7 1.7 0 0 0 6.4 20h11.2a1.7 1.7 0 0 0 1.4-2.5L14 10V4m-6.7 11h9.4"/>',
    contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    flag: '<path d="M5 21V4m0 1c4-3 7 3 13 0v9c-6 3-9-3-13 0"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9" r="1"/><path d="m4 17 4-4 3 3 4-5 5 6"/>',
    eraser: '<path d="m13 19 6-7a2 2 0 0 0 0-3l-3-3a2 2 0 0 0-3 0l-8 8a2 2 0 0 0 0 3l2 2h13M9 10l7 7"/>',
    strike: '<path d="M6 12h12m-2-5a4 4 0 0 0-7 1.5m-1 8a4.5 4.5 0 0 0 8-1.5"/>',
    reset: '<path d="M4 5v5h5M4.6 10a7.5 7.5 0 1 1 .6 6.2"/>',
  };
  function icon(name) {
    const span = document.createElement("span");
    span.className = "tool-icon";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
    return span;
  }
  for (const placeholder of document.querySelectorAll("[data-icon]")) {
    placeholder.replaceWith(icon(placeholder.dataset.icon));
  }

  function element(tag, className, value) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (value !== undefined) result.textContent = value;
    return result;
  }

  function button(label, className, onClick, symbol) {
    const result = element("button", className);
    result.type = "button";
    if (symbol) result.append(icon(symbol));
    result.append(label);
    result.addEventListener("click", onClick);
    return result;
  }

  function heading(parent, eyebrow, title, className = "") {
    parent.append(element("p", "eyebrow", eyebrow));
    const h1 = element("h1", className, title);
    h1.tabIndex = -1;
    parent.append(h1);
  }

  function announce(message) {
    byId("announcement").textContent = message;
  }

  const config = {
    current: { size: 20, minutes: 30 },
    source: { size: 50, minutes: 75 },
  };
  const storageKey = "exam-practice-form16-v1-" + items.length;
  const blank = () => ({
    mode: "current",
    customFormat: { ...config.current },
    phase: "ready",
    block: 0,
    position: 0,
    deadline: 0,
    results: [],
    responses: {},
    dark: false,
    textSize: 0,
  });

  function validFormat(format) {
    return Number.isInteger(format?.size) && format.size >= 1 && format.size <= items.length &&
      Number.isInteger(format.minutes) && format.minutes >= 1 &&
      Number.isSafeInteger(Date.now() + format.minutes * 60_000);
  }

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      const customFormat = validFormat(saved?.customFormat) ? saved.customFormat : null;
      if (
        saved &&
        (Object.hasOwn(config, saved.mode) || (saved.mode === "custom" && customFormat)) &&
        ["ready", "taking", "break", "complete"].includes(saved.phase) &&
        Number.isInteger(saved.block) && saved.block >= 0 &&
        Number.isInteger(saved.position) && saved.position >= 0 &&
        Array.isArray(saved.results) && saved.responses && typeof saved.responses === "object"
      ) return { ...blank(), ...saved, customFormat: customFormat ?? { ...config.current } };
    } catch {
      // The test remains usable when storage is blocked.
    }
    return blank();
  }

  let state = readState();
  let view = "item";
  let reviewBlock = null;
  let reviewFilter = false;
  let drag = null;
  let suppressedClickUntil = 0;

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The in-memory attempt remains available.
    }
  }

  function blockFormat() {
    return state.mode === "custom" ? state.customFormat : config[state.mode];
  }

  function blockCount() {
    return Math.ceil(items.length / blockFormat().size);
  }

  function blockItems(block = reviewBlock ?? state.block) {
    const { size } = blockFormat();
    return items.slice(block * size, (block + 1) * size);
  }

  function questionPosition() {
    return Math.min(state.position, Math.max(0, blockItems().length - 1));
  }

  function currentItem() {
    return blockItems()[questionPosition()];
  }

  function response(item) {
    return state.responses[item.id] ?? { answer: null, marked: false, crossed: [], highlights: {} };
  }

  function blockIsOpen() {
    if (state.phase !== "taking") return false;
    if (Date.now() < state.deadline) return true;
    endBlock(true);
    return false;
  }

  function editResponse(item, updates) {
    if (!blockIsOpen()) return false;
    state.responses[item.id] = { ...response(item), ...updates };
    save();
    return true;
  }

  function showDialog(title, kind, content, wide = false) {
    closeDialog();
    dialog.toggleAttribute("data-wide", wide);
    dialog.toggleAttribute("data-image", kind === "image");
    byId("dialog-title").textContent = title;
    dialogContent.replaceChildren(content);
    dialog.showModal();
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function openHelp() {
    const body = element("div");
    body.append(element("p", "", "Answer one question at a time. Jump between items with the question grid and use Review block to check marked or unanswered items before ending the block."));
    const list = element("ul");
    [
      "Click and drag over question or answer text to highlight it. Use Clear highlights to remove your highlights for that question.",
      "Use the strikeout button or right-click an answer to cross it out.",
      "Open Source image to inspect the reference for an item.",
      "Progress is saved in this browser. A started block keeps counting down during reloads and while dialogs are open.",
    ].forEach((line) => list.append(element("li", "", line)));
    body.append(list);
    const keys = element("p");
    for (const [key, description] of [["Alt + ← / →", " Previous or next item"], ["Alt + M", " Mark item"], ["Alt + R", " Review block"]]) {
      if (keys.childNodes.length) keys.append(element("br"));
      keys.append(element("kbd", "", key), description);
    }
    body.append(keys);
    showDialog("Exam controls", "help", body);
  }

  function openImage(title, image) {
    const body = element("div");
    const controls = element("div", "zoom-controls");
    const scroll = element("div", "zoom-scroll");
    const img = element("img");
    img.src = image.src;
    img.alt = image.alt || title;
    img.style.width = "100%";
    img.draggable = false;
    let zoom = 100;
    function adjustZoom(change) {
      zoom = change === 0 ? 100 : Math.max(100, Math.min(300, zoom + change));
      img.style.width = zoom + "%";
      fit.textContent = zoom === 100 ? "Fit" : zoom + "% · Fit";
      out.disabled = zoom === 100;
      plus.disabled = zoom === 300;
    }
    const out = button("Zoom −", "button secondary", () => adjustZoom(-25));
    const fit = button("Fit", "button secondary", () => adjustZoom(0));
    const plus = button("Zoom +", "button secondary", () => adjustZoom(25));
    out.disabled = true;
    controls.append(out, fit, plus);
    scroll.append(img);
    body.append(controls, scroll);
    showDialog(title, "image", body, true);
  }

  function openCalculator() {
    const body = element("div", "calculator");
    const display = element("output", "", "0");
    display.setAttribute("aria-label", "Calculator result");
    const grid = element("div", "calculator-grid");
    const operations = {
      "÷": (left, right) => left / right,
      "×": (left, right) => left * right,
      "−": (left, right) => left - right,
      "+": (left, right) => left + right,
    };
    let entry = "0";
    let left = 0;
    let operation = "";
    let fresh = true;

    function calculate() {
      const result = operations[operation](left, Number(entry));
      entry = Number.isFinite(result) ? String(Number(result.toPrecision(12))) : "Error";
      operation = "";
      fresh = true;
    }
    function press(key) {
      if (key === "AC") {
        entry = "0";
        left = 0;
        operation = "";
        fresh = true;
      } else if (key === "±") {
        if (entry !== "0" && entry !== "Error") entry = String(-Number(entry));
      } else if (key === "%") {
        if (entry !== "Error") entry = String(Number(entry) / 100);
      } else if (Object.hasOwn(operations, key)) {
        if (entry === "Error") return;
        if (operation && !fresh) calculate();
        if (entry !== "Error") {
          left = Number(entry);
          operation = key;
          fresh = true;
        }
      } else if (key === "=") {
        if (operation) calculate();
      } else {
        if (fresh || entry === "Error") entry = "0";
        if (key === "." && !entry.includes(".")) entry += ".";
        if (/^\d$/.test(key) && entry.length < 18) entry = entry === "0" ? key : entry + key;
        fresh = false;
      }
      display.value = entry;
    }
    for (const key of ["AC", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="]) {
      grid.append(button(key, "button " + (key === "=" ? "primary" : "secondary"), () => press(key)));
    }
    body.append(display, grid);
    body.addEventListener("keydown", (event) => {
      const shortcuts = { "*": "×", "/": "÷", "-": "−", "+": "+", "=": "=", Enter: "=", Delete: "AC", ".": ".", "%": "%" };
      const key = shortcuts[event.key] ?? (/^\d$/.test(event.key) ? event.key : "");
      if (!key || (event.key === "Enter" && event.target instanceof HTMLButtonElement)) return;
      event.preventDefault();
      press(key);
    });
    showDialog("Calculator", "calculator", body);
  }

  function setPreferences() {
    document.documentElement.dataset.contrast = state.dark ? "dark" : "light";
    document.documentElement.dataset.textSize = String(state.textSize);
    byId("contrast-button").setAttribute("aria-pressed", String(state.dark));
    byId("font-button").title = ["Text size: default", "Text size: large", "Text size: extra large"][state.textSize] || "Change text size";
  }

  function startBlock() {
    if (state.phase !== "ready" && state.phase !== "break") return;
    state.phase = "taking";
    state.position = 0;
    state.deadline = Date.now() + blockFormat().minutes * 60_000;
    view = "item";
    reviewFilter = false;
    save();
    render(true);
  }

  function summarize(block) {
    const questions = blockItems(block);
    return {
      total: questions.length,
      answered: questions.filter((item) => response(item).answer !== null).length,
      marked: questions.filter((item) => response(item).marked).length,
      keyed: questions.filter((item) => item.answer !== undefined && item.answer !== null).length,
      correct: questions.filter((item) => item.answer != null && String(item.answer) === response(item).answer).length,
    };
  }

  function endBlock(expired = false) {
    if (state.phase !== "taking") return;
    expired ||= Date.now() >= state.deadline;
    closeDialog();
    state.results[state.block] = { ...summarize(state.block), expired };
    state.block += 1;
    state.phase = state.block >= blockCount() ? "complete" : "break";
    state.position = 0;
    state.deadline = 0;
    view = "item";
    save();
    announce(expired ? "Time expired. Block ended automatically." : "Block ended.");
    render(true);
  }

  function confirmEndBlock() {
    if (!blockIsOpen()) return;
    const { answered, total, marked } = summarize(state.block);
    const body = element("div");
    body.append(element("p", "", answered + " of " + total + " questions answered. " + marked + " marked for review."));
    body.append(element("p", "", state.block + 1 < blockCount()
      ? "Ending the block locks your answers. The next block starts when you select Start block."
      : "Ending the final block locks your answers and opens the exam summary."));
    const actions = element("div", "dialog-actions");
    actions.append(button("Keep working", "button secondary", closeDialog), button("End block", "button danger", () => endBlock()));
    body.append(actions);
    showDialog("End block " + (state.block + 1) + "?", "end-block", body);
  }

  function resetAttempt() {
    const body = element("div");
    body.append(element("p", "", "This clears your answers, flags, strikeouts, highlights, and block results for the entire exam. You’ll return to the start screen with a fresh timer."));
    const actions = element("div", "dialog-actions");
    actions.append(button("Cancel", "button secondary", closeDialog), button("Reset exam", "button danger", () => {
      closeDialog();
      state = { ...blank(), dark: state.dark, textSize: state.textSize };
      reviewBlock = null;
      reviewFilter = false;
      view = "item";
      drag = null;
      suppressedClickUntil = 0;
      save();
      render(true);
      announce("Exam reset.");
    }));
    body.append(actions);
    showDialog("Reset the entire exam?", "reset", body);
  }

  function metric(label, value) {
    const wrap = element("div", "metric");
    wrap.append(element("dt", "", label), element("dd", "", value));
    return wrap;
  }

  function renderBlockSetup(card, metrics, start) {
    const modes = element("fieldset", "mode-choices");
    modes.append(element("legend", "", "Block format"));
    const custom = element("fieldset", "custom-format");
    custom.append(element("legend", "sr-only", "Custom block settings"));
    const fields = element("div", "custom-format-fields");
    const inputs = {};
    for (const [key, title] of [["size", "Questions per block"], ["minutes", "Minutes per block"]]) {
      const label = element("label", "", title);
      const input = element("input");
      input.type = "number";
      input.min = "1";
      input.required = true;
      input.value = state.customFormat[key];
      if (key === "size") input.max = items.length;
      label.append(input);
      fields.append(label);
      inputs[key] = input;
    }
    const error = element("p", "custom-format-error",
      "Enter a whole number of questions from 1 to " + items.length + " and a valid positive whole number of minutes.");
    error.setAttribute("role", "status");
    custom.append(fields, error);

    function updateSetup() {
      const isCustom = state.mode === "custom";
      const format = { size: inputs.size.valueAsNumber, minutes: inputs.minutes.valueAsNumber };
      const valid = !isCustom || validFormat(format);
      if (isCustom && valid) state.customFormat = format;
      custom.hidden = !isCustom;
      error.hidden = valid;
      start.disabled = !valid;
      metrics.replaceChildren(
        metric("Questions", items.length),
        metric("Blocks", valid ? blockCount() : "—"),
        metric("Minutes per block", valid ? blockFormat().minutes : "—"),
      );
    }

    for (const [mode, name, explanation] of [
      ["current", "Current Step 1 pacing", "Up to 20 questions in 30 minutes"],
      ["source", "Original form sections", "Up to 50 questions in 75 minutes"],
      ["custom", "Custom", "Set the questions and time per block"],
    ]) {
      const label = element("label", "mode-choice");
      const input = element("input");
      input.type = "radio";
      input.name = "format";
      input.value = mode;
      input.checked = state.mode === mode;
      input.addEventListener("change", () => {
        state.mode = mode;
        updateSetup();
        save();
      });
      const copy = element("span");
      copy.append(element("strong", "", name), element("span", "", explanation));
      label.append(input, copy);
      modes.append(label);
    }
    fields.addEventListener("input", () => {
      updateSetup();
      save();
    });
    card.append(metrics, modes, custom);
    updateSetup();
  }

  function renderLanding() {
    const card = element("section", "landing-card");
    const metrics = element("dl", "metrics");
    const actions = element("div", "landing-actions");
    if (state.phase === "ready") {
      heading(card, "Practice examination", data.title || "Form 16");
      card.append(element("p", "", "Work through the questions in timed blocks. Highlight important details, cross out answer choices, and mark items to revisit."));
      const start = button("Start block 1", "button primary", startBlock);
      renderBlockSetup(card, metrics, start);
      actions.append(start, button("Exam controls", "button secondary", openHelp));
      card.append(actions, element("p", "instructions-note", "The timer starts when you begin. Your progress is saved in this browser."));
    } else if (state.phase === "break") {
      const finished = state.results[state.block - 1];
      heading(card, "Between blocks", "Block " + state.block + " complete");
      card.append(element("p", "", finished.expired ? "Time expired and the block closed automatically." : "Your responses for this block are saved."));
      metrics.append(metric("Answered", finished.answered + " / " + finished.total), metric("Marked", finished.marked), metric("Next block", state.block + 1 + " of " + blockCount()));
      actions.append(button("Start block " + (state.block + 1), "button primary", startBlock), button("Start over", "button secondary", resetAttempt));
      card.append(metrics, actions);
    } else {
      const answered = state.results.reduce((total, block) => total + block.answered, 0);
      const keyed = state.results.reduce((total, block) => total + block.keyed, 0);
      const correct = state.results.reduce((total, block) => total + block.correct, 0);
      heading(card, "Attempt complete", "Exam complete");
      card.append(element("p", "", "Review a completed block to revisit the questions and your responses."));
      metrics.append(metric("Answered", answered + " / " + items.length), metric("Finished blocks", state.results.length));
      if (keyed) metrics.append(metric(keyed === items.length ? "Correct" : "Correct on keyed items", correct + " / " + keyed));
      card.append(metrics);
      const blockList = element("div", "block-list");
      state.results.forEach((block, index) => {
        const entry = button("Review block " + (index + 1), "button secondary", () => {
          reviewBlock = index;
          state.position = 0;
          openReview();
        });
        blockList.append(entry);
      });
      actions.append(button("Start over", "button secondary", resetAttempt));
      card.append(blockList, actions);
    }
    screen.append(card);
  }

  function jump(position) {
    if (position < 0 || position >= blockItems().length) return;
    state.position = position;
    view = "item";
    if (reviewBlock === null) save();
    closeDialog();
    render(true);
  }

  function openReview() {
    if (reviewBlock === null && !blockIsOpen()) return;
    view = "review";
    reviewFilter = false;
    render(true);
  }

  function updateNavigator() {
    const block = reviewBlock ?? state.block;
    const questions = blockItems();
    const { answered, total } = summarize(block);
    byId("block-label").textContent = "Block " + (block + 1) + " of " + blockCount();
    byId("answered-count").textContent = answered + " / " + total;
    byId("progress").max = total;
    byId("progress").value = answered;
    const grid = byId("question-grid");
    const buttons = Array.from(grid.querySelectorAll("button"));
    if (buttons.length === questions.length && grid.dataset.block === String(block)) {
      questions.forEach((item, position) => styleNavigatorButton(buttons[position], item, position));
    } else {
      grid.replaceChildren(...makeNavigatorButtons());
      grid.dataset.block = String(block);
    }
  }

  function styleNavigatorButton(entry, item, position) {
    const { answer, marked } = response(item);
    entry.toggleAttribute("data-answered", answer !== null);
    entry.toggleAttribute("data-marked", marked);
    if (view === "item" && position === questionPosition()) {
      entry.setAttribute("aria-current", "true");
    } else {
      entry.removeAttribute("aria-current");
    }
    entry.setAttribute("aria-label", "Question " + (position + 1) + ", " + (answer === null ? "unanswered" : "answered") + (marked ? ", marked" : ""));
  }

  function makeNavigatorButtons() {
    return blockItems().map((item, position) => {
      const entry = button(String(position + 1), "question-number", () => jump(position));
      styleNavigatorButton(entry, item, position);
      return entry;
    });
  }

  function openNavigator() {
    const body = element("div");
    const grid = element("nav", "question-grid");
    grid.setAttribute("aria-label", "Questions");
    grid.append(...makeNavigatorButtons());
    const controls = element("div", "dialog-actions");
    controls.append(button("Review block", "button secondary", () => {
      closeDialog();
      openReview();
    }, "list"));
    body.append(grid, controls);
    showDialog("Block " + ((reviewBlock ?? state.block) + 1) + " questions", "navigator", body);
  }

  function renderReview() {
    const block = reviewBlock ?? state.block;
    const questions = blockItems();
    const { answered, total, marked } = summarize(block);
    const card = element("section", "review-card");
    heading(card, "Block " + (block + 1) + " of " + blockCount(), reviewBlock === null ? "Review block" : "Review completed block");
    card.append(element("p", "", answered + " of " + total + " answered · " + marked + " marked"));
    const toolbar = element("div", "review-toolbar");
    const filter = element("label", "filter-control");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.checked = reviewFilter;
    checkbox.addEventListener("change", () => {
      reviewFilter = checkbox.checked;
      fillRows();
    });
    filter.append(checkbox, "Marked or unanswered only");
    toolbar.append(filter);
    toolbar.append(reviewBlock === null
      ? button("End block", "button primary", confirmEndBlock)
      : button("Exam summary", "button secondary", closeCompletedReview));
    const list = element("div", "review-list");
    list.setAttribute("aria-label", "Item review");

    function fillRows() {
      const header = element("div", "review-row review-heading");
      for (const label of ["Item", "Status", "Marked", "Answer"]) header.append(element("span", "", label));
      list.replaceChildren(header);
      questions.forEach((item, index) => {
        const { answer, marked: flagged } = response(item);
        if (reviewFilter && answer !== null && !flagged) return;
        const row = button("", "review-row", () => jump(index));
        row.append(
          element("strong", "", index + 1),
          element("span", "", answer === null ? "Unanswered" : "Answered"),
          element("span", flagged ? "status-marked" : "", flagged ? "Marked" : "—"),
          element("span", "", answer ?? "—"),
        );
        list.append(row);
      });
      if (list.children.length === 1) list.append(element("p", "review-empty", "No marked or unanswered questions."));
    }
    fillRows();
    card.append(toolbar, list);
    screen.append(card);
  }

  function closeCompletedReview() {
    reviewBlock = null;
    view = "item";
    render(true);
  }

  function writeSegments(segment, text, ranges) {
    let cursor = 0;
    const parts = [];
    const subscriptAt = text.indexOf("Gαₛ") + 1;
    function appendText(parent, start, end) {
      if (subscriptAt && start <= subscriptAt && subscriptAt < end) {
        parent.push(
          document.createTextNode(text.slice(start, subscriptAt)),
          element("sub", "source-subscript", "α"),
          document.createTextNode(text.slice(subscriptAt + 1, end)),
        );
      } else {
        parent.push(document.createTextNode(text.slice(start, end)));
      }
    }
    for (const [start, end] of ranges) {
      appendText(parts, cursor, start);
      const mark = element("mark");
      const contents = [];
      appendText(contents, start, end);
      mark.append(...contents);
      parts.push(mark);
      cursor = end;
    }
    appendText(parts, cursor, text.length);
    segment.replaceChildren(...parts);
  }

  function textSegment(item, key, text, className = "") {
    const segment = element("span", ("highlightable text-segment " + className).trim());
    segment.dataset.segment = key;
    writeSegments(segment, text, response(item).highlights[key] ?? []);
    return segment;
  }

  function renderFigure(block) {
    const figure = element("figure", "figure-item");
    const img = element("img");
    img.src = block.src;
    img.alt = block.alt || "Question exhibit";
    img.draggable = false;
    const zoom = button("", "", () => openImage(block.alt || "Question exhibit", block));
    zoom.setAttribute("aria-label", "Zoom " + img.alt);
    zoom.title = "Open exhibit";
    zoom.append(img);
    figure.append(zoom);
    if (block.caption) figure.append(element("figcaption", "", block.caption));
    const wrap = element("div", "figure-list");
    wrap.append(figure);
    return wrap;
  }

  function renderTable(item, block, blockIndex) {
    const frame = element("div", "data-table-frame");
    const table = element("table", "data-table");
    if (block.caption) {
      const caption = element("caption");
      caption.append(textSegment(item, "table-caption-" + blockIndex, block.caption));
      table.append(caption);
    }
    const headerRows = block.headerRows ?? (block.header ? 1 : 0);
    const head = element("thead");
    const body = element("tbody");
    block.rows.forEach((row, rowIndex) => {
      const tr = element("tr");
      row.forEach((value, column) => {
        const cell = element(rowIndex < headerRows ? "th" : "td");
        if (rowIndex < headerRows) cell.scope = "col";
        cell.append(textSegment(item, "table-" + blockIndex + "-" + rowIndex + "-" + column, value));
        tr.append(cell);
      });
      (rowIndex < headerRows ? head : body).append(tr);
    });
    if (head.children.length) table.append(head);
    table.append(body);
    frame.append(table);
    return frame;
  }

  function renderStem(item, parent) {
    const blocks = item.blocks?.length ? item.blocks : [{ type: "text", text: item.stem }, ...(item.figures ?? []).map((figure) => ({ ...figure, type: "figure" }))];
    blocks.forEach((block, index) => {
      if (block.type === "text" && block.text) {
        const paragraph = element("div", "stem");
        paragraph.append(textSegment(item, "stem-" + index, block.text));
        parent.append(paragraph);
      }
      if (block.type === "table" && block.rows?.length) parent.append(renderTable(item, block, index));
      if (block.type === "figure" && block.src) parent.append(renderFigure(block));
    });
  }

  function renderChoices(item, parent) {
    const choices = element("fieldset", "choices");
    choices.append(element("legend", "sr-only", "Answer choices"));
    const columns = Math.max(item.choiceHeadings?.length ?? 0, ...item.choices.map((choice) => choice.cells?.length ?? 0));
    if (columns > 0) {
      choices.dataset.table = "";
      choices.style.setProperty("--column-count", columns);
    }

    if (item.choiceHeadings?.length) {
      const headers = element("div", "choice-headings choice-cells");
      item.choiceHeadings.forEach((value, column) => {
        headers.append(textSegment(item, "choice-heading-" + column, value));
      });
      choices.append(headers);
    }

    function updateRows() {
      const { answer, crossed } = response(item);
      for (const row of choices.querySelectorAll(".choice-row")) {
        const label = row.dataset.label;
        const selected = answer === label;
        const isCrossed = crossed.includes(label);
        row.toggleAttribute("data-selected", selected);
        row.toggleAttribute("data-crossed", isCrossed);
        row.toggleAttribute("data-correct", reviewBlock !== null && item.answer != null && String(item.answer) === label);
        row.toggleAttribute("data-incorrect", reviewBlock !== null && item.answer != null && String(item.answer) !== label && selected);
        row.querySelector("input").checked = selected;
        row.querySelector(".cross-button")?.setAttribute("aria-pressed", String(isCrossed));
      }
    }

    item.choices.forEach((choice, index) => {
      const key = String(choice.label);
      const row = element("div", "choice-row");
      row.dataset.label = key;
      const label = element("label", "choice-label");
      const radio = element("input");
      radio.type = "radio";
      radio.name = "exam-answer";
      radio.value = key;
      radio.disabled = reviewBlock !== null;
      radio.addEventListener("change", () => {
        if (!editResponse(item, { answer: key, crossed: response(item).crossed.filter((value) => value !== key) })) return;
        updateRows();
        updateNavigator();
      });
      const letter = element("span", "choice-letter", /[.)]$/.test(key) ? key : key + ")");
      label.append(radio, letter);
      if (choice.cells?.length) {
        const cells = element("span", "choice-cells");
        choice.cells.forEach((cell, column) => cells.append(textSegment(item, "choice-" + index + "-" + column, cell, "choice-text")));
        label.append(cells);
      } else {
        label.append(textSegment(item, "choice-" + index, choice.text ?? "", "choice-text"));
      }
      row.append(label);

      if (reviewBlock === null) {
        function toggleCrossed() {
          const current = response(item);
          const wasCrossed = current.crossed.includes(key);
          if (!editResponse(item, {
            crossed: wasCrossed ? current.crossed.filter((value) => value !== key) : [...current.crossed, key],
            answer: !wasCrossed && current.answer === key ? null : current.answer,
          })) return;
          updateRows();
          updateNavigator();
        }
        const cross = button("", "icon-button cross-button", toggleCrossed, "strike");
        cross.title = "Toggle strikeout for choice " + key;
        cross.setAttribute("aria-label", cross.title);
        row.append(cross);
        row.addEventListener("contextmenu", (event) => {
          if (event.shiftKey) return;
          event.preventDefault();
          toggleCrossed();
        });
        row.addEventListener("auxclick", (event) => {
          // WebKit can forward a right-click on a label to its radio input.
          if (event.button === 2 && !event.shiftKey) event.preventDefault();
        });
      }
      choices.append(row);
    });
    updateRows();
    const frame = element("div", "choices-frame");
    if (columns > 0) {
      frame.tabIndex = 0;
      frame.setAttribute("role", "region");
      frame.setAttribute("aria-label", "Tabular answer choices");
    }
    frame.append(choices);
    parent.append(frame);
  }

  function toggleMark() {
    if (state.phase !== "taking" || view !== "item") return;
    const item = currentItem();
    const marked = !response(item).marked;
    if (!editResponse(item, { marked })) return;
    const flag = byId("mark-item");
    flag.setAttribute("aria-pressed", String(marked));
    flag.lastChild.textContent = marked ? "Marked" : "Mark";
    updateNavigator();
    announce(marked ? "Item marked for review." : "Item mark removed.");
  }

  function renderItem() {
    const item = currentItem();
    const card = element("article", "question-card");
    const head = element("header", "item-head");
    const label = element("div");
    if (item.section && item.number) {
      label.append(element("p", "eyebrow source-position", "Form section " + item.section + " · Item " + item.number));
    }
    const title = element("h1", "", "Question " + (questionPosition() + 1));
    title.tabIndex = -1;
    label.append(title);
    const actions = element("div", "item-actions");
    if (item.source) actions.append(button("Source image", "mini-button", () => openImage("Question " + (questionPosition() + 1) + " · Source image", item.source), "image"));
    if (reviewBlock === null) {
      const clear = button("Clear highlights", "mini-button", () => {
        if (!editResponse(item, { highlights: {} })) return;
        for (const segment of card.querySelectorAll(".highlightable")) {
          writeSegments(segment, segment.textContent, []);
        }
        clear.disabled = true;
        announce("Highlights cleared.");
      }, "eraser");
      clear.id = "clear-highlights";
      clear.disabled = !Object.keys(response(item).highlights).length;
      const marked = response(item).marked;
      const flag = button(marked ? "Marked" : "Mark", "mini-button", toggleMark, "flag");
      flag.id = "mark-item";
      flag.setAttribute("aria-pressed", String(marked));
      actions.append(clear, flag);
    }
    head.append(label, actions);
    card.append(head);
    renderStem(item, card);
    if (item.choices.length) renderChoices(item, card);
    if (reviewBlock !== null) {
      const { answer } = response(item);
      card.append(element("p", "item-note", "Your answer " + (answer ?? "—") + (item.answer != null ? " · Correct answer " + item.answer : "")));
    }
    screen.append(card);
  }

  function previousItem() {
    if (view === "review") jump(questionPosition());
    else jump(questionPosition() - 1);
  }

  function nextItem() {
    if (view === "review") {
      if (reviewBlock === null) confirmEndBlock();
      else closeCompletedReview();
    } else if (questionPosition() < blockItems().length - 1) jump(questionPosition() + 1);
    else openReview();
  }

  function updateTimer() {
    if (state.phase !== "taking") return;
    const seconds = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    const formatted = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    byId("timer-value").textContent = formatted;
    byId("timer").toggleAttribute("data-warning", seconds <= 300);
    if (seconds === 0) endBlock(true);
  }

  function render(focus = false) {
    setPreferences();
    const active = items.length > 0 && (state.phase === "taking" || reviewBlock !== null);
    app.toggleAttribute("data-active", active);
    workstation.toggleAttribute("data-active", active);
    byId("timer").hidden = state.phase !== "taking";
    byId("reset-button").hidden = !items.length || state.phase === "ready";
    screen.replaceChildren();
    if (!items.length) {
      const card = element("section", "landing-card");
      heading(card, "Exam practice", "Question data is unavailable");
      card.append(element("p", "", "Keep questions.js alongside index.html and reload this page."));
      screen.append(card);
    } else if (active) {
      updateNavigator();
      if (view === "review") renderReview();
      else renderItem();
      const last = questionPosition() === blockItems().length - 1;
      byId("previous-button").disabled = view === "item" && questionPosition() === 0;
      byId("previous-button").textContent = view === "review" ? "Return to item" : "Previous";
      byId("next-button").textContent = view === "review" ? (reviewBlock === null ? "End block" : "Exam summary") : last ? "Review block" : "Next";
      byId("item-position").textContent = view === "review" ? "Block review" : "Item " + (questionPosition() + 1) + " of " + blockItems().length;
      byId("review-button").disabled = view === "review";
    } else {
      renderLanding();
    }
    scrollpane.scrollTop = 0;
    if (focus) screen.querySelector("h1")?.focus({ preventScroll: true });
    updateTimer();
  }

  function mergeRange(ranges, candidate) {
    const combinations = [...ranges, candidate].sort((a, b) => a[0] - b[0]);
    const merged = [combinations[0].slice()];
    for (const range of combinations.slice(1)) {
      const tail = merged[merged.length - 1];
      if (range[0] <= tail[1]) tail[1] = Math.max(tail[1], range[1]);
      else merged.push(range.slice());
    }
    return merged;
  }

  function textOffset(segment, container, offset) {
    const before = document.createRange();
    before.selectNodeContents(segment);
    before.setEnd(container, offset);
    return before.toString().length;
  }

  function applyHighlight(selection, card, item) {
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const next = { ...response(item).highlights };
    const affected = [];
    for (const segment of card.querySelectorAll(".highlightable")) {
      if (!range.intersectsNode(segment)) continue;
      const text = segment.textContent;
      const start = segment.contains(range.startContainer) ? textOffset(segment, range.startContainer, range.startOffset) : 0;
      const end = segment.contains(range.endContainer) ? textOffset(segment, range.endContainer, range.endOffset) : text.length;
      if (start >= end || !text.slice(start, end).trim()) continue;
      const key = segment.dataset.segment;
      next[key] = mergeRange(next[key] ?? [], [start, end]);
      affected.push({ segment, text, key });
    }
    if (!affected.length) return;
    if (!editResponse(item, { highlights: next })) return;
    selection.removeAllRanges();
    for (const { segment, text, key } of affected) writeSegments(segment, text, next[key]);
    byId("clear-highlights").disabled = false;
  }

  screen.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressedClickUntil = 0;
    drag = null;
    const target = event.target.closest(".highlightable");
    if (!target || state.phase !== "taking" || view !== "item") return;
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false, card: target.closest(".question-card") };
  });
  document.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 4) drag.moved = true;
  });
  document.addEventListener("pointercancel", () => { drag = null; });
  document.addEventListener("pointerup", (event) => {
    if (drag?.id !== event.pointerId) return;
    const selection = window.getSelection();
    const { card, moved } = drag;
    drag = null;
    if (!moved && (!selection || selection.isCollapsed)) return;
    suppressedClickUntil = performance.now() + 250;
    const item = currentItem();
    requestAnimationFrame(() => {
      if (card.isConnected && state.phase === "taking" && currentItem() === item) applyHighlight(window.getSelection(), card, item);
    });
  });
  screen.addEventListener("click", (event) => {
    if (event.detail && performance.now() < suppressedClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  screen.addEventListener("dragstart", (event) => {
    if (event.target.closest(".highlightable")) event.preventDefault();
  });

  byId("help-button").addEventListener("click", openHelp);
  byId("reset-button").addEventListener("click", resetAttempt);
  byId("calculator-button").addEventListener("click", openCalculator);
  byId("font-button").addEventListener("click", () => {
    state.textSize = (state.textSize + 1) % 3;
    save();
    setPreferences();
    announce(byId("font-button").title);
  });
  byId("contrast-button").addEventListener("click", () => {
    state.dark = !state.dark;
    save();
    setPreferences();
  });
  byId("dialog-close").addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
    }
  });
  byId("jump-button").addEventListener("click", openNavigator);
  byId("review-button").addEventListener("click", openReview);
  byId("previous-button").addEventListener("click", previousItem);
  byId("next-button").addEventListener("click", nextItem);
  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || dialog.open || state.phase !== "taking") return;
    const key = event.key.toLowerCase();
    if (!["arrowleft", "arrowright", "m", "r"].includes(key)) return;
    event.preventDefault();
    if (key === "arrowleft") previousItem();
    if (key === "arrowright") nextItem();
    if (key === "m") toggleMark();
    if (key === "r") openReview();
  });
  byId("form-title").textContent = data?.title ?? "Form 16";
  if (data?.title) document.title = data.title + " · Exam Practice";
  render();
  window.setInterval(updateTimer, 500);
  window.addEventListener("focus", updateTimer);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateTimer();
  });
})();
