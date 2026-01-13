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
    const user = data?.user ?? null;
    const verified = !!(user && (user.email_confirmed_at || user.confirmed_at));
    if (!verified) {
      // Redirect to index with login modal prompt (stays on same page since this is index)
      // Show message after scripts load
      window.__requireLogin = true;
    }
  } catch (e) {
    console.warn("Auth guard error", e);
    window.__requireLogin = true;
  }
})();

// --- CONFIG (already set by you) ---
const SUPABASE_URL = "https://hyrtpoywvdvghasiewei.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kneblDkCAHqgGFqgntXgEw_9cc8INOj";

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
const assignmentSelect = document.getElementById("assignmentSelect");
const answerText = document.getElementById("answerText");
const answerForm = document.getElementById("answerForm");
const answerFeedback = document.getElementById("answerFeedback");
const answersList = document.getElementById("answersList");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");

let currentUser = null;
let currentRole = null;
let currentAssignments = [];

// Bootstrap modal instance (so we can hide it programmatically)
const loginModalEl = document.getElementById("loginModal");
let bootstrapModal;
if (loginModalEl) {
  bootstrapModal = bootstrap.Modal.getOrCreateInstance(loginModalEl);
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
  roleHint.className = `alert alert-${type}`;
}

function togglePanel(panel, show) {
  if (!panel) return;
  panel.classList.toggle("d-none", !show);
}

function resetStudentUI() {
  togglePanel(studentPanel, false);
  if (assignmentsList) assignmentsList.innerHTML = "";
  if (assignmentSelect) {
    assignmentSelect.innerHTML = "";
    assignmentSelect.disabled = true;
  }
  if (answerText) answerText.value = "";
  if (answerFeedback) {
    answerFeedback.textContent = "";
    answerFeedback.classList.remove("text-danger", "text-success");
  }
}

function resetTeacherUI() {
  togglePanel(teacherPanel, false);
  if (answersList) answersList.innerHTML = "";
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
    return data?.role ?? null;
  } catch (err) {
    console.error("fetchUserRole unexpected", err);
    return null;
  }
}

async function refreshRoleViews(user) {
  currentUser = user || null;
  currentRole = null;

  if (!user) {
    setRoleHint("Logg inn for å se oppgaver og besvarelser.");
    resetStudentUI();
    resetTeacherUI();
    return;
  }

  setRoleHint("Henter rolle...", "info");
  const role = await fetchUserRole(user.id);
  currentRole = role;

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
  } else if (role === "lærer" || role === "admin") {
    setRoleHint("Du er logget inn som lærer/administrator.", "secondary");
    resetStudentUI();
    togglePanel(teacherPanel, true);
    await loadAnswers();
  } else {
    setRoleHint(`Du er logget inn med rollen "${role}". Ingen paneler tilgjengelig.`, "info");
    resetStudentUI();
    resetTeacherUI();
  }
}

async function loadAssignments() {
  if (!assignmentsList || !assignmentSelect) return;
  assignmentsList.innerHTML = '<div class="text-muted">Laster oppgaver...</div>';
  assignmentSelect.disabled = true;
  assignmentSelect.innerHTML = '';
  currentAssignments = [];

  try {
    const { data, error } = await supabaseClient
      .from("oppgaver")
      .select("id, tittel, beskrivelse, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("loadAssignments error", error);
      assignmentsList.innerHTML = `<div class="text-danger">${error.message}</div>`;
      return;
    }
    currentAssignments = data || [];
    renderAssignments();
  } catch (err) {
    console.error("loadAssignments unexpected", err);
    assignmentsList.innerHTML = `<div class="text-danger">Kunne ikke hente oppgaver.</div>`;
  }
}

function renderAssignments() {
  if (!assignmentsList || !assignmentSelect) return;
  if (!currentAssignments.length) {
    assignmentsList.innerHTML = '<div class="alert alert-info mb-0">Ingen oppgaver er lagt ut ennå.</div>';
    assignmentSelect.disabled = true;
    assignmentSelect.innerHTML = '<option value="">Ingen oppgaver tilgjengelig</option>';
    return;
  }

  assignmentsList.innerHTML = currentAssignments
    .map(
      (task) => `
        <article class="border rounded p-3 mb-2">
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0">${task.tittel}</h6>
            <small class="text-muted">${task.created_at ? new Date(task.created_at).toLocaleDateString() : ""}</small>
          </div>
          <p class="mb-0 text-muted">${task.beskrivelse || "Ingen beskrivelse."}</p>
        </article>
      `
    )
    .join("");

  assignmentSelect.disabled = false;
  assignmentSelect.innerHTML = `
    <option value="">Velg oppgave</option>
    ${currentAssignments.map((task) => `<option value="${task.id}">${task.tittel}</option>`).join("")}
  `;
}

