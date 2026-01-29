// ===== Global auth guard =====
// Prevent access to the page unless logged in and verified.
(async () => {
  try {
    const supa = window.supabase || null;
    if (!supa) return; // supabase will be available below when client is created
    const client = supa.createClient(
      "https://hyrtpoywvdvghasiewei.supabase.co",
      "sb_publishable_kneblDkCAHqgGFqgntXgEw_9cc8INOj"
    );
    const { data } = await client.auth.getUser();
    const user = data && data.user ? data.user : null;
    const verified = !!(user && (user.email_confirmed_at || user.confirmed_at));
    if (!verified) {
      // Redirect to index with login modal prompt (stays on same page since this is index)
    if (!selectedAssignmentId && currentAssignments.length) {
      selectedAssignmentId = String(currentAssignments[0].id);
    }
      // Show message after scripts load
      window.__requireLogin = true;
    }
  } catch (e) {
    console.warn("Auth guard error", e);
    window.__requireLogin = true;
  }
})();

(function syncLandingLoginFlag() {
  const params = new URLSearchParams(window.location.search);
  const shouldForceLogin = params.get("showLogin") === "1";
  window.__forceLoginFromLanding = shouldForceLogin;
  if (params.has("showLogin")) {
    params.delete("showLogin");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }
})();

// --- CONFIG (already set by you) ---
const SUPABASE_URL = "https://hyrtpoywvdvghasiewei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kneblDkCAHqgGFqgntXgEw_9cc8INOj";
const UNSPLASH_ACCESS_KEY = "db8EqDOqXs-ZT_71bk4oujJ4Dx1KW390H3bPc4ZA5lY";
const UNSPLASH_RANDOM_ENDPOINT = "https://api.unsplash.com/photos/random";
const UNSPLASH_SEARCH_ENDPOINT = "https://api.unsplash.com/search/photos";
const UNSPLASH_AUTO_SEARCH_DELAY_MS = 500;

// --- create client correctly from the CDN global ---
// create client from global
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM refs ---
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMe = document.getElementById("rememberMe");
const loginMessage = document.getElementById("loginMessage");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const roleHint = document.getElementById("roleHint");
const studentPanel = document.getElementById("studentPanel");
const teacherPanel = document.getElementById("teacherPanel");
const assignmentsList = document.getElementById("assignmentsList");
const answerOptions = document.getElementById("answerOptions");
const answerForm = document.getElementById("answerForm");
const answerFeedback = document.getElementById("answerFeedback");
const answersList = document.getElementById("answersList");
const answersViewSelect = document.getElementById("answersViewSelect");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");
const createTaskForm = document.getElementById("createTaskForm");
const taskTitleInput = document.getElementById("taskTitle");
const taskPromptInput = document.getElementById("taskPrompt");
const taskImageKeywordInput = document.getElementById("taskImageKeyword");
const taskOptionInputs = Array.prototype.slice.call(document.querySelectorAll(".task-option"));
const correctOptionInputs = Array.prototype.slice.call(document.querySelectorAll(".correct-option"));
const taskCreateFeedback = document.getElementById("taskCreateFeedback");
const clearAllAnswersBtn = document.getElementById("clearAllAnswersBtn");
const selectedAssignmentLabel = document.getElementById("selectedAssignmentLabel");
const assignmentDetailsPanel = document.getElementById("assignmentDetailsPanel");
const selectedAssignmentDetails = document.getElementById("selectedAssignmentDetails");
const adminAssignmentsSection = document.getElementById("adminAssignmentsSection");
const adminAssignmentsList = document.getElementById("adminAssignmentsList");
const unsplashChoicesContainer = document.getElementById("unsplashChoices");
const unsplashChoicesStatus = document.getElementById("unsplashChoicesStatus");

if (correctOptionInputs.length && !correctOptionInputs.some((input) => input.checked)) {
  correctOptionInputs[0].checked = true;
}

let currentUser = null;
let currentRole = null;
let currentAssignments = [];
let answeredAssignmentIds = new Set();
let roleSwitchBusy = false;
let selectedAssignmentId = null;
let unsplashChoiceItems = [];
let selectedUnsplashImage = null;
let unsplashChoicesLoading = false;
let lastUnsplashKeyword = "";
let unsplashAutoSearchTimeout = null;
let unsplashQueuedLoadPending = false;
let unsplashQueuedLoadNeedsRefresh = false;
let adminAssignments = [];
let currentAnswersEntries = [];
let currentAnswersOppgaveMap = new Map();
let currentAnswersStudentMap = new Map();
let answersViewMode = "students";

// Bootstrap modal instance (so we can hide it programmatically)
const loginModalEl = document.getElementById("loginModal");
let bootstrapModal;
if (loginModalEl) {
  bootstrapModal = bootstrap.Modal.getOrCreateInstance(loginModalEl);
}

function openLoginModal(message) {
  if (!loginModalEl) return;
  try {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(loginModalEl);
    modalInstance.show();
    if (message) {
      showMessage(message);
    }
  } catch (err) {
    console.warn("Kunne ikke åpne innloggingsmodal", err);
  }
}

// --- Helpers ---
function showMessage(msg, type = "danger") {
  loginMessage.textContent = msg;
  loginMessage.classList.remove("text-danger", "text-success");
  loginMessage.classList.add(type === "success" ? "text-success" : "text-danger");
}

function clearMessage() {
  loginMessage.textContent = "";
  loginMessage.classList.remove("text-danger", "text-success");
}

function domainAllowed(email) {
  if (!email || typeof email !== "string") return false;
  return email.toLowerCase().endsWith("@stud.akademiet.no");
}

function isEmailVerified(user) {
  if (!user) return false;
  // Supabase user objects usually have email_confirmed_at when verified
  return !!(user.email_confirmed_at || user.confirmed_at);
}

function setRoleHint(message, type = "info") {
  if (!roleHint) return;
  if (!message) {
    roleHint.classList.add("d-none");
    roleHint.textContent = "";
    return;
  }
  roleHint.textContent = message;
  roleHint.className = `role-hint role-hint--${type}`;
}

function togglePanel(panel, show) {
  if (!panel) return;
  panel.classList.toggle("d-none", !show);
}

function escapeHtml(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url) {
  if (typeof url !== "string") return "";
  return url.replace(/"/g, "").replace(/'/g, "");
}

function resetStudentUI() {
  togglePanel(studentPanel, false);
  answeredAssignmentIds = new Set();
  selectedAssignmentId = null;
  if (assignmentsList) assignmentsList.innerHTML = "";
  if (answerOptions) answerOptions.innerHTML = '<div class="text-muted">Ingen oppgaver valgt.</div>';
  if (answerFeedback) {
    answerFeedback.textContent = "";
    answerFeedback.classList.remove("text-danger", "text-success");
  }
  if (submitAnswerBtn) submitAnswerBtn.disabled = true;
  if (answerForm) answerForm.classList.remove("was-validated");
  updateSelectedAssignmentLabel();
}

function resetTeacherUI() {
  togglePanel(teacherPanel, false);
  if (answersList) answersList.innerHTML = "";
  setClearAllButtonState(false);
  resetAdminAssignmentsUI();
}

function resetAdminAssignmentsUI() {
  if (adminAssignmentsSection) adminAssignmentsSection.classList.add("d-none");
  if (adminAssignmentsList) adminAssignmentsList.innerHTML = "";
  adminAssignments = [];
}

function parseTaskContent(task) {
  if (!task) return { prompt: "", options: [], correctOption: null, imageUrl: "" };
  if (task._parsedContent) return task._parsedContent;

  let prompt = typeof task.beskrivelse === "string" ? task.beskrivelse : "";
  let options = [];
  let correctOption = null;
  let imageUrl = "";
  const raw = task.beskrivelse;

  if (raw && typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (parsed.prompt || parsed.question) {
          prompt = parsed.prompt || parsed.question;
        }
        if (Array.isArray(parsed.options)) {
          options = parsed.options
            .map((opt) => {
              if (typeof opt === "string") {
                return { text: opt, correct: false };
              }
              if (opt && typeof opt === "object") {
                const textValue = opt.text || opt.value || "";
                if (!textValue) return null;
                return { text: textValue, correct: !!opt.correct };
              }
              return null;
            })
            .filter((opt) => !!opt && !!opt.text);
        }
        if (parsed.correctOption && options.length) {
          const match = options.find((opt) => opt.text === parsed.correctOption);
          if (match) match.correct = true;
        }
        if (parsed.imageUrl || parsed.image) {
          imageUrl = parsed.imageUrl || parsed.image;
        }
      }
    } catch (err) {
      // keep fallback prompt / options
    }
  }

  if (!Array.isArray(options) || !options.length) {
    options = [];
  }
  const flagged = options.find((opt) => opt.correct);
  if (flagged) {
    correctOption = flagged.text;
  }

  task._parsedContent = { prompt: prompt || "", options, correctOption, imageUrl };
  return task._parsedContent;
}

