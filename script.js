const API_BASE = "http://localhost:8000";

const state = {
  token: localStorage.getItem("face_auth_token") || "",
  captures: new Map(),
  streams: new Map(),
  faceAutoTimer: null,
  faceLoginBusy: false,
  user: null,
};

const authPanel = document.querySelector(".auth-panel");
const homeView = document.querySelector("#homeView");
const authMessage = document.querySelector("#authMessage");
const faceLoginStatus = document.querySelector("#faceLoginStatus");
const greeting = document.querySelector("#greeting");
const profileText = document.querySelector("#profileText");
const verifyResult = document.querySelector("#verifyResult");
const profileUpdateResult = document.querySelector("#profileUpdateResult");

const endpoints = {
  register: "/api/auth/register",
  passwordLogin: "/api/auth/login/password",
  faceLogin: "/api/auth/login/face",
  verify: "/api/face/verify",
  profile: "/api/profile",
  me: "/api/auth/me",
};

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab, .tab-panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");
    stopFaceAutoLogin();
  });
});

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", async () => {
    await setLoginMode(button.dataset.mode);
  });
});

document.querySelectorAll("[data-camera]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await startCamera(button.dataset.camera);
      setMessage("Kamera yoqildi.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });
});

document.querySelectorAll("[data-shot]").forEach((button) => {
  button.addEventListener("click", () => {
    try {
      capturePhoto(button.dataset.shot);
      setMessage("Rasm olindi.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });
});

document.querySelector("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const image = await imageFromForm(form, "register");
  if (!image) return setMessage("Registratsiya uchun rasm kerak.", true);

  const body = new FormData();
  body.append("name", form.name.value.trim());
  body.append("phone", form.phone.value.trim());
  body.append("password", form.password.value);
  body.append("image", image, "register.jpg");

  try {
    const data = await request(endpoints.register, { method: "POST", body });
    await enterSite(data);
  } catch (error) {
    setMessage(error.message, true);
  }
});

document.querySelector("#passwordLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = new URLSearchParams();
  body.append("phone", form.phone.value.trim());
  body.append("password", form.password.value);

  try {
    const data = await request(endpoints.passwordLogin, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    await enterSite(data);
  } catch (error) {
    setMessage(error.message, true);
  }
});

document.querySelector("#faceLoginForm").addEventListener("submit", (event) => {
  event.preventDefault();
});

document.querySelector("#logoutBtn").addEventListener("click", () => {
  showAuth("Tizimdan chiqildi.");
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-action='logout']")) {
    showAuth("Tizimdan chiqildi.");
  }
});

function showAuth(message = "Tayyor.") {
  localStorage.removeItem("face_auth_token");
  state.token = "";
  state.user = null;
  stopCamera("verify");
  stopFaceAutoLogin();
  document.body.classList.remove("is-home");
  homeView.classList.remove("menu-closed");
  homeView.classList.add("hidden");
  authPanel.classList.remove("hidden");
  setLoginMode("password");
  setMessage(message);
}

document.querySelector("#verifyFaceBtn").addEventListener("click", async () => {
  await verifyFace();
});

document.querySelectorAll(".admin-nav").forEach((button) => {
  button.addEventListener("click", () => {
    setAdminView(button.dataset.view);
  });
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view]");
  if (!target || !homeView.contains(target)) return;
  setAdminView(target.dataset.view);
});

document.querySelector("#profileUpdateForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await updateProfile(event.currentTarget);
});

document.querySelector(".mobile-close")?.addEventListener("click", () => {
  homeView.classList.add("menu-closed");
});

document.querySelector(".mobile-browser-chrome")?.addEventListener("click", () => {
  homeView.classList.remove("menu-closed");
});

