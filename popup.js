const DEFAULTS = {
    dailyHours: 8,
    breakMin: 45,
    breakMax: 60
};

let currentMode = "time"; // "time" or "settings"

// ============ Mode Switching ============
function setMode(mode) {
    currentMode = mode;
    const timeSection = document.getElementById("time-form");
    const settingsSection = document.getElementById("popup-form");
    const modeTitle = document.getElementById("mode-title");

    if (mode === "time") {
        timeSection.classList.add("active");
        settingsSection.classList.remove("active");
        modeTitle.textContent = "Enter / Exit";
    } else {
        timeSection.classList.remove("active");
        settingsSection.classList.add("active");
        modeTitle.textContent = "Settings";
    }
}

function toggleMode() {
    setMode(currentMode === "time" ? "settings" : "time");
}

// ============ Time Helpers ============
function timeToMinutes(t) {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(min) {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
}

function calculateExit(rows, settings) {
    const dailyMinutes = Math.round(settings.dailyHours * 60);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let workedFromCompleted = 0;
    let lastIn = null;

    for (const row of rows) {
        const inMin = timeToMinutes(row.enter);
        const outMin = timeToMinutes(row.exit);
        if (inMin === null) continue;
        if (outMin !== null) {
            workedFromCompleted += Math.max(0, outMin - inMin);
        } else {
            lastIn = inMin;
        }
    }

    const remaining = Math.max(0, dailyMinutes - workedFromCompleted);

    if (lastIn === null) return null; // no open session, nothing to show

    const exitMin = lastIn + remaining;
    const workedNow = workedFromCompleted + Math.max(0, nowMinutes - lastIn);

    return {
        exitTime: minutesToTime(exitMin),
        worked: workedNow,
        remaining: Math.max(0, dailyMinutes - workedNow)
    };
}

async function renderResult() {
    const rows = getRowValues();
    const settings = await chrome.storage.sync.get(DEFAULTS);
    const result = calculateExit(rows, settings);

    const exitEl = document.getElementById("result-exit");
    const metaEl = document.getElementById("result-meta");

    if (!result) {
        exitEl.textContent = "--:--";
        metaEl.textContent = "";
        return;
    }

    exitEl.textContent = result.exitTime;
    metaEl.innerHTML =
        `<span>Worked ${formatDuration(result.worked)}</span>` +
        `<span>Left ${formatDuration(result.remaining)}</span>`;
}

// ============ Time Rows ============
function createRow(enter = "", exit = "") {
    const container = document.getElementById("time-rows");
    const row = document.createElement("div");
    row.className = "time-row";

    const inInput = document.createElement("input");
    inInput.type = "time";
    inInput.value = enter;

    const outInput = document.createElement("input");
    outInput.type = "time";
    outInput.value = exit;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-row-btn";
    removeBtn.title = "Remove row";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
        if (container.children.length > 1) {
            row.remove();
        }
    });

    inInput.addEventListener("input", renderResult);
    outInput.addEventListener("input", renderResult);

    row.appendChild(inInput);
    row.appendChild(outInput);
    row.appendChild(removeBtn);
    container.appendChild(row);
}

function getRowValues() {
    const rows = document.querySelectorAll("#time-rows .time-row");
    return Array.from(rows).map(row => {
        const inputs = row.querySelectorAll("input");
        return { enter: inputs[0].value, exit: inputs[1].value };
    });
}

// ============ Persistence ============
async function getTodayTimes() {
    const today = new Date().toDateString();
    const result = await chrome.storage.sync.get("todayTimes");
    const stored = result.todayTimes;
    if (stored && stored.date === today) return stored.rows || [];
    return [];
}

async function saveTimes(event) {
    event.preventDefault();
    const rows = getRowValues();
    await chrome.storage.sync.set({
        todayTimes: { date: new Date().toDateString(), rows }
    });
    showTimeStatus("Saved.");
}

async function restoreTimes() {
    const container = document.getElementById("time-rows");
    container.innerHTML = "";
    const rows = await getTodayTimes();
    if (rows.length > 0) {
        rows.forEach(r => createRow(r.enter, r.exit));
    } else {
        createRow();
        createRow();
    }
    await renderResult();
}

function showTimeStatus(message) {
    const status = document.getElementById("time-status");
    status.textContent = message;
    setTimeout(() => { status.textContent = ""; }, 1500);
}

// ============ Settings ============
async function restoreSettings() {
    const settings = await chrome.storage.sync.get(DEFAULTS);
    document.getElementById("dailyHours").value = settings.dailyHours;
    document.getElementById("breakMin").value = settings.breakMin;
    document.getElementById("breakMax").value = settings.breakMax;
}

async function saveSettings(event) {
    event.preventDefault();
    const dailyHours = Number(document.getElementById("dailyHours").value);
    const breakMin = Number(document.getElementById("breakMin").value);
    const breakMax = Number(document.getElementById("breakMax").value);
    const status = document.getElementById("status");

    if (!dailyHours || breakMin < 0 || breakMax < 0 || breakMin > breakMax) {
        status.textContent = "Check the values.";
        return;
    }

    await chrome.storage.sync.set({ dailyHours, breakMin, breakMax });
    status.textContent = "Saved.";
    setTimeout(() => { status.textContent = ""; }, 1000);
}

// ============ Event Binding ============
function bindEvents() {
    document.getElementById("popup-form").addEventListener("submit", saveSettings);
    document.getElementById("settings-toggle").addEventListener("click", toggleMode);
    document.getElementById("time-form").addEventListener("submit", saveTimes);
    document.getElementById("add-row-btn").addEventListener("click", () => createRow());
}

document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await restoreSettings();
    await restoreTimes();
    setMode("time");
});