function renderAnswerOptions(taskId) {
  if (!answerOptions) return;
  answerOptions.innerHTML = "";
  if (!taskId) {
    answerOptions.innerHTML = '<div class="text-muted">Velg en oppgave for å se alternativer.</div>';
    return;
  }
  const normalizedId = String(taskId);
  const task = currentAssignments.find((t) => String(t.id) === normalizedId);
  if (!task) {
    answerOptions.innerHTML = '<div class="text-muted">Fant ikke alternativene for denne oppgaven.</div>';
    return;
  }
  const content = parseTaskContent(task);
  if (!content.options.length) {
    answerOptions.innerHTML = '<div class="text-muted">Denne oppgaven har ingen alternativer – kontakt lærer.</div>';
    return;
  }

  const optionItems = content.options
    .map((opt, index) => {
      const optionId = `answerOption-${task.id}-${index}`;
      return `
        <label class="list-group-item list-group-item-action">
          <input class="form-check-input me-2" type="radio" name="answerOption" value="${escapeHtml(opt.text)}" id="${optionId}">
          ${escapeHtml(opt.text)}
        </label>
      `;
    })
    .join("");
  answerOptions.innerHTML = optionItems;
}

function setTaskCreateFeedback(message, type) {
  if (!taskCreateFeedback) return;
  taskCreateFeedback.textContent = message;
  taskCreateFeedback.classList.remove("text-danger", "text-success");
  if (type === "success") {
    taskCreateFeedback.classList.add("text-success");
  } else if (type === "danger") {
    taskCreateFeedback.classList.add("text-danger");
  }
}

function setClearAllButtonState(enabled) {
  if (!clearAllAnswersBtn) return;
  clearAllAnswersBtn.disabled = !enabled;
}

function updateSelectedAssignmentLabel() {
  if (!selectedAssignmentLabel) return;
  if (!selectedAssignmentId) {
    selectedAssignmentLabel.textContent = "Ingen oppgave valgt";
    selectedAssignmentLabel.classList.remove("bg-primary", "text-white");
    selectedAssignmentLabel.classList.add("bg-light", "text-dark");
    if (assignmentDetailsPanel) assignmentDetailsPanel.classList.add("d-none");
    if (selectedAssignmentDetails) {
      selectedAssignmentDetails.textContent = "";
    }
    return;
  }
  if (assignmentDetailsPanel) assignmentDetailsPanel.classList.remove("d-none");
  const task = currentAssignments.find((item) => String(item.id) === String(selectedAssignmentId));
  if (task) {
    selectedAssignmentLabel.textContent = `Valgt: ${task.tittel}`;
    if (selectedAssignmentDetails) {
      const content = parseTaskContent(task);
      const prompt = content.prompt || "Ingen beskrivelse.";
      selectedAssignmentDetails.textContent = prompt;
    }
  } else {
    selectedAssignmentLabel.textContent = "Oppgaven finnes ikke lenger";
    if (selectedAssignmentDetails) {
      selectedAssignmentDetails.textContent = "Oppgaven ble fjernet.";
    }
  }
  selectedAssignmentLabel.classList.remove("bg-light", "text-dark");
  selectedAssignmentLabel.classList.add("bg-primary", "text-white");
}

function getDisplayNameFromUser(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const nameCandidates = [
    meta.display_name,
    meta.nickname,
    meta.full_name,
    meta.name,
    user.email,
  ];
  const match = nameCandidates.find((value) => typeof value === "string" && value.trim().length);
  return match ? match.trim() : user.id || "";
}

function setRoleSwitchFeedback(message, type) {
  const el = document.getElementById("roleSwitchFeedback");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("text-danger", "text-success", "text-muted");
  if (type === "success") {
    el.classList.add("text-success");
  } else if (type === "danger") {
    el.classList.add("text-danger");
  } else if (type === "muted") {
    el.classList.add("text-muted");
  }
}

function syncRoleSwitchUI() {
  const roleBadge = document.getElementById("profileRoleLabel");
  if (roleBadge) {
    const badgeText = currentRole || (currentUser ? "Henter rolle..." : "Ikke logget inn");
    roleBadge.textContent = badgeText;
  }
  const roleSelect = document.getElementById("roleSwitchSelect");
  if (roleSelect) {
    const valueToSet = currentRole || "";
    if (roleSelect.value !== valueToSet) {
      roleSelect.value = valueToSet;
    }
  }
}

async function handleRoleSwitchChange(newRole) {
  const allowedRoles = ["elev", "lærer", "admin"];
  if (!newRole || allowedRoles.indexOf(newRole) === -1 || roleSwitchBusy) {
    syncRoleSwitchUI();
    return;
  }
  if (!currentUser) {
    setRoleSwitchFeedback("Du må være innlogget for å endre rolle.", "danger");
    syncRoleSwitchUI();
    return;
  }
  if (newRole === currentRole) {
    setRoleSwitchFeedback("Du har allerede denne rollen.", "muted");
    return;
  }

  const previousRole = currentRole;
  roleSwitchBusy = true;
  const roleSelect = document.getElementById("roleSwitchSelect");
  if (roleSelect) roleSelect.disabled = true;
  setRoleSwitchFeedback("Oppdaterer rolle...", "muted");

  try {
    const { error } = await supabaseClient
      .from("profiles")
      .update({ role: newRole })
      .eq("id", currentUser.id);
    if (error) {
      console.error("handleRoleSwitchChange error", error);
      setRoleSwitchFeedback(error.message || "Kunne ikke endre rolle.", "danger");
      if (roleSelect) roleSelect.value = previousRole || "";
      return;
    }
    await refreshRoleViews(currentUser);
    setRoleSwitchFeedback("Rolle oppdatert.", "success");
  } catch (err) {
    console.error("handleRoleSwitchChange unexpected", err);
    setRoleSwitchFeedback("Uventet feil ved endring av rolle.", "danger");
    if (roleSelect) roleSelect.value = previousRole || "";
  } finally {
    if (roleSelect) roleSelect.disabled = false;
    roleSwitchBusy = false;
    syncRoleSwitchUI();
  }
}