async function setLoginMode(mode) {
  const isFace = mode === "face";

  document.querySelectorAll(".mode").forEach((item) => {
    item.classList.toggle("active", item.dataset.mode === mode);
  });

  document.querySelector("#passwordLoginForm").classList.toggle("hidden", isFace);
  document.querySelector("#faceLoginForm").classList.toggle("hidden", !isFace);

  if (isFace) {
    await startFaceAutoLogin();
  } else {
    stopFaceAutoLogin();
  }
}

async function startFaceAutoLogin() {
  if (state.faceLoginBusy) return;

  try {
    faceLoginStatus.textContent = "Kamera ochilmoqda...";
    await startCamera("faceLogin");
    faceLoginStatus.textContent = "Yuzingizni kameraga qarating. Login avtomatik bajariladi.";
    clearTimeout(state.faceAutoTimer);
    state.faceAutoTimer = setTimeout(autoSubmitFaceLogin, 1300);
  } catch (error) {
    faceLoginStatus.textContent = error.message;
    setMessage(error.message, true);
  }
}

async function autoSubmitFaceLogin() {
  if (state.faceLoginBusy) return;
  state.faceLoginBusy = true;

  try {
    faceLoginStatus.textContent = "Tekshirilmoqda...";
    const image = await capturePhoto("faceLogin");
    const body = new FormData();
    body.append("image", image, "face-login.jpg");

    const data = await request(endpoints.faceLogin, { method: "POST", body });
    faceLoginStatus.textContent = "Kirish muvaffaqiyatli.";
    await enterSite(data);
  } catch (error) {
    faceLoginStatus.textContent = "Tanilmadi. Qayta urinilmoqda...";
    setMessage(error.message, true);
    state.faceLoginBusy = false;
    state.faceAutoTimer = setTimeout(autoSubmitFaceLogin, 2200);
  }
}

function stopFaceAutoLogin() {
  clearTimeout(state.faceAutoTimer);
  state.faceLoginBusy = false;
  stopCamera("faceLogin");
  if (faceLoginStatus) faceLoginStatus.textContent = "Yuzingizni kameraga qarating.";
}

async function enterSite(data = {}) {
  const token = data?.access_token || state.token;
  if (token) {
    state.token = token;
    localStorage.setItem("face_auth_token", token);
  }

  stopFaceAutoLogin();
  const user = data.user || (state.token ? await loadProfile() : null);
  if (!user && !data.user && state.token) {
    showAuth("Sessiya topilmadi. Qayta login qiling.");
    return;
  }
  applyUser(user);
  verifyResult.textContent = "Moslik foizi shu yerda chiqadi.";
  if (profileUpdateResult) profileUpdateResult.textContent = "Yangilash natijasi shu yerda chiqadi.";
  setAdminView("profile");
  document.body.classList.add("is-home");
  authPanel.classList.add("hidden");
  homeView.classList.remove("hidden");
}

function setAdminView(view) {
  document.querySelectorAll(".admin-nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  document.querySelectorAll(".admin-view").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === view);
  });
}

function applyUser(user) {
  user = unwrapUser(user);
  state.user = user;
  const name = user?.name || user?.phone || "user";
  const phone = user?.phone ? `Telefon: ${user.phone}` : "Telefon kiritilmagan";
  const id = user?.id === undefined ? "" : `ID: ${user.id}`;

  greeting.textContent = `Hello ${name}`;
  profileText.textContent = [id, phone].filter(Boolean).join(" • ") || "Xush kelibsiz.";
  fillProfileForm(user);
}