async function loadAnswers() {
  if (!answersList) return;
  answersList.innerHTML = '<div class="text-muted">Laster besvarelser...</div>';

  try {
    const { data, error } = await supabaseClient
      .from("besvarelser")
      .select("id, oppgave_id, elev_id, svar, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("loadAnswers error", error);
      answersList.innerHTML = `<div class="text-danger">${error.message}</div>`;
      return;
    }

    const answers = data || [];
    const oppgaveIds = [...new Set(answers.map((ans) => ans.oppgave_id))].filter(Boolean);
    const oppgaveMap = new Map();

    if (oppgaveIds.length) {
      const { data: oppgaverData, error: oppgaveError } = await supabaseClient
        .from("oppgaver")
        .select("id, tittel")
        .in("id", oppgaveIds);
      if (!oppgaveError && oppgaverData) {
        oppgaverData.forEach((oppgave) => oppgaveMap.set(oppgave.id, oppgave.tittel));
      }
    }

    renderAnswersTable(answers, oppgaveMap);
  } catch (err) {
    console.error("loadAnswers unexpected", err);
    answersList.innerHTML = `<div class="text-danger">Kunne ikke hente besvarelser.</div>`;
  }
}

function renderAnswersTable(answers, oppgaveMap) {
  if (!answersList) return;
  if (!answers.length) {
    answersList.innerHTML = '<div class="alert alert-info mb-0">Ingen besvarelser sendt inn ennå.</div>';
    return;
  }

  const rows = answers
    .map((ans) => {
      const oppgaveNavn = oppgaveMap.get(ans.oppgave_id) || ans.oppgave_id;
      const timestamp = ans.created_at ? new Date(ans.created_at).toLocaleString() : "-";
      return `
        <tr>
          <td>${oppgaveNavn}</td>
          <td><code>${ans.elev_id}</code></td>
          <td>${ans.svar}</td>
          <td>${timestamp}</td>
        </tr>
      `;
    })
    .join("");

  answersList.innerHTML = `
    <table class="table table-striped align-middle">
      <thead>
        <tr>
          <th>Oppgave</th>
          <th>Elev-ID</th>
          <th>Svar</th>
          <th>Tidspunkt</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

if (answerForm) {
  answerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (answerFeedback) {
      answerFeedback.textContent = "";
      answerFeedback.classList.remove("text-danger", "text-success");
    }
    answerForm.classList.add("was-validated");

    const oppgaveId = assignmentSelect?.value;
    const answerValue = answerText?.value?.trim();

    if (!oppgaveId || !answerValue) {
      return;
    }

    if (!currentUser) {
      if (answerFeedback) {
        answerFeedback.textContent = "Du må være innlogget for å sende inn.";
        answerFeedback.classList.add("text-danger");
      }
      return;
    }

    if (submitAnswerBtn) submitAnswerBtn.disabled = true;
    try {
      const { error } = await supabaseClient.from("besvarelser").insert({
        oppgave_id: oppgaveId,
        elev_id: currentUser.id,
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

      if (answerText) answerText.value = "";
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
          </div>
          <div class="dropdown-divider"></div>
          <div class="px-2">
            <table class="table table-borderless table-sm mb-2">
              <tbody>
                <tr><td>Profil</td><td class="text-end"><button id="sendMeldingBtn" class="btn btn-sm btn-primary">Send melding</button></td></tr>
              </tbody>
            </table>
          </div>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item text-danger" id="dropdownLogout">Logg ut</button>
        `;
      // Wire actions
      const sendBtn = document.getElementById("sendMeldingBtn");
      if (sendBtn) sendBtn.onclick = () => {
        window.location.href = "melding side.html";
      };
      const dLogout = document.getElementById("dropdownLogout");
      if (dLogout)
        dLogout.onclick = async () => {
          await supabaseClient.auth.signOut();
        };
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
    const user = data?.user ?? null;
    // If there's no user on the server, ensure we're signed out locally
    if (!user) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        /* ignore */
      }
      updateUIFromUser(null);
      await refreshRoleViews(null);
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
      return;
    }
    updateUIFromUser(user);
    await refreshRoleViews(user);

    // If guard requested login, open login modal
    if (window.__requireLogin) {
      try {
        const lm = bootstrap.Modal.getOrCreateInstance(
          document.getElementById("loginModal")
        );
        lm.show();
        showMessage("Logg inn for å fortsette.");
      } catch (e) {}
      window.__requireLogin = false;
    }
  } catch (err) {
    console.error("initAuth error:", err);
    showMessage("Feil ved henting av bruker. Sjekk konsollen.");
  }
}

// Listen for auth state changes (login/logout) and update UI
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event, session);
  const user = session?.user ?? null;
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
    const nick = user.user_metadata?.nickname;
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
      const newUser = got?.user ?? null;
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
  const email = emailInput.value?.trim();
  const password = passwordInput.value ?? "";

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
    const user = got?.data?.user ?? null;
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
      localStorage.setItem(REMEMBER_KEY, rememberMe?.checked ? "true" : "false");
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
  const email = emailInput.value?.trim();
  const password = passwordInput.value ?? "";

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
