const API = "/api/reminders";
const ARCHIVE_THRESHOLD_MONTHS = 3;
const MONTH_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const viewCalendar = document.getElementById("view-calendar");
const viewList = document.getElementById("view-list");
const viewForm = document.getElementById("view-form");
const listContent = document.getElementById("list-content");
const formTitle = document.getElementById("form-title");
const alertsList = document.getElementById("alerts-list");
const alertRowTemplate = document.getElementById("alert-row-template");

const inputTitle = document.getElementById("input-title");
const inputDate = document.getElementById("input-date");
const inputTime = document.getElementById("input-time");

const btnNew = document.getElementById("btn-new");
const btnBack = document.getElementById("btn-back");
const btnAddAlert = document.getElementById("btn-add-alert");
const btnSave = document.getElementById("btn-save");
const btnDelete = document.getElementById("btn-delete");

const bottomNav = document.getElementById("bottom-nav");
const tabCalendar = document.getElementById("tab-calendar");
const tabList = document.getElementById("tab-list");

const calPrev = document.getElementById("cal-prev");
const calNext = document.getElementById("cal-next");
const calMonthLabel = document.getElementById("cal-month-label");
const calGrid = document.getElementById("cal-grid");
const calMonthList = document.getElementById("cal-month-list");
const calTodayBtn = document.getElementById("cal-today-btn");

const subtabUpcoming = document.getElementById("subtab-upcoming");
const subtabPast = document.getElementById("subtab-past");
const btnToggleArchived = document.getElementById("btn-toggle-archived");

const sheetBackdrop = document.getElementById("day-sheet-backdrop");
const daySheet = document.getElementById("day-sheet");
const daySheetTitle = document.getElementById("day-sheet-title");
const daySheetList = document.getElementById("day-sheet-list");
const daySheetClose = document.getElementById("day-sheet-close");

const monthSheetBackdrop = document.getElementById("month-sheet-backdrop");
const monthSheet = document.getElementById("month-sheet");
const monthSheetClose = document.getElementById("month-sheet-close");
const msheetYearLabel = document.getElementById("msheet-year-label");
const msheetPrevYear = document.getElementById("msheet-prev-year");
const msheetNextYear = document.getElementById("msheet-next-year");
const msheetGrid = document.getElementById("msheet-grid");

let editingId = null;
let activeTab = "calendar"; // "calendar" | "list"
let listSubTab = "upcoming"; // "upcoming" | "past"
let showArchived = false;
let calendarCursor = new Date();
let monthSheetYear = calendarCursor.getFullYear();
let allReminders = [];
let previousMainDateTime = null;

// ---------- helpers ----------

function pad2(n) {
  return String(n).padStart(2, "0");
}

// All date/time inputs are local wall-clock values, so every helper here
// formats using local getters — never toISOString(), which is UTC and
// silently shifts dates/times across timezone offsets.
function toDateInput(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toTimeInput(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function todayStr() {
  return toDateInput(new Date());
}

function archiveThresholdStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - ARCHIVE_THRESHOLD_MONTHS);
  return toDateInput(d);
}

function isArchived(reminder) {
  return reminder.date < archiveThresholdStr();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatCardTime(time) {
  const [h, m] = time.split(":").map(Number);
  const mer = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return { hh: String(hh).padStart(2, "0") + ":" + String(m).padStart(2, "0"), mer };
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })
    .toUpperCase();
}

// ---------- navigation ----------

function hideAllViews() {
  viewCalendar.classList.add("hidden");
  viewList.classList.add("hidden");
  viewForm.classList.add("hidden");
}

function showCalendar() {
  hideAllViews();
  viewCalendar.classList.remove("hidden");
  bottomNav.classList.remove("hidden");
  activeTab = "calendar";
  tabCalendar.classList.add("active");
  tabList.classList.remove("active");
  renderCalendar();
}

function showList() {
  hideAllViews();
  viewList.classList.remove("hidden");
  bottomNav.classList.remove("hidden");
  activeTab = "list";
  tabList.classList.add("active");
  tabCalendar.classList.remove("active");
  showArchived = false;
  setListSubTab("upcoming");
}

function setListSubTab(subTab) {
  listSubTab = subTab;
  subtabUpcoming.classList.toggle("active", subTab === "upcoming");
  subtabPast.classList.toggle("active", subTab === "past");
  btnToggleArchived.classList.toggle("hidden", subTab !== "past");
  updateArchiveToggleState();
  renderList();
}

