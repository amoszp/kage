const API = "/api/reminders";
const AUTH_API = "/api/auth";
const ARCHIVE_THRESHOLD_MONTHS = 3;
const MONTH_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const viewCalendar = document.getElementById("view-calendar");
const viewList = document.getElementById("view-list");
const viewForm = document.getElementById("view-form");
const viewLogin = document.getElementById("view-login");
const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");
const viewingBanner = document.getElementById("viewing-banner");
const viewSignup = document.getElementById("view-signup");
const signupForm = document.getElementById("signup-form");
const signupName = document.getElementById("signup-name");
const signupUsername = document.getElementById("signup-username");
const signupPassword = document.getElementById("signup-password");
const signupPassword2 = document.getElementById("signup-password2");
const signupError = document.getElementById("signup-error");
const btnSignup = document.getElementById("btn-signup");

const btnAccount = document.getElementById("btn-account");
const btnToggleDone = document.getElementById("btn-toggle-done");
const accountSheetBackdrop = document.getElementById("account-sheet-backdrop");
const accountSheet = document.getElementById("account-sheet");
const accountSheetTitle = document.getElementById("account-sheet-title");
const accountSheetClose = document.getElementById("account-sheet-close");
const accountUsers = document.getElementById("account-users");
const accountUsersList = document.getElementById("account-users-list");
const btnLogout = document.getElementById("btn-logout");
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
const btnComplete = document.getElementById("btn-complete");

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
let editingCompleted = false;
let currentUser = null;
let allUsers = []; // only filled for admins
let viewingUserId = null; // admin browsing another user's reminders; null = own

// Calendar: show reminders marked as done (washed yellow) or hide them.
// Remembered per device; storage can be unavailable (private mode).
const SHOW_DONE_KEY = "kage-calendar-show-done";
let showDoneInCalendar = true;
try {
  showDoneInCalendar = localStorage.getItem(SHOW_DONE_KEY) !== "0";
} catch (err) {}

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

// A completed reminder counts as past even if its date is still ahead.
function isDone(reminder) {
  return Boolean(reminder.completedAt);
}

function isPast(reminder, today = todayStr()) {
  return isDone(reminder) || reminder.date < today;
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
  viewLogin.classList.add("hidden");
  viewSignup.classList.add("hidden");
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
    editingCompleted = isDone(reminder);
    btnComplete.textContent = editingCompleted ? "REABRIR RECORDATORIO" : "✓ MARCAR COMO HECHO";
    btnComplete.classList.remove("hidden");
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
    btnComplete.classList.add("hidden");
    editingCompleted = false;
    inputTitle.value = "";
    inputDate.value = mode === "new" && reminder ? reminder.date : "";
    inputTime.value = "";
  }

  previousMainDateTime = getMainDateTime();
}

// ---------- session ----------

class LoginRequired extends Error {}

// Every API call goes through here: a 401 means the session ended, so the
// login screen takes over.
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: "same-origin", ...options });
  if (res.status === 401) {
    showLogin();
    throw new LoginRequired();
  }
  return res;
}

function showLogin() {
  hideAllViews();
  closeDaySheet();
  closeAccountSheet();
  currentUser = null;
  allUsers = [];
  viewingUserId = null;
  allReminders = [];
  updateViewingBanner();
  bottomNav.classList.add("hidden");
  viewLogin.classList.remove("hidden");
  loginPassword.value = "";
  loginError.classList.add("hidden");
}

async function loadSession() {
  const res = await apiFetch(`${AUTH_API}/me`);
  if (!res.ok) throw new Error(`session check failed (${res.status})`);
  const data = await res.json();
  currentUser = data.user;
  allUsers = data.users;
}