async function fetchRandomUnsplashImage(keyword) {
  if (!keyword || !keyword.trim()) return null;
  try {
    const queryParams = new URLSearchParams({
      query: keyword.trim(),
      orientation: "landscape",
      content_filter: "high",
    });
    const response = await fetch(`${UNSPLASH_RANDOM_ENDPOINT}?${queryParams.toString()}`, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });
    if (!response.ok) {
      console.warn("Unsplash request failed", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    if (data && data.urls && data.urls.regular) {
      return {
        url: data.urls.regular,
        author: data.user && data.user.name ? data.user.name : "Unsplash",
      };
    }
  } catch (err) {
    console.error("fetchRandomUnsplashImage error", err);
  }
  return null;
}

async function searchUnsplashImages(keyword, perPage = 6) {
  if (!keyword || !keyword.trim()) return [];
  try {
    const queryParams = new URLSearchParams({
      query: keyword.trim(),
      orientation: "landscape",
      content_filter: "high",
      per_page: String(perPage),
    });
    const response = await fetch(`${UNSPLASH_SEARCH_ENDPOINT}?${queryParams.toString()}`, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });
    if (!response.ok) {
      console.warn("Unsplash search failed", response.status, await response.text());
      return [];
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.results)) return [];
    return data.results
      .filter((item) => item && item.urls && item.urls.regular)
      .map((item) => ({
        id: item.id,
        url: item.urls.regular,
        previewUrl: item.urls.small || item.urls.thumb || item.urls.regular,
        author: item.user && item.user.name ? item.user.name : "Unsplash",
        description: item.description || item.alt_description || keyword.trim(),
        keyword: keyword.trim(),
      }));
  } catch (err) {
    console.error("searchUnsplashImages error", err);
    return [];
  }
}

function setUnsplashStatus(message = "", tone = "muted") {
  if (!unsplashChoicesStatus) return;
  const toneClass = tone === "muted" ? "text-muted" : `text-${tone}`;
  unsplashChoicesStatus.classList.remove("text-muted", "text-success", "text-danger");
  if (message) {
    unsplashChoicesStatus.classList.add(toneClass);
    unsplashChoicesStatus.textContent = message;
  } else {
    unsplashChoicesStatus.textContent = "";
  }
}

function cancelUnsplashAutoSearchTimer() {
  if (unsplashAutoSearchTimeout) {
    clearTimeout(unsplashAutoSearchTimeout);
    unsplashAutoSearchTimeout = null;
  }
}

function renderUnsplashChoices(images) {
  if (!unsplashChoicesContainer) return;
  if (!images || !images.length) {
    unsplashChoicesContainer.innerHTML = "";
    return;
  }
  const cards = images
    .map((img, index) => {
      const preview = sanitizeUrl(img.previewUrl || img.url || "");
      const isSelected = selectedUnsplashImage && selectedUnsplashImage.id === img.id;
      return `
        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
          <label class="unsplash-choice${isSelected ? " selected" : ""}" data-choice-index="${index}">
            <input type="radio" class="unsplash-choice-input" name="unsplashChoice" value="${index}" ${
              isSelected ? "checked" : ""
            } />
            <div class="unsplash-choice-image" style="background-image:url('${preview}')"></div>
          </label>
        </div>
      `;
    })
    .join("");
  unsplashChoicesContainer.innerHTML = cards;
}

function clearUnsplashChoices({ clearKeyword = false, message = "" } = {}) {
  unsplashChoiceItems = [];
  selectedUnsplashImage = null;
  cancelUnsplashAutoSearchTimer();
  unsplashQueuedLoadPending = false;
  unsplashQueuedLoadNeedsRefresh = false;
  if (clearKeyword && taskImageKeywordInput) {
    taskImageKeywordInput.value = "";
  }
  if (unsplashChoicesContainer) {
    unsplashChoicesContainer.innerHTML = "";
  }
  if (clearKeyword) {
    lastUnsplashKeyword = "";
  }
  setUnsplashStatus(message, "muted");
}

function setUnsplashSelection(image) {
  selectedUnsplashImage = image || null;
  if (!image) {
    setUnsplashStatus("Ingen bilde valgt ennå.", "muted");
  } else {
    setUnsplashStatus("Et bilde er valgt.", "success");
  }
  renderUnsplashChoices(unsplashChoiceItems);
}

if (taskImageKeywordInput) {
  taskImageKeywordInput.addEventListener("input", () => {
    const keyword = taskImageKeywordInput.value.trim();
    cancelUnsplashAutoSearchTimer();
    unsplashQueuedLoadPending = false;
    unsplashQueuedLoadNeedsRefresh = false;
    if (!keyword) {
      clearUnsplashChoices({ clearKeyword: true, message: "Skriv inn et søkeord for å hente bilder." });
      return;
    }
    if (keyword === lastUnsplashKeyword && unsplashChoiceItems.length) {
      setUnsplashStatus("Velg bildet som passer best for oppgaven.", "muted");
      return;
    }
    unsplashChoiceItems = [];
    selectedUnsplashImage = null;
    renderUnsplashChoices([]);
    setUnsplashStatus("Søker etter bilder...", "muted");
    unsplashAutoSearchTimeout = window.setTimeout(() => {
      unsplashAutoSearchTimeout = null;
      loadUnsplashChoices({ refresh: false });
    }, UNSPLASH_AUTO_SEARCH_DELAY_MS);
  });
}

if (unsplashChoicesContainer) {
  unsplashChoicesContainer.addEventListener("click", (event) => {
    const target = event.target.closest(".unsplash-choice");
    if (!target) return;
    const indexAttr = target.getAttribute("data-choice-index");
    if (indexAttr === null) return;
    const index = parseInt(indexAttr, 10);
    if (Number.isNaN(index) || !unsplashChoiceItems[index]) return;
    const choice = unsplashChoiceItems[index];
    if (!choice) return;
    if (selectedUnsplashImage && selectedUnsplashImage.id === choice.id) {
      setUnsplashSelection(null);
      return;
    }
    setUnsplashSelection(choice);
  });
}

async function loadUnsplashChoices({ refresh = false } = {}) {
  if (!taskImageKeywordInput) return;
  const keyword = taskImageKeywordInput.value.trim();
  if (!keyword) {
    setUnsplashStatus("Skriv inn et søkeord for å finne bilder.", "danger");
    return;
  }
  if (!refresh && keyword === lastUnsplashKeyword && unsplashChoiceItems.length) {
    renderUnsplashChoices(unsplashChoiceItems);
    setUnsplashStatus("Velg ett av bildene under. Skriv inn et nytt søkeord for flere forslag.", "muted");
    return;
  }
  if (unsplashChoicesLoading) {
    unsplashQueuedLoadPending = true;
    if (refresh) unsplashQueuedLoadNeedsRefresh = true;
    return;
  }
  unsplashChoicesLoading = true;
  unsplashQueuedLoadPending = false;
  unsplashQueuedLoadNeedsRefresh = false;
  setUnsplashStatus("Søker etter bilder...", "muted");
  try {
    const images = await searchUnsplashImages(keyword, 8);
    lastUnsplashKeyword = keyword;
    unsplashChoiceItems = images;
    if (!images.length) {
      setUnsplashSelection(null);
      setUnsplashStatus("Fant ingen treff. Prøv et annet søkeord.", "danger");
      return;
    }
    if (refresh) {
      setUnsplashSelection(null);
    } else if (selectedUnsplashImage && selectedUnsplashImage.keyword !== keyword) {
      selectedUnsplashImage = null;
    }
    renderUnsplashChoices(images);
    if (!selectedUnsplashImage) {
      setUnsplashStatus("Velg bildet som passer best for oppgaven.", "muted");
    }
  } catch (err) {
    console.error("loadUnsplashChoices error", err);
    setUnsplashStatus("Kunne ikke hente bilder nå.", "danger");
  } finally {
    unsplashChoicesLoading = false;
    if (unsplashQueuedLoadPending) {
      const shouldRefresh = unsplashQueuedLoadNeedsRefresh;
      unsplashQueuedLoadPending = false;
      unsplashQueuedLoadNeedsRefresh = false;
      loadUnsplashChoices({ refresh: shouldRefresh });
    }
  }
}

