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

    if (!endedSession || !activeSession) {
        return null;
    }

    const endedTimes = [
        ...endedSession.querySelectorAll(".hour-session span")
    ].map(el => el.textContent.trim());

    if (endedTimes.length < 2) {
        return null;
    }

    const activeTime =
        activeSession
            .querySelector("span")
            ?.textContent
            ?.trim();

    if (!activeTime) {
        return null;
    }

    return {
        entry: endedTimes[0],
        lunchStart: endedTimes[1],
        lunchEnd: activeTime
    };
}
function getBreakColor(minutes) {
    if (minutes < 45 || minutes > 60) {
        return "#d32f2f"; // rosso
    }
    return "#2e7d32"; // verde
}


function calculate(data, settings) {
    const entry = timeToMinutes(data.entry);
    const lunchStart = timeToMinutes(data.lunchStart);
    const lunchEndActual = timeToMinutes(data.lunchEnd);

    const lunchDuration = lunchEndActual - lunchStart;
    const morningWorked = lunchStart - entry;
    const dailyMinutes = Math.round(settings.dailyHours * 60);

    const exitMinutes =
        lunchEndActual +
        (dailyMinutes - morningWorked);

    const now = new Date();
    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

    const afternoonWorked =
        Math.max(0, currentMinutes - lunchEndActual);

    const worked =
        morningWorked + afternoonWorked;

    const remaining =
        Math.max(0, dailyMinutes - worked);

    return {
        lunchDuration,
        exitTime: minutesToTime(exitMinutes),
        worked,
        remaining
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

    const breakMinutes =
        timeToMinutes(data.lunchEnd) - timeToMinutes(data.lunchStart);

    const breakClass =
        breakMinutes < settings.breakMin || breakMinutes > settings.breakMax
            ? "is-warn"
            : "is-ok";

    widget.innerHTML = `
        <div class="dic-row-top">
            <div class="dic-exit-time">${stats.exitTime}</div>

            <div class="dic-mini">
                <div class="dic-mini-item"><strong>Lavorato</strong> ${formatDuration(stats.worked)}</div>
                <div class="dic-mini-item"><strong>Residuo</strong> ${formatDuration(stats.remaining)}</div>
            </div>
        </div>

        <div class="dic-break ${breakClass}">
            Pausa ${formatDuration(breakMinutes)}
        </div>
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