function updateArchiveToggleState() {
  btnToggleArchived.classList.toggle("active", showArchived);
  btnToggleArchived.textContent = showArchived ? "📂" : "📁";
  btnToggleArchived.setAttribute("aria-label", showArchived ? "Ocultar archivados" : "Mostrar archivados");
}

let toastTimer = null;
function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 1500);
}

function showActiveTab() {
  if (activeTab === "list") showList();
  else showCalendar();
}

function getMainDateTime() {
  if (!inputDate.value || !inputTime.value) return null;
  return new Date(`${inputDate.value}T${inputTime.value}:00`);
}

function handleMainDateTimeChange() {
  const newMain = getMainDateTime();

  if (previousMainDateTime && newMain) {
    const deltaMs = newMain.getTime() - previousMainDateTime.getTime();
    if (deltaMs !== 0) {
      for (const row of alertsList.querySelectorAll(".alert-row")) {
        const dateEl = row.querySelector(".alert-date");
        const timeEl = row.querySelector(".alert-time");
        if (!dateEl.value || !timeEl.value) continue;
        const shifted = new Date(`${dateEl.value}T${timeEl.value}:00`);
        shifted.setTime(shifted.getTime() + deltaMs);
        dateEl.value = toDateInput(shifted);
        timeEl.value = toTimeInput(shifted);
      }
    }
  }

  previousMainDateTime = newMain;
  refreshAllAlertLabels();
}

function showForm(mode, reminder) {
  hideAllViews();
  viewForm.classList.remove("hidden");
  bottomNav.classList.add("hidden");
  closeDaySheet();
  alertsList.innerHTML = "";

  if (mode === "edit" && reminder) {
    editingId = reminder.id;
    formTitle.textContent = "EDITAR";
    btnDelete.classList.remove("hidden");
    inputTitle.value = reminder.title;
    inputDate.value = reminder.date;
    inputTime.value = reminder.time;
    for (const alert of reminder.alerts) {
      const d = new Date(alert.fireAt);
      addAlertRow(toDateInput(d), toTimeInput(d));
    }
  } else {
    editingId = null;
    formTitle.textContent = "NUEVO";
    btnDelete.classList.add("hidden");
    inputTitle.value = "";
    inputDate.value = mode === "new" && reminder ? reminder.date : "";
    inputTime.value = "";
  }

  previousMainDateTime = getMainDateTime();
}

// ---------- data ----------

async function loadReminders() {
  try {
    const res = await fetch(API);
    allReminders = await res.json();
  } catch (err) {
    allReminders = [];
  }
}

async function refreshEverything() {
  await loadReminders();
  if (activeTab === "list") renderList();
  else renderCalendar();
}

// ---------- list view (upcoming / past, with archiving) ----------

function renderList() {
  const today = todayStr();
  let items;

  if (listSubTab === "past") {
    items = allReminders.filter((r) => r.date < today);
    if (!showArchived) items = items.filter((r) => !isArchived(r));
    items.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  } else {
    items = allReminders
      .filter((r) => r.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  listContent.innerHTML = "";

  if (items.length === 0) {
    const msg = listSubTab === "past" ? "NO HAY RECORDATORIOS PASADOS" : "NO HAY RECORDATORIOS PRÓXIMOS";
    listContent.innerHTML = `<p class="empty-state">${msg}</p>`;
    return;
  }

  const byDay = new Map();
  for (const r of items) {
    if (!byDay.has(r.date)) byDay.set(r.date, []);
    byDay.get(r.date).push(r);
  }

  for (const [date, dayItems] of byDay) {
    const label = document.createElement("div");
    label.className = "day-label";
    label.textContent = formatDayLabel(date);
    listContent.appendChild(label);

    for (const reminder of dayItems) {
      listContent.appendChild(buildCard(reminder));
    }
  }
}

function buildCard(reminder, dimmed = false) {
  const card = document.createElement("div");
  card.className = dimmed ? "reminder-card dimmed" : "reminder-card";
  const { hh, mer } = formatCardTime(reminder.time);

  const alertTags = reminder.alerts
    .map((a) => `<span class="tag">${escapeHtml(a.label)}</span>`)
    .join("");

  card.innerHTML = `
    <div class="time">${hh}<small>${mer}</small></div>
    <div class="body">
      <div class="title">${escapeHtml(reminder.title)}</div>
      <div class="tags">${alertTags}</div>
    </div>
  `;
  card.addEventListener("click", () => showForm("edit", reminder));
  return card;
}

// ---------- calendar view ----------

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();

  calMonthLabel.textContent = calendarCursor
    .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
    .toUpperCase();

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  calTodayBtn.classList.toggle("hidden", isCurrentMonth);

  const remindersByDate = new Map();
  for (const r of allReminders) {
    if (!remindersByDate.has(r.date)) remindersByDate.set(r.date, []);
    remindersByDate.get(r.date).push(r);
  }

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  calGrid.innerHTML = "";

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    calGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    cell.textContent = String(day);

    if (dateStr === today) cell.classList.add("today");

    const dayReminders = remindersByDate.get(dateStr);
    if (dayReminders && dayReminders.length > 0) {
      cell.classList.add("has-items");
      if (dayReminders.length > 1) {
        const badge = document.createElement("div");
        badge.className = "count-badge";
        badge.textContent = String(dayReminders.length);
        cell.appendChild(badge);
      }
      cell.addEventListener("click", () => openDaySheet(dateStr, dayReminders));
    }

    calGrid.appendChild(cell);
  }

  renderCalendarMonthList(year, month);
}

