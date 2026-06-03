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
function calculate(data) {
    const entry = timeToMinutes(data.entry);
    const lunchStart = timeToMinutes(data.lunchStart);
    const lunchEndActual = timeToMinutes(data.lunchEnd);

    const lunchDuration = lunchEndActual - lunchStart;
    const morningWorked = lunchStart - entry;

    const exitMinutes =
        lunchEndActual +
        (480 - morningWorked);

    const now = new Date();
    const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

    const afternoonWorked =
        Math.max(0, currentMinutes - lunchEndActual);

    const worked =
        morningWorked + afternoonWorked;

    const remaining =
        Math.max(0, 480 - worked);

    return {
        lunchDuration,
        exitTime: minutesToTime(exitMinutes),
        worked,
        remaining
    };
}

function renderWidget() {

    const data = parseDashboard();
    if (!data) return;

    const stats = calculate(data);

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
        breakMinutes >= 45 && breakMinutes <= 60
            ? "is-ok"
            : "is-warn";

    widget.innerHTML = `
    <div class="dic-row-top">
        <div class="dic-exit-time">
            ${stats.exitTime}
        </div>

        <div class="dic-mini">
            <div><strong>Lavorato:</strong> ${formatDuration(stats.worked)}</div>
            <div><strong>Residuo:</strong> ${formatDuration(stats.remaining)}</div>
        </div>
    </div>

    <div class="dic-break ${breakClass}">
        Pausa ${formatDuration(breakMinutes)}
    </div>
`;
}

function start() {

    renderWidget();

    setInterval(() => {
        try {
            renderWidget();
        } catch (err) {
            console.error(
                "DIC Exit Time:",
                err
            );
        }
    }, 10000);
}

start();