const DEFAULT_SETTINGS = {
    dailyHours: 8,
    breakMin: 45,
    breakMax: 60
};

async function getSettings() {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return settings;
}
function timeToMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return `${h}h ${String(m).padStart(2, "0")}m`;
}

function parseDashboard() {

    const endedSession =
        document.querySelector(".ended-session");

    const activeSession =
        document.querySelector(".active-session");

    const endedTimes = endedSession
        ? [...endedSession.querySelectorAll(".hour-session span")]
            .map(el => el.textContent.trim())
        : [];

    const activeTime =
        activeSession
            ?.querySelector("span")
            ?.textContent
            ?.trim() || null;

    const sessions = [];
    for (let i = 0; i + 1 < endedTimes.length; i += 2) {
        sessions.push({
            entry: endedTimes[i],
            exit: endedTimes[i + 1]
        });
    }

    // Nothing to show without at least one entry
    if (sessions.length === 0 && !activeTime) {
        return null;
    }

    return {
        sessions,
        activeEntry: activeTime
    };
}
function getBreakColor(minutes) {
    if (minutes < 45 || minutes > 60) {
        return "#d32f2f"; // rosso
    }
    return "#2e7d32"; // verde
}


function calculate(data, settings) {
    const sessions = data.sessions.map(session => ({
        entry: timeToMinutes(session.entry),
        exit: timeToMinutes(session.exit)
    }));
    const activeEntry = data.activeEntry
        ? timeToMinutes(data.activeEntry)
        : null;

    const now = new Date();
    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

    const dailyMinutes = Math.round(settings.dailyHours * 60);
    const defaultBreak = settings.breakMin;

    const completedWorked = sessions.reduce(
        (total, session) => total + Math.max(0, session.exit - session.entry),
        0
    );
    const missingWork = Math.max(0, dailyMinutes - completedWorked);

    // Gaps between closed sessions (and the active one, if any)
    const closedBreaks = sessions.reduce((total, session, index) => {
        const nextEntry = index + 1 < sessions.length
            ? sessions[index + 1].entry
            : activeEntry;
        return nextEntry === null
            ? total
            : total + Math.max(0, nextEntry - session.exit);
    }, 0);

    // Only an entry: exit is estimated with the default break
    if (sessions.length === 0) {
        const worked = Math.max(0, currentMinutes - activeEntry);
        return {
            mode: "estimated",
            defaultBreak,
            exitTime: minutesToTime(activeEntry + dailyMinutes + defaultBreak),
            worked,
            remaining: Math.max(0, dailyMinutes - worked)
        };
    }

    // Exit recorded, no active entry: currently on break
    if (activeEntry === null) {
        const lastExit = sessions[sessions.length - 1].exit;
        const breakSoFar = closedBreaks + Math.max(0, currentMinutes - lastExit);
        const returnMinutes = lastExit + Math.max(0, defaultBreak - closedBreaks);
        return {
            mode: "break",
            defaultBreak,
            breakDuration: breakSoFar,
            returnTime: minutesToTime(returnMinutes),
            exitTime: minutesToTime(Math.max(returnMinutes, currentMinutes) + missingWork),
            worked: completedWorked,
            remaining: missingWork
        };
    }

    const afternoonWorked =
        Math.max(0, currentMinutes - activeEntry);

    const worked =
        completedWorked + afternoonWorked;

    return {
        mode: "normal",
        breakDuration: closedBreaks,
        exitTime: minutesToTime(activeEntry + missingWork),
        worked,
        remaining: Math.max(0, dailyMinutes - worked)
    };
}

async function renderWidget() {
    const data = parseDashboard();
    if (!data) return;

    const settings = await getSettings();
    const stats = calculate(data, settings);

    let widget = document.getElementById("dic-exit-widget");

    if (!widget) {
        widget = document.createElement("div");
        widget.id = "dic-exit-widget";

        const target =
            document.querySelector(".dic-dashboard-card-content") ||
            document.querySelector("dic-dashboard-card-content");

        if (!target) return;
        target.appendChild(widget);
    }

    let footer;
    if (stats.mode === "estimated") {
        footer = `
        <div class="dic-break">
            Uscita stimata in base a ${stats.defaultBreak} min di pausa
        </div>`;
    } else {
        const breakClass =
            stats.breakDuration < settings.breakMin || stats.breakDuration > settings.breakMax
                ? "is-warn"
                : "is-ok";
        const returnInfo = stats.mode === "break"
            ? ` &middot; Rientro ${stats.returnTime} (${stats.defaultBreak} min)`
            : "";
        footer = `
        <div class="dic-break ${breakClass}">
            Pausa ${formatDuration(stats.breakDuration)}${returnInfo}
        </div>`;
    }

    widget.innerHTML = `
        <div class="dic-row-top">
            <div class="dic-exit-time">${stats.exitTime}</div>

            <div class="dic-mini">
                <div class="dic-mini-item"><strong>Lavorato</strong> ${formatDuration(stats.worked)}</div>
                <div class="dic-mini-item"><strong>Residuo</strong> ${formatDuration(stats.remaining)}</div>
            </div>
        </div>
        ${footer}
    `;
}

function start() {
    // Wait for dashboard elements to be available
    const checkInterval = setInterval(() => {
        const data = parseDashboard();
        if (data) {
            clearInterval(checkInterval);
            renderWidget();
            
            // Update every minute after widget appears
            setInterval(() => {
                try {
                    renderWidget();
                } catch (err) {
                    console.error(
                        "DIC Exit Time:",
                        err
                    );
                }
            }, 60000); // precision is in minutes, so we update every 60 seconds
        }
    }, 500);
}

start();