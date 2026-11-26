(() => {
  const FIELD_IDS = {
    allyAdc: "champ-select-in-2",
    allySupport: "champ-select-in-3",
    allyJungle: "champ-select-in-4",
    enemyAdc: "champ-select-in-5",
    enemySupport: "champ-select-in-6",
  };
  const lastApplied = new Map();
  let statusNode;
  let busy = false;
  let connected = false;
  let pollTimer = null;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function showStatus(text, state = "idle") {
    if (!statusNode) {
      statusNode = document.createElement("button");
      statusNode.id = "coachktool-status";
      statusNode.type = "button";
      statusNode.title = "Click to connect or retry CoachKtool local access";
      statusNode.setAttribute("aria-label", "CoachKtool local draft connection");
      Object.assign(statusNode.style, {
        position: "fixed", zIndex: "2147483647", right: "14px", bottom: "14px",
        padding: "9px 13px", borderRadius: "8px", background: "#10151d", color: "#e7edf5",
        border: "1px solid #526174", boxShadow: "0 4px 18px #0007", font: "12px/1.4 system-ui,sans-serif",
        maxWidth: "340px", cursor: "pointer", pointerEvents: "auto",
      });
      statusNode.addEventListener("click", () => sync(true));
      document.documentElement.appendChild(statusNode);
    }
    statusNode.textContent = `CoachKtool · ${text}`;
    statusNode.style.borderColor = state === "connected" ? "#4dbb8b" : state === "error" ? "#d56c6c" : "#c18b43";
  }
  function setConnected(value) {
    connected = value;
    if (connected && !pollTimer) pollTimer = setInterval(() => sync(false), 1500);
    if (!connected && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function inputFor(field) { return document.getElementById(FIELD_IDS[field]); }
  function normalizeName(value) {
    return String(value || "").trim().replace(/\*+$/, "").replace(/\s+/g, " ").toLocaleLowerCase();
  }
  function dispatchInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value); else input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function slotFor(field) { return FIELD_IDS[field].match(/\d+$/)?.[0] || null; }
  function findOption(field, name) {
    const slot = slotFor(field);
    if (!slot) return null;
    const options = document.querySelectorAll(`[id^="champ-select-list-${slot}-"], [role="option"]`);
    const wanted = normalizeName(name);
    return [...options].find((item) =>
      item.getClientRects().length > 0 && normalizeName(item.textContent) === wanted,
    ) || null;
  }
  function dispatchKey(input, key, code) {
    const eventOptions = { key, code, bubbles: true, cancelable: true, view: window };
    input.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
    input.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
  }
  function dispatchMouseSelection(option) {
    const eventOptions = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
    option.dispatchEvent(new PointerEvent("pointerdown", { ...eventOptions, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    option.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    option.dispatchEvent(new PointerEvent("pointerup", { ...eventOptions, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    option.dispatchEvent(new MouseEvent("mouseup", { ...eventOptions, buttons: 0 }));
    option.click();
  }
  function listIsClosed(field, input) {
    const slot = slotFor(field);
    const list = slot ? document.getElementById(`champ-select-list-${slot}`) : null;
    return !list?.getClientRects().length && input.getAttribute("aria-expanded") !== "true";
  }
  async function waitForCommit(field, input) {
    for (let attempt = 0; attempt < 12; attempt++) {
      await wait(100);
      if (listIsClosed(field, input)) return true;
    }
    return false;
  }
  async function choose(field, player) {
    const input = inputFor(field);
    const desired = player?.name || "";
    if (!input) return false;
    if (lastApplied.get(field) === desired) return true;
    if (!desired) {
      if (lastApplied.get(field)) {
        dispatchKey(input, "Backspace", "Backspace");
        lastApplied.set(field, "");
      }
      return true;
    }
    input.click();
    dispatchInput(input, desired);
    let option = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(100);
      option = findOption(field, desired);
      if (option) break;
    }
    if (!option) return false;
    dispatchMouseSelection(option);
    let committed = await waitForCommit(field, input);
    if (!committed) {
      dispatchKey(input, "Enter", "Enter");
      committed = await waitForCommit(field, input);
    }
    if (committed) lastApplied.set(field, desired);
    return committed;
  }
  function setBlindPick(value) {
    const label = [...document.querySelectorAll("label")].find((item) => /i.m blind pick/i.test(item.textContent || ""));
    const checkbox = label?.querySelector('input[type="checkbox"]') || document.querySelector('input[type="checkbox"]');
    if (checkbox && checkbox.checked !== Boolean(value)) checkbox.click();
  }
  async function sync(fromClick) {
    if (busy || (!connected && !fromClick)) return;
    busy = true;
    if (!connected) showStatus("Connecting to League; allow local access if asked.");
    try {
      // Initiated only by the Connect click on first use, which allows Chrome to request loopback access.
      const response = await fetch("http://127.0.0.1:32145/draft", { cache: "no-store", mode: "cors" });
      const result = await response.json().catch(() => null);
      setConnected(true);
      if (!result?.ok) {
        showStatus(result?.message || "Waiting for the local League service.", "error");
        return;
      }
      if (!result.draft) {
        showStatus(result.message || "Connected; waiting for Champion Select.", "connected");
        return;
      }
      const draft = result.draft;
      const key = JSON.stringify(draft);
      const estimated = draft.enemyBotLaneEstimated ? " · enemy bot lane estimated" : "";
      if (lastApplied.get("draft") === key) { showStatus(`Live draft synced${estimated}.`, "connected"); return; }
      let allCommitted = true;
      for (const field of Object.keys(FIELD_IDS)) {
        const committed = await choose(field, draft[field]);
        allCommitted = committed && allCommitted;
      }
      setBlindPick(Boolean(draft.blindPick));
      if (allCommitted) {
        lastApplied.set("draft", key);
        showStatus(`Live draft synced${estimated}.`, "connected");
      } else {
        showStatus("Selecting champion suggestions; retrying until the fields commit.", "connected");
      }
    } catch {
      setConnected(false);
      showStatus("Connection failed. Click to retry and allow local access if prompted.", "error");
    } finally { busy = false; }
  }
  showStatus("Click to connect to your local League draft.");
})();
