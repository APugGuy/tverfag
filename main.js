// ===== Global auth guard =====
// Prevent access to the page unless logged in and verified.
(async () => {
  try {
    const supa = window.supabase || null;
    if (!supa) return; // supabase will be available below when client is created
    const client = supa.createClient(
      "https://ivlertpelhlmrkelimik.supabase.co",
      "sb_publishable_dzv1-BSpefObyTjVEWEjgw_Ua8Q8jNq"
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
const SUPABASE_URL = "https://ivlertpelhlmrkelimik.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dzv1-BSpefObyTjVEWEjgw_Ua8Q8jNq";

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
      showMessage("E-post må bekreftes før innlogging. Sjekk innboksen for verifiseringslenke.");
      return;
    }
    updateUIFromUser(user);

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