async function fetchUserRole(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("fetchUserRole error", error);
      return null;
    }
    return data ? data.role : null;
  } catch (err) {
    console.error("fetchUserRole unexpected", err);
    return null;
  }
}

async function refreshRoleViews(user) {
  currentUser = user || null;
  currentRole = null;
  syncRoleSwitchUI();
  setRoleSwitchFeedback("", null);

  if (!user) {
    setRoleHint("Logg inn for å se oppgaver og besvarelser.");
    resetStudentUI();
    resetTeacherUI();
    return;
  }

  setRoleHint("Henter rolle...", "info");
  let role = await fetchUserRole(user.id);
  if (!role) {
    await ensureDefaultRole(user);
    role = await fetchUserRole(user.id);
  }
  currentRole = role;
  syncRoleSwitchUI();

  if (!role) {
    setRoleHint(
      "Fant ingen rolle på profilen din. Be en lærer/administrator oppdatere deg i Supabase.",
      "warning"
    );
    resetStudentUI();
    resetTeacherUI();
    return;
  }

  if (role === "elev") {
    setRoleHint("Du er logget inn som elev.", "primary");
    resetTeacherUI();
    togglePanel(studentPanel, true);
    await loadAssignments();
  } else if (role === "lærer") {
    setRoleHint("Du er logget inn som lærer.", "secondary");
    resetStudentUI();
    togglePanel(teacherPanel, true);
    await loadAnswers();
    resetAdminAssignmentsUI();
  } else if (role === "admin") {
    setRoleHint("Du er logget inn som admin.", "secondary");
    resetStudentUI();
    togglePanel(teacherPanel, true);
    await loadAnswers();
    await loadAdminAssignments();
  } else {
    setRoleHint(`Du er logget inn med rollen "${role}". Ingen paneler tilgjengelig.`, "info");
    resetStudentUI();
    resetTeacherUI();
  }
}

async function ensureDefaultRole(user) {
  try {
    if (!user) return;
    const { data, error } = await supabaseClient
      .from("profiles")
      .update({ role: "elev" })
      .eq("id", user.id)
      .is("role", null)
      .select("role");
    if (error) {
      console.warn("ensureDefaultRole error", error);
    } else if (data && data.length) {
      currentRole = "elev";
      syncRoleSwitchUI();
    }
  } catch (err) {
    console.warn("ensureDefaultRole unexpected", err);
  }
}

async function loadAssignments() {
  if (!assignmentsList) return;
  assignmentsList.innerHTML = '<div class="text-muted">Laster oppgaver...</div>';
  currentAssignments = [];
  answeredAssignmentIds = new Set();

  try {
    if (currentRole === "elev" && currentUser) {
      const { data: answeredData, error: answeredError } = await supabaseClient
        .from("besvarelser")
        .select("oppgave_id")
        .eq("elev_id", currentUser.id);
      if (answeredError) {
        console.error("loadAssignments answeredError", answeredError);
      } else if (Array.isArray(answeredData)) {
        answeredData.forEach((row) => {
          if (row && row.oppgave_id !== null && row.oppgave_id !== undefined) {
            answeredAssignmentIds.add(String(row.oppgave_id));
          }
        });
      }
    }

    const { data, error } = await supabaseClient
      .from("oppgaver")
      .select("id, tittel, beskrivelse, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("loadAssignments error", error);
      assignmentsList.innerHTML = `<div class="text-danger">${error.message}</div>`;
      return;
    }
    let assignments = data || [];
    if (currentRole === "elev" && answeredAssignmentIds.size) {
      assignments = assignments.filter((task) => !answeredAssignmentIds.has(String(task.id)));
    }
    currentAssignments = assignments;
    if (selectedAssignmentId && !currentAssignments.some((task) => String(task.id) === String(selectedAssignmentId))) {
      selectedAssignmentId = currentAssignments.length ? String(currentAssignments[0].id) : null;
    }
    renderAssignments();
  } catch (err) {
    console.error("loadAssignments unexpected", err);
    assignmentsList.innerHTML = `<div class="text-danger">Kunne ikke hente oppgaver.</div>`;
  }
}