function renderCalendarMonthList(year, month) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const today = todayStr();

  const monthReminders = allReminders.filter((r) => r.date.startsWith(monthPrefix));
  const upcoming = monthReminders
    .filter((r) => r.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = monthReminders
    .filter((r) => r.date < today && !isArchived(r))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  calMonthList.innerHTML = "";

  if (upcoming.length === 0 && past.length === 0) {
    calMonthList.innerHTML = '<p class="empty-state">SIN RECORDATORIOS ESTE MES</p>';
    return;
  }

  if (upcoming.length > 0) {
    const label = document.createElement("div");
    label.className = "section-label";
    label.textContent = "PRÓXIMOS ESTE MES";
    calMonthList.appendChild(label);
    for (const reminder of upcoming) calMonthList.appendChild(buildCard(reminder));
  }

  if (past.length > 0) {
    const label = document.createElement("div");
    label.className = "section-label";
    label.textContent = "PASADOS ESTE MES";
    calMonthList.appendChild(label);
    for (const reminder of past) calMonthList.appendChild(buildCard(reminder, true));
  }
}

function openDaySheet(dateStr, reminders) {
  daySheetTitle.textContent = formatDayLabel(dateStr);
  daySheetList.innerHTML = "";

  for (const reminder of reminders) {
    const { hh, mer } = formatCardTime(reminder.time);
    const item = document.createElement("div");
    item.className = "day-sheet-item";
    item.innerHTML = `
      <div class="when">${hh} ${mer}</div>
      <div class="title">${escapeHtml(reminder.title)}</div>
      <button class="edit-icon" aria-label="Editar">✎</button>
    `;
    item.addEventListener("click", () => showForm("edit", reminder));
    daySheetList.appendChild(item);
  }

  sheetBackdrop.classList.remove("hidden");
  daySheet.classList.remove("hidden");
}

function closeDaySheet() {
  sheetBackdrop.classList.add("hidden");
  daySheet.classList.add("hidden");
}

// ---------- month / year picker sheet ----------

function openMonthSheet() {
  monthSheetYear = calendarCursor.getFullYear();
  renderMonthSheet();
  monthSheetBackdrop.classList.remove("hidden");
  monthSheet.classList.remove("hidden");
}

function closeMonthSheet() {
  monthSheetBackdrop.classList.add("hidden");
  monthSheet.classList.add("hidden");
}

function renderMonthSheet() {
  msheetYearLabel.textContent = String(monthSheetYear);
  msheetGrid.innerHTML = "";

  const now = new Date();

  for (let m = 0; m < 12; m++) {
    const cell = document.createElement("div");
    cell.className = "msheet-cell";
    cell.textContent = MONTH_ABBR[m];

    if (monthSheetYear === now.getFullYear() && m === now.getMonth()) cell.classList.add("current");
    if (monthSheetYear === calendarCursor.getFullYear() && m === calendarCursor.getMonth()) {
      cell.classList.add("selected");
    }

    cell.addEventListener("click", () => {
      calendarCursor = new Date(monthSheetYear, m, 1);
      closeMonthSheet();
      renderCalendar();
    });

    msheetGrid.appendChild(cell);
  }
}

// ---------- alert rows (auto label) ----------