async function handleLogin(event) {
  event.preventDefault();
  btnLogin.disabled = true;
  loginError.classList.add("hidden");
  try {
    const res = await fetch(`${AUTH_API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginUsername.value.trim(), password: loginPassword.value }),
    });
    if (!res.ok) {
      loginError.textContent =
        res.status === 429 ? "DEMASIADOS INTENTOS. PRUEBA EN UNOS MINUTOS."
        : res.status === 401 ? "USUARIO O CONTRASEÑA INCORRECTOS."
        : "NO SE PUDO ENTRAR. INTÉNTALO DE NUEVO.";
      loginError.classList.remove("hidden");
      return;
    }
    loginPassword.value = "";
    await loadSession();
    await loadReminders();
    showCalendar();
  } catch (err) {
    if (!(err instanceof LoginRequired)) {
      loginError.textContent = "SIN CONEXIÓN CON EL SERVIDOR.";
      loginError.classList.remove("hidden");
    }
  } finally {
    btnLogin.disabled = false;
  }
}

function showSignup() {
  hideAllViews();
  viewSignup.classList.remove("hidden");
  signupForm.reset();
  signupError.classList.add("hidden");
}

function showSignupError(text) {
  signupError.textContent = text;
  signupError.classList.remove("hidden");
}

async function handleSignup(event) {
  event.preventDefault();
  signupError.classList.add("hidden");
  const username = signupUsername.value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(username)) {
    return showSignupError("USUARIO: 2 A 32 CARACTERES, MINÚSCULAS, NÚMEROS, PUNTO, GUION O GUION BAJO.");
  }
  if (signupPassword.value.length < 4) return showSignupError("LA CONTRASEÑA NECESITA AL MENOS 4 CARACTERES.");
  if (signupPassword.value !== signupPassword2.value) return showSignupError("LAS CONTRASEÑAS NO COINCIDEN.");

  btnSignup.disabled = true;
  try {
    const res = await fetch(`${AUTH_API}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: signupPassword.value, displayName: signupName.value.trim() }),
    });
    if (res.status === 201) {
      signupForm.reset();
      await loadSession();
      await loadReminders();
      showCalendar();
      showToast("CUENTA CREADA");
      return;
    }
    showSignupError(
      res.status === 409 ? "ESE USUARIO YA EXISTE. ELIGE OTRO."
      : res.status === 429 ? "DEMASIADAS CUENTAS CREADAS. PRUEBA MÁS TARDE."
      : "NO SE PUDO CREAR. REVISA LOS DATOS."
    );
  } catch (err) {
    if (!(err instanceof LoginRequired)) showSignupError("SIN CONEXIÓN CON EL SERVIDOR.");
  } finally {
    btnSignup.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch(`${AUTH_API}/logout`, { method: "POST" });
  } finally {
    showLogin();
  }
}

// ---------- account sheet (logout, admin user switch) ----------

function openAccountSheet() {
  accountSheetTitle.textContent = `SESIÓN: ${currentUser.displayName}`.toUpperCase();
  accountUsersList.innerHTML = "";
  accountUsers.classList.toggle("hidden", !currentUser.isAdmin || allUsers.length < 2);

  for (const user of allUsers) {
    const isSelected = (viewingUserId ?? currentUser.id) === user.id;
    const item = document.createElement("button");
    item.type = "button";
    item.className = isSelected ? "day-sheet-item account-user selected" : "day-sheet-item account-user";
    item.innerHTML = `<div class="title">${escapeHtml(user.displayName)}${user.id === currentUser.id ? " (TÚ)" : ""}</div>`;
    item.addEventListener("click", () => switchViewedUser(user.id === currentUser.id ? null : user.id));
    accountUsersList.appendChild(item);
  }

  accountSheetBackdrop.classList.remove("hidden");
  accountSheet.classList.remove("hidden");
}

function closeAccountSheet() {
  accountSheetBackdrop.classList.add("hidden");
  accountSheet.classList.add("hidden");
}

async function switchViewedUser(userId) {
  viewingUserId = userId;
  closeAccountSheet();
  updateViewingBanner();
  await refreshEverything();
}

function updateViewingBanner() {
  const viewed = viewingUserId && allUsers.find((u) => u.id === viewingUserId);
  viewingBanner.classList.toggle("hidden", !viewed);
  // New reminders are always created for yourself, so hide "+" while browsing someone else.
  btnNew.classList.toggle("hidden", Boolean(viewed));
  if (viewed) viewingBanner.textContent = `VIENDO: ${viewed.displayName.toUpperCase()} · TOCA PARA VOLVER`;
}

// ---------- data ----------

async function loadReminders() {
  try {
    const res = await apiFetch(viewingUserId ? `${API}?userId=${viewingUserId}` : API);
    allReminders = res.ok ? await res.json() : [];
  } catch (err) {
    if (err instanceof LoginRequired) throw err;
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
    items = allReminders.filter((r) => isPast(r, today));
    if (!showArchived) items = items.filter((r) => !isArchived(r));
    items.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  } else {
    items = allReminders
      .filter((r) => !isPast(r, today))
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
      listContent.appendChild(buildCard(reminder, false, listSubTab === "upcoming"));
    }
  }
}

