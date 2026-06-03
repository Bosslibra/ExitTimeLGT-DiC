const DEFAULTS = {
    dailyHours: 8,
    breakMin: 45,
    breakMax: 60
};

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

    await chrome.storage.sync.set({
        dailyHours,
        breakMin,
        breakMax
    });

    status.textContent = "Saved.";
    setTimeout(() => {
        status.textContent = "";
    }, 1000);
}

function bindEvents() {
    document
        .getElementById("popup-form")
        .addEventListener("submit", saveSettings);
}

document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await restoreSettings();
});