function computeAutoLabel(alertDate, alertTime) {
  if (!alertDate || !inputDate.value) return "—";

  const reminderDay = new Date(`${inputDate.value}T00:00:00`);
  const alertDay = new Date(`${alertDate}T00:00:00`);
  const diffDays = Math.round((reminderDay - alertDay) / 86400000);

  if (diffDays === 0) {
    if (alertTime && inputTime.value && alertTime === inputTime.value) return "Mismo momento";
    return "Mismo día";
  }
  if (diffDays === 1) return "1 día antes";
  if (diffDays > 1) return `${diffDays} días antes`;
  if (diffDays === -1) return "1 día después";
  return `${Math.abs(diffDays)} días después`;
}

function addAlertRow(date = "", time = "") {
  const node = alertRowTemplate.content.firstElementChild.cloneNode(true);
  const labelEl = node.querySelector(".alert-auto-label");
  const dateEl = node.querySelector(".alert-date");
  const timeEl = node.querySelector(".alert-time");

  dateEl.value = date;
  timeEl.value = time;
  labelEl.textContent = computeAutoLabel(date, time);

  const refresh = () => {
    labelEl.textContent = computeAutoLabel(dateEl.value, timeEl.value);
  };
  dateEl.addEventListener("input", refresh);
  timeEl.addEventListener("input", refresh);

  node.querySelector(".alert-remove").addEventListener("click", () => node.remove());
  alertsList.appendChild(node);
}

function refreshAllAlertLabels() {
  for (const row of alertsList.querySelectorAll(".alert-row")) {
    const dateEl = row.querySelector(".alert-date");
    const timeEl = row.querySelector(".alert-time");
    row.querySelector(".alert-auto-label").textContent = computeAutoLabel(dateEl.value, timeEl.value);
  }
}

function collectAlerts() {
  const rows = alertsList.querySelectorAll(".alert-row");
  const alerts = [];
  for (const row of rows) {
    const date = row.querySelector(".alert-date").value;
    const time = row.querySelector(".alert-time").value;
    if (!date || !time) continue;
    const label = computeAutoLabel(date, time);
    alerts.push({ label, fireAt: new Date(`${date}T${time}:00`).toISOString() });
  }
  return alerts;
}

// ---------- save / delete ----------

async function saveReminder() {
  const title = inputTitle.value.trim();
  const date = inputDate.value;
  const time = inputTime.value;

  if (!title || !date || !time) {
    alert("Título, fecha y hora son obligatorios.");
    return;
  }

  const payload = { title, date, time, alerts: collectAlerts() };

  const url = editingId ? `${API}/${editingId}` : API;
  const method = editingId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    alert("No se pudo guardar el recordatorio.");
    return;
  }

  await refreshEverything();
  showActiveTab();
}

async function deleteReminder() {
  if (!editingId) return;
  if (!confirm("¿Eliminar este recordatorio y todas sus alertas?")) return;

  const res = await fetch(`${API}/${editingId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    alert("No se pudo eliminar el recordatorio.");
    return;
  }
  await refreshEverything();
  showActiveTab();
}

// ---------- wiring ----------

tabCalendar.addEventListener("click", showCalendar);
tabList.addEventListener("click", showList);
btnNew.addEventListener("click", () => showForm("new"));
btnBack.addEventListener("click", showActiveTab);
btnAddAlert.addEventListener("click", () => addAlertRow());
inputDate.addEventListener("input", handleMainDateTimeChange);
inputTime.addEventListener("input", handleMainDateTimeChange);
btnSave.addEventListener("click", saveReminder);
btnDelete.addEventListener("click", deleteReminder);

calPrev.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendar();
});
calNext.addEventListener("click", () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendar();
});
calTodayBtn.addEventListener("click", () => {
  calendarCursor = new Date();
  renderCalendar();
});
calMonthLabel.addEventListener("click", openMonthSheet);
msheetPrevYear.addEventListener("click", () => {
  monthSheetYear--;
  renderMonthSheet();
});
msheetNextYear.addEventListener("click", () => {
  monthSheetYear++;
  renderMonthSheet();
});
monthSheetClose.addEventListener("click", closeMonthSheet);
monthSheetBackdrop.addEventListener("click", closeMonthSheet);

subtabUpcoming.addEventListener("click", () => setListSubTab("upcoming"));
subtabPast.addEventListener("click", () => setListSubTab("past"));
btnToggleArchived.addEventListener("click", () => {
  showArchived = !showArchived;
  updateArchiveToggleState();
  showToast(showArchived ? "MOSTRANDO ARCHIVADOS" : "OCULTANDO ARCHIVADOS");
  renderList();
});

sheetBackdrop.addEventListener("click", closeDaySheet);
daySheetClose.addEventListener("click", closeDaySheet);

(async function init() {
  await loadReminders();
  showCalendar();
})();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