function renderAssignments() {
  if (!assignmentsList) return;
  if (!currentAssignments.length) {
    const completedAll = currentRole === "elev" && answeredAssignmentIds && answeredAssignmentIds.size;
    assignmentsList.innerHTML = completedAll
      ? '<div class="alert alert-success mb-0">Du har svart på alle tilgjengelige oppgaver.</div>'
      : '<div class="alert alert-info mb-0">Ingen oppgaver er lagt ut ennå.</div>';
    if (submitAnswerBtn) submitAnswerBtn.disabled = true;
    renderAnswerOptions(null);
    selectedAssignmentId = null;
    updateSelectedAssignmentLabel();
    return;
  }

  const cardsHtml = currentAssignments
    .map((task) => {
      const content = parseTaskContent(task);
      const safeTitle = escapeHtml(task.tittel || "Untitled");
      const createdAt = task.created_at ? new Date(task.created_at).toLocaleDateString() : "";
      const imageUrl = content.imageUrl ? sanitizeUrl(content.imageUrl) : "";
      const hasImage = !!imageUrl;
      const classes = ["assignment-card", hasImage ? "has-image" : "no-image"];
      if (String(task.id) === String(selectedAssignmentId)) {
        classes.push("selected");
      }
      const overlay = hasImage ? '<div class="assignment-card__overlay"></div>' : "";
      const style = hasImage ? `style="background-image:url('${imageUrl}')"` : "";
      return `
        <article class="${classes.join(" ")}" data-assignment-id="${task.id}" ${style}>
          ${overlay}
          <div class="assignment-card__body">
            <div class="d-flex justify-content-between align-items-center w-100">
              <h6 class="mb-0">${safeTitle}</h6>
              <small class="text-muted">${createdAt}</small>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  assignmentsList.innerHTML = cardsHtml;
  if (submitAnswerBtn) submitAnswerBtn.disabled = !selectedAssignmentId;
  updateSelectedAssignmentLabel();
  renderAnswerOptions(selectedAssignmentId);
}

function renderAdminAssignments() {
  if (!adminAssignmentsList) return;
  if (!adminAssignments.length) {
    adminAssignmentsList.innerHTML = '<div class="list-group-item text-muted">Ingen oppgaver publisert ennå.</div>';
    return;
  }

  const rows = adminAssignments
    .map((task) => {
      const safeTitle = escapeHtml(task.tittel || "Uten navn");
      const createdAt = task.created_at ? new Date(task.created_at).toLocaleString() : "";
      const taskIdAttr = escapeHtml(String(task.id));
      return `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">${safeTitle}</div>
            <small class="text-muted">${createdAt}</small>
          </div>
          <button type="button" class="btn btn-outline-danger btn-sm admin-delete-assignment" data-assignment-id="${taskIdAttr}">
            Slett
          </button>
        </div>
      `;
    })
    .join("");

  adminAssignmentsList.innerHTML = rows;
}

async function loadAdminAssignments() {
  if (!adminAssignmentsList || currentRole !== "admin") return;
  if (adminAssignmentsSection) {
    adminAssignmentsSection.classList.remove("d-none");
  }
  adminAssignmentsList.innerHTML = '<div class="list-group-item text-muted">Laster oppgaver...</div>';
  try {
    const { data, error } = await supabaseClient
      .from("oppgaver")
      .select("id, tittel, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("loadAdminAssignments error", error);
      adminAssignmentsList.innerHTML = `<div class="list-group-item text-danger">${escapeHtml(error.message)}</div>`;
      adminAssignments = [];
      return;
    }
    adminAssignments = data || [];
    renderAdminAssignments();
  } catch (err) {
    console.error("loadAdminAssignments unexpected", err);
    adminAssignmentsList.innerHTML = '<div class="list-group-item text-danger">Kunne ikke hente oppgaver.</div>';
    adminAssignments = [];
  }
}

if (assignmentsList) {
  assignmentsList.addEventListener("click", (event) => {
    const card = event.target.closest(".assignment-card");
    if (!card) return;
    const assignmentId = card.getAttribute("data-assignment-id");
    if (!assignmentId) return;
    selectedAssignmentId = assignmentId;
    renderAssignments();
  });
}

if (adminAssignmentsList) {
  adminAssignmentsList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".admin-delete-assignment");
    if (!deleteBtn) return;
    const assignmentId = deleteBtn.getAttribute("data-assignment-id");
    if (!assignmentId) return;
    deleteAssignmentById(assignmentId);
  });
}

async function loadAnswers() {
  if (!answersList) return;
  answersList.innerHTML = '<div class="text-muted">Laster besvarelser...</div>';

  try {
    const { data, error } = await supabaseClient
      .from("besvarelser")
      .select("id, oppgave_id, elev_id, elev_navn, svar, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadAnswers error", error);
      answersList.innerHTML = `<div class="text-danger">${error.message}</div>`;
      return;
    }

    const answers = data || [];
    setClearAllButtonState(answers.length > 0);
    const oppgaveIds = [...new Set(answers.map((ans) => ans.oppgave_id))].filter(Boolean);
    const studentIds = [...new Set(answers.map((ans) => ans.elev_id))].filter(Boolean);
    const oppgaveMap = new Map();
    const studentMap = new Map();

    if (oppgaveIds.length) {
      const { data: oppgaverData, error: oppgaveError } = await supabaseClient
        .from("oppgaver")
        .select("id, tittel, beskrivelse")
        .in("id", oppgaveIds);
      if (!oppgaveError && oppgaverData) {
        oppgaverData.forEach((oppgave) => {
          if (!oppgave) return;
          const parsed = parseTaskContent(oppgave);
          const correctOption = parsed && parsed.correctOption ? parsed.correctOption : null;
          oppgaveMap.set(oppgave.id, {
            title: oppgave.tittel || `Oppgave ${oppgave.id}`,
            correctOption: correctOption || null,
          });
        });
      }
    }

    if (studentIds.length) {
      const { data: profilesData, error: profilesError } = await supabaseClient
        .from("profiles")
        .select("id, full_name, nickname")
        .in("id", studentIds);
      if (!profilesError && profilesData) {
        profilesData.forEach((profile) => {
          const displayName = profile.full_name || profile.nickname || profile.id;
          studentMap.set(profile.id, displayName);
        });
      }
    }

    currentAnswersEntries = answers;
    currentAnswersOppgaveMap = oppgaveMap;
    currentAnswersStudentMap = studentMap;
    renderAnswersView();
  } catch (err) {
    console.error("loadAnswers unexpected", err);
    setClearAllButtonState(false);
    answersList.innerHTML = `<div class="text-danger">Kunne ikke hente besvarelser.</div>`;
  }
}

function renderAnswersView() {
  if (!answersList) return;
  if (!currentAnswersEntries.length) {
    answersList.innerHTML = '<div class="alert alert-info mb-0">Ingen besvarelser sendt inn ennå.</div>';
    return;
  }

  if (answersViewMode === "assignments") {
    answersList.innerHTML = renderAnswersGroupedByAssignment();
  } else {
    answersList.innerHTML = renderAnswersGroupedByStudent();
  }
}

function renderAnswersGroupedByStudent() {
  const grouped = new Map();
  currentAnswersEntries.forEach((entry) => {
    const key = entry.elev_id || entry.elev_navn || "ukjent";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  const groupArray = Array.from(grouped.entries()).map(([key, entries]) => {
    const displayName = currentAnswersStudentMap.get(key) || entries[0].elev_navn || key;
    const sortedEntries = entries
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return {
      title: displayName,
      meta: `${sortedEntries.length} svar`,
      entries: sortedEntries,
    };
  });

  groupArray.sort((a, b) => a.title.localeCompare(b.title, "nb"));
  if (!groupArray.length) {
    return '<div class="alert alert-info mb-0">Ingen besvarelser sendt inn ennå.</div>';
  }

  return groupArray
    .map((group) => {
      return `
        <section class="answers-group">
          <div class="answers-group__header">
            <h6 class="answers-group__title">${escapeHtml(String(group.title))}</h6>
            <span class="answers-group__meta">${group.meta}</span>
          </div>
          ${buildAnswersTable(group.entries, { showAssignment: true, showStudent: false })}
        </section>
      `;
    })
    .join("");
}

function renderAnswersGroupedByAssignment() {
  const grouped = new Map();
  currentAnswersEntries.forEach((entry) => {
    const key = entry.oppgave_id || "ukjent";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });

  const groupArray = Array.from(grouped.entries()).map(([key, entries]) => {
    const meta = getAnswerAssignmentMeta(key);
    const title = meta.title || `Oppgave ${key}`;
    const sortedEntries = entries
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return {
      title,
      meta: `${sortedEntries.length} svar`,
      entries: sortedEntries,
    };
  });

  groupArray.sort((a, b) => String(a.title).localeCompare(String(b.title), "nb"));
  if (!groupArray.length) {
    return '<div class="alert alert-info mb-0">Ingen besvarelser sendt inn ennå.</div>';
  }

  return groupArray
    .map((group) => {
      return `
        <section class="answers-group">
          <div class="answers-group__header">
            <h6 class="answers-group__title">${escapeHtml(String(group.title))}</h6>
            <span class="answers-group__meta">${group.meta}</span>
          </div>
          ${buildAnswersTable(group.entries, { showAssignment: false, showStudent: true })}
        </section>
      `;
    })
    .join("");
}

function getAnswerAssignmentMeta(oppgaveId) {
  const fallbackTitle = oppgaveId ? `Oppgave ${oppgaveId}` : "Ukjent oppgave";
  const meta = currentAnswersOppgaveMap.get(oppgaveId);
  if (!meta) {
    return { title: fallbackTitle, correctOption: null };
  }
  if (typeof meta === "string") {
    return { title: meta, correctOption: null };
  }
  return {
    title: meta.title || fallbackTitle,
    correctOption: meta.correctOption || null,
  };
}

function buildAnswersTable(entries, { showAssignment = true, showStudent = true } = {}) {
  const headerCells = [];
  if (showAssignment) headerCells.push("Oppgave");
  if (showStudent) headerCells.push("Elev");
  headerCells.push("Status", "Svar", "Tidspunkt", "Handling");

  const rows = entries
    .map((ans) => {
      const meta = getAnswerAssignmentMeta(ans.oppgave_id);
      const oppgaveNavn = meta.title || ans.oppgave_id;
      const correctOption = meta.correctOption;
      const elevNavn = currentAnswersStudentMap.get(ans.elev_id) || ans.elev_navn || ans.elev_id;
      const timestamp = ans.created_at ? new Date(ans.created_at).toLocaleString() : "-";
      const rawStudentAnswer = ans.svar;
      const normalizedStudentAnswer =
        typeof rawStudentAnswer === "string"
          ? rawStudentAnswer.trim()
          : rawStudentAnswer != null
          ? String(rawStudentAnswer).trim()
          : "";
      const normalizedCorrect =
        typeof correctOption === "string"
          ? correctOption.trim()
          : correctOption != null
          ? String(correctOption).trim()
          : "";
      const hasCorrect = !!normalizedCorrect;
      const studentAnswerKey = normalizedStudentAnswer.toLocaleLowerCase();
      const correctAnswerKey = normalizedCorrect.toLocaleLowerCase();
      let statusSymbol = "&ndash;";
      let statusModifier = "answer-status-icon--unknown";
      let statusTitle = hasCorrect ? "Ingen svar registrert" : "Ingen fasit";

      if (hasCorrect && studentAnswerKey) {
        if (studentAnswerKey === correctAnswerKey) {
          statusSymbol = "&#10003;";
          statusModifier = "answer-status-icon--correct";
          statusTitle = "Riktig svar";
        } else {
          statusSymbol = "&#10005;";
          statusModifier = "answer-status-icon--incorrect";
          const correctDisplay = correctOption != null ? String(correctOption) : "";
          statusTitle = correctDisplay ? `Fasit: ${correctDisplay}` : "Feil svar";
        }
      } else if (hasCorrect && !studentAnswerKey) {
        statusSymbol = "?";
        statusModifier = "answer-status-icon--unknown";
        statusTitle = "Ingen svar registrert";
      } else if (!hasCorrect && studentAnswerKey) {
        statusSymbol = "?";
        statusModifier = "answer-status-icon--unknown";
        statusTitle = "Ingen fasit";
      }

      const statusIconHtml = `<span class="answer-status-icon ${statusModifier}" title="${escapeHtml(
        statusTitle
      )}">${statusSymbol}</span>`;
      const cells = [];
      if (showAssignment) cells.push(`<td>${escapeHtml(String(oppgaveNavn))}</td>`);
      if (showStudent) cells.push(`<td>${escapeHtml(String(elevNavn))}</td>`);
      cells.push(
        `<td class="answer-status">${statusIconHtml}</td>`,
        `<td>${escapeHtml(String(ans.svar ?? ""))}</td>`,
        `<td>${timestamp}</td>`,
        `<td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-danger delete-answer-btn" data-answer-id="${ans.id}">
            Slett
          </button>
        </td>`
      );
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  return `
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-0">
        <thead>
          <tr>
            ${headerCells.map((label) => `<th>${label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function deleteAnswerById(answerId) {
  if (!answerId) return;
  const confirmed = window.confirm("Vil du slette denne besvarelsen?");
  if (!confirmed) return;
  try {
    const { error } = await supabaseClient.from("besvarelser").delete().eq("id", answerId);
    if (error) {
      console.error("deleteAnswerById error", error);
      window.alert("Kunne ikke slette besvarelsen.");
      return;
    }
    await loadAnswers();
  } catch (err) {
    console.error("deleteAnswerById unexpected", err);
    window.alert("Uventet feil ved sletting.");
  }
}

async function deleteAssignmentById(assignmentId) {
  if (!assignmentId) return;
  if (currentRole !== "admin") {
    window.alert("Kun administratorer kan slette oppgaver.");
    return;
  }
  const confirmed = window.confirm(
    "Dette sletter oppgaven for alle elever og fjerner alle tilknyttede svar. Fortsett?"
  );
  if (!confirmed) return;
  try {
    const { error: answersError } = await supabaseClient
      .from("besvarelser")
      .delete()
      .eq("oppgave_id", assignmentId);
    if (answersError) {
      console.error("deleteAssignmentById answersError", answersError);
      window.alert("Kunne ikke slette svarene knyttet til oppgaven.");
      return;
    }

    const { error: assignmentError } = await supabaseClient
      .from("oppgaver")
      .delete()
      .eq("id", assignmentId);
    if (assignmentError) {
      console.error("deleteAssignmentById error", assignmentError);
      window.alert("Kunne ikke slette oppgaven.");
      return;
    }

    await loadAdminAssignments();
    await loadAssignments();
    await loadAnswers();
  } catch (err) {
    console.error("deleteAssignmentById unexpected", err);
    window.alert("Uventet feil ved sletting av oppgave.");
  }
}

async function clearAllAnswers() {
  const confirmed = window.confirm("Dette sletter alle elevlogger. Er du sikker?");
  if (!confirmed) return;
  setClearAllButtonState(false);
  try {
    const { error } = await supabaseClient
      .from("besvarelser")
      .delete()
      .not("id", "is", null);
    if (error) {
      console.error("clearAllAnswers error", error);
      window.alert("Kunne ikke slette alle besvarelsene.");
      setClearAllButtonState(true);
      return;
    }
    await loadAnswers();
  } catch (err) {
    console.error("clearAllAnswers unexpected", err);
    window.alert("Uventet feil ved sletting av alle besvarelser.");
    setClearAllButtonState(true);
  }
}

if (answerForm) {
  answerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (answerFeedback) {
      answerFeedback.textContent = "";
      answerFeedback.classList.remove("text-danger", "text-success");
    }
    answerForm.classList.add("was-validated");

    const oppgaveId = selectedAssignmentId ? String(selectedAssignmentId) : "";
    const normalizedOppgaveId = oppgaveId ? String(oppgaveId) : "";
    let answerValue = "";
    if (answerOptions) {
      const selectedOption = answerOptions.querySelector('input[name="answerOption"]:checked');
      if (selectedOption && typeof selectedOption.value === "string") {
        answerValue = selectedOption.value.trim();
      }
    }

    if (!oppgaveId || !answerValue) {
      if (answerFeedback && !answerValue) {
        answerFeedback.textContent = "Velg et alternativ før du sender inn.";
        answerFeedback.classList.add("text-danger");
      }
      return;
    }

    if (!currentUser) {
      if (answerFeedback) {
        answerFeedback.textContent = "Du må være innlogget for å sende inn.";
        answerFeedback.classList.add("text-danger");
      }
      return;
    }

    if (answeredAssignmentIds && answeredAssignmentIds.has(normalizedOppgaveId)) {
      if (answerFeedback) {
        answerFeedback.textContent = "Du har allerede svart på denne oppgaven.";
        answerFeedback.classList.add("text-success");
      }
      await loadAssignments();
      return;
    }

    if (submitAnswerBtn) submitAnswerBtn.disabled = true;
    try {
      const displayName = getDisplayNameFromUser(currentUser);
      const { data: existingRows, error: existingError } = await supabaseClient
        .from("besvarelser")
        .select("id")
        .eq("oppgave_id", oppgaveId)
        .eq("elev_id", currentUser.id)
        .limit(1);
      if (existingError) {
        console.error("check existing answers error", existingError);
      } else if (existingRows && existingRows.length) {
        if (answerFeedback) {
          answerFeedback.textContent = "Du har allerede sendt inn et svar for denne oppgaven.";
          answerFeedback.classList.add("text-success");
        }
        answeredAssignmentIds.add(normalizedOppgaveId);
        await loadAssignments();
        return;
      }

      const { error } = await supabaseClient.from("besvarelser").insert({
        oppgave_id: oppgaveId,
        elev_id: currentUser.id,
        elev_navn: displayName,
        svar: answerValue,
      });

      if (error) {
        console.error("submit answer error", error);
        if (answerFeedback) {
          answerFeedback.textContent = error.message;
          answerFeedback.classList.remove("text-success");
          answerFeedback.classList.add("text-danger");
        }
        return;
      }

      answeredAssignmentIds.add(normalizedOppgaveId);
      renderAnswerOptions(null);
      answerForm.classList.remove("was-validated");
      if (answerFeedback) {
        answerFeedback.textContent = "Svar sendt!";
        answerFeedback.classList.remove("text-danger");
        answerFeedback.classList.add("text-success");
      }
      await loadAssignments();
      if (currentRole === "lærer" || currentRole === "admin") {
        await loadAnswers();
      }
    } catch (err) {
      console.error("submit answer unexpected", err);
      if (answerFeedback) {
        answerFeedback.textContent = "Kunne ikke sende svaret ditt.";
        answerFeedback.classList.remove("text-success");
        answerFeedback.classList.add("text-danger");
      }
    } finally {
      if (submitAnswerBtn) submitAnswerBtn.disabled = false;
    }
  });
}