function buildCard(reminder, dimmed = false, withCheck = false) {
  const card = document.createElement("div");
  card.className = dimmed ? "reminder-card dimmed" : "reminder-card";
  const { hh, mer } = formatCardTime(reminder.time);

  const doneTag = isDone(reminder) ? '<span class="tag tag-done">✓ HECHO</span>' : "";
  const alertTags =
    doneTag +
    reminder.alerts.map((a) => `<span class="tag">${escapeHtml(a.label)}</span>`).join("");

  card.innerHTML = `
    <div class="time">${hh}<small>${mer}</small></div>
    <div class="body">
      <div class="title">${escapeHtml(reminder.title)}</div>
      <div class="tags">${alertTags}</div>
    </div>
  `;
  card.addEventListener("click", () => showForm("edit", reminder));

  if (withCheck) {
    const check = document.createElement("button");
    check.className = "card-check";
    check.type = "button";
    check.textContent = "✓";
    check.setAttribute("aria-label", "Marcar como hecho");
    check.addEventListener("click", (event) => {
      event.stopPropagation();
      setCompleted(reminder.id, true);
    });
    card.appendChild(check);
  }
  return card;
}

// ---------- calendar view ----------

/** What the calendar (grid + month list) shows: done reminders only if wanted. */
function calendarReminders() {
  return showDoneInCalendar ? allReminders : allReminders.filter((r) => !isDone(r));
}

function updateDoneToggle() {
  btnToggleDone.classList.toggle("active", showDoneInCalendar);
  btnToggleDone.setAttribute("aria-label", showDoneInCalendar ? "Ocultar hechos" : "Mostrar hechos");
}

function toggleDoneInCalendar() {
  showDoneInCalendar = !showDoneInCalendar;
  try {
    localStorage.setItem(SHOW_DONE_KEY, showDoneInCalendar ? "1" : "0");
  } catch (err) {}
  showToast(showDoneInCalendar ? "MOSTRANDO HECHOS" : "OCULTANDO HECHOS");
  renderCalendar();
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();

  calMonthLabel.textContent = calendarCursor
    .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
    .toUpperCase();

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  calTodayBtn.classList.toggle("hidden", isCurrentMonth);

  updateDoneToggle();
  const remindersByDate = new Map();
  for (const r of calendarReminders()) {
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
      // Every reminder that day is done: washed yellow instead of the full one.
      if (dayReminders.every(isDone)) cell.classList.add("all-done");
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

  const monthReminders = calendarReminders().filter((r) => r.date.startsWith(monthPrefix));
  const upcoming = monthReminders
    .filter((r) => !isPast(r, today))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = monthReminders
    .filter((r) => isPast(r, today) && !isArchived(r))
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
    for (const reminder of upcoming) calMonthList.appendChild(buildCard(reminder, false, true));
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
      <div class="title">${isDone(reminder) ? "✓ " : ""}${escapeHtml(reminder.title)}</div>
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

  const res = await apiFetch(url, {
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

async function setCompleted(id, completed) {
  const res = await apiFetch(`${API}/${id}/${completed ? "complete" : "reopen"}`, { method: "POST" });
  if (!res.ok) {
    alert("No se pudo actualizar el recordatorio.");
    return false;
  }
  showToast(completed ? "HECHO · MOVIDO A PASADOS" : "REABIERTO");
  await refreshEverything();
  return true;
}

async function toggleEditingCompleted() {
  if (!editingId) return;
  if (await setCompleted(editingId, !editingCompleted)) showActiveTab();
}

async function deleteReminder() {
  if (!editingId) return;
  if (!confirm("¿Eliminar este recordatorio y todas sus alertas?")) return;

  const res = await apiFetch(`${API}/${editingId}`, { method: "DELETE" });
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
btnComplete.addEventListener("click", toggleEditingCompleted);

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

loginForm.addEventListener("submit", handleLogin);
signupForm.addEventListener("submit", handleSignup);
document.getElementById("btn-show-signup").addEventListener("click", showSignup);
document.getElementById("btn-show-login").addEventListener("click", showLogin);
btnAccount.addEventListener("click", openAccountSheet);
btnToggleDone.addEventListener("click", toggleDoneInCalendar);
accountSheetClose.addEventListener("click", closeAccountSheet);
accountSheetBackdrop.addEventListener("click", closeAccountSheet);
btnLogout.addEventListener("click", handleLogout);
viewingBanner.addEventListener("click", () => switchViewedUser(null));

sheetBackdrop.addEventListener("click", closeDaySheet);
daySheetClose.addEventListener("click", closeDaySheet);

(async function init() {
  try {
    await loadSession();
    await loadReminders();
    showCalendar();
  } catch (err) {
    if (!(err instanceof LoginRequired)) {
      console.error(err);
      showLogin();
    }
  }
})();

// A session that ends mid-action shows the login screen; nothing else to report.
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason instanceof LoginRequired) event.preventDefault();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