async function updateProfile(form) {
  if (!state.token) {
    profileUpdateResult.classList.add("error");
    profileUpdateResult.textContent = "Avval login qiling.";
    return;
  }

  const body = new FormData();
  let hasValue = false;
  ["name", "phone", "password"].forEach((field) => {
    const value = form[field].value.trim();
    if (value) {
      body.append(field, value);
      hasValue = true;
    }
  });

  const image = form.image.files?.[0];
  if (image) {
    body.append("image", image);
    hasValue = true;
  }

  if (!hasValue) {
    profileUpdateResult.classList.add("error");
    profileUpdateResult.textContent = "Yangilash uchun kamida bitta maydon kiriting.";
    return;
  }

  try {
    profileUpdateResult.classList.remove("error");
    profileUpdateResult.textContent = "Profil yangilanmoqda...";
    const data = await request(endpoints.profile, {
      method: "PATCH",
      headers: authHeaders(),
      body,
    });
    const user = unwrapUser(data);
    applyUser(user);
    form.password.value = "";
    form.image.value = "";
    profileUpdateResult.textContent = `Profil yangilandi.\nIsm: ${user?.name ?? "-"}\nTelefon: ${user?.phone ?? "-"}`;
  } catch (error) {
    profileUpdateResult.classList.add("error");
    profileUpdateResult.textContent = error.message;
  }
}

function fillProfileForm(user) {
  const form = document.querySelector("#profileUpdateForm");
  if (!form) return;
  form.name.value = user?.name || "";
  form.phone.value = user?.phone || "";
}

function unwrapUser(data) {
  return data?.user || data?.profile || data;
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function verifyFace() {
  const userId = state.user?.id;
  if (!userId) {
    verifyResult.textContent = "User ID topilmadi. Qayta login qiling.";
    verifyResult.classList.add("error");
    return;
  }

  try {
    verifyResult.classList.remove("error");
    verifyResult.textContent = "Kamera tayyorlanmoqda...";

    if (!state.streams.has("verify")) {
      await startCamera("verify");
    }

    verifyResult.textContent = "Rasm olinmoqda...";
    const image = await capturePhoto("verify");
    const body = new FormData();
    body.append("user_id", userId);
    body.append("image", image, "verify.jpg");

    verifyResult.textContent = "Moslik tekshirilmoqda...";
    const data = await request(endpoints.verify, {
      method: "POST",
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : undefined,
      body,
    });

    const percent = data.similarity_percent ?? data.similarity ?? data.match_percent;
    const matched = data.matched === undefined ? "" : data.matched ? "Mos tushdi" : "Mos tushmadi";
    verifyResult.textContent = percent === undefined ? JSON.stringify(data, null, 2) : `${matched}\nMoslik: ${percent}%`;
  } catch (error) {
    verifyResult.classList.add("error");
    verifyResult.textContent = error.message;
  }
}

async function loadProfile() {
  try {
    return await request(endpoints.profile, {
      method: "GET",
      headers: authHeaders(),
    });
  } catch {
    try {
    return await request(endpoints.me, {
      method: "GET",
      headers: authHeaders(),
    });
  } catch {
    return null;
  }
  }
}

async function startCamera(key) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Brauzer kamerani qo‘llab-quvvatlamaydi.");
  }

  stopCamera(key);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  const video = document.querySelector(`#${key}Video`);
  video.srcObject = stream;
  await video.play();
  state.streams.set(key, stream);
}

function capturePhoto(key) {
  const video = document.querySelector(`#${key}Video`);
  const canvas = document.querySelector(`#${key}Canvas`);
  if (!video.srcObject || !video.videoWidth) {
    throw new Error("Kamera hali tayyor emas.");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Rasm olinmadi."));
      state.captures.set(key, blob);
      resolve(blob);
    }, "image/jpeg", 0.92);
  });
}

function stopCamera(key) {
  const stream = state.streams.get(key);
  if (stream) stream.getTracks().forEach((track) => track.stop());
  state.streams.delete(key);
}

async function imageFromForm(form, key) {
  const file = form.image?.files?.[0];
  if (file) return file;
  return state.captures.get(key);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === "string" ? data : data.detail || JSON.stringify(data);
    throw new Error(message || `HTTP ${response.status}`);
  }

  return data;
}

function setMessage(message, isError = false) {
  authMessage.classList.toggle("error", isError);
  authMessage.textContent = message;
}

showAuth("Tayyor.");

window.addEventListener("beforeunload", () => {
  state.streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
});