if (createTaskForm) {
  createTaskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    createTaskForm.classList.add("was-validated");
    setTaskCreateFeedback("", null);

    const title = taskTitleInput && typeof taskTitleInput.value === "string" ? taskTitleInput.value.trim() : "";
    const prompt = taskPromptInput && typeof taskPromptInput.value === "string" ? taskPromptInput.value.trim() : "";
    const imageKeyword = taskImageKeywordInput && typeof taskImageKeywordInput.value === "string"
      ? taskImageKeywordInput.value.trim()
      : "";
    if (selectedUnsplashImage && selectedUnsplashImage.keyword !== imageKeyword) {
      selectedUnsplashImage = null;
    }
    const optionItems = taskOptionInputs
      .map((input) => {
        if (!input) return null;
        const value = typeof input.value === "string" ? input.value.trim() : "";
        const index = parseInt(input.getAttribute("data-index"), 10);
        return { text: value, index: isNaN(index) ? null : index };
      })
      .filter((item) => item && item.text.length);

    if (!title || !prompt) {
      setTaskCreateFeedback("Fyll inn tittel og spørsmål for å publisere.", "danger");
      return;
    }
    if (optionItems.length < 2) {
      setTaskCreateFeedback("Legg inn minst to alternativer.", "danger");
      return;
    }

    const selectedCorrect = document.querySelector('input[name="correctOption"]:checked');
    if (!selectedCorrect) {
      setTaskCreateFeedback("Velg hvilket alternativ som er riktig.", "danger");
      return;
    }
    const correctIndex = parseInt(selectedCorrect.value, 10);
    const correctOption = optionItems.find((opt) => opt.index === correctIndex);
    if (!correctOption) {
      setTaskCreateFeedback("Riktig svar må være et av de utfylte alternativene.", "danger");
      return;
    }

    const serializedOptions = optionItems.map((opt) => ({
      text: opt.text,
      correct: opt.index === correctIndex,
    }));

    const submitBtn = createTaskForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      let backgroundImage = null;
      if (selectedUnsplashImage && selectedUnsplashImage.keyword === imageKeyword) {
        backgroundImage = selectedUnsplashImage;
      } else if (imageKeyword) {
        backgroundImage = await fetchRandomUnsplashImage(imageKeyword);
      }
      const payloadContent = {
        prompt,
        options: serializedOptions,
        correctOption: correctOption.text,
      };
      if (backgroundImage && backgroundImage.url) {
        payloadContent.imageUrl = backgroundImage.url;
        if (backgroundImage.author) payloadContent.imageCredit = backgroundImage.author;
        payloadContent.imageKeyword = imageKeyword;
      }

      const payload = {
        tittel: title,
        beskrivelse: JSON.stringify(payloadContent),
      };
      const { error } = await supabaseClient.from("oppgaver").insert(payload);
      if (error) {
        console.error("create task error", error);
        setTaskCreateFeedback(error.message || "Kunne ikke lagre oppgaven.", "danger");
        return;
      }

      createTaskForm.reset();
      if (taskImageKeywordInput) taskImageKeywordInput.value = "";
      clearUnsplashChoices({ clearKeyword: true, message: "Skriv inn et søkeord for å hente bilder." });
      correctOptionInputs.forEach((input, index) => {
        if (index === 0) {
          input.checked = true;
        } else {
          input.checked = false;
        }
      });
      createTaskForm.classList.remove("was-validated");
      setTaskCreateFeedback("Oppgave publisert!", "success");
      await loadAssignments();
      if (currentRole === "lærer" || currentRole === "admin") {
        await loadAnswers();
      }
    } catch (err) {
      console.error("create task unexpected", err);
      setTaskCreateFeedback("Kunne ikke publisere oppgaven.", "danger");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

if (answersList) {
  answersList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".delete-answer-btn");
    if (!deleteBtn) return;
    const answerId = deleteBtn.getAttribute("data-answer-id");
    if (answerId) {
      deleteAnswerById(answerId);
    }
  });
}

if (clearAllAnswersBtn) {
  clearAllAnswersBtn.addEventListener("click", () => {
    clearAllAnswers();
  });
}

if (answersViewSelect) {
  answersViewMode = answersViewSelect.value || "students";
  answersViewSelect.addEventListener("change", () => {
    answersViewMode = answersViewSelect.value || "students";
    renderAnswersView();
  });
}

// --- Update UI based on user state ---
async function updateUIFromUser(user) {
  if (user) {
    loginBtn.classList.add("d-none");
    signupBtn.classList.add("d-none");
    logoutBtn.classList.remove("d-none");
    showMessage("Innlogget som: " + user.email, "success");
  } else {
    loginBtn.classList.remove("d-none");
    signupBtn.classList.remove("d-none");
    logoutBtn.classList.add("d-none");
    clearMessage();
  }

  // Update profile dropdown contents
  const profileDropdown = document.getElementById("profileDropdown");
  if (profileDropdown) {
    if (user) {
      // show a small table-like layout with actions
      profileDropdown.innerHTML = `
          <div class="px-2">
            <div class="fw-semibold">${user.email}</div>
            <div class="small text-muted">Logget inn</div>
            <div class="mt-2">
              <span class="badge bg-secondary" id="profileRoleLabel">${currentRole || "Henter rolle..."}</span>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <div class="px-2">
            <label class="form-label small mb-1" for="roleSwitchSelect">Bytt rolle</label>
            <select id="roleSwitchSelect" class="form-select form-select-sm">
              <option value="">Velg rolle</option>
              <option value="elev">Elev</option>
              <option value="lærer">Lærer</option>
              <option value="admin">Admin</option>
            </select>
            <div class="form-text" id="roleSwitchFeedback"></div>
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item text-danger" id="dropdownLogout">Logg ut</button>
        `;
      // Wire actions
      const dLogout = document.getElementById("dropdownLogout");
      if (dLogout)
        dLogout.onclick = async () => {
          await supabaseClient.auth.signOut();
        };
      const roleSelect = document.getElementById("roleSwitchSelect");
      if (roleSelect) {
        roleSelect.addEventListener("change", (evt) => {
          handleRoleSwitchChange(evt.target.value);
        });
      }
      syncRoleSwitchUI();
    } else {
      profileDropdown.innerHTML = `
          <div class="small text-muted px-2">Du er ikke logget inn</div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="openLoginFromDropdown" type="button" data-bs-toggle="modal" data-bs-target="#loginModal">Logg inn / Lag konto</button>
        `;
    }
  }
}

// Try to fetch current session/user and update UI
async function initAuth() {
  try {
    // Clear any stale local session unless user opted for remember me previously
    const REMEMBER_KEY = "rememberMe";
    const remember = localStorage.getItem(REMEMBER_KEY) === "true";
    if (!remember) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        /* ignore */
      }
    }

    const { data } = await supabaseClient.auth.getUser();
    // getUser returns { data: { user } } when signed in, else data.user is null
    const user = data && data.user ? data.user : null;
    // If there's no user on the server, ensure we're signed out locally
    if (!user) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        /* ignore */
      }
      updateUIFromUser(null);
      await refreshRoleViews(null);
      if (window.__forceLoginFromLanding) {
        openLoginModal("Logg inn for å fortsette.");
        window.__forceLoginFromLanding = false;
      }
      return;
    }
    // Enforce verification: treat unverified as logged out.
    if (!isEmailVerified(user)) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        /* ignore */
      }
      updateUIFromUser(null);
      await refreshRoleViews(null);
      showMessage("E-post må bekreftes før innlogging. Sjekk innboksen for verifiseringslenke.");
      if (window.__requireLogin || window.__forceLoginFromLanding) {
        openLoginModal();
        window.__forceLoginFromLanding = false;
        window.__requireLogin = false;
      }
      return;
    }
    updateUIFromUser(user);
    await refreshRoleViews(user);

    // If guard requested login, open login modal
    if (window.__requireLogin) {
      openLoginModal("Logg inn for å fortsette.");
      window.__requireLogin = false;
    }
    if (window.__forceLoginFromLanding) {
      window.__forceLoginFromLanding = false;
    }
  } catch (err) {
    console.error("initAuth error:", err);
    showMessage("Feil ved henting av bruker. Sjekk konsollen.");
  }
}

// Listen for auth state changes (login/logout) and update UI
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event, session);
  const user = session && session.user ? session.user : null;
  updateUIFromUser(user);
  refreshRoleViews(user);

  // Close modal on successful sign in
  if (["SIGNED_IN", "USER_UPDATED"].includes(event) && bootstrapModal) {
    try {
      bootstrapModal.hide();
    } catch (e) {
      /* ignore */
    }
  }
  // Prompt for nickname when the user signs in or when a user without nickname is detected
  if (user && (event === "SIGNED_IN" || !(user.user_metadata && user.user_metadata.nickname))) {
    ensureNickname(user);
  }
});

// If user logs in and has no nickname, prompt them to create one
async function ensureNickname(user) {
  try {
    if (!user) return;
    const nick = user && user.user_metadata ? user.user_metadata.nickname : undefined;
    if (nick && nick.toString().trim().length > 0) return; // already has nickname

    const nickModalEl = document.getElementById("nickModal");
    const nickModal = bootstrap.Modal.getOrCreateInstance(nickModalEl, {
      backdrop: "static",
      keyboard: false,
    });
    const nickInput = nickModalEl.querySelector("#nickInput");
    const nickFeedback = nickModalEl.querySelector("#nickFeedback");
    const nickSave = nickModalEl.querySelector("#nickSave");

    function validNickname(v) {
      return typeof v === "string" && v.trim().length >= 2 && v.trim().length <= 30;
    }

    nickInput.value = "";
    nickFeedback.style.display = "none";
    nickModal.show();

    async function onSave() {
      const v = (nickInput.value || "").trim();
      if (!validNickname(v)) {
        nickFeedback.style.display = "block";
        nickInput.focus();
        return;
      }
      // update user metadata
      const { data, error } = await supabaseClient.auth.updateUser({
        data: {
          nickname: v,
          name: v,
          full_name: v,
          display_name: v,
        },
      });
      if (error) {
        console.error("Failed to save nickname", error);
        // Show more helpful message from Supabase
        nickFeedback.textContent =
          (error.message || "Kunne ikke lagre kallenavn.") +
          " Sørg for at du er innlogget og at e-post er verifisert.";
        nickFeedback.style.display = "block";
        return;
      }
      // refresh UI with new user
      const { data: got } = await supabaseClient.auth.getUser();
      const newUser = got && got.user ? got.user : null;
      updateUIFromUser(newUser);
      nickModal.hide();
    }

    nickSave.addEventListener("click", onSave, { once: true });
  } catch (err) {
    console.error("ensureNickname error", err);
  }
}

// --- Button handlers ---
loginBtn.onclick = async () => {
  clearMessage();
  const email = emailInput && typeof emailInput.value === "string" ? emailInput.value.trim() : "";
  const password = passwordInput && typeof passwordInput.value === "string" ? passwordInput.value : "";

  if (!email || !password) {
    showMessage("Fyll inn både e-post og passord.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.warn("signInWithPassword error:", error);
      showMessage(error.message || "Innlogging feilet.");
      return;
    }

    // Make sure server actually returned a user (in some edge cases the call may succeed without a valid user)
    const got = await supabaseClient.auth.getUser();
    const user = got && got.data && got.data.user ? got.data.user : null;
    if (!user) {
      // No user — abort and clear any local session
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        /* ignore */
      }
      showMessage("Bruker ikke funnet. Sjekk at kontoen finnes.");
      return;
    }

    // Verify email before allowing full login
    if (!isEmailVerified(user)) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        /* ignore */
      }
      showMessage(
        "E-post ikke bekreftet. Sjekk e-posten og klikk verifiseringslenken før du logger inn."
      );
      return;
    }

    // Successful sign in: update UI and prompt for nickname if needed
    console.log("Signed in:", data);
    showMessage("Innlogging vellykket.", "success");
    // Store remember-me preference
    const REMEMBER_KEY = "rememberMe";
    try {
      const rememberValue = rememberMe && rememberMe.checked ? "true" : "false";
      localStorage.setItem(REMEMBER_KEY, rememberValue);
    } catch (e) {
      /* ignore */
    }
    // prompt for nickname if missing
    ensureNickname(user);
    // modal will be closed by onAuthStateChange
  } catch (err) {
    console.error("Unexpected login error:", err);
    showMessage("Uventet feil. Sjekk konsollen.");
  }
};

signupBtn.onclick = async () => {
  clearMessage();
  const email = emailInput && typeof emailInput.value === "string" ? emailInput.value.trim() : "";
  const password = passwordInput && typeof passwordInput.value === "string" ? passwordInput.value : "";

  if (!email || !password) {
    showMessage("Fyll inn både e-post og passord for å lage konto.");
    return;
  }

  if (!domainAllowed(email)) {
    showMessage("Kun @stud.akademiet.no kan lage konto!");
    return;
  }

  if (password.length < 6) {
    showMessage("Passord må være minst 6 tegn.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "elev",
        },
      },
    });

    if (error) {
      console.warn("signUp error:", error);
      showMessage(error.message || "Registrering feilet.");
      return;
    }

    console.log("Sign up result:", data);
    showMessage("Registrering vellykket — sjekk e-posten og bekreft før innlogging.", "success");
    // modal will be closed on confirmed sign in; keep it open for verification message
  } catch (err) {
    console.error("Unexpected signup error:", err);
    showMessage("Uventet feil ved registrering.");
  }
};

logoutBtn.onclick = async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.warn("signOut error:", error);
      showMessage("Feil ved utlogging.");
      return;
    }
    updateUIFromUser(null);
    await refreshRoleViews(null);
    showMessage("Du er logget ut.", "success");
  } catch (err) {
    console.error("logout error:", err);
    showMessage("Uventet feil ved utlogging.");
  }
};

// Provide a resend verification helper
async function resendVerification(email) {
  if (!email) {
    showMessage("Ingen e-post å sende til.");
    return;
  }
  try {
    // Supabase currently does not expose a direct resend endpoint via JS; typical approach is to trigger signUp again which re-sends if unconfirmed.
    const { error } = await supabaseClient.auth.signUp({
      email,
      password: "dummy-temporary-pass",
    });
    if (error) {
      // Silent: this flow may not work depending on settings; instruct user instead.
      showMessage(
        "Hvis du ikke finner e-posten, prøv «send på nytt» i din e-postklient eller kontakt administrator."
      );
    } else {
      showMessage("Verifiseringsmail forsøkt sendt (sjekk spam).", "success");
    }
  } catch (e) {
    console.error("resendVerification error", e);
    showMessage("Kunne ikke sende verifiseringsmail.");
  }
}

// Initialize
initAuth();

// Helpful debugging tips for you
console.log(
  "Supabase client initialized. If something fails, open DevTools -> Console to see errors."
);
