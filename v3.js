const V3 = "https://png8nftp9y-alt.github.io/dist/v3/";
// Release contracts: location.origin+'/app/api' and background refresh outside opponent profiles.
// Functional-shield contracts retained across formatting:
// ${agendaDrawCodeHtml(m,itemTournament)}</div><${whenTag} class="agendaWhenDetails
// stats.innerHTML='<span class="scheduledTournamentLabel">PROGRAMMATO</span>'
// statSpans[0].hidden=profileOutcomeFilter!=='all'
const PRIVATE_API = location.origin + "/app/api";
const APP_API = PRIVATE_API + "/app-snapshot";
const LAST_GOOD_CACHE = "courtwatch-v3-last-good-v1";
const UI_STATE_CACHE = "courtwatch-v3-ui-state-v1";
const DEVICE_ID_CACHE = "courtwatch-device-id-v1";
const PLAYER_RANKING_CACHE = "courtwatch-player-rankings-v1";
const OPPONENT_HISTORY_CACHE = "courtwatch-opponent-history-v1";
const ACTIVE_OPPONENT_CACHE = "courtwatch-active-opponent-v1";
function courtWatchDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_CACHE) || "";
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(id)) {
      id = (
        crypto.randomUUID
          ? crypto.randomUUID()
          : Array.from(crypto.getRandomValues(new Uint8Array(24)), (value) =>
              value.toString(16).padStart(2, "0"),
            ).join("")
      ).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(DEVICE_ID_CACHE, id);
    }
    return id;
  } catch {
    return "";
  }
}
function privateApiOptions(options = {}) {
  const id = courtWatchDeviceId(),
    headers = new Headers(options.headers || {});
  if (id) headers.set("X-CourtWatch-Device", id);
  return { ...options, headers };
}

const FORMER_PLAYERS = new Set([
  "martina-busa",
  "manuel-natale",
  "pietro-sala",
  "niccolo-zanaga",
]);
const PLAYER_DEMOGRAPHICS = {
  "aila-zennaro": [2012, "F"],
  "alessio-nava": [2017, "M"],
  "andrea-losa": [2014, "M"],
  "anna-gambarini": [2015, "F"],
  "camilla-lingeri": [2015, "F"],
  "carlo-ghislotti": [2016, "M"],
  "daniele-gelli": [2015, "M"],
  "darko-sartori": [2011, "M"],
  "edoardo-grimoldi": [2015, "M"],
  "filippo-vitali": [2014, "M"],
  "francesco-bocchio": [2015, "M"],
  "francesco-renzulli": [2012, "M"],
  "giulia-scozzafava": [2012, "F"],
  "gregorio-puccio": [2014, "M"],
  "martina-danesi": [2009, "F"],
  "matilde-mainetti": [2012, "F"],
  "matteo-bocchio": [2017, "M"],
  "mattia-garibaldi": [2015, "M"],
  "nicholas-scappa": [2015, "M"],
  "nikola-kerkenyakov": [2012, "M"],
  "noemi-paganini": [2015, "F"],
  "virginia-cereghini": [2013, "F"],
  "virginia-rossoni": [2016, "F"],
};
function savedUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_STATE_CACHE) || "{}");
  } catch {
    return {};
  }
}
function savedEntries(key, storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function saveEntries(key, map, storage = localStorage, limit = 30) {
  try {
    storage.setItem(key, JSON.stringify([...map.entries()].slice(-limit)));
  } catch {}
}
function savedActiveOpponent(requestKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(ACTIVE_OPPONENT_CACHE) || "null");
    return saved?.requestKey === requestKey && saved?.data ? saved.data : null;
  } catch {
    return null;
  }
}
function saveActiveOpponent(requestKey, data) {
  try {
    localStorage.setItem(ACTIVE_OPPONENT_CACHE, JSON.stringify({ requestKey, data }));
  } catch {}
}
const restoredUi = savedUiState(),
  restoredMonth = /^\d{4}-\d{2}$/.test(restoredUi.month)
    ? new Date(restoredUi.month + "-01T12:00:00")
    : new Date(),
  restoredAgenda = /^\d{4}-\d{2}-\d{2}$/.test(restoredUi.agenda)
    ? new Date(restoredUi.agenda + "T12:00:00")
    : new Date();
const CATEGORY_VALUES = ["U10", "U12", "U14", "U16", "U18", "O18"],
  restoredCategories = Array.isArray(restoredUi.categoryFilters)
    ? restoredUi.categoryFilters.filter((value) =>
        CATEGORY_VALUES.includes(value),
      )
    : /^(U10|U12|U14|U16|U18|O18)$/.test(restoredUi.categoryFilter)
      ? [restoredUi.categoryFilter]
      : [];
const state = {
  data: null,
  month: restoredMonth,
  agenda: restoredAgenda,
  agendaMode:
    restoredUi.agendaMode === "chronological" ? "chronological" : "tournament",
  categoryFilters: new Set(restoredCategories),
  sexFilter: /^[MF]$/.test(restoredUi.sexFilter) ? restoredUi.sexFilter : "all",
  selected: new Set(
    Array.isArray(restoredUi.selected) ? restoredUi.selected : [],
  ),
  pickerView: "years",
  pickerYear: restoredAgenda.getFullYear(),
  pickerMonth: restoredAgenda.getMonth(),
};
let calendarHeightObserver = null,
  loadRunning = false,
  renderedDataSignature = "",
  activeOpponentRouteKey = "",
  opponentHistoryCache = new Map(savedEntries(OPPONENT_HISTORY_CACHE)),
  opponentHistoryRequests = new Map(),
  opponentPrefetchQueue = [],
  opponentPrefetchQueued = new Set(),
  opponentPrefetchActive = 0,
  playerRankingRequests = new Map(),
  playerRankingCache = new Map(savedEntries(PLAYER_RANKING_CACHE)),
  playerSearchSequence = 0,
  playerSearchTimer = null,
  activeRouteScrollKey = location.hash || "#home",
  routeScrollMemory = new Map(),
  uiSelectionRestored =
    Array.isArray(restoredUi.selected) && restoredUi.selected.length > 0,
  uiScrollRestored = false,
  calendarPlayerHoldTimer = null,
  suppressTournamentOpenUntil = 0,
  suppressPlayerFilterUntil = 0,
  tournamentPageKey = String(restoredUi.tournamentPageKey || ""),
  openTournamentPlayerKeys = new Set(
    Array.isArray(restoredUi.openTournamentPlayerKeys)
      ? restoredUi.openTournamentPlayerKeys
      : [],
  );
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
const iso = (d) => {
    const x = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
    return x.toISOString().slice(0, 10);
  },
  add = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  },
  monday = (d) => add(d, -((d.getDay() + 6) % 7));
function saveUiState() {
  try {
    localStorage.setItem(
      UI_STATE_CACHE,
      JSON.stringify({
        agenda: iso(state.agenda),
        month: `${state.month.getFullYear()}-${String(state.month.getMonth() + 1).padStart(2, "0")}`,
        selected: [...state.selected],
        agendaMode: state.agendaMode,
        categoryFilters: [...state.categoryFilters],
        sexFilter: state.sexFilter,
        scrollY: Math.max(0, Math.round(scrollY || 0)),
        profilePlayerId: profileFilterPlayerId,
        openProfileTournamentKeys: [...openProfileTournamentKeys],
        tournamentPageKey,
        openTournamentPlayerKeys: [...openTournamentPlayerKeys],
      }),
    );
  } catch {}
}
function restoreUiScroll() {
  if (uiScrollRestored) return;
  uiScrollRestored = true;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => scrollTo(0, Number(restoredUi.scrollY) || 0)),
  );
}
const fmt = (d) =>
  new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
const agendaBtnFmt = (d) =>
  new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })
    .format(d)
    .replace(",", "")
    .replace(".", "");
const monthFmt = (d) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(
    d,
  );
const initials = (n) => {
  const parts = String(n || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
};
const decodeEntities = (value) => {
  const el = document.createElement("textarea");
  el.innerHTML = String(value || "");
  return el.value;
};
const readableText = (value) =>
  decodeEntities(value)
    .replace(/(J30\s+Compi[eè]gne)\s*\(cancelled\)/gi, "$1")
    .replace(/\s*\(?\s*view\s+in\s+google\s+maps\s*\)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
const readablePerson = (value) => {
  const words = readableText(value)
    .replace(/\bmatilde\s+mambrini\b/gi, "Matilde Mambrini")
    .split(" ")
    .filter(Boolean);
  if (
    words.length > 1 &&
    words
      .at(-1)
      .localeCompare(words.at(-2), undefined, { sensitivity: "base" }) === 0
  )
    words.pop();
  return words.join(" ");
};
const IOC_REGION = {
  AUT: "AT",
  BEL: "BE",
  BIH: "BA",
  BLR: "BY",
  BUL: "BG",
  CRO: "HR",
  CYP: "CY",
  CZE: "CZ",
  DEN: "DK",
  ESP: "ES",
  EST: "EE",
  FIN: "FI",
  FRA: "FR",
  GBR: "GB",
  GEO: "GE",
  GER: "DE",
  GRE: "GR",
  HUN: "HU",
  IRL: "IE",
  ISR: "IL",
  ITA: "IT",
  LAT: "LV",
  LTU: "LT",
  LUX: "LU",
  MDA: "MD",
  MKD: "MK",
  MLT: "MT",
  MNE: "ME",
  NED: "NL",
  NOR: "NO",
  POL: "PL",
  POR: "PT",
  ROM: "RO",
  ROU: "RO",
  RUS: "RU",
  SRB: "RS",
  SLO: "SI",
  SVK: "SK",
  SUI: "CH",
  SWE: "SE",
  TUR: "TR",
  UKR: "UA",
  UZB: "UZ",
  USA: "US",
  CAN: "CA",
  AUS: "AU",
  NZL: "NZ",
  JPN: "JP",
  CHN: "CN",
  KOR: "KR",
  IND: "IN",
  BRA: "BR",
  ARG: "AR",
  MEX: "MX",
  KAZ: "KZ",
};
const COUNTRY_NAME_REGION = {
  SERBIA: "RS",
  SRBIJA: "RS",
  CZECHIA: "CZ",
  "CZECH REPUBLIC": "CZ",
  KAZAKHSTAN: "KZ",
};
const countryCode = (value) =>
    String(value || "")
      .trim()
      .toUpperCase(),
  countryFlagCode = (value) => {
    const raw = countryCode(value),
      code = IOC_REGION[raw] || COUNTRY_NAME_REGION[raw] || raw;
    return /^[A-Z]{2}$/.test(code) ? code.toLowerCase() : "";
  };
const nationalityHtml = (value) => {
  const code = countryCode(value);
  if (!code) return "";
  const flagCode = countryFlagCode(code),
    flagFile = flagCode === "mx" ? "mx-flat" : flagCode;
  return ` <span class="nationality">(${esc(code)})${flagFile ? ` <img class="countryFlag" src="flags/${flagFile}.svg" alt="Bandiera ${esc(code)}" loading="eager">` : ""}</span>`;
};
const VERIFIED_NATIONALITY = {
  "MARIA SHILIGA": "RUS",
  "IVAN SINYAKOV": "RUS",
  "MARIA DOMANEVSKAYA": "BLR",
  "MAKAR HAURYLAU": "BLR",
};
function knownNationality(name, value) {
  if (value) return value;
  const wanted = readablePerson(name).toUpperCase();
  for (const m of state.data?.matches || []) {
    const sets = [
      [
        m.sourcePlayerName || m.playerName,
        [m.sourceNationality || m.playerNationality],
      ],
      [m.partner, m.partnerNationalities || []],
      [m.opponent, m.opponentNationalities || []],
    ];
    for (const [names, codes] of sets) {
      const parts = String(names || "").split(/\s*\/\s*/);
      const i = parts.findIndex(
        (x) => readablePerson(x).toUpperCase() === wanted,
      );
      if (i >= 0 && codes[i]) return codes[i];
    }
  }
  return VERIFIED_NATIONALITY[wanted] || "";
}
const teRankHtml = (value) => {
  const rank = Number(value);
  return Number.isInteger(rank) && rank > 0
    ? ` <span class="teRanking">n°${rank} TE</span>`
    : "";
};
const playerRankingSummary = (player) => {
  const cached = playerRankingCache.get(String(player?.id || "")),
    labels = cached?.rankings?.length
      ? currentPlayerRankingLabels(player, cached.rankings)
      : [
          player?.ranking ? `${readableText(player.ranking)} FITP` : "",
          player?.tennisEuropeRanking
            ? readableText(player.tennisEuropeRanking)
            : "",
        ].filter(Boolean);
  return labels.length
    ? `<span id="playerLiveRankings" class="playerAllRankings"> · ${labels.map(esc).join(" · ")}</span>`
    : '<span id="playerLiveRankings" class="playerAllRankings"></span>';
};
function currentPlayerRankingLabels(player, rows = []) {
  const labels = [];
  if (player?.ranking) labels.push(`${readableText(player.ranking)} FITP`);
  const liveRows = rows.length
    ? rows
    : Object.entries(player?.tennisEuropeRankings || {}).map(([category, ranking]) => ({
        category: category === "u14" ? "U14" : category === "u16" ? "U16" : category,
        ranking,
      }));
  for (const row of liveRows)
    if (row?.ranking)
      labels.push(`n°${row.ranking} TE${row.category ? ` ${row.category.replace(/^[BG]/, "U")}` : ""}`);
  if (!liveRows.length && player?.tennisEuropeRanking)
    labels.push(...String(player.tennisEuropeRanking).split(/\s*·\s*/).filter(Boolean));
  return labels;
}
async function loadCurrentPlayerRanking(player) {
  const key = String(player?.id || readablePerson(player?.name));
  if (!key) return;
  if (!playerRankingRequests.has(key))
    playerRankingRequests.set(
      key,
      fetch(
        `${PRIVATE_API}/player-ranking?playerId=${encodeURIComponent(player.id || "")}&name=${encodeURIComponent(player.name || "")}`,
        privateApiOptions({ cache: "no-store" }),
      )
        .then((response) => {
          if (!response.ok) throw Error("player ranking");
          return response.json();
        })
        .finally(() => playerRankingRequests.delete(key)),
    );
  try {
    const data = await playerRankingRequests.get(key),
      target = $("playerLiveRankings"),
      labels = currentPlayerRankingLabels(player, data.rankings || []);
    if ((data.rankings || []).length) {
      playerRankingCache.set(key, data);
      saveEntries(PLAYER_RANKING_CACHE, playerRankingCache);
    }
    if (target && location.hash === `#player/${encodeURIComponent(player.id)}`)
      target.textContent = labels.length ? ` · ${labels.join(" · ")}` : "";
  } catch {}
}
const normalizedDesignation = (value) => {
  const raw = String(value ?? "").trim().replace(/^[\[(]|[\])]$/g, "").toUpperCase();
  if (/^\d{1,2}$/.test(raw)) return raw;
  if (/^(?:WC|WILD\s*CARD)$/.test(raw)) return "WC";
  if (/^(?:Q|QUALIFIER|QUALIFIED)$/.test(raw)) return "Q";
  if (/^(?:LL|LUCKY\s*LOSER)$/.test(raw)) return "LL";
  return "";
};
const participantDesignation = (row, prefix = "") => {
  const direct = [
    row?.[`${prefix}Designation`], row?.[`${prefix}EntryType`],
    row?.[`${prefix}Seed`], row?.[`${prefix}SeedNumber`], row?.[`${prefix}Seeding`],
    row?.[`${prefix}Qualifier`], row?.[`${prefix}WildCard`], row?.[`${prefix}Wildcard`],
    row?.[`${prefix}LuckyLoser`],
  ].map(normalizedDesignation).find(Boolean);
  if (direct) return direct;
  if (row?.[`${prefix}WildCard`] === true || row?.[`${prefix}Wildcard`] === true) return "WC";
  if (row?.[`${prefix}Qualifier`] === true || row?.[`${prefix}Qualified`] === true) return "Q";
  if (row?.[`${prefix}LuckyLoser`] === true) return "LL";
  return "";
};
const participantDesignationHtml = (value) => {
  const marker = normalizedDesignation(value);
  return marker ? ` <span class="participantDesignation">${esc(marker)}</span>` : "";
};
const inlineParticipant = (value) => {
  const raw = readablePerson(value),
    match = raw.match(/\s*[\[(]\s*(\d{1,2}|WC|Q|LL)\s*[\])]\s*$/i);
  return { name: match ? raw.slice(0, match.index).trim() : raw, designation: match?.[1] || "" };
};
const peopleHtml = (names, nationalities = [], rankings = [], designations = []) =>
  String(names || "")
    .split(/\s*\/\s*/)
    .filter(Boolean)
    .map((value, index) => {
      const person = inlineParticipant(value);
      return `${esc(person.name)}${participantDesignationHtml(designations[index] || person.designation)}${nationalityHtml(knownNationality(person.name, nationalities[index]))}${teRankHtml(rankings[index])}`;
    })
    .join("/");
const circuit = (x) => {
  const s = (
    x.sourceId ||
    x.source ||
    x.sourceName ||
    x.circuit ||
    ""
  ).toLowerCase();
  return s.includes("tennis-europe") ||
    s.includes("tennis europe") ||
    s === "te"
    ? "tennis-europe"
    : s.includes("itf")
      ? "itf"
      : "fitp";
};
const circuitRank = (x) =>
  ({ itf: 0, "tennis-europe": 1, fitp: 2 })[circuit(x)] ?? 3;
const acceptanceRank = (x) =>
    ({ MD: 0, Q: 1, A: 2 })[
      String(x.acceptanceCode || x.calendarListLabel || "").split("-")[0]
    ] ?? 3,
  acceptanceNumber = (x) => {
    const n = Number(
      x.acceptancePosition ?? String(x.calendarListLabel || "").split("-")[1],
    );
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
const active = (t) =>
  !["eliminated", "excluded", "withdrawn"].includes(
    String(t.status || "").toLowerCase(),
  ) && String(t.acceptanceList || "").toLowerCase() !== "withdrawn";
const overlap = (t, a, b) =>
  active(t) &&
  (!t.startDate || t.startDate <= b) &&
  (!t.endDate || t.endDate >= a);
const cityCountry = (s) => {
  let v = String(s || "")
    .replace(/^Tournaments\s+/i, "")
    .trim();
  if (v.includes("|")) v = v.split("|").pop().trim();
  const m = v.match(/([\p{L}' .-]+,\s*[\p{L}' .-]+)(?:\s|$)/u);
  const label = (m ? m[1] : v).trim();
  if (!label) return "Città/stato da pubblicare";
  const parts = label.split(",");
  if (/^[\p{Lu}' .-]+$/u.test(parts[0]) && /\p{Lu}/u.test(parts[0]))
    parts[0] = parts[0]
      .toLocaleLowerCase("it-IT")
      .replace(/(^|[\s'-])\p{Ll}/gu, (letter) => letter.toLocaleUpperCase("it-IT"));
  return parts.join(",").trim();
};
const displayDate = (value) => {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(value || "");
};
function playerBirthLabel(player) {
  const raw = String(player?.birthDate || player?.dateOfBirth || "").slice(
    0,
    10,
  );
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(raw + "T12:00:00");
    return `data di nascita ${new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(date).replace(".", "")}`;
  }
  const year = playerDemographics(player).birthYear;
  return Number.isInteger(year) ? `anno di nascita ${year}` : "";
}
const FITP_UPPER = new Set([
  "ASD",
  "SSD",
  "SRL",
  "SPA",
  "TC",
  "FITP",
  "CSD",
  "CRAL",
  "CUS",
  "ACSI",
  "UISP",
]);
function fitpClubCase(value) {
  const raw = readableText(value);
  if (!raw || raw !== raw.toLocaleUpperCase("it-IT")) return raw;
  return raw
    .toLocaleLowerCase("it-IT")
    .split(/(\s+|-)/)
    .map((word, index) => {
      if (!word.trim() || word === "-") return word;
      const upper = word.toUpperCase();
      if (FITP_UPPER.has(upper)) return upper;
      if (index > 0 && /^(di|del|della|dei|degli|e|a|da|in)$/.test(word))
        return word;
      return word.charAt(0).toLocaleUpperCase("it-IT") + word.slice(1);
    })
    .join("");
}
function fitpAddressCase(value) {
  const raw = readableText(value);
  if (!raw || raw !== raw.toLocaleUpperCase("it-IT")) return raw;
  return raw
    .toLocaleLowerCase("it-IT")
    .split(/(\s+|-)/)
    .map((word, index) => {
      if (!word.trim() || word === "-") return word;
      if (index > 0 && /^(di|del|della|dei|degli|e|a|da|in)$/.test(word))
        return word;
      return word.charAt(0).toLocaleUpperCase("it-IT") + word.slice(1);
    })
    .join("");
}
function fitpCityProvince(value) {
  const raw = readableText(value),
    match = raw.match(/^(.*?)(?:\s+([A-Za-z]{2}))$/);
  return match
    ? `${fitpAddressCase(match[1].trim())} ${match[2].toUpperCase()}`
    : fitpAddressCase(raw);
}
function fitpSummerCenterPlace(t) {
  if (circuit(t) !== "fitp") return "";
  const raw = readableText(
      `${t.name || t.tournamentName || ""} ${t.venueName || t.clubName || t.club || ""}`,
    ),
    match = raw.match(
      /CENTRO ESTIVO FITP\s+(.+?)(?=\s+(?:TORNEO|UNDER|U\d|DAL|DA\s+\d|\d{1,2}[\/-])\b|$)/i,
    );
  return match
    ? `Centro estivo FITP · ${fitpAddressCase(match[1].trim())}`
    : "";
}
function tournamentLocationLabel(t, fallback = "") {
  if (circuit(t) === "tennis-europe") {
    const venue = readableText(t?.venueName || ""),
      parts = readableText(t?.location || t?.city || fallback)
        .split(",")
        .map(readableText)
        .filter(Boolean);
    if (
      venue &&
      parts[0]?.toLocaleLowerCase("it-IT") === venue.toLocaleLowerCase("it-IT")
    )
      parts.shift();
    return parts.length > 1
      ? parts.slice(-2).join(", ")
      : parts[0] || "Città/stato da pubblicare";
  }
  return (
    fitpSummerCenterPlace(t) || cityCountry(t?.location || t?.city || fallback)
  );
}
function tournamentPlace(t) {
  const compact = (value) => {
      const seen = new Set();
      return readableText(value)
        .split(",")
        .map((x) => x.trim())
        .filter(
          (x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()),
        )
        .join(", ");
    },
    source = circuit(t),
    summerCenter = fitpSummerCenterPlace(t);
  if (summerCenter) return summerCenter;
  if (source === "fitp") {
    const values = [
      fitpClubCase(t.venueName || t.clubName || t.club),
      fitpAddressCase(t.address || t.clubAddress || t.venueAddress),
      fitpCityProvince(t.location || t.city),
    ]
      .map(compact)
      .filter(Boolean);
    return values.join(", ") || "Luogo da pubblicare";
  }
  const officialAddressRaw = compact(t.address || t.venueAddress),
    officialAddress = /\bitalia\b/i.test(officialAddressRaw)
      ? officialAddressRaw.replace(/,\s*Italy\s*$/i, "")
      : officialAddressRaw,
    values = (
      officialAddress
        ? [t.venueName, t.clubName, t.club, officialAddress]
        : [t.venueName, t.clubName, t.club, t.location, t.city, t.country]
    )
      .map(compact)
      .filter(Boolean),
    result = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (result.some((x) => x.toLowerCase().includes(key))) continue;
    for (let i = result.length - 1; i >= 0; i--)
      if (key.includes(result[i].toLowerCase())) result.splice(i, 1);
    result.push(value);
  }
  return result.join(", ") || "Luogo da pubblicare";
}
function agendaOrderOfPlayUrl(match) {
  const explicit = readableText(
    match?.sourceUrl ||
      match?.orderOfPlayUrl ||
      match?.oopUrl ||
      match?.scheduleUrl ||
      "",
  );
  if (/^https?:\/\//i.test(explicit)) return explicit;
  if (
    circuit(match) === "tennis-europe" &&
    match?.competitionId &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(match.date || ""))
  )
    return `https://te.tournamentsoftware.com/tournament/${encodeURIComponent(match.competitionId)}/matches/${String(match.date).replaceAll("-", "")}`;
  return "";
}
function agendaVenueLocation(t, fallback = "") {
  const item = t || {},
    venue =
      circuit(item) === "fitp"
        ? fitpClubCase(item.venueName || item.clubName || item.club)
        : readableText(item.venueName || item.clubName || item.club);
  let rawLocation = readableText(item.location || item.city || fallback);
  if (
    venue &&
    rawLocation
      .toLocaleLowerCase("it-IT")
      .startsWith(readableText(venue).toLocaleLowerCase("it-IT"))
  )
    rawLocation = rawLocation
      .slice(readableText(venue).length)
      .replace(/^[,·\s-]+/, "");
  const location =
      circuit(item) === "fitp"
        ? fitpCityProvince(rawLocation || item.city || fallback)
        : cityCountry(rawLocation || item.city || fallback),
    parts = [];
  for (const value of [venue, location]) {
    const text = readableText(value);
    if (!text) continue;
    const key = text.toLocaleLowerCase("it-IT");
    if (
      parts.some(
        (x) =>
          x.toLocaleLowerCase("it-IT") === key ||
          x.toLocaleLowerCase("it-IT").includes(key) ||
          key.includes(x.toLocaleLowerCase("it-IT")),
      )
    )
      continue;
    parts.push(text);
  }
  return parts.join(" · ") || "Luogo da pubblicare";
}

async function v3json(path) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(V3 + path, {
      cache: "no-cache",
      mode: "cors",
      signal: controller.signal,
    });
    if (!r.ok) throw Error("File v3 mancante: " + path);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
async function fetchProjection(url, timeoutMs) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
      privateApiOptions({
        cache: "no-store",
        mode: "cors",
        credentials: "same-origin",
        signal: controller.signal,
      }),
    );
    if (!response.ok) throw Error("API Court Watch non disponibile: " + response.status);
    const data = await response.json();
    if (
      !Array.isArray(data.players) ||
      !data.players.length ||
      !Array.isArray(data.tournaments) ||
      !Array.isArray(data.matches)
    )
      throw Error("Proiezione API incompleta");
    return data;
  } finally {
    clearTimeout(timer);
  }
}
async function apiProjection() {
  try {
    return await fetchProjection(APP_API, 8000);
  } catch (privateError) {
    console.warn("Snapshot privato lento: recupero snapshot D1 rapido", privateError);
    return fetchProjection(location.origin + "/v1/app-snapshot", 15000);
  }
}
function cachedData() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_GOOD_CACHE) || "null");
    return saved &&
      Array.isArray(saved.players) &&
      saved.players.length &&
      Array.isArray(saved.tournaments)
      ? saved
      : null;
  } catch {
    return null;
  }
}
function saveCachedData(data) {
  try {
    localStorage.setItem(LAST_GOOD_CACHE, JSON.stringify(data));
  } catch (e) {
    console.warn("Cache locale Court Watch non disponibile", e);
  }
}
function syncLabel(data, fallback = false) {
  const status = $("syncStatus"),
    alert = $("dataAlert"),
    stamp = Date.parse(data.generatedAt || ""),
    when = new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(Number.isFinite(stamp) ? stamp : Date.now())),
    age = Number.isFinite(stamp) ? Date.now() - stamp : Infinity;
  alert.hidden = true;
  alert.textContent = "";
  status.className = "status";
  if (fallback) {
    status.hidden = true;
    status.classList.add("fallback");
    status.textContent = "";
    return;
  }
  if (!Number.isFinite(stamp) || age > 45 * 60 * 1000) {
    status.hidden = false;
    status.classList.add("delay");
    status.textContent =
      "Dati aggiornati con ritardo · ultimo aggiornamento " + when;
    return;
  }
  status.hidden = true;
  status.textContent = "";
}
function unavailableLabel() {
  const status = $("syncStatus"),
    alert = $("dataAlert");
  status.hidden = true;
  status.textContent = "";
  alert.hidden = false;
  alert.textContent =
    "Dati temporaneamente non disponibili. Riprova più tardi.";
}
function matchMeta(m) {
  const isDouble =
      m.matchType === "doubles" ||
      m.eventType === "doubles" ||
      /doppio|double/i.test(
        `${m.draw || ""} ${m.category || ""} ${m.eventType || ""} ${m.partner || ""}`,
      ),
    op = m.opponentOptions?.length
      ? m.opponentOptions.join(isDouble ? "/" : " oppure ")
      : m.opponent;
  return { isDouble, op, condition: m.condition || m.note || "" };
}
function agendaSchedule(m) {
  const raw = readableText(m.time || ""),
    qualifier = readableText(
      m.scheduleQualifier || m.scheduleLabel || m.officialScheduleLabel || "",
    ),
    notBefore =
      Boolean(m.notBefore) ||
      /^not\s*before\b/i.test(raw) ||
      /^not before$/i.test(qualifier),
    afterRest =
      Boolean(m.afterRest) ||
      /after\s+rest/i.test(raw) ||
      /^after rest$/i.test(qualifier),
    followedBy =
      Boolean(m.followedBy) ||
      /followed\s+by/i.test(raw) ||
      /^followed by$/i.test(qualifier);
  let time = raw
    .replace(/^(?:not\s*before|starting(?:\s+at)?)\s*/i, "")
    .replace(/^orario da pubblicare$/i, "");
  if (/tba/i.test(qualifier) || /tba/i.test(time)) time = "";
  if (notBefore)
    return {
      hideNumber: false,
      numberText: "",
      numberDetail: "",
      restText: "",
      timeText: `N.B. ${time || "—"}`,
    };
  if (followedBy) {
    const position = Number(m.relativeMatchNumber),
      from = readableText(m.relativeFromTime || ""),
      overall = Number(m.overallMatchNumber),
      overallFrom = readableText(m.overallFromTime || ""),
      extra =
        Number.isInteger(overall) &&
        overall > 0 &&
        overall !== position &&
        overallFrom
          ? `,\n${overall}° match complessivo dalle ${overallFrom}`
          : "";
    return {
      hideNumber: true,
      numberText: "A seguire",
      numberDetail:
        Number.isInteger(position) && position > 0 && from
          ? `(${position}° match dalle ${from}${extra})`
          : "",
      restText: "",
      timeText: "",
    };
  }
  if (afterRest) {
    const position = Number(m.overallMatchNumber || m.courtMatchNumber),
      from = readableText(m.overallFromTime || "");
    return {
      hideNumber: true,
      numberText: "",
      numberDetail: "",
      restText: "Dopo riposo",
      restDetail:
        Number.isInteger(position) && position > 2 && from
          ? `${position}° match dalle ${from}`
          : "",
      timeText: "",
    };
  }
  return {
    hideNumber: false,
    numberText: "",
    numberDetail: "",
    restText: "",
    timeText: time || "—",
  };
}
function agendaClockMinutes(value) {
  const match = readableText(value || "").match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return Number.POSITIVE_INFINITY;
  const hours = Number(match[1]),
    minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60
    ? hours * 60 + minutes
    : Number.POSITIVE_INFINITY;
}
function agendaEstimatedMinutes(m) {
  const qualifier = readableText(
      m.scheduleQualifier || m.scheduleLabel || m.officialScheduleLabel || "",
    ),
    raw = readableText(m.time || ""),
    followedBy =
      Boolean(m.followedBy) ||
      /followed\s+by/i.test(raw) ||
      /^followed by$/i.test(qualifier);
  if (!followedBy) return agendaClockMinutes(raw);
  const position = Number(
      m.overallMatchNumber || m.courtMatchNumber || m.relativeMatchNumber,
    ),
    anchor = agendaClockMinutes(m.overallFromTime || m.relativeFromTime || "");
  if (!Number.isInteger(position) || position < 1 || !Number.isFinite(anchor))
    return Number.POSITIVE_INFINITY;
  let estimate = anchor;
  for (let matchNumber = 1; matchNumber < position; matchNumber++)
    estimate += matchNumber <= 2 ? 90 : matchNumber <= 4 ? 105 : 120;
  return estimate;
}
function agendaChronologicalCompare(a, b) {
  return (
    agendaEstimatedMinutes(a) - agendaEstimatedMinutes(b) ||
    agendaCourtMatchNumber(a) - agendaCourtMatchNumber(b) ||
    String(a.playerName || "").localeCompare(String(b.playerName || ""), "it")
  );
}
function agendaTime(m) {
  const schedule = agendaSchedule(m);
  return schedule.timeText || schedule.numberText || "—";
}
function agendaCourtMatchNumber(m) {
  for (const value of [
    m.courtMatchNumber,
    m.matchNumber,
    m.orderOfPlayPosition,
    m.courtOrder,
    m.matchOrder,
  ]) {
    const number = Number(value);
    if (Number.isInteger(number) && number > 0) return number;
  }
  return 0;
}
function agendaCourtName(m) {
  const value = readableText(m.court || "");
  if (!value) return "";
  return /^(?:campo\b|court\b|c(?:c)?(?:[\s.:-]|\d))/i.test(value)
    ? value
    : "Court " + value;
}
function agendaLongCourt(m) {
  return agendaCourtName(m).length > 17;
}
function pendingOpponentHtml(m) {
  const possible = Array.isArray(m.possibleOpponents)
    ? m.possibleOpponents.map(readablePerson).filter(Boolean)
    : [];
  return possible.length === 2
    ? `Avversario da definire · Possibili: ${possible.map(esc).join(" / ")}`
    : "Avversario da definire";
}
function courtWatchPlayerByName(name) {
  const wanted = readablePerson(name);
  return (state.data?.players || []).find(
    (player) =>
      readablePerson(player.name).localeCompare(wanted, "it", {
        sensitivity: "base",
      }) === 0,
  );
}
function participantLinkHtml(m, role, name, index, content, courtWatchClass = "") {
  const monitored = courtWatchPlayerByName(name),
    profileIds =
      role === "partner"
        ? m.partnerTeProfileIds || m.partnerSourceIds || []
        : m.opponentTeProfileIds || m.opponentSourceIds || [];
  return monitored
    ? `<button class="inlinePlayerLink ${courtWatchClass}" data-open-player="${esc(monitored.id)}">${content}</button>`
    : `<button class="inlinePlayerLink opponentPlayerLink${role === "partner" ? " doublesPartnerLink" : ""}" data-open-current-opponent="${esc(profileIds[index] || "")}" data-opponent-name="${esc(readablePerson(name))}" data-opponent-event="${esc(m.event || m.draw || "")}">${content}</button>`;
}
function partnerHtml(m) {
  const names = String(m.partner || "")
      .split(/\s*\/\s*/)
      .map(readablePerson)
      .filter(Boolean),
    nationalities = m.partnerNationalities || [],
    rankings = m.partnerTeRankings || [],
    designations = m.partnerDesignations || m.partnerEntryTypes || m.partnerSeeds || [];
  return names
    .map((name, index) =>
      participantLinkHtml(
        m,
        "partner",
        name,
        index,
        playerLabelHtml(name, nationalities[index] || "", rankings[index], designations[index]),
      ),
    )
    .join('<span class="teamSeparator">/</span>');
}
function opponentHtml(m, x) {
  if (!x.op) return pendingOpponentHtml(m);
  const club = m.opponentClub
      ? ` · circolo ${esc(readableText(m.opponentClub))}`
      : "",
    names = m.opponentOptions?.length
      ? m.opponentOptions
      : String(x.op).split(/\s*\/\s*|\s+oppure\s+/i),
    nationalities = m.opponentNationalities?.length
      ? m.opponentNationalities
      : m.opponentNationality
        ? [m.opponentNationality]
        : [],
    rankings = m.opponentTeRankings || [],
    designations = m.opponentDesignations || m.opponentEntryTypes || m.opponentSeeds || [],
    people = names
      .map((name, index) => {
        const content = playerLabelHtml(
          name,
          nationalities[index] || "",
          rankings[index],
          designations[index],
        );
        return participantLinkHtml(
          m,
          "opponent",
          name,
          index,
          content,
          courtWatchPlayerByName(name)
            ? "opponentPlayerLink courtWatchOpponent"
            : "",
        );
      })
      .join('<span class="teamSeparator">/</span>');
  return `vs <span class="opponentName">${people}</span><span class="opponentClub">${club}</span>`;
}
function agendaResultHtml(m, x) {
  if (!matchResultText(m)) return "";
  const names = m.opponentOptions?.length
      ? m.opponentOptions
      : String(x.op || "").split(/\s*\/\s*|\s+oppure\s+/i),
    courtWatchOpponent =
      names.length === 1 ? courtWatchPlayerByName(names[0]) : null,
    winner =
      courtWatchOpponent && m.advances === true
        ? readablePerson(m.playerName)
        : courtWatchOpponent && m.advances === false
          ? readablePerson(courtWatchOpponent.name)
          : "";
  return winner
    ? `<p class="result sharedCourtWatchResult">Vincitore: ${esc(winner)} · Risultato: ${esc(matchResultText(m))}</p>`
    : `<p class="result${m.advances === false ? " loss" : m.advances === true ? " win" : ""}">Risultato: ${esc(matchResultText(m))}</p>`;
}
function plainOpponentHtml(m, x) {
  if (!x.op) return pendingOpponentHtml(m);
  const club = m.opponentClub
      ? ` · circolo ${esc(readableText(m.opponentClub))}`
      : "",
    ranking = m.opponentRanking
      ? ` · classifica ${esc(readableText(m.opponentRanking))}`
      : "";
  return `vs <span class="opponentName">${esc(readableText(x.op))}</span>${ranking}<span class="opponentClub">${club}</span>`;
}
function monitoredNationality(playerId, fallback = "") {
  const player = (state.data?.players || []).find((p) => p.id === playerId);
  return (
    player?.nationality || player?.country || player?.countryCode || fallback
  );
}
function playerLabelHtml(player, nationality, ranking, designation = "") {
  const person = inlineParticipant(player);
  return `${esc(person.name)}${participantDesignationHtml(designation || person.designation)}${nationalityHtml(nationality)}${teRankHtml(ranking)}`;
}
function playerTeamHtml(m) {
  const source = circuit(m),
    person = inlineParticipant(m.playerName),
    base = esc(person.name) + participantDesignationHtml(participantDesignation(m, "player") || person.designation);
  if (source === "fitp") {
    const club =
      (state.data?.players || []).find((p) => p.id === m.playerId)?.club || "";
    return club
      ? `${base} <span class="playerClub">· ${esc(club)}</span>`
      : base;
  }
  const player = playerLabelHtml(
    m.playerName,
    m.sourceNationality ||
      m.playerNationality ||
      monitoredNationality(m.playerId),
    m.playerTeRanking,
    participantDesignation(m, "player"),
  );
  return m.partner
    ? `${player}/${peopleHtml(m.partner, m.partnerNationalities || [], m.partnerTeRankings || [], m.partnerDesignations || m.partnerEntryTypes || m.partnerSeeds || [])}`
    : player;
}
function analysisKey(m) {
  return String(m.matchId || m.id || agendaKey(m));
}
let matchAnalysisKeys = new Set();
function matchAnalysisButton(m) {
  const key = analysisKey(m),
    has = matchAnalysisKeys.has(key),
    label = has ? "Modifica analisi partita" : "Inserisci analisi partita";
  return `<button type="button" class="matchAnalysisButton${has ? " hasAnalysis" : ""}" data-match-analysis="${esc(key)}" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5V22l2.5-1.5H19a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a1.5 1.5 0 0 0 1 1.5ZM7 8h10M7 12h10M7 16h6"/></svg></button>`;
}
function accountInitials(name, email) {
  const parts = readableText(name).split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts.at(-1)[0]).toUpperCase();
  if (parts.length) return parts[0][0].toUpperCase();
  return String(email || "?")[0].toUpperCase();
}
async function loadAccount() {
  try {
    const response = await fetch(
      PRIVATE_API + "/session",
      privateApiOptions({ cache: "no-store" }),
    );
    if (!response.ok) throw Error("session");
    const data = await response.json(),
      user = data.user || {},
      initials = accountInitials(user.displayName, user.email),
      button = $("accountMenuButton");
    $("accountInitials").textContent = initials;
    button.title = user.displayName || user.email || "Account";
    button.setAttribute(
      "aria-label",
      "Account " + (user.displayName || user.email || ""),
    );
  } catch {
    $("accountInitials").textContent = "FQ";
  }
}
function wireAccount() {
  const control = $("accountControl"),
    button = $("accountMenuButton"),
    menu = $("accountMenu"),
    close = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    };
  button.onclick = (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
  $("accountLogout").onclick = () => {
    location.href = location.origin + "/cdn-cgi/access/logout";
  };
  menu.onclick = (event) => event.stopPropagation();
  document.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}
function refreshAnalysisButtons() {
  document.querySelectorAll("[data-match-analysis]").forEach((button) => {
    const has = matchAnalysisKeys.has(button.dataset.matchAnalysis);
    button.classList.toggle("hasAnalysis", has);
    const label = has
      ? "Modifica analisi partita"
      : "Inserisci analisi partita";
    button.setAttribute("aria-label", label);
    button.title = label;
  });
}
async function refreshMatchAnalysisStatus() {
  try {
    const response = await fetch(PRIVATE_API + "/match-analysis-status", {
        cache: "no-store",
      }),
      data = await response.json();
    matchAnalysisKeys = new Set(
      (data.matches || []).map((x) => String(x.matchKey)),
    );
    refreshAnalysisButtons();
  } catch {}
}
function analysisEditor() {
  let editor = $("matchAnalysisEditor");
  if (editor) return editor;
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="matchAnalysisEditor" class="analysisEditor" hidden><div class="analysisEditorPanel" role="dialog" aria-modal="true" aria-labelledby="matchAnalysisTitle"><div class="analysisEditorHead"><h2 id="matchAnalysisTitle">Analisi della partita</h2><button type="button" class="analysisEditorClose" aria-label="Chiudi">×</button></div><textarea class="analysisEditorText" rows="12" aria-label="Testo analisi"></textarea><p class="analysisEditorError" role="alert" hidden></p><div class="analysisEditorActions"><button type="button" class="btn analysisEditorDelete">Elimina</button><span></span><button type="button" class="btn analysisEditorCancel">Annulla</button><button type="button" class="btn analysisEditorSave">Salva</button></div></div></div>',
  );
  return $("matchAnalysisEditor");
}
function editMatchAnalysis(initial, canDelete) {
  const editor = analysisEditor(),
    text = editor.querySelector(".analysisEditorText"),
    error = editor.querySelector(".analysisEditorError"),
    save = editor.querySelector(".analysisEditorSave"),
    remove = editor.querySelector(".analysisEditorDelete"),
    cancel = editor.querySelector(".analysisEditorCancel"),
    close = editor.querySelector(".analysisEditorClose");
  text.value = initial || "";
  error.hidden = true;
  error.textContent = "";
  remove.hidden = !canDelete;
  editor.hidden = false;
  text.focus();
  text.setSelectionRange(text.value.length, text.value.length);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
        if (done) return;
        done = true;
        editor.hidden = true;
        document.removeEventListener("keydown", onKey);
        resolve(value);
      },
      onKey = (e) => {
        if (e.key === "Escape") finish(null);
      };
    save.onclick = () => {
      const value = text.value.trim();
      if (!value) {
        error.textContent =
          "Inserisci il testo dell’analisi oppure usa Elimina.";
        error.hidden = false;
        return;
      }
      finish({ action: "save", analysis: value });
    };
    remove.onclick = () => finish({ action: "delete" });
    cancel.onclick = close.onclick = () => finish(null);
    editor.onclick = (e) => {
      if (e.target === editor) finish(null);
    };
    document.addEventListener("keydown", onKey);
  });
}
async function openMatchAnalysis(key) {
  const loading = analysisEditor(),
    loadingText = loading.querySelector(".analysisEditorText"),
    loadingError = loading.querySelector(".analysisEditorError");
  loading.hidden = false;
  loadingText.value = "Caricamento…";
  loadingText.disabled = true;
  loadingError.hidden = true;
  for (const button of loading.querySelectorAll(
    ".analysisEditorActions button",
  ))
    button.disabled = true;
  loading.querySelector(".analysisEditorClose").onclick = () => {
    loading.hidden = true;
  };
  let response;
  try {
    response = await fetch(
      PRIVATE_API + "/match-analysis?matchKey=" + encodeURIComponent(key),
      { cache: "no-store" },
    );
  } catch {
    loadingText.value = "";
    loadingError.textContent = "Analisi temporaneamente non disponibile.";
    loadingError.hidden = false;
    loading.querySelector(".analysisEditorClose").disabled = false;
    return;
  }
  if (response.status === 401) {
    location.href = location.origin + "/app";
    return;
  }
  if (!response.ok) {
    loadingText.value = "";
    loadingError.textContent = "Analisi temporaneamente non disponibile.";
    loadingError.hidden = false;
    loading.querySelector(".analysisEditorClose").disabled = false;
    return;
  }
  const current = await response.json();
  loading.hidden = true;
  loadingText.disabled = false;
  for (const button of loading.querySelectorAll(
    ".analysisEditorActions button",
  ))
    button.disabled = false;
  const edit = await editMatchAnalysis(
    current.analysis || "",
    Boolean(current.analysis),
  );
  if (!edit) return;
  if (edit.action === "delete") {
    response = await fetch(
      PRIVATE_API + "/match-analysis?matchKey=" + encodeURIComponent(key),
      { method: "DELETE" },
    );
    if (response.ok) matchAnalysisKeys.delete(key);
  } else {
    response = await fetch(PRIVATE_API + "/match-analysis", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchKey: key, analysis: edit.analysis }),
    });
    if (response.ok) matchAnalysisKeys.add(key);
  }
  if (!response.ok) {
    alert("Salvataggio non riuscito.");
    return;
  }
  refreshAnalysisButtons();
}

function agendaKey(m) {
  return `${m.playerId || ""}|${m.matchId || m.id || ""}`;
}
function mergeAgenda(agenda, matches) {
  const hasEurope = matches.some((m) => circuit(m) === "tennis-europe"),
    byKey = new Map(matches.map((m) => [agendaKey(m), m]));
  for (const a of agenda || []) {
    if (hasEurope && circuit(a) === "tennis-europe" && !a.manual) continue;
    const key = agendaKey(a),
      base = byKey.get(key) || {};
    byKey.set(key, { ...base, ...a });
  }
  return [...byKey.values()];
}
function clearDemographicFilters() {
  state.categoryFilters.clear();
  state.sexFilter = "all";
}
function isolatePlayer(playerId) {
  if (
    !playerId ||
    !state.data?.players?.some((player) => player.id === playerId)
  )
    return;
  suppressTournamentOpenUntil = Date.now() + 1000;
  suppressPlayerFilterUntil = Date.now() + 1000;
  clearDemographicFilters();
  state.selected = new Set([playerId]);
  saveUiState();
  renderHome();
}
function bindPlayerHold(element, playerId) {
  let active = false;
  const cancel = () => {
    if (calendarPlayerHoldTimer) {
      clearTimeout(calendarPlayerHoldTimer);
      calendarPlayerHoldTimer = null;
    }
    active = false;
    element.classList.remove("holding");
  };
  element.onpointerdown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.stopPropagation();
    cancel();
    active = true;
    element.classList.add("holding");
    calendarPlayerHoldTimer = setTimeout(() => {
      calendarPlayerHoldTimer = null;
      if (!active) return;
      element.classList.remove("holding");
      isolatePlayer(playerId);
    }, 550);
  };
  element.onpointerup = cancel;
  element.onpointercancel = cancel;
  element.oncontextmenu = (event) => {
    if (active || Date.now() < suppressPlayerFilterUntil)
      event.preventDefault();
  };
}
function playerDemographics(player) {
  const stored = PLAYER_DEMOGRAPHICS[player?.id] || [];
  return {
    birthYear: Number(player?.birthYear || stored[0]),
    sex: String(player?.sex || stored[1] || "").toUpperCase(),
  };
}
function playerAgeCategory(player, year = state.month.getFullYear()) {
  const birthYear = playerDemographics(player).birthYear;
  if (!Number.isInteger(birthYear)) return "";
  const age = year - birthYear;
  return age <= 10
    ? "U10"
    : age <= 12
      ? "U12"
      : age <= 14
        ? "U14"
        : age <= 16
          ? "U16"
          : age <= 18
            ? "U18"
            : "O18";
}
function calendarEligiblePlayers() {
  return (state.data?.players || []).filter(
    (player) =>
      (!state.categoryFilters.size ||
        state.categoryFilters.has(playerAgeCategory(player))) &&
      (state.sexFilter === "all" ||
        playerDemographics(player).sex === state.sexFilter),
  );
}
function applyDemographicSelection() {
  state.selected = new Set(
    calendarEligiblePlayers().map((player) => player.id),
  );
}
function renderFilters() {
  const all = state.data.players || [],
    eligibleIds = new Set(calendarEligiblePlayers().map((player) => player.id));
  $("calendarSex").value = state.sexFilter;
  $("categoryFilterLabel").textContent = state.categoryFilters.size
    ? [...state.categoryFilters].join(", ")
    : "Tutte";
  document
    .querySelectorAll("[data-category-filter]")
    .forEach(
      (input) => (input.checked = state.categoryFilters.has(input.value)),
    );
  $("playerFilters").innerHTML = all
    .map(
      (p) =>
        `<button class="chip ${state.selected.has(p.id) ? "selected" : eligibleIds.has(p.id) ? "" : "filteredOut"}" data-filter="${esc(p.id)}">${esc(p.name)}</button>`,
    )
    .join("");
  $("toggleAll").textContent =
    state.selected.size > all.length - state.selected.size
      ? "Deseleziona tutti"
      : "Seleziona tutti";
  document.querySelectorAll("[data-filter]").forEach((b) => {
    bindPlayerHold(b, b.dataset.filter);
    b.onclick = () => {
      if (Date.now() < suppressPlayerFilterUntil) return;
      const selecting = !state.selected.has(b.dataset.filter);
      if (selecting && !eligibleIds.has(b.dataset.filter))
        clearDemographicFilters();
      selecting
        ? state.selected.add(b.dataset.filter)
        : state.selected.delete(b.dataset.filter);
      saveUiState();
      renderHome();
    };
  });
}
function matchTournament(m) {
  return groups(false).find(
    (x) =>
      circuit(x) === circuit(m) &&
      (m.competitionId && x.competitionId
        ? String(x.competitionId) === String(m.competitionId)
        : readableText(x.name) === readableText(m.tournamentName)),
  );
}
function matchTournamentKey(m) {
  const t = matchTournament(m);
  return t ? tournamentKey(t) : "";
}
function agendaGenderClass(m) {
  const code = agendaEventCode(m).toUpperCase();
  return code.startsWith("G") ? "girls" : code.startsWith("B") ? "boys" : "";
}
function agendaEventCode(m) {
  const raw = readableText(`${m.event || ""} ${m.draw || ""}`),
    direct = raw.match(/\b(BS|GS|BD|GD|XD)\s*U?(\d{2})\b/i);
  if (direct) return direct[1].toUpperCase() + direct[2];
  const age =
    (raw.match(/\b(?:U|UNDER\s*)(\d{2})\b/i) ||
      raw.match(/\b(12|14|16|18)\b/))?.[1] || "";
  if (!age) return "";
  const gender = /\bgirls?|female|donne?\b/i.test(raw)
    ? "G"
    : /\bboys?|male|uomini?\b/i.test(raw)
      ? "B"
      : "";
  const kind = /\bdoubles?|doppio\b/i.test(raw)
    ? "D"
    : /\bsingles?|singolare\b/i.test(raw)
      ? "S"
      : "";
  return gender && kind ? gender + kind + age : "";
}
function agendaRoundCode(m) {
  const raw = readableText([m.round, m.roundName, m.stage, m.phase, m.group, m.format, m.drawFormat].filter(Boolean).join(" ")),
    source = readableText(`${m.event || ""} ${m.draw || ""}`),
    bonus = /bonus\s*draw/i.test(source),
    upper = raw.toUpperCase();
  if (m.roundRobin || m.isRoundRobin || /round\s*robin|robin|(?:^|\b)rr(?:\b|$)|group|girone|pool/i.test(`${raw} ${source}`))
    return "RR";
  let code = "";
  const explicit = raw.match(/\bS?Q\s*(\d+)\b/i),
    qualSize = (raw.match(
      /QUALIF(?:YING|ICATION)?\s+ROUND\s+OF\s+(64|32|16|8)/i,
    ) || [])[1];
  if (explicit) code = "SQ" + explicit[1];
  else if (qualSize) {
    const sizes = [
      ...new Set(
        (state.data.matches || [])
          .filter(
            (x) =>
              String(x.competitionId || "") === String(m.competitionId || "") &&
              readableText(x.event || x.draw || "") ===
                readableText(m.event || m.draw || ""),
          )
          .map(
            (x) =>
              (readableText(x.round || "").match(
                /QUALIF(?:YING|ICATION)?\s+ROUND\s+OF\s+(64|32|16|8)/i,
              ) || [])[1],
          )
          .filter(Boolean)
          .map(Number),
      ),
    ].sort((a, b) => b - a);
    code = "SQ" + (Math.max(0, sizes.indexOf(Number(qualSize))) + 1);
  } else {
    const ordinal = raw.match(
      /(\d+)\D*(?:ST|ND|RD|TH)?\s+(?:ROUND\s+OF\s+)?QUAL/i,
    );
    if (ordinal) code = "SQ" + ordinal[1];
    else if (/QUARTER/.test(upper) || /\bQF\b/.test(upper)) code = "QF";
    else if (/SEMI/.test(upper) || /\bSF\b/.test(upper)) code = "SF";
    else if (/FINAL/.test(upper) || /^F$/.test(upper)) code = "F";
    else {
      const round =
        upper.match(/\bR(?:OUND)?\s*(64|32|16|8)\b/) ||
        upper.match(/ROUND\s+OF\s+(64|32|16|8)/);
      if (round) code = "R" + round[1];
    }
  }
  return bonus ? (code ? `BONUS ${code}` : "BONUS") : code;
}
function agendaGenderLabel(m) {
  const raw = readableText(
    `${m.gender || ""} ${m.event || ""} ${m.draw || ""} ${m.category || ""}`,
  ).toUpperCase();
  if (/\\b(GS|GD)\\d{0,2}\\b|GIRLS?|FEMALE|FEMMINILE|DONNE?/.test(raw))
    return "Femminile";
  if (/\\b(BS|BD)\\d{0,2}\\b|BOYS?|MALE|MASCHILE|UOMINI?/.test(raw))
    return "Maschile";
  return "";
}
function tournamentDisplayName(t, fallback = "Torneo") {
  const item = t || {};
  return readableText(
    circuit(item) === "tennis-europe"
      ? item.tournamentName || item.searchTournamentName || item.name || fallback
      : item.name || item.tournamentName || fallback,
  );
}
function agendaCircuitLabel(value) {
  const source = circuit(value);
  if (source === "tennis-europe") return "TENNIS EUROPE";
  return source === "itf"
    ? "ITF"
    : "FITP";
}
function agendaCircuitBadges(value, tournament = value) {
  const source = circuit(value),
    circuitBadge = `<span class="type ${source}">${esc(agendaCircuitLabel(value))}</span>`;
  if (source !== "tennis-europe") return circuitBadge;
  const conditions = tournamentSurfaceLabel(tournament, true);
  return `${circuitBadge}<span class="type tournamentConditions">${esc(conditions || "SUPERFICIE/AMBIENTE NON PUBBLICATI")}</span>`;
}
function agendaTournamentLocation(t, m) {
  const source = circuit(t || m),
    venue = readableText(t?.venueName || t?.clubName || t?.club || ""),
    raw = readableText(t?.location || t?.city || m.location || m.city || "");
  let parts = raw.split(",").map(readableText).filter(Boolean);
  if (
    venue &&
    parts[0] &&
    parts[0].toLocaleLowerCase("it") === venue.toLocaleLowerCase("it")
  )
    parts.shift();
  parts = parts.filter(
    (part, index) =>
      !index ||
      part.toLocaleLowerCase("it") !== parts[index - 1].toLocaleLowerCase("it"),
  );
  if (source === "fitp")
    return parts[0] || readableText(t?.city || m.city || "");
  return parts.length > 1 ? parts.slice(-2).join(", ") : parts[0] || "";
}
function agendaPlayerTeamHtml(m) {
  if (circuit(m) !== "fitp") return playerTeamHtml(m);
  const player = esc(readablePerson(m.playerName));
  return m.partner ? `${player}/${esc(readablePerson(m.partner))}` : player;
}
function agendaPlayerTeamLinksHtml(m) {
  const playerName = readablePerson(m.playerName),
    playerContent =
      circuit(m) === "fitp"
        ? esc(playerName)
        : playerLabelHtml(
            playerName,
            m.sourceNationality ||
              m.playerNationality ||
              monitoredNationality(m.playerId),
            m.playerTeRanking,
          ),
    player = `<button class="inlinePlayerLink" data-open-player="${esc(m.playerId)}">${playerContent}</button>`,
    partnerName = readablePerson(m.partner || "");
  if (!partnerName) return player;
  const partnerRecord = (state.data?.players || []).find(
      (p) =>
        readablePerson(p.name).localeCompare(partnerName, "it", {
          sensitivity: "base",
        }) === 0,
    ),
    partnerContent =
      circuit(m) === "fitp"
        ? esc(partnerName)
        : peopleHtml(
            partnerName,
            m.partnerNationalities || [],
            m.partnerTeRankings || [],
          );
  return partnerRecord
    ? `${player}<span class="teamSeparator">/</span><button class="inlinePlayerLink" data-open-player="${esc(partnerRecord.id)}">${partnerContent}</button>`
    : `${player}<span class="teamSeparator">/</span>${participantLinkHtml(m, "partner", partnerName, 0, partnerContent)}`;
}
function agendaTeamNames(m) {
  return [
    readablePerson(m.playerName),
    ...(Array.isArray(m.partner) ? m.partner : [m.partner]),
  ]
    .filter(Boolean)
    .map((name) => readablePerson(name).toLocaleUpperCase("it-IT"))
    .sort();
}
function sameAgendaMatch(a, b) {
  if (circuit(a) !== circuit(b) || a.date !== b.date) return false;
  const aid = String(a.matchId || ""),
    bid = String(b.matchId || "");
  if (aid && bid) return aid === bid;
  if (!matchMeta(a).isDouble || !matchMeta(b).isDouble) return false;
  if (
    String(a.competitionId || a.tournamentName || "") !==
    String(b.competitionId || b.tournamentName || "")
  )
    return false;
  const at = agendaTeamNames(a),
    bt = agendaTeamNames(b);
  return (
    at.length >= 2 &&
    at.length === bt.length &&
    at.every((name, index) => name === bt[index]) &&
    [a.court, a.time, a.round, agendaCourtMatchNumber(a)].join("|") ===
      [b.court, b.time, b.round, agendaCourtMatchNumber(b)].join("|")
  );
}
function dedupeAgendaMatches(items) {
  const unique = [];
  for (const match of items) {
    if (!unique.some((existing) => sameAgendaMatch(existing, match)))
      unique.push(match);
  }
  return unique;
}
function agendaMatchRows(matches) {
  const groups = [];
  for (const match of matches) {
    const estimated = agendaEstimatedMinutes(match),
      key = Number.isFinite(estimated) ? String(estimated) : agendaTime(match),
      group = groups.find((item) => item.key === key);
    if (group) group.matches.push(match);
    else groups.push({ key, matches: [match] });
  }
  return groups.flatMap((group) => {
    const rows = [];
    for (let i = 0; i < group.matches.length; i += 3)
      rows.push(group.matches.slice(i, i + 3));
    return rows;
  });
}
function renderWeeklyAgenda() {
  const start = monday(state.agenda),
    end = add(start, 6),
    first = iso(start),
    last = iso(end),
    tournaments = groups(false)
      .filter((tournament) => overlap(tournament, first, last))
      .sort(
        (a, b) =>
          String(a.startDate || "").localeCompare(String(b.startDate || "")) ||
          String(a.name || a.tournamentName || "").localeCompare(
            String(b.name || b.tournamentName || ""),
            "it",
          ),
      );
  $("weeklyAgendaTitle").textContent = `Tornei · ${fmt(start)}–${fmt(end)}`;
  $("weeklyAgendaContent").innerHTML = tournaments.length
    ? `<div class="weeklyTournamentList">${tournaments
        .map(
          (tournament) =>
            `<button type="button" class="weeklyTournament ${circuit(tournament)}" data-weekly-tournament="${esc(tournamentKey(tournament))}"><span class="weeklyTournamentCircuit">${esc(circuit(tournament) === "tennis-europe" ? "Tennis Europe" : circuit(tournament).toUpperCase())}</span><strong>${esc(tournamentDisplayName(tournament))}</strong><small>${esc(tournamentLocationLabel(tournament))}</small><span>${tournament.players.map((player) => `<b>${esc(player)}</b>`).join(", ")}</span></button>`,
        )
        .join("")}</div>`
    : '<div class="empty">Nessun giocatore iscritto a tornei in questa settimana.</div>';
  document
    .querySelectorAll("[data-weekly-tournament]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          location.hash =
            "tournament/" + encodeURIComponent(button.dataset.weeklyTournament);
        }),
    );
}
function renderAgenda() {
  const key = iso(state.agenda),
    items = dedupeAgendaMatches(
      (state.data.agenda || []).filter(
        (m) => m.date === key && state.selected.has(m.playerId),
      ),
    );
  items.sort(agendaChronologicalCompare);
  $("agendaToday").textContent =
    key === iso(new Date()) ? "Oggi" : agendaBtnFmt(state.agenda);
  $("agendaGoToday").hidden = key === iso(new Date());
  renderWeeklyAgenda();
  if ($("agendaMode")) $("agendaMode").value = state.agendaMode;
  const groups = new Map();
  for (const m of items) {
    const tournament = matchTournament(m),
      identity = [
        circuit(m),
        m.competitionId ||
          tournament?.competitionId ||
          m.tournamentName ||
          tournament?.name,
      ].join("|"),
      group = groups.get(identity) || {
        tournament,
        matches: [],
        firstOrder: agendaEstimatedMinutes(m),
      };
    group.matches.push(m);
    group.matches.sort(agendaChronologicalCompare);
    group.firstOrder = Math.min(group.firstOrder, agendaEstimatedMinutes(m));
    groups.set(identity, group);
  }
  const sourceRank = { itf: 0, "tennis-europe": 1, fitp: 2 };
  const tournamentBlocks = [...groups.values()].sort(
    (a, b) =>
      (sourceRank[circuit(a.matches[0])] ?? 9) -
        (sourceRank[circuit(b.matches[0])] ?? 9) ||
      a.firstOrder - b.firstOrder ||
      String(
        a.tournament?.name || a.matches[0]?.tournamentName || "",
      ).localeCompare(
        String(b.tournament?.name || b.matches[0]?.tournamentName || ""),
        "it",
      ),
  );
  const chronologicalGroups = new Map();
  for (const m of items) {
    const estimate = agendaEstimatedMinutes(m),
      slot = Number.isFinite(estimate) ? String(estimate) : agendaTime(m),
      group = chronologicalGroups.get(slot) || {
        tournament: null,
        matches: [],
        firstOrder: estimate,
      };
    group.matches.push(m);
    group.matches.sort(agendaChronologicalCompare);
    chronologicalGroups.set(slot, group);
  }
  const chronologicalBlocks = [...chronologicalGroups.values()].sort(
    (a, b) =>
      a.firstOrder - b.firstOrder ||
      (sourceRank[circuit(a.matches[0])] ?? 9) -
        (sourceRank[circuit(b.matches[0])] ?? 9) ||
      String(
        a.tournament?.name || a.matches[0]?.tournamentName || "",
      ).localeCompare(
        String(b.tournament?.name || b.matches[0]?.tournamentName || ""),
        "it",
      ),
  );
  const isChronological = state.agendaMode === "chronological",
    blocks = isChronological ? chronologicalBlocks : tournamentBlocks;
  let chronologicalHeaderIdentity = "";
  $("dailyAgenda").innerHTML = blocks.length
    ? `<div class="agendaList">${blocks
        .map(({ tournament, matches }) => {
          const sample = matches[0],
            identities = new Set(
              matches.map((m) =>
                [
                  circuit(m),
                  m.competitionId ||
                    matchTournament(m)?.competitionId ||
                    m.tournamentName ||
                    matchTournament(m)?.name,
                ].join("|"),
              ),
            ),
            mixedChronological = isChronological && identities.size > 1,
            blockTournament =
              tournament ||
              (!mixedChronological ? matchTournament(sample) : null),
            tKey = blockTournament ? tournamentKey(blockTournament) : "",
            name = tournamentDisplayName(
              blockTournament,
              sample.tournamentName || "Torneo",
            ),
            place = agendaTournamentLocation(blockTournament, sample),
            courtConditions = tournamentSurfaceLabel(blockTournament || sample),
            source = circuit(sample),
            rows = agendaMatchRows(matches),
            blockIdentity = mixedChronological ? "" : [...identities][0] || "",
            showTournamentHead =
              !isChronological ||
              (!mixedChronological &&
                blockIdentity !== chronologicalHeaderIdentity);
          if (isChronological)
            chronologicalHeaderIdentity = mixedChronological
              ? ""
              : blockIdentity;
          return `<section class="agendaTournamentBlock ${source}${isChronological ? " chronologicalAgendaBlock" : ""}">${showTournamentHead ? `<header class="agendaTournamentHead"><div><h3>${tKey ? `<button data-open-tournament="${esc(tKey)}">${esc(name)}</button>` : `<span>${esc(name)}</span>`}<small>${esc([place, source === "tennis-europe" ? "" : courtConditions].filter(Boolean).join(" · "))}</small></h3></div><div class="agendaTournamentBadges">${agendaCircuitBadges(sample, blockTournament || sample)}</div></header>` : ""}<div class="agendaTournamentMatches">${rows
            .map(
              (row) =>
                `<div class="agendaMatchRow matches-${row.length}">${row
                  .map((m) => {
                    const x = matchMeta(m),
                      loss = m.advances === false ? " loss" : "",
                      win = m.advances === true ? " win" : "",
                      number = agendaCourtMatchNumber(m),
                      round = agendaRoundCode(m),
                      schedule = agendaSchedule(m),
                      showNumber = number && !schedule.hideNumber,
                      numberText =
                        schedule.numberText ||
                        (showNumber ? `Match n°${number}` : ""),
                      oopUrl = agendaOrderOfPlayUrl(m),
                      whenTag = oopUrl ? "a" : "div",
                      whenAttrs = oopUrl
                        ? ` href="${esc(oopUrl)}" target="_blank" rel="noopener" aria-label="Apri l'ordine di gioco ufficiale di ${esc(readableText(m.tournamentName || "questo torneo"))} per il ${esc(displayDate(m.date))}"`
                        : "",
                      itemTournament = matchTournament(m),
                      itemTKey = itemTournament
                        ? tournamentKey(itemTournament)
                        : "",
                      itemName = tournamentDisplayName(
                        itemTournament,
                        m.tournamentName || "Torneo",
                      ),
                      itemPlace = agendaTournamentLocation(itemTournament, m),
                      itemSource = circuit(m),
                      chronologicalMeta = mixedChronological
                        ? `<div class="agendaChronologicalTournament"><div>${itemTKey ? `<button data-open-tournament="${esc(itemTKey)}">${esc(itemName)}</button>` : `<span>${esc(itemName)}</span>`}<small>${esc(itemPlace)}</small></div><div class="agendaTournamentBadges">${agendaCircuitBadges(m, itemTournament || m)}</div></div>`
                        : "";
                    return `<article class="agendaItem${loss}${win}${agendaLongCourt(m) ? " agendaLongCourt" : ""}"><div class="agendaWhen"><div class="agendaRoundLabels">${round ? (oopUrl ? `<a class="type roundCode agendaRoundOopLink" ${whenAttrs.trim()}>${esc(round)}</a>` : `<span class="type roundCode">${esc(round)}</span>`) : ""}${agendaDrawCodeHtml(m, itemTournament)}</div><${whenTag} class="agendaWhenDetails${oopUrl ? " agendaWhenLink" : ""}"${whenAttrs}><small class="agendaCourtField${m.court ? "" : " agendaFieldEmpty"}">${m.court ? esc(agendaCourtName(m)) : "—"}</small>${schedule.restText ? `<small class="agendaRestLabel"><span>${esc(schedule.restText)}</span>${schedule.restDetail ? `<em>${esc(schedule.restDetail)}</em>` : ""}</small>` : ""}<small class="agendaCourtMatch${numberText ? "" : " agendaFieldEmpty"}">${numberText ? `<span>${esc(numberText)}</span>${schedule.numberDetail ? `<em>${esc(schedule.numberDetail)}</em>` : ""}` : "—"}</small><time class="${schedule.timeText ? "" : "agendaFieldEmpty"}">${schedule.timeText ? esc(schedule.timeText) : "—"}</time></${whenTag}></div><div class="agendaMatchBody">${chronologicalMeta}<div class="agendaTitle">${agendaPlayerTeamLinksHtml(m)}</div><p class="versus">${opponentHtml(m, x)}</p>${agendaResultHtml(m, x)}${x.condition ? `<p class="condition">${esc(readableText(x.condition))}</p>` : ""}</div></article>`;
                  })
                  .join("")}</div>`,
            )
            .join("")}</div></section>`;
        })
        .join("")}</div>`
    : '<div class="empty">Nessuna partita confermata per questa giornata.</div>';
  document.querySelectorAll("#dailyAgenda [data-open-tournament]").forEach(
    (x) =>
      (x.onclick = () => {
        if (String(getSelection() || "").trim()) return;
        location.hash =
          "tournament/" + encodeURIComponent(x.dataset.openTournament);
      }),
  );
  bindParticipantNavigation($("dailyAgenda"));
}
function tournamentKey(t) {
  const identity =
    t.competitionId ||
    t.itfTournamentKey ||
    t.teTournamentId ||
    String(t.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-");
  return `${identity}|${cityCountry(t.location)}|${circuit(t)}`;
}
function groups(selectedOnly = true) {
  const map = new Map();
  for (const t of state.data.tournaments || []) {
    if ((selectedOnly && !state.selected.has(t.playerId)) || !active(t))
      continue;
    const key = tournamentKey(t),
      g = map.get(key) || {
        ...t,
        people: [],
        players: [],
        playerIds: [],
        labels: [],
      };
    if (!g.people.some((p) => p.playerId === t.playerId)) g.people.push(t);
    if (t.calendarListLabel && !g.labels.includes(t.calendarListLabel))
      g.labels.push(t.calendarListLabel);
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.people.sort(
      (a, b) =>
        acceptanceRank(a) - acceptanceRank(b) ||
        acceptanceNumber(a) - acceptanceNumber(b) ||
        String(a.playerName).localeCompare(String(b.playerName)),
    );
    g.players = g.people.map((t) =>
      t.calendarListLabel
        ? `${t.playerName} ${t.calendarListLabel}`
        : t.playerName,
    );
    g.playerIds = g.people.map((t) => t.playerId);
  }
  return [...map.values()].sort(
    (a, b) =>
      circuitRank(a) - circuitRank(b) ||
      String(a.name).localeCompare(String(b.name)),
  );
}
function renderCalendar() {
  const first = new Date(
      state.month.getFullYear(),
      state.month.getMonth(),
      1,
      12,
    ),
    last = new Date(
      state.month.getFullYear(),
      state.month.getMonth() + 1,
      0,
      12,
    ),
    start = monday(first),
    monthLabel = monthFmt(first);
  if ($("calendarMonthLabel"))
    $("calendarMonthLabel").textContent =
      monthLabel.charAt(0).toLocaleUpperCase("it-IT") + monthLabel.slice(1);
  let html =
    '<div class="weekdays">' +
    ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
      .map((x) => `<b>${x}</b>`)
      .join("") +
    "</div>";
  const all = groups();
  for (let ws = new Date(start); ws <= last; ws = add(ws, 7)) {
    const we = add(ws, 6),
      a = iso(ws),
      b = iso(we),
      bars = all.filter((t) => overlap(t, a, b));
    html += `<section class="calWeek"><div class="dates">${[0, 1, 2, 3, 4, 5, 6]
      .map((i) => {
        const d = add(ws, i),
          k = iso(d),
          inCurrent = d.getMonth() === first.getMonth();
        return `<button type="button" class="calDay ${inCurrent ? "" : "out"} ${k === iso(new Date()) ? "today" : ""}" data-date="${k}" aria-label="Apri agenda del ${fmt(d)}">${d.getDate()}</button>`;
      })
      .join("")}</div><div class="bands">${bars
      .map((t) => {
        const rawS = Math.round(
            (new Date((t.startDate || a) + "T12:00:00") - ws) / 864e5,
          ),
          rawE = Math.round(
            (new Date((t.endDate || b) + "T12:00:00") - ws) / 864e5,
          ),
          s = Math.max(0, rawS),
          e = Math.min(6, rawE),
          loc = tournamentLocationLabel(t),
          players = t.players.join(", "),
          playerNamesHtml = t.players
            .map((name) => `<b>${esc(name)}</b>`)
            .join(", ");
        if (e < 0 || s > 6) return "";
        const span = e - s + 1,
          outFlags = Array.from(
            { length: span },
            (_, j) => add(ws, s + j).getMonth() !== first.getMonth(),
          ),
          fadeLeft =
            outFlags.findIndex((x) => !x) === -1
              ? span
              : outFlags.findIndex((x) => !x),
          fadeRight =
            [...outFlags].reverse().findIndex((x) => !x) === -1
              ? span
              : [...outFlags].reverse().findIndex((x) => !x),
          fullyOut = fadeLeft === span,
          fadeStyle = fullyOut
            ? ""
            : `;--fade-left:${(fadeLeft / span) * 100}%;--fade-right:${(fadeRight / span) * 100}%`,
          cls = [
            circuit(t),
            rawS >= 0 && rawS <= 6 ? "rangeStart" : "",
            rawE >= 0 && rawE <= 6 ? "rangeEnd" : "",
            rawS >= 0 && rawS <= 6 && add(ws, s).getMonth() !== first.getMonth()
              ? "startOutMonth"
              : "",
            rawE >= 0 && rawE <= 6 && add(ws, e).getMonth() !== first.getMonth()
              ? "endOutMonth"
              : "",
            fullyOut ? "outMonth" : "",
          ]
            .filter(Boolean)
            .join(" ");
        const displayName = tournamentDisplayName(t);
        return `<button class="tourBand ${cls}" style="grid-column:${s + 1}/${e + 2}${fadeStyle}" data-tournament="${esc(tournamentKey(t))}" title="${esc(displayName + " · " + loc + " · " + players + (t.playerIds.length > 3 ? " (" + t.playerIds.length + ")" : ""))}"><strong>${esc(displayName)}</strong><span>${esc(loc)} · ${playerNamesHtml}</span></button>`;
      })
      .join("")}</div></section>`;
  }
  $("calendar").innerHTML = html;
  document.querySelectorAll(".calDay[data-date]").forEach(
    (x) =>
      (x.onclick = () => {
        state.agenda = new Date(x.dataset.date + "T12:00:00");
        syncMonthFromAgenda();
        renderSynchronizedDates();
        requestAnimationFrame(() => scrollTo({ top: 0, behavior: "smooth" }));
      }),
  );
  document.querySelectorAll(".tourBand[data-tournament]").forEach(
    (x) =>
      (x.onclick = () => {
        if (
          Date.now() < suppressTournamentOpenUntil ||
          String(getSelection() || "").trim()
        )
          return;
        location.hash =
          "tournament/" + encodeURIComponent(x.dataset.tournament);
      }),
  );
}
function syncPlayersColumnHeight() {
  const calendar = $("calendarCard"),
    card = $("playersCard");
  if (!calendar || !card) return;
  const height = Math.ceil(calendar.getBoundingClientRect().height);
  card.style.maxHeight = height > 0 ? height + "px" : "";
}
function wirePlayersColumnHeight() {
  const calendar = $("calendarCard");
  if (!calendar || typeof ResizeObserver === "undefined") return;
  calendarHeightObserver?.disconnect();
  calendarHeightObserver = new ResizeObserver(syncPlayersColumnHeight);
  calendarHeightObserver.observe(calendar);
  addEventListener("resize", syncPlayersColumnHeight);
  requestAnimationFrame(syncPlayersColumnHeight);
}
function renderPlayers() {
  const ps = state.data.players || [];
  $("playerTotal").textContent = ps.length;
  $("playersList").innerHTML = ps
    .map((p) => {
      const n = (state.data.tournaments || []).filter(
          (t) => t.playerId === p.id && active(t),
        ).length,
        club = p.club || "Tesseramento da completare",
        card = p.membershipCard ? ` · tessera ${p.membershipCard}` : "";
      return `<div class="playerRow" data-profile="${esc(p.id)}"><div class="avatar">${initials(p.name)}</div><div><strong>${esc(p.name)}</strong><small>${esc(club)}${esc(card)} · ${n ? `${n} ${n === 1 ? "torneo" : "tornei"} monitorati` : "Ricerca iscrizioni in corso"}</small></div><i>›</i></div>`;
    })
    .join("");
  document.querySelectorAll("[data-profile]").forEach(
    (x) => {
      const player = ps.find((item) => item.id === x.dataset.profile),
        preloadRanking = () => player && loadCurrentPlayerRanking(player);
      x.addEventListener("pointerenter", preloadRanking, { once: true });
      x.addEventListener("touchstart", preloadRanking, { once: true, passive: true });
      (x.onclick = () => {
        if (String(getSelection() || "").trim()) return;
        openProfile(x.dataset.profile);
      });
    },
  );
}
async function searchPlayers(query) {
  const response = await fetch(
    `${PRIVATE_API}/player-search?q=${encodeURIComponent(query)}`,
    privateApiOptions({ cache: "no-store" }),
  );
  if (!response.ok) throw Error("player search");
  return (await response.json()).results || [];
}
function openPlayerSearchResult(result) {
  if (result.courtwatchId) openProfile(result.courtwatchId);
  else openCurrentOpponent(result.identity, result.name, "");
}
function playerSearchResultHtml(result, className) {
  const detail = result.courtwatchId
    ? "Court Watch"
    : readableText(result.circuit || "Giocatore");
  return `<button type="button" class="${className}" data-search-player="${esc(result.identity || result.courtwatchId)}" data-search-name="${esc(result.name)}" data-search-courtwatch="${esc(result.courtwatchId || "")}"><span><b>${esc(readablePerson(result.name))}</b>${result.nationality ? nationalityHtml(result.nationality) : ""}${result.club ? `<small>${esc(result.club)}</small>` : ""}</span><small>${esc(detail)}</small></button>`;
}
function bindPlayerSearchResults(root, results) {
  root.querySelectorAll("[data-search-player]").forEach((button) => {
    button.onclick = () => {
      const result = results.find(
        (item) =>
          String(item.identity || item.courtwatchId) ===
            button.dataset.searchPlayer &&
          readablePerson(item.name) === readablePerson(button.dataset.searchName),
      );
      if (result) openPlayerSearchResult(result);
    };
  });
}
async function renderPlayerSearchPage(query) {
  activeOpponentRouteKey = "";
  $("removeProfilePlayer").hidden = true;
  $("profileContent").innerHTML =
    `<section class="card playerSearchResults"><div class="cardHead"><div><h2>Risultati giocatori</h2><p>Ricerca: ${esc(query)}</p></div></div><div id="playerSearchPageContent"><div class="empty">Ricerca in corso…</div></div></section>`;
  $("profileView").classList.add("active");
  const routeHash = location.hash;
  try {
    const results = await searchPlayers(query);
    if (location.hash !== routeHash) return;
    const body = $("playerSearchPageContent");
    body.innerHTML = results.length
      ? results.map((result) => playerSearchResultHtml(result, "playerSearchResult")).join("")
      : '<div class="empty">Nessun giocatore trovato.</div>';
    bindPlayerSearchResults(body, results);
  } catch {
    if (location.hash === routeHash)
      $("playerSearchPageContent").innerHTML =
        '<div class="empty">Ricerca temporaneamente non disponibile.</div>';
  }
}
function statusEmoji(s) {
  return s === "green" ? "🟢" : s === "red" ? "🔴" : "🟡";
}
function renderDiagnostics() {
  if (!$("motorLight") || !$("miniStatus")) return;
  const diag = state.data.diagnostics || {},
    items = diag.items || [],
    overall = diag.overall || "yellow";
  $("motorLight").textContent = statusEmoji(overall);
  $("miniStatus").innerHTML =
    `<div class="diagLights">${items.length ? items.map((x) => `<div class="diagLight ${esc(x.status)}"><span aria-hidden="true">${statusEmoji(x.status)}</span><b>${esc(x.label)}</b></div>`).join("") : `<div class="diagLight ${esc(overall)}"><span aria-hidden="true">${statusEmoji(overall)}</span><b>Motore V3</b></div>`}</div>`;
}
function renderHome() {
  renderFilters();
  renderAgenda();
  renderCalendar();
  renderPlayers();
  renderDiagnostics();
}
function renderDataSignature(data) {
  return JSON.stringify(
    {
      today: iso(new Date()),
      players: data?.players || [],
      tournaments: data?.tournaments || [],
      matches: data?.matches || [],
      agenda: data?.agenda || [],
      results: data?.results || [],
      opponents: data?.opponents || [],
      tournamentEntries: data?.tournamentEntries || [],
    },
    (key, value) =>
      /(?:generated|updated|checked|observed|fetched|lastSeen)At$/i.test(key)
        ? undefined
        : value,
  );
}
function renderIfDataChanged() {
  const signature = renderDataSignature(state.data);
  if (signature === renderedDataSignature) {
    renderDiagnostics();
    return false;
  }
  renderedDataSignature = signature;
  if (/^#opponent(?:-profile)?\//.test(location.hash)) {
    renderDiagnostics();
    return false;
  }
  if (/^#player-search\//.test(location.hash)) {
    renderDiagnostics();
    return false;
  }
  route();
  return true;
}
function openProfile(id) {
  location.hash = "player/" + encodeURIComponent(id);
}
function openCurrentOpponent(profileId, name, event = "") {
  const identity = profileId || readablePerson(name);
  location.hash =
    "opponent-profile/" +
    encodeURIComponent(identity) +
    "/" +
    encodeURIComponent(readablePerson(name)) +
    "/" +
    encodeURIComponent(event || "-");
}
function bindParticipantNavigation(root) {
  root.querySelectorAll("[data-open-player]").forEach(
    (element) =>
      (element.onclick = (event) => {
        event.stopPropagation();
        openProfile(element.dataset.openPlayer);
      }),
  );
  const opponentLinks = [...root.querySelectorAll("[data-open-current-opponent]")];
  opponentLinks.forEach(
    (element) => {
      const preload = () =>
        preloadOpponentHistory(
          element.dataset.opponentName,
          element.dataset.opponentEvent || "",
        );
      element.addEventListener("pointerenter", preload, { once: true });
      element.addEventListener("focus", preload, { once: true });
      element.addEventListener("touchstart", preload, { once: true, passive: true });
      queueOpponentPreload(
        element.dataset.opponentName,
        element.dataset.opponentEvent || "",
      );
      (element.onclick = (event) => {
        event.stopPropagation();
        openCurrentOpponent(
          element.dataset.openCurrentOpponent,
          element.dataset.opponentName,
          element.dataset.opponentEvent || "",
        );
      });
    },
  );
}
function incompleteCompletedScore(value, status, decided = false) {
  const sets = String(value || "").match(/\d+(?:\(\d+\))?-\d+(?:\(\d+\))?/g) || [];
  if (!sets.length) return false;
  let left = 0, right = 0;
  for (const set of sets) {
    const points = set.match(/^(\d+)(?:\(\d+\))?-(\d+)/);
    if (!points) continue;
    const a = Number(points[1]), b = Number(points[2]), high = Math.max(a, b), low = Math.min(a, b), completeSet = high >= 6 && (high - low >= 2 || (high === 7 && low === 6));
    if (!completeSet) continue;
    a > b ? left++ : right++;
  }
  return Math.max(left, right) < 2;
}
function matchResultText(match) {
  const value = readableText(match?.result || match?.score || "");
  const evidence = [match?.status, match?.reason, match?.resultStatus, match?.scoreStatus, match?.retirementReason, match?.retirementStatus, match?.resultDetail, match?.resultType, match?.completedBy, match?.notes, value].filter(Boolean).join(" ");
  const retired = Boolean(match?.retired || match?.retirement || /retir|withdraw|abandon|ritir|\bret\.?\b/i.test(evidence) || incompleteCompletedScore(value, match?.status, typeof match?.advances === "boolean" || typeof match?.won === "boolean"));
  return value + (retired && !/\brit\.?\b/i.test(value) ? " Rit." : "");
}
function opponentHistoryRanking(person) {
  if (!person?.ranking) return "";
  const category = /14$/.test(person.rankingCategory || "")
    ? " U14"
    : /16$/.test(person.rankingCategory || "")
      ? " U16"
      : "";
  return `n°${person.ranking} TE${category}`;
}
function opponentHistoryRoundLabel(value, roundRobin = false) {
  const round = readableText(value || "");
  if (roundRobin || /^round\s*\d+$/i.test(round)) return "RR";
  return /round\s*robin|robin|(?:^|\b)rr(?:\b|$)|group|girone|pool/i.test(round)
    ? "RR"
    : round || "—";
}
function fullMatchRoundLabel(match, contextMatches = []) {
  const raw = readableText(
      match?.round || match?.roundName || match?.stage || match?.phase || match?.group || "",
    ),
    source = `${raw} ${match?.event || ""} ${match?.draw || ""}`,
    bonus = /bonus\s*draw/i.test(source),
    label = (value) => bonus ? `Bonus ${value}` : value;
  if (match?.roundRobin || match?.isRoundRobin || /round\s*robin|robin|(?:^|\b)rr(?:\b|$)|group|girone|pool/i.test(source))
    return label("Round robin");
  const explicitQualification = raw.match(/\bS?Q\s*(\d+)\b/i) || raw.match(/(?:qualification|qualifying)\s*round\s*(\d+)/i);
  if (explicitQualification) return label(`Qualification round ${explicitQualification[1]}`);
  const qualificationSize = Number((raw.match(/QUALIF(?:YING|ICATION)?\s+ROUND\s+OF\s+(128|64|32|16|8)/i) || [])[1]);
  if (qualificationSize) {
    const sizes = [...new Set(contextMatches.map((item) => Number((readableText(item?.round || item?.roundName || "").match(/QUALIF(?:YING|ICATION)?\s+ROUND\s+OF\s+(128|64|32|16|8)/i) || [])[1])).filter(Boolean))].sort((a, b) => b - a);
    return label(`Qualification round ${Math.max(0, sizes.indexOf(qualificationSize)) + 1}`);
  }
  if (/quarter|\bqf\b/i.test(raw)) return label("Quarter final");
  if (/semi|\bsf\b/i.test(raw)) return label("Semi final");
  if (/^f$|\bfinal\b/i.test(raw)) return label("Final");
  const mainSize = (raw.match(/(?:round\s+of|\br)\s*(128|64|32|16|8)\b/i) || [])[1];
  return label(mainSize ? `Round of ${mainSize}` : raw || "—");
}
function opponentTournamentDateLabel(tournament) {
  const start = displayDate(tournament.startDate),
    end = displayDate(tournament.endDate);
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end || "";
}
function opponentTournamentEventLinks(tournament) {
  const events = new Map();
  for (const match of tournament.matches || []) {
    const code = agendaEventCode(match);
    if (code && !events.has(code))
      events.set(code, {
        url: match.drawUrl || "",
        gender: agendaGenderClass(match),
      });
  }
  return [...events]
    .map(([code, event]) =>
      event.url
        ? `<a class="type drawCode ${esc(event.gender)} opponentTournamentDraw" href="${esc(event.url)}" target="_blank" rel="noopener">${esc(code)}</a>`
        : `<span class="type drawCode ${esc(event.gender)}">${esc(code)}</span>`,
    )
    .join("");
}
function opponentHistoryPersonHtml(person, event = "") {
  const courtWatchPlayer = courtWatchPlayerByName(person.name),
    name = courtWatchPlayer
      ? `<button type="button" class="opponentHistoryCourtWatch" data-open-player="${esc(courtWatchPlayer.id)}"><b>${esc(readablePerson(person.name))}</b></button>`
      : `<button type="button" class="opponentHistoryPersonLink" data-open-current-opponent="${esc(person.profileId || "")}" data-opponent-name="${esc(readablePerson(person.name))}" data-opponent-event="${esc(event)}"><b>${esc(readablePerson(person.name))}</b></button>`;
  return `<span class="opponentHistoryPerson">${name}${participantDesignationHtml(person.designation)}${nationalityHtml(person.nationality)}${opponentHistoryRanking(person) ? ` <span class="opponentHistoryRanking">${esc(opponentHistoryRanking(person))}</span>` : ""}</span>`;
}
function opponentHistoryMatchRowHtml(match, contextMatches = []) {
  const partners = (match.partners || [])
      .map((person) => opponentHistoryPersonHtml(person, match.event || ""))
      .join(" / "),
    opponents = (match.opponents || [])
      .map((person) => opponentHistoryPersonHtml(person, match.event || ""))
      .join(" / "),
    matchup = `${partners ? `con ${partners} ` : ""}vs ${opponents || "Avversario da definire"}`,
    outcome =
      match.status === "completed" || match.retired || match.score
        ? matchResultText(match) || "—"
        : readableText(match.status || "Programmato");
  return `<div class="opponentHistoryMatch unifiedMatchRow"><span class="opponentHistoryRound unifiedMatchMeta"><time>${esc(displayDate(match.date) || "data da pubblicare")}</time><span class="matchRoundFull">${esc(fullMatchRoundLabel(match, contextMatches))}</span></span><span class="opponentHistoryOpponent unifiedMatchOpponent">${matchup}</span><strong class="${match.won ? "win" : "loss"}">${esc(outcome)}</strong></div>`;
}
function groupedMatchSections(matches, rowHtml, doublesKey) {
  const singles = matches.filter((match) => !doublesKey(match)),
    doubles = new Map();
  for (const match of matches.filter(doublesKey)) {
    const key = doublesKey(match) || "__double__",
      group = doubles.get(key) || [];
    group.push(match);
    doubles.set(key, group);
  }
  const sections = [];
  if (singles.length)
    sections.push(
      `<section class="matchTypeSection singlesMatches"><h5 class="matchTypeHeading">Singolare</h5>${singles.map(rowHtml).join("")}</section>`,
    );
  for (const [partner, rows] of doubles)
    sections.push(
      `<section class="matchTypeSection doublesMatches"><h5 class="matchTypeHeading">Doppio${partner === "__double__" ? "" : ` con ${partner}`}</h5>${rows.map(rowHtml).join("")}</section>`,
    );
  return sections.join("");
}
function opponentHistoryMatchSectionsHtml(matches) {
  return groupedMatchSections(
    matches,
    (match) => opponentHistoryMatchRowHtml(match, matches),
    (match) =>
      (match.partners || []).length
        ? (match.partners || [])
            .map((person) => opponentHistoryPersonHtml(person, match.event || ""))
            .join(" / ")
        : "",
  );
}
function renderOpponentHistory(data) {
  const tournaments = data.tournaments || [],
    body = $("opponentTournamentHistory");
  const profileRanking = $("opponentProfileRanking"),
    profile = data.profile || null;
  if (profileRanking && profile?.ranking) {
    const category = /14$/.test(profile.category || "")
      ? " U14"
      : /16$/.test(profile.category || "")
        ? " U16"
        : "";
    profileRanking.textContent = `n°${profile.ranking} TE${category}${profile.ranking_date ? ` · (ranking del ${displayDate(profile.ranking_date)})` : ""}`;
    profileRanking.hidden = false;
  }
  const nationality = $("opponentProfileCurrentNationality");
  if (nationality && profile?.nationality) {
    nationality.innerHTML = nationalityHtml(profile.nationality);
    nationality.hidden = false;
  }
  if (!body) return;
  body.innerHTML = tournaments.length
    ? tournaments
        .map(
          (tournament) => {
            const home = tournament.competitionId
              ? `https://te.tournamentsoftware.com/tournament/${encodeURIComponent(tournament.competitionId)}`
              : "";
            const projectedTournament = (state.data?.tournaments || []).find(
                (item) =>
                  String(item.competitionId || item.sourceTournamentId || "") ===
                  String(tournament.competitionId || ""),
              ),
              courtConditions =
                tournamentSurfaceLabel(projectedTournament || tournament) ||
                tournamentSurfaceLabel(tournament);
            return `<section class="opponentHistoryTournament"><header class="opponentHistoryTournamentHead"><h4>${home ? `<a href="${esc(home)}" target="_blank" rel="noopener">${esc(readableText(tournament.name))}</a>` : esc(readableText(tournament.name))}${courtConditions ? ` <small class="tournamentSurface">${esc(courtConditions)}</small>` : ""}</h4><span class="opponentTournamentEvents">${opponentTournamentEventLinks(tournament)}</span>${opponentTournamentDateLabel(tournament) ? `<time class="opponentTournamentDates">${esc(opponentTournamentDateLabel(tournament))}</time>` : ""}</header><div class="opponentHistoryMatches">${opponentHistoryMatchSectionsHtml(tournament.matches || [])}</div></section>`;
          },
        )
        .join("")
    : '<div class="empty">Nessun torneo precedente disponibile prima di questo incontro.</div>';
  bindParticipantNavigation(body);
}
function opponentHistoryKey(name, event = "") {
  const asOf = iso(new Date()),
    requestKey = [readablePerson(name), asOf, event || ""].join("|");
  return { asOf, requestKey };
}
async function fetchOpponentHistory(name, event = "", refresh = false) {
  const { asOf, requestKey } = opponentHistoryKey(name, event);
  if (!refresh && opponentHistoryCache.has(requestKey))
    return opponentHistoryCache.get(requestKey);
  if (!opponentHistoryRequests.has(requestKey)) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    opponentHistoryRequests.set(requestKey, fetch(
      PRIVATE_API +
        "/opponent-profile?name=" +
        encodeURIComponent(name) +
        "&asOf=" +
        encodeURIComponent(asOf) +
        "&event=" +
        encodeURIComponent(event || ""),
      privateApiOptions({ cache: "no-store", signal: controller.signal }),
    ).then(async (response) => {
    if (!response.ok) throw Error("opponent history");
    const data = await response.json();
    opponentHistoryCache.set(requestKey, data);
    saveEntries(
      OPPONENT_HISTORY_CACHE,
      opponentHistoryCache,
      localStorage,
      20,
    );
      return data;
    }).finally(() => {
      clearTimeout(timer);
      opponentHistoryRequests.delete(requestKey);
    }));
  }
  return opponentHistoryRequests.get(requestKey);
}
function preloadOpponentHistory(name, event = "") {
  if (!readablePerson(name)) return;
  fetchOpponentHistory(name, event).catch(() => {});
}
function runOpponentPrefetchQueue() {
  while (opponentPrefetchActive < 6 && opponentPrefetchQueue.length) {
    const item = opponentPrefetchQueue.shift(),
      { requestKey } = opponentHistoryKey(item.name, item.event);
    opponentPrefetchQueued.delete(requestKey);
    if (opponentHistoryCache.has(requestKey)) continue;
    opponentPrefetchActive++;
    fetchOpponentHistory(item.name, item.event)
      .catch(() => {})
      .finally(() => {
        opponentPrefetchActive--;
        runOpponentPrefetchQueue();
      });
  }
}
function queueOpponentPreload(name, event = "") {
  if (!readablePerson(name)) return;
  const { requestKey } = opponentHistoryKey(name, event);
  if (
    opponentHistoryCache.has(requestKey) ||
    opponentHistoryRequests.has(requestKey) ||
    opponentPrefetchQueued.has(requestKey)
  )
    return;
  opponentPrefetchQueued.add(requestKey);
  opponentPrefetchQueue.push({ name, event });
  runOpponentPrefetchQueue();
}
async function loadOpponentHistory(name, event = "") {
  const body = $("opponentTournamentHistory"),
    routeKey = activeOpponentRouteKey,
    { requestKey } = opponentHistoryKey(name, event),
    cached = opponentHistoryCache.get(requestKey) || savedActiveOpponent(requestKey);
  if (cached && !opponentHistoryCache.has(requestKey))
    opponentHistoryCache.set(requestKey, cached);
  if (cached) renderOpponentHistory(cached);
  try {
    const data = await fetchOpponentHistory(name, event, Boolean(cached));
    if (activeOpponentRouteKey === routeKey) {
      saveActiveOpponent(requestKey, data);
      renderOpponentHistory(data);
    }
  } catch {
    if (body && !cached)
      body.innerHTML =
        `<div class="empty">Storico temporaneamente non disponibile. <button type="button" class="btn" data-retry-opponent>Riprova</button></div>`;
    body?.querySelector("[data-retry-opponent]")?.addEventListener("click", () =>
      loadOpponentHistory(name, event),
    );
  }
}
function renderOpponentFromMatch(identity, matchId, index, role = "opponent") {
  const sources = [...(state.data.matches || []), ...(state.data.agenda || [])],
    match =
      sources.find(
        (row) => String(row.matchId || row.id || "") === String(matchId),
      ) || null;
  if (!match) {
    location.hash = "";
    return;
  }
  const partner = role === "partner",
    names = partner
      ? String(match.partner || "").split(/\s*\/\s*/)
      : match.opponentOptions?.length
        ? match.opponentOptions
        : String(match.opponent || "").split(/\s*\/\s*/),
    name = readablePerson(names[index] || names[0] || identity),
    nationality = partner
      ? (match.partnerNationalities || [])[index] || ""
      : (match.opponentNationalities || [match.opponentNationality || ""])[index] || "",
    event = match.event || match.draw || "";
  renderOpponentProfile(identity, name, event, nationality);
}
function renderOpponentProfile(identity, name, event = "", initialNationality = "") {
  const routeKey = [identity, readablePerson(name), event].join("|");
  if (activeOpponentRouteKey === routeKey && $("profileView").classList.contains("active") && $("opponentTournamentHistory")) return;
  activeOpponentRouteKey = routeKey;
  const { requestKey } = opponentHistoryKey(name, event),
    prepared = opponentHistoryCache.get(requestKey) || savedActiveOpponent(requestKey),
    flag = nationalityHtml(initialNationality || prepared?.profile?.nationality),
    follow = $("removeProfilePlayer");
  follow.hidden = false;
  follow.textContent = "Segui giocatore";
  follow.title = "Segui giocatore";
  follow.setAttribute("aria-label", "Segui giocatore");
  $("profileContent").innerHTML =
    `<div class="card opponentProfileHero"><div class="opponentProfileIdentity"><h2>${esc(readablePerson(name))}</h2><span id="opponentProfileCurrentNationality" class="opponentProfileNationality"${flag ? "" : " hidden"}>${flag}</span><span id="opponentProfileRanking" class="opponentProfileRanking" hidden></span></div></div><div class="card opponentHistoryPlaceholder"><div class="cardHead"><h3>Ultimi 5 tornei</h3></div><div id="opponentTournamentHistory"></div><p class="opponentFollowHint"><button type="button" data-follow-opponent>Per vedere tutti i tornei segui giocatore</button></p></div>`;
  $("homeView").classList.remove("active");
  $("profileView").classList.add("active");
  $("profileContent").querySelector("[data-follow-opponent]")?.addEventListener("click", (event) => {
    event.preventDefault();
    follow.scrollIntoView({ behavior: "smooth", block: "center" });
    follow.focus({ preventScroll: true });
  });
  if (prepared) {
    opponentHistoryCache.set(requestKey, prepared);
    renderOpponentHistory(prepared);
  }
  loadOpponentHistory(name, event);
}
function renderProfile(id) {
  activeOpponentRouteKey = "";
  const p = state.data.players.find((x) => x.id === id);
  if (!p) {
    location.hash = "";
    return;
  }
  const ts = (state.data.tournaments || []).filter(
      (t) => t.playerId === id && active(t),
    ),
    ms = (state.data.matches || []).filter((m) => m.playerId === id),
    keyOf = (x) =>
      circuit(x) +
      "|" +
      String(x.competitionId || x.tournamentName || x.name || ""),
    byTournament = new Map();
  for (const t of ts) byTournament.set(keyOf(t), { t, matches: [] });
  for (const m of ms) {
    const key = keyOf(m),
      group = byTournament.get(key) || {
        t: {
          name: m.tournamentName,
          competitionId: m.competitionId,
          location: m.location || "",
          startDate: m.date,
          endDate: m.date,
          circuit: m.circuit,
          playerId: id,
        },
        matches: [],
      };
    group.matches.push(m);
    byTournament.set(key, group);
  }
  const sections = [...byTournament.values()]
    .sort(
      (a, b) =>
        String(b.t.startDate || b.matches[0]?.date || "").localeCompare(
          String(a.t.startDate || a.matches[0]?.date || ""),
        ) || String(a.t.name || "").localeCompare(String(b.t.name || ""), "it"),
    )
    .map(({ t, matches }) => {
      matches.sort(
        (a, b) =>
          String(a.date || "").localeCompare(String(b.date || "")) ||
          String(a.time || "99:99").localeCompare(String(b.time || "99:99")),
      );
      const tKey = (state.data.tournaments || []).includes(t)
          ? tournamentKey({
              ...t,
              people: [t],
              players: [p.name],
              playerIds: [id],
            })
          : "",
        summerCenter = fitpSummerCenterPlace(t),
        venue = summerCenter
          ? ""
          : readableText(t.venueName || t.clubName || t.club || ""),
        place = summerCenter || cityCountry(t.location),
        courtConditions = tournamentSurfaceLabel(t);
      return `<section class="profileTournament" data-profile-tournament="${esc(keyOf(t))}"><div class="profileTournamentHead">${tKey ? `<h3><i class="sourceDot ${circuit(t)}"></i><button data-open-tournament="${esc(tKey)}">${esc(t.name || "Torneo")}</button></h3>` : `<h3><i class="sourceDot ${circuit(t)}"></i>${esc(t.name || "Torneo")}</h3>`}<p>${venue ? esc(venue) + " · " : ""}${esc([place, courtConditions].filter(Boolean).join(" · "))} · ${esc(displayDate(t.startDate))} – ${esc(displayDate(t.endDate))}${t.calendarListLabel ? ` · ${circuit(t) === "tennis-europe" ? "Acceptance list: " : ""}${esc(t.calendarListLabel)}` : ""}</p></div><div class="profileTournamentMatches">${
        matches.length
          ? matchHistorySectionsHtml(matches)
          : '<div class="empty">Nessuna partita pubblicata.</div>'
      }</div></section>`;
    })
    .join("");
  $("profileContent").innerHTML =
    `<div class="card profileHero"><div class="avatar big">${initials(p.name)}</div><div><h2>${esc(p.name)}</h2><p>${esc(p.club || "Tesseramento da completare")}${playerBirthLabel(p) ? " · " + esc(playerBirthLabel(p)) : " "}${p.membershipCard ? " · tessera " + esc(p.membershipCard) : ""}${playerRankingSummary(p)}</p></div></div><div class="card profileTournamentList"><div class="cardHead"><h3>Tornei</h3><span>${byTournament.size}</span></div>${sections || '<div class="empty">Nessun torneo pubblicato.</div>'}</div>`;
  loadCurrentPlayerRanking(p);
  $("profileContent")
    .querySelectorAll("[data-open-tournament]")
    .forEach(
      (x) =>
        (x.onclick = () =>
          (location.hash =
            "tournament/" + encodeURIComponent(x.dataset.openTournament))),
    );
  bindParticipantNavigation($("profileContent"));
  $("homeView").classList.remove("active");
  $("profileView").classList.add("active");
}
function matchHistoryRowHtml(m, contextMatches = []) {
  const x = matchMeta(m),
    result = matchResultText(m),
    outcome = m.advances === true ? "win" : m.advances === false ? "loss" : "",
    round = fullMatchRoundLabel(m, contextMatches);
  return `<div class="opponentHistoryMatch unifiedMatchRow matchWithAnalysis">${matchAnalysisButton(m)}<span class="opponentHistoryRound unifiedMatchMeta"><time>${esc(displayDate(m.date) || "data da pubblicare")}</time><span class="matchRoundFull">${esc(round)}</span></span><span class="opponentHistoryOpponent unifiedMatchOpponent"><span>${opponentHtml(m, x)}</span></span><strong class="result ${outcome}">${result ? esc(result) : ""}</strong></div>`;
}
function matchHistorySectionsHtml(matches) {
  return groupedMatchSections(
    matches,
    (match) => matchHistoryRowHtml(match, matches),
    (match) =>
      matchMeta(match).isDouble
        ? match.partner
          ? partnerHtml(match)
          : "__double__"
        : "",
  );
}
function tournamentOfficialUrl(t) {
  const source = circuit(t),
    id = String(t.competitionId || "").trim(),
    url = String(t.sourceUrl || "").trim();
  if (source === "tennis-europe" && id)
    return `https://te.tournamentsoftware.com/tournament/${encodeURIComponent(id)}`;
  return url;
}
function tournamentDrawUrl(t, m) {
  const explicit = readableText(
    m?.drawUrl || m?.drawsUrl || m?.eventUrl || m?.drawSourceUrl || "",
  );
  if (/^https?:\/\//i.test(explicit)) return explicit;
  const source = readableText(m?.sourceUrl || "");
  if (/^https?:\/\//i.test(source) && /(?:draw|tabellon)/i.test(source))
    return source;
  const official = tournamentOfficialUrl(t);
  if (circuit(t) === "itf" && official)
    return official.replace(/\/?$/, "/draws-and-results/");
  return official;
}
function drawCodeOrder(code) {
  const kind = String(code || "")
    .toUpperCase()
    .charAt(1);
  return kind === "S" ? 0 : kind === "D" ? 1 : 2;
}
function agendaDrawCodeHtml(m, t) {
  const code = agendaEventCode(m);
  if (!code) return "";
  const url = tournamentDrawUrl(t || matchTournament(m) || m, m),
    gender = agendaGenderClass(m);
  return url
    ? `<a class="type drawCode ${esc(gender)} tournamentDrawLink" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Apri tabellone ${esc(code)}">${esc(code)}</a>`
    : `<span class="type drawCode ${esc(gender)}">${esc(code)}</span>`;
}
function tournamentDrawLinks(t, matches) {
  const draws = new Map();
  for (const m of matches) {
    const code = agendaEventCode(m);
    if (!code) continue;
    const url = tournamentDrawUrl(t, m),
      current = draws.get(code);
    if (!current || (!current.url && url))
      draws.set(code, { code, url, gender: agendaGenderClass(m) });
  }
  return [...draws.values()]
    .sort(
      (a, b) =>
        drawCodeOrder(a.code) - drawCodeOrder(b.code) ||
        a.code.localeCompare(b.code, "it"),
    )
    .map((draw) =>
      draw.url
        ? `<a class="type drawCode ${esc(draw.gender)} tournamentDrawLink" href="${esc(draw.url)}" target="_blank" rel="noopener" aria-label="Apri tabellone ${esc(draw.code)}">${esc(draw.code)}</a>`
        : `<span class="type drawCode ${esc(draw.gender)}">${esc(draw.code)}</span>`,
    )
    .join("");
}
function tournamentAcceptanceUrl(t) {
  if (circuit(t) !== "tennis-europe") return "";
  const explicit = String(t.acceptanceListUrl || "").trim(),
    source = String(t.sourceUrl || "").trim(),
    id = String(t.competitionId || "").trim();
  if (explicit) return explicit;
  if (/acceptancelist/i.test(source)) return source;
  return id
    ? `https://te.tournamentsoftware.com/sport/acceptancelist.aspx?id=${encodeURIComponent(id)}`
    : "";
}
function itfAcceptanceListUrl(t, entry) {
  if (circuit(t) !== "itf") return "";
  const status =
    `${entry?.calendarState || ""} ${entry?.entryStatus || ""}`.toLowerCase();
  if (
    status.includes("draw_confirmed") ||
    status.includes("official_draw") ||
    entry?.acceptanceListPublished === false
  )
    return "";
  const start = String(
    entry?.qualificationStartDate ||
      t?.qualificationStartDate ||
      entry?.startDate ||
      t?.startDate ||
      "",
  ).slice(0, 10);
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(start) &&
    iso(new Date()) >= iso(add(new Date(start + "T12:00:00"), -1))
  )
    return "";
  const explicit = String(
      entry?.acceptanceListUrl || t?.acceptanceListUrl || "",
    ).trim(),
    source = String(entry?.sourceUrl || t?.sourceUrl || "").trim(),
    base =
      explicit || (source ? source.replace(/\/?$/, "/acceptance-list/") : "");
  if (!base) return "";
  const matchingEntry = (state.data?.tournamentEntries || []).find(
      (item) =>
        String(item.competitionId || "") === String(t?.competitionId || "") &&
        String(item.playerId || "") ===
          String(entry?.playerId || t?.playerId || ""),
    ),
    gender = readableText(entry?.gender || matchingEntry?.gender || "");
  if (!/^girls?$/i.test(gender)) return base;
  try {
    const url = new URL(base);
    url.searchParams.set("entryType", "Girls");
    return url.toString();
  } catch {
    return base;
  }
}
function tournamentMapsUrl(place) {
  const query = readableText(place);
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "";
}

function tournamentSurfaceLabel(t, includeNameDuplicates = false) {
  const surface = readableText(t.surface || t.courtSurface || t.playingSurface || ""),
    environment = readableText(t.environment || t.courtEnvironment || (t.indoor === true ? "Indoor" : t.outdoor === true ? "Outdoor" : "")),
    name = readableText(t.name || t.tournamentName || ""),
    parts = [surface, environment]
      .filter((value, index, list) => value && list.findIndex(x => x.toLowerCase() === value.toLowerCase()) === index)
      .filter(value => includeNameDuplicates || !name.toLowerCase().includes(value.toLowerCase()));
  return parts.join(" · ");
}

function renderTournament(key) {
  $("removeProfilePlayer").hidden = true;
  const t = groups(false).find((x) => tournamentKey(x) === key);
  if (!t) {
    location.hash = "";
    return;
  }
  if (tournamentPageKey !== key) {
    tournamentPageKey = key;
    openTournamentPlayerKeys.clear();
    saveUiState();
  }
  const source = circuit(t),
    matches = (state.data.matches || [])
      .filter(
        (m) =>
          circuit(m) === source &&
          (t.competitionId && m.competitionId
            ? String(m.competitionId) === String(t.competitionId)
            : readableText(m.tournamentName) === readableText(t.name)),
      )
      .sort(
        (a, b) =>
          String(a.playerName || "").localeCompare(
            String(b.playerName || ""),
          ) ||
          String(a.date || "").localeCompare(String(b.date || "")) ||
          String(a.time || "99:99").localeCompare(String(b.time || "99:99")),
      ),
    byPlayer = new Map();
  for (const person of t.people || [])
    byPlayer.set(person.playerId, {
      playerId: person.playerId,
      playerName: person.playerName,
      entry: person,
      matches: [],
    });
  for (const m of matches) {
    const group = byPlayer.get(m.playerId) || {
      playerId: m.playerId,
      playerName: m.playerName,
      matches: [],
    };
    group.matches.push(m);
    byPlayer.set(m.playerId, group);
  }
  const multiPlayer = (t.playerIds || []).length > 1 || byPlayer.size > 1;
  const sections = [...byPlayer.values()]
    .map((group) => {
      const rows = group.matches;
      const playerKey = key + "|" + group.playerId,
        open = !multiPlayer || openTournamentPlayerKeys.has(playerKey),
        liveLabel =
          ["itf", "tennis-europe"].includes(source) &&
          group.entry?.calendarListLabel &&
          !String(group.entry?.calendarState || "")
            .toLowerCase()
            .includes("draw_confirmed") &&
          !String(group.entry?.entryStatus || "")
            .toLowerCase()
            .includes("official_draw")
            ? group.entry.calendarListLabel
            : "",
        itfAcceptanceUrl = liveLabel
          ? itfAcceptanceListUrl(t, group.entry)
          : "";
      const playerRecord = (state.data.players || []).find(
          (player) => player.id === group.playerId,
        ),
        playerNationality =
          group.entry?.nationality ||
          rows.find((row) => row.sourceNationality)?.sourceNationality ||
          rows.find((row) => row.playerNationality)?.playerNationality ||
          monitoredNationality(group.playerId),
        tournamentTeRanking = [...rows]
          .sort((a, b) =>
            String(a.date || "").localeCompare(String(b.date || "")),
          )
          .find((row) => row.playerTeRanking)?.playerTeRanking,
        playerRanking =
          source === "tennis-europe"
            ? tournamentTeRanking
            : source === "fitp"
              ? playerRecord?.ranking
              : "";
      const matchRows = matchHistorySectionsHtml(rows);
      return `<section class="tournamentPlayer" data-tournament-player="${esc(playerKey)}"><div class="playerSectionHead${multiPlayer ? " expandableTournamentPlayer" : ""}"><button class="inlinePlayerLink" data-open-player="${esc(group.playerId)}">${esc(readablePerson(group.playerName))}${participantDesignationHtml(participantDesignation(rows.find(row => participantDesignation(row, "player")), "player"))}${nationalityHtml(playerNationality)}${playerRanking ? (source === "tennis-europe" ? teRankHtml(playerRanking) : ` <span class="playerRanking">· classifica ${esc(readableText(playerRanking))}</span>`) : ""}</button><span>${liveLabel ? `<b class="acceptanceLiveLabel">${itfAcceptanceUrl ? `<a class="acceptanceListTextLink" href="${esc(itfAcceptanceUrl)}" target="_blank" rel="noopener">Acceptance list</a>` : "Acceptance list"}: ${esc(liveLabel)}</b>` : rows.length ? `${rows.length} ${rows.length === 1 ? "partita" : "partite"}` : "Iscritto"}</span>${multiPlayer && rows.length ? '<button class="tournamentToggle tournamentPlayerToggle" type="button" aria-expanded="' + String(open) + '" aria-label="' + (open ? "Nascondi partite" : "Mostra partite") + '">⌄</button>' : ""}</div><div class="tournamentPlayerMatches"${open ? "" : " hidden"}>${matchRows}</div></section>`;
    })
    .join("");
  const officialUrl = tournamentOfficialUrl(t),
    acceptanceUrl = tournamentAcceptanceUrl(t),
    place = tournamentPlace(t, matches),
    mapsUrl = tournamentMapsUrl(place),
    title = officialUrl
      ? `<a class="tournamentOfficialTitle" href="${esc(officialUrl)}" target="_blank" rel="noopener">${esc(t.name)}</a>`
      : esc(t.name),
    acceptanceLink = acceptanceUrl
      ? `<a class="btn tournamentAcceptanceLink" href="${esc(acceptanceUrl)}" target="_blank" rel="noopener" aria-label="Apri Acceptance List"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01"/></svg><span>Acceptance List</span></a>`
      : "",
    drawLinks = tournamentDrawLinks(t, matches),
    surfaceLabel = tournamentSurfaceLabel(t);
  $("profileContent").innerHTML =
    `<div class="card tournamentHero"><div><h2>${title}</h2>${surfaceLabel ? `<p class="tournamentSurface">${esc(surfaceLabel)}</p>` : ""}<p>📍 ${mapsUrl ? `<a class="tournamentMapsLink" href="${esc(mapsUrl)}" target="_blank" rel="noopener">${esc(place)}</a>` : esc(place)}</p><p>📅 ${esc(displayDate(t.startDate) || "data da pubblicare")} – ${esc(displayDate(t.endDate) || "data da pubblicare")}</p></div><div class="tournamentHeroActions">${acceptanceLink}<div class="tournamentDraws"><b>Tabelloni:</b><span>${drawLinks || "—"}</span></div></div></div><div class="card tournamentMatches">${sections || '<div class="empty">Nessun match ancora pubblicato per i nostri giocatori.</div>'}</div>`;
  bindParticipantNavigation($("profileContent"));
  if (multiPlayer)
    $("profileContent")
      .querySelectorAll("[data-tournament-player]:has(.tournamentPlayerToggle)")
      .forEach((section) => {
        const head = section.querySelector(".playerSectionHead"),
          body = section.querySelector(".tournamentPlayerMatches"),
          toggle = section.querySelector(".tournamentPlayerToggle"),
          playerKey = section.dataset.tournamentPlayer,
          setOpen = (open) => {
            body.hidden = !open;
            if (open) openTournamentPlayerKeys.add(playerKey);
            else openTournamentPlayerKeys.delete(playerKey);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute(
              "aria-label",
              open ? "Nascondi partite" : "Mostra partite",
            );
            saveUiState();
          };
        toggle.onclick = (e) => {
          e.stopPropagation();
          setOpen(body.hidden);
        };
        head.tabIndex = 0;
        head.setAttribute("role", "button");
        head.setAttribute(
          "aria-label",
          "Mostra o nascondi le partite del giocatore",
        );
        head.onclick = (e) => {
          if (e.target.closest("button,a")) return;
          setOpen(body.hidden);
        };
        head.onkeydown = (e) => {
          if (
            (e.key === "Enter" || e.key === " ") &&
            !e.target.closest("button,a")
          ) {
            e.preventDefault();
            setOpen(body.hidden);
          }
        };
      });
  $("homeView").classList.remove("active");
  $("profileView").classList.add("active");
}
const renderProfileWithoutStats = renderProfile;
let profileCircuitFilter = "all",
  profileMatchTypeFilter = "all",
  profileOutcomeFilter = "all",
  profileFilterPlayerId = String(restoredUi.profilePlayerId || "");
let openProfileTournamentKeys = new Set(
  Array.isArray(restoredUi.openProfileTournamentKeys)
    ? restoredUi.openProfileTournamentKeys
    : [],
);
renderProfile = function (id) {
  const remove = $("removeProfilePlayer");
  remove.hidden = false;
  remove.textContent = "Rimuovi giocatore";
  remove.title = "Rimuovi giocatore";
  remove.setAttribute("aria-label", "Rimuovi giocatore");
  if (profileFilterPlayerId !== id) {
    profileCircuitFilter = "all";
    profileMatchTypeFilter = "all";
    profileOutcomeFilter = "all";
    openProfileTournamentKeys.clear();
    profileFilterPlayerId = id;
  }
  renderProfileWithoutStats(id);
  const matches = (state.data.matches || []).filter((m) => m.playerId === id),
    hero = $("profileContent").querySelector(".profileHero"),
    list = $("profileContent").querySelector(".profileTournamentList"),
    head = list?.querySelector(".cardHead");
  if (!document.querySelector("#profileStatsStyle"))
    document.head.insertAdjacentHTML(
      "beforeend",
      '<style id="profileStatsStyle">.profileStats{margin-left:auto;display:grid;grid-template-columns:repeat(3,minmax(66px,1fr));gap:8px}.profileStats button{min-width:66px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:#fafafa;text-align:center;cursor:pointer}.profileStats button.active{border-color:var(--blue);box-shadow:0 0 0 2px var(--blueSoft)}.profileStats strong,.profileStats span{display:block}.profileStats strong{font-size:20px;line-height:1.1}.profileStats span{margin-top:2px;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.profileStats .won strong{color:var(--green)}.profileStats .lost strong{color:var(--red)}.profileMatchFilter{margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.profileMatchFilter label{font-size:11px;color:var(--muted)}.profileMatchFilter select{border:1px solid var(--line);border-radius:8px;background:#fff;padding:6px 28px 6px 9px;font:inherit}.profileTournamentHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center}.profileTournamentHead>p{grid-column:1}.tournamentStats{grid-column:2;grid-row:1/span 2;display:flex;align-items:center;gap:8px}.tournamentStats span{font-size:10px;color:var(--muted);white-space:nowrap}.tournamentStats b{font-size:12px;color:var(--ink)}.tournamentToggle{width:30px;height:30px;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:pointer;font-size:16px}.tournamentToggle[aria-expanded="true"]{transform:rotate(180deg)}@media(max-width:650px){.profileHero{align-items:flex-start;flex-wrap:wrap}.profileStats{width:100%;margin-left:0}.profileStats button{min-width:0}.profileTournamentList>.cardHead{align-items:flex-start;flex-wrap:wrap}.profileMatchFilter{width:100%;margin-left:0}.profileMatchFilter select{flex:1;min-width:120px}.profileTournamentHead{grid-template-columns:1fr}.profileTournamentHead>p,.tournamentStats{grid-column:1;grid-row:auto}.tournamentStats{justify-content:space-between}}</style>',
    );
  if (hero)
    hero.insertAdjacentHTML(
      "beforeend",
      '<div class="profileStats" aria-label="Filtra le partite per esito"><button data-outcome="all"><strong data-stat="all">0</strong><span>Tutte</span></button><button class="won" data-outcome="win"><strong data-stat="won">0</strong><span>Vinte</span></button><button class="lost" data-outcome="loss"><strong data-stat="lost">0</strong><span>Perse</span></button></div>',
    );
  if (head)
    head.insertAdjacentHTML(
      "beforeend",
      '<div class="profileMatchFilter"><label for="profileCircuitFilter">Circuito</label><select id="profileCircuitFilter"><option value="all">Tutti</option><option value="fitp">FITP</option><option value="tennis-europe">Tennis Europe</option><option value="itf">ITF</option></select><label for="profileMatchTypeFilter">Partita</label><select id="profileMatchTypeFilter"><option value="all">Singolo e doppio</option><option value="singles">Singolo</option><option value="doubles">Doppio</option></select></div>',
    );
  for (const section of list?.querySelectorAll(".profileTournament") || []) {
    const items = [...section.querySelectorAll(".unifiedMatchRow")],
      wins = items.filter((x) => x.querySelector(".result.win")).length,
      losses = items.filter((x) => x.querySelector(".result.loss")).length,
      body = section.querySelector(".profileTournamentMatches"),
      sectionHead = section.querySelector(".profileTournamentHead"),
      sectionKey = section.dataset.profileTournament || "";
    if (body) body.hidden = !openProfileTournamentKeys.has(sectionKey);
    if (sectionHead)
      sectionHead.insertAdjacentHTML(
        "beforeend",
        `<div class="tournamentStats" aria-label="Statistiche del torneo"><span><b>${wins + losses}</b> giocate</span><span><b>${wins}</b> vinte</span><span><b>${losses}</b> perse</span><button class="tournamentToggle" type="button" aria-expanded="false" aria-label="Mostra partite">⌄</button></div>`,
      );
    const toggle = section.querySelector(".tournamentToggle"),
      setOpen = (open) => {
        if (!body || !toggle) return;
        body.hidden = !open;
        if (sectionKey) {
          if (open) openProfileTournamentKeys.add(sectionKey);
          else openProfileTournamentKeys.delete(sectionKey);
        }
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute(
          "aria-label",
          open ? "Nascondi partite" : "Mostra partite",
        );
        saveUiState();
      };
    if (toggle && body) {
      setOpen(!body.hidden);
      toggle.onclick = (e) => {
        e.stopPropagation();
        setOpen(body.hidden);
      };
    }
    if (sectionHead && body) {
      sectionHead.classList.add("expandableTournamentRow");
      sectionHead.tabIndex = 0;
      sectionHead.setAttribute("role", "button");
      sectionHead.setAttribute(
        "aria-label",
        "Mostra o nascondi le partite del torneo",
      );
      sectionHead.onclick = (e) => {
        if (e.target.closest("button,a,select")) return;
        setOpen(body.hidden);
      };
      sectionHead.onkeydown = (e) => {
        if (
          (e.key === "Enter" || e.key === " ") &&
          !e.target.closest("button,a,select")
        ) {
          e.preventDefault();
          setOpen(body.hidden);
        }
      };
    }
  }
  const circuitSelect = $("profileCircuitFilter"),
    typeSelect = $("profileMatchTypeFilter"),
    applyFilter = () => {
      profileCircuitFilter = circuitSelect?.value || "all";
      profileMatchTypeFilter = typeSelect?.value || "all";
      let visibleTournaments = 0;
      for (const section of list?.querySelectorAll(".profileTournament") ||
        []) {
        const source =
            [...(section.querySelector(".sourceDot")?.classList || [])].find(
              (x) => x === "fitp" || x === "tennis-europe" || x === "itf",
            ) || "",
          circuitVisible =
            profileCircuitFilter === "all" || source === profileCircuitFilter,
          items = [...section.querySelectorAll(".unifiedMatchRow")];
        let visibleMatches = 0;
        for (const item of items) {
          const isDouble = /Doppio/i.test(
              item.querySelector(".matchType")?.textContent || "",
            ),
            typeVisible =
              profileMatchTypeFilter === "all" ||
              (profileMatchTypeFilter === "doubles" && isDouble) ||
              (profileMatchTypeFilter === "singles" && !isDouble),
            outcomeVisible =
              profileOutcomeFilter === "all" ||
              (profileOutcomeFilter === "win" &&
                Boolean(item.querySelector(".result.win"))) ||
              (profileOutcomeFilter === "loss" &&
                Boolean(item.querySelector(".result.loss")));
          item.hidden = !(typeVisible && outcomeVisible);
          if (!item.hidden) visibleMatches++;
        }
        section.querySelectorAll(".matchTypeSection").forEach(
          (matchSection) =>
            (matchSection.hidden = ![
              ...matchSection.querySelectorAll(".unifiedMatchRow"),
            ].some((row) => !row.hidden)),
        );
        const visible =
          circuitVisible &&
          (visibleMatches > 0 ||
            (items.length === 0 &&
              profileMatchTypeFilter === "all" &&
              profileOutcomeFilter === "all"));
        section.hidden = !visible;
        if (visible) visibleTournaments++;
      }
      const base = matches.filter(
          (m) =>
            (profileCircuitFilter === "all" ||
              circuit(m) === profileCircuitFilter) &&
            (profileMatchTypeFilter === "all" ||
              (profileMatchTypeFilter === "doubles" && matchMeta(m).isDouble) ||
              (profileMatchTypeFilter === "singles" && !matchMeta(m).isDouble)),
        ),
        wins = base.filter((m) => m.advances === true).length,
        losses = base.filter((m) => m.advances === false).length;
      hero
        ?.querySelector('[data-stat="all"]')
        ?.replaceChildren(String(base.length));
      hero?.querySelector('[data-stat="won"]')?.replaceChildren(String(wins));
      hero
        ?.querySelector('[data-stat="lost"]')
        ?.replaceChildren(String(losses));
      hero
        ?.querySelectorAll("[data-outcome]")
        .forEach((x) =>
          x.classList.toggle(
            "active",
            x.dataset.outcome === profileOutcomeFilter,
          ),
        );
      const count = head?.querySelector(":scope > span");
      if (count) count.textContent = String(visibleTournaments);
    };
  if (circuitSelect) {
    circuitSelect.value = profileCircuitFilter;
    circuitSelect.onchange = applyFilter;
  }
  if (typeSelect) {
    typeSelect.value = profileMatchTypeFilter;
    typeSelect.onchange = applyFilter;
  }
  hero?.querySelectorAll("[data-outcome]").forEach(
    (x) =>
      (x.onclick = () => {
        profileOutcomeFilter = x.dataset.outcome;
        applyFilter();
      }),
  );
  applyFilter();
};
function route() {
  const player = location.hash.match(/^#player\/(.+)$/),
    currentOpponent = location.hash.match(
      /^#opponent-profile\/([^/]+)\/([^/]+)\/([^/]+)$/,
    ),
    opponent = location.hash.match(
      /^#opponent\/(opponent|partner)\/([^/]+)\/([^/]+)\/(\d+)$/,
    ),
    legacyOpponent = location.hash.match(
      /^#opponent\/([^/]+)\/([^/]+)\/(\d+)$/,
    ),
    playerSearch = location.hash.match(/^#player-search\/(.+)$/),
    tournament = location.hash.match(/^#tournament\/(.+)$/),
    primaryView = location.hash.match(/^#(agenda|calendar|players)$/)?.[1] || "home";
  const isHomeRoute = !location.hash;
  $("quickSectionNav").hidden = isHomeRoute;
  $("homeOthers").hidden = !isHomeRoute;
  document.querySelectorAll("#quickSectionNav [data-home-route]").forEach(
    (button) =>
      button.classList.toggle(
        "active",
        location.hash === `#${button.dataset.homeRoute}`,
      ),
  );
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  if (!player) {
    profileYearFilter = String(new Date().getFullYear());
    profileStatusPlayerId = "";
  }
  if (!tournament && tournamentPageKey) {
    tournamentPageKey = "";
    openTournamentPlayerKeys.clear();
    saveUiState();
  }
  if (playerSearch) renderPlayerSearchPage(decodeURIComponent(playerSearch[1]));
  else if (player && state.data) renderProfile(decodeURIComponent(player[1]));
  else if (currentOpponent)
    renderOpponentProfile(
      decodeURIComponent(currentOpponent[1]),
      decodeURIComponent(currentOpponent[2]),
      decodeURIComponent(currentOpponent[3]) === "-"
        ? ""
        : decodeURIComponent(currentOpponent[3]),
    );
  else if ((opponent || legacyOpponent) && state.data) {
    const routeMatch = opponent || legacyOpponent;
    renderOpponentFromMatch(
      decodeURIComponent(routeMatch[opponent ? 2 : 1]),
      decodeURIComponent(routeMatch[opponent ? 3 : 2]),
      Number(routeMatch[opponent ? 4 : 3]),
      opponent ? routeMatch[1] : "opponent",
    );
  }
  else {
    if (profileFilterPlayerId) {
      profileFilterPlayerId = "";
      openProfileTournamentKeys.clear();
      saveUiState();
    }
    if (tournament && state.data)
      renderTournament(decodeURIComponent(tournament[1]));
    else {
      $(`${primaryView}View`).classList.add("active");
      if (state.data) renderHome();
    }
  }
}
function syncMonthFromAgenda() {
  state.month = new Date(
    state.agenda.getFullYear(),
    state.agenda.getMonth(),
    1,
    12,
  );
}
function moveBothToMonth(year, month) {
  const day = Math.min(
    state.agenda.getDate(),
    new Date(year, month + 1, 0).getDate(),
  );
  state.month = new Date(year, month, 1, 12);
  state.agenda = new Date(year, month, day, 12);
}
function renderSynchronizedDates() {
  saveUiState();
  renderAgenda();
  renderCalendar();
}
function renderDatePopover() {
  const pop = $("datePopover"),
    year = state.pickerYear,
    month = state.pickerMonth;
  if (state.pickerView === "years") {
    const start = Math.floor(year / 12) * 12,
      past = start - 1,
      future = start + 12;
    pop.innerHTML = `<div class="pickerHead"><button class="btn icon" data-range="-12">‹</button><strong>${start}–${future - 1}</strong><button class="btn icon" data-range="12">›</button></div><div class="pickerGrid years">${Array.from({ length: 12 }, (_, i) => `<button class="pickerChoice${start + i === state.agenda.getFullYear() ? " selected" : ""}" data-year="${start + i}">${start + i}</button>`).join("")}</div><div class="pickerEdges"><button data-year="${past}">${past}</button><button data-year="${future}">${future}</button></div>`;
  } else if (state.pickerView === "months") {
    pop.innerHTML = `<div class="pickerHead"><button class="pickerBack">← Anni</button><strong>${year}</strong><span></span></div><div class="pickerGrid months">${Array.from({ length: 12 }, (_, i) => `<button class="pickerChoice${year === state.agenda.getFullYear() && i === state.agenda.getMonth() ? " selected" : ""}" data-month="${i}">${new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date(year, i, 1))}</button>`).join("")}</div>`;
  } else {
    const first = new Date(year, month, 1, 12),
      start = monday(first),
      last = new Date(year, month + 1, 0, 12);
    pop.innerHTML = `<div class="pickerHead"><button class="pickerBack">← Mesi</button><strong>${monthFmt(first)}</strong><span></span></div><div class="pickerWeekdays">${["L", "M", "M", "G", "V", "S", "D"].map((x) => `<b>${x}</b>`).join("")}</div><div class="pickerGrid days">${Array.from(
      { length: 42 },
      (_, i) => {
        const d = add(start, i),
          outside = d.getMonth() !== month;
        if (i > 27 && d > last && d.getDay() === 1) return "";
        return `<button class="pickerDay${outside ? " outside" : ""}${iso(d) === iso(state.agenda) ? " selected" : ""}" data-date="${iso(d)}">${d.getDate()}</button>`;
      },
    ).join("")}</div>`;
  }
  pop.querySelectorAll("[data-range]").forEach(
    (x) =>
      (x.onclick = () => {
        state.pickerYear += Number(x.dataset.range);
        renderDatePopover();
      }),
  );
  pop.querySelectorAll("[data-year]").forEach(
    (x) =>
      (x.onclick = () => {
        state.pickerYear = Number(x.dataset.year);
        state.pickerView = "months";
        renderDatePopover();
      }),
  );
  pop.querySelectorAll("[data-month]").forEach(
    (x) =>
      (x.onclick = () => {
        state.pickerMonth = Number(x.dataset.month);
        state.pickerView = "days";
        renderDatePopover();
      }),
  );
  pop.querySelectorAll("[data-date]").forEach(
    (x) =>
      (x.onclick = () => {
        state.agenda = new Date(x.dataset.date + "T12:00:00");
        syncMonthFromAgenda();
        pop.hidden = true;
        renderSynchronizedDates();
      }),
  );
  const back = pop.querySelector(".pickerBack");
  if (back)
    back.onclick = () => {
      state.pickerView = state.pickerView === "days" ? "months" : "years";
      renderDatePopover();
    };
}
function toggleDatePopover() {
  const pop = $("datePopover");
  if (!pop.hidden) {
    pop.hidden = true;
    return;
  }
  state.pickerView = "years";
  state.pickerYear = state.agenda.getFullYear();
  state.pickerMonth = state.agenda.getMonth();
  renderDatePopover();
  pop.hidden = false;
}
function wire() {
  wirePlayersColumnHeight();
  const playerSearchForm = $("playerSearchForm"),
    playerSearchInput = $("playerSearchInput"),
    playerSearchSuggestions = $("playerSearchSuggestions");
  playerSearchInput.oninput = () => {
    clearTimeout(playerSearchTimer);
    const query = playerSearchInput.value.trim(),
      sequence = ++playerSearchSequence;
    if (query.length < 2) {
      playerSearchSuggestions.hidden = true;
      playerSearchInput.setAttribute("aria-expanded", "false");
      return;
    }
    playerSearchTimer = setTimeout(async () => {
      try {
        const results = await searchPlayers(query);
        if (sequence !== playerSearchSequence) return;
        playerSearchSuggestions.innerHTML = results.length
          ? results.slice(0, 10).map((result) => playerSearchResultHtml(result, "playerSearchSuggestion")).join("")
          : '<div class="empty">Nessun giocatore trovato.</div>';
        bindPlayerSearchResults(playerSearchSuggestions, results);
        playerSearchSuggestions.hidden = false;
        playerSearchInput.setAttribute("aria-expanded", "true");
      } catch {
        if (sequence === playerSearchSequence) {
          playerSearchSuggestions.innerHTML =
            '<div class="empty">Ricerca temporaneamente non disponibile.</div>';
          playerSearchSuggestions.hidden = false;
        }
      }
    }, 220);
  };
  playerSearchForm.onsubmit = (event) => {
    event.preventDefault();
    const query = playerSearchInput.value.trim();
    if (query.length < 2) return;
    playerSearchSuggestions.hidden = true;
    playerSearchInput.setAttribute("aria-expanded", "false");
    location.hash = `player-search/${encodeURIComponent(query)}`;
  };
  $("agendaMode").onchange = () => {
    state.agendaMode =
      $("agendaMode").value === "chronological"
        ? "chronological"
        : "tournament";
    saveUiState();
    renderAgenda();
  };
  document.querySelectorAll("[data-category-filter]").forEach(
    (input) =>
      (input.onchange = () => {
        input.checked
          ? state.categoryFilters.add(input.value)
          : state.categoryFilters.delete(input.value);
        applyDemographicSelection();
        saveUiState();
        renderFilters();
        renderCalendar();
      }),
  );
  $("prevCalendarMonth").onclick = () => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1, 12);
    saveUiState();
    renderCalendar();
  };
  $("nextCalendarMonth").onclick = () => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1, 12);
    saveUiState();
    renderCalendar();
  };
  $("calendarSex").onchange = () => {
    state.sexFilter = $("calendarSex").value;
    applyDemographicSelection();
    saveUiState();
    renderFilters();
    renderCalendar();
  };
  $("prevAgendaMonth").onclick = () => {
    moveBothToMonth(state.agenda.getFullYear(), state.agenda.getMonth() - 1);
    renderSynchronizedDates();
  };
  $("nextAgendaMonth").onclick = () => {
    moveBothToMonth(state.agenda.getFullYear(), state.agenda.getMonth() + 1);
    renderSynchronizedDates();
  };
  $("prevAgenda").onclick = () => {
    state.agenda = add(state.agenda, -1);
    syncMonthFromAgenda();
    renderSynchronizedDates();
  };
  $("nextAgenda").onclick = () => {
    state.agenda = add(state.agenda, 1);
    syncMonthFromAgenda();
    renderSynchronizedDates();
  };
  $("agendaToday").onclick = toggleDatePopover;
  $("agendaGoToday").onclick = () => {
    state.agenda = new Date();
    syncMonthFromAgenda();
    renderSynchronizedDates();
  };
  $("weeklyAgendaToggle").onclick = () => {
    const panel = $("weeklyAgendaPanel"),
      opening = panel.hidden;
    panel.hidden = !opening;
    $("weeklyAgendaToggle").setAttribute("aria-expanded", String(opening));
  };
  $("datePopover").onclick = (e) => e.stopPropagation();
  $("toggleAll").onclick = () => {
    const all = state.data.players || [];
    clearDemographicFilters();
    state.selected.size > all.length - state.selected.size
      ? state.selected.clear()
      : all.forEach((p) => state.selected.add(p.id));
    saveUiState();
    renderHome();
  };
  document.querySelectorAll("[data-home-route]").forEach(
    (button) =>
      (button.onclick = () => {
        location.hash = button.dataset.homeRoute;
      }),
  );
  $("backHome").onclick = () => {
    if (history.length > 1) {
      history.back();
      return;
    }
    location.hash = "";
  };
  $("brandHome").onclick = () => {
    location.hash = "";
    scrollTo({ top: 0, behavior: "smooth" });
  };
  document.addEventListener("click", (e) => {
    const category = $("calendarCategory");
    if (category?.open && !category.contains(e.target)) category.open = false;
    if (!playerSearchForm.contains(e.target)) {
      playerSearchSuggestions.hidden = true;
      playerSearchInput.setAttribute("aria-expanded", "false");
    }
    const pop = $("datePopover");
    if (
      !pop.hidden &&
      !pop.contains(e.target) &&
      !$("agendaToday").contains(e.target)
    )
      pop.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("datePopover").hidden = true;
      playerSearchSuggestions.hidden = true;
      playerSearchInput.setAttribute("aria-expanded", "false");
    }
  });
  addEventListener("hashchange", () => {
    const now = Date.now(),
      nextRouteScrollKey = location.hash || "#home";
    routeScrollMemory.set(activeRouteScrollKey, {
      y: Math.max(0, Math.round(scrollY || 0)),
      leftAt: now,
    });
    const remembered = routeScrollMemory.get(nextRouteScrollKey),
      restoreY =
        remembered && now - remembered.leftAt <= 15000 ? remembered.y : 0;
    activeRouteScrollKey = nextRouteScrollKey;
    saveUiState();
    route();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => scrollTo({ top: restoreY, behavior: "auto" })),
    );
  });
  addEventListener("pagehide", saveUiState);
}
async function load() {
  if (loadRunning) return;
  const immediate = !state.data && cachedData();
  if (immediate) {
    state.data = immediate;
    if (!uiSelectionRestored) {
      state.data.players.forEach((p) => state.selected.add(p.id));
      uiSelectionRestored = true;
    } else
      state.selected = new Set(
        [...state.selected].filter((id) =>
          state.data.players.some((p) => p.id === id),
        ),
      );
    syncLabel(state.data, true);
    renderIfDataChanged();
    restoreUiScroll();
  }
  loadRunning = true;
  try {
    const names = [
      "players",
      "tournaments",
      "matches",
      "agenda",
      "results",
      "opponents",
      "entries",
      "status",
      "diagnostics",
      "manual",
    ];
    const files = [
      "players.json",
      "tournaments.json",
      "matches.json",
      "agenda.json",
      "results.json",
      "opponents.json",
      "tournament_entries.json",
      "sync_status.json",
      "diagnostics.json",
      "manual_matches.json",
    ];
    const projectionPromise = apiProjection().catch((error) => {
      console.warn("Fallback JSON Court Watch attivo", error);
      return null;
    });
    const settled = await Promise.allSettled(files.map(v3json));
    const docs = Object.fromEntries(
      names.map((name, i) => [
        name,
        settled[i].status === "fulfilled" ? settled[i].value : null,
      ]),
    );
    if (!Array.isArray(docs.players?.players) || !docs.players.players.length)
      throw Error("Elenco giocatori essenziale non disponibile");
    if (!Array.isArray(docs.tournaments?.tournaments))
      throw Error("Calendario tornei essenziale non disponibile");

    const previous = state.data || cachedData() || {};
    const projection = await projectionPromise;
    const jsonGeneration = Math.max(
        ...[docs.players?.generatedAt, docs.tournaments?.generatedAt]
          .map(Date.parse)
          .filter(Number.isFinite),
        0,
      ),
      apiGeneration = Date.parse(projection?.generatedAt || "");
    const universalProjectionFresh =
      projection &&
      (!jsonGeneration ||
        (Number.isFinite(apiGeneration) && apiGeneration >= jsonGeneration));
    if (projection && !universalProjectionFresh)
      console.warn(
        "Indice universale D1 in sincronizzazione: uso temporaneo dei JSON per giocatori e tornei; i match di circuito restano dalla API",
      );
    const projectedPlayers = new Map(
        (projection?.players || []).map((p) => [p.id, p]),
      ),
      previousPlayers = new Map((previous.players || []).map((p) => [p.id, p]));
    const visiblePlayers = docs.players.players
      .filter((p) => !FORMER_PLAYERS.has(p.id))
      .map((player) => {
        const projected = projectedPlayers.get(player.id),
          retained =
            projected?.tennisEuropeRankings || projected?.tennisEuropeRanking
              ? projected
              : previousPlayers.get(player.id);
        return retained?.tennisEuropeRankings || retained?.tennisEuropeRanking
          ? {
              ...player,
              tennisEuropeRanking:
                retained.tennisEuropeRanking || retained.ranking,
              tennisEuropeRankings: retained.tennisEuropeRankings,
              tennisEuropeRankingDates: retained.tennisEuropeRankingDates,
            }
          : player;
      });
    const visibleIds = new Set(visiblePlayers.map((p) => p.id));
    const projectedMatches = Array.isArray(projection?.matches)
        ? projection.matches
        : [],
      jsonMatches = Array.isArray(docs.matches?.matches)
        ? docs.matches.matches
        : [],
      previousMatches = Array.isArray(previous.matches) ? previous.matches : [],
      freshMatches = projectedMatches.length
        ? projectedMatches
        : jsonMatches.length
          ? jsonMatches
          : previousMatches,
      freshMatchKeys = new Set(freshMatches.map(agendaKey)),
      retainedCurrentMatches = previousMatches.filter(
        (match) =>
          !freshMatchKeys.has(agendaKey(match)) &&
          (!match.date ||
            String(match.date).slice(0, 10) >= iso(add(new Date(), -2))),
      ),
      baseMatches = [...retainedCurrentMatches, ...freshMatches],
      manualMatches = Array.isArray(docs.manual?.matches)
        ? docs.manual.matches
        : [],
      matches = [
        ...new Map(
          [...baseMatches, ...manualMatches].map((m) => [agendaKey(m), m]),
        ).values(),
      ];
    const agenda = Array.isArray(docs.agenda?.agenda)
      ? docs.agenda.agenda
      : previous.agenda || [];
    const results = Array.isArray(docs.results?.results)
      ? docs.results.results
      : previous.results || [];
    const opponents = Array.isArray(docs.opponents?.opponents)
      ? docs.opponents.opponents
      : previous.opponents || [];
    const tournamentEntries = Array.isArray(docs.entries?.tournamentEntries)
      ? docs.entries.tournamentEntries
      : previous.tournamentEntries || [];
    const optionalFailures = settled
      .slice(2)
      .filter((x) => x.status === "rejected").length;
    const diagnostics = docs.diagnostics ||
      previous.diagnostics || { overall: "yellow", items: [] };

    state.data = {
      players: visiblePlayers,
      tournaments: (
        (universalProjectionFresh && projection?.tournaments) ||
        docs.tournaments.tournaments
      ).filter((x) => visibleIds.has(x.playerId)),
      matches: matches.filter((x) => visibleIds.has(x.playerId)),
      agenda: mergeAgenda(agenda, matches).filter((x) =>
        visibleIds.has(x.playerId),
      ),
      results: results.filter((x) => visibleIds.has(x.playerId)),
      opponents,
      tournamentEntries: tournamentEntries.filter((x) =>
        visibleIds.has(x.playerId),
      ),
      diagnostics,
      generatedAt: new Date(
        Math.max(
          ...[
            universalProjectionFresh && projection?.generatedAt,
            docs.status?.generatedAt,
            docs.players.generatedAt,
            docs.tournaments.generatedAt,
          ]
            .map(Date.parse)
            .filter(Number.isFinite),
          Date.parse(previous.generatedAt || "") || 0,
        ),
      ).toISOString(),
    };
    saveCachedData(state.data);
    if (!uiSelectionRestored) {
      state.data.players.forEach((p) => state.selected.add(p.id));
      uiSelectionRestored = true;
    } else
      state.selected = new Set(
        [...state.selected].filter((id) =>
          state.data.players.some((p) => p.id === id),
        ),
      );
    syncLabel(state.data, optionalFailures > 0);
    renderIfDataChanged();
  } catch (e) {
    const fallback = state.data || cachedData();
    if (fallback) {
      state.data = fallback;
      if (!uiSelectionRestored) {
        state.data.players.forEach((p) => state.selected.add(p.id));
        uiSelectionRestored = true;
      } else
        state.selected = new Set(
          [...state.selected].filter((id) =>
            state.data.players.some((p) => p.id === id),
          ),
        );
      syncLabel(state.data, true);
      renderIfDataChanged();
      restoreUiScroll();
    } else {
      unavailableLabel();
      $("dailyAgenda").innerHTML =
        '<div class="empty">Il collegamento ai dati non è disponibile e su questo dispositivo non esiste ancora una copia valida.</div>';
    }
    console.error(e);
  } finally {
    loadRunning = false;
  }
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-match-analysis]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  openMatchAnalysis(button.dataset.matchAnalysis);
});
const renderProfileWithoutTournamentStatus = renderProfile;
let profileTournamentStatusFilter = "all",
  profileYearFilter = String(new Date().getFullYear()),
  profileStatusPlayerId = "";
renderProfile = function (id) {
  if (profileStatusPlayerId !== id) {
    profileTournamentStatusFilter = "all";
    profileYearFilter = String(new Date().getFullYear());
    profileStatusPlayerId = id;
  }
  renderProfileWithoutTournamentStatus(id);
  const list = $("profileContent").querySelector(".profileTournamentList"),
    head = list?.querySelector(".cardHead"),
    filters = $("profileContent").querySelector(".profileMatchFilter"),
    hero = $("profileContent").querySelector(".profileHero"),
    matches = (state.data.matches || []).filter((m) => m.playerId === id),
    today = iso(new Date()),
    currentYear = String(new Date().getFullYear()),
    statusFromDates = (start, end) =>
      !start
        ? "all"
        : end < today
          ? "completed"
          : start > today
            ? "scheduled"
            : "ongoing";
  if (!document.querySelector("#profileTournamentStatusStyle"))
    document.head.insertAdjacentHTML(
      "beforeend",
      '<style id="profileTournamentStatusStyle">.profileTournamentMatches[hidden]{display:none!important}.profileTournamentList>.cardHead>span{margin-left:9px;margin-right:auto}.tournamentStats b{font-size:15px}.profileTournamentStatusLabel,.profileTournamentYearLabel{margin-left:4px}@media(max-width:650px){.profileTournamentList>.cardHead>span{margin-right:0}.profileTournamentStatusLabel,.profileTournamentYearLabel{margin-left:0}}</style>',
    );
  if (filters)
    filters.insertAdjacentHTML(
      "beforeend",
      '<label class="profileTournamentYearLabel" for="profileTournamentYearFilter">Anno</label><select id="profileTournamentYearFilter"></select>',
    );
  const availableYears = new Set([Number(currentYear)]);
  for (const section of list?.querySelectorAll(".profileTournament") || []) {
    const dates = [
        ...(
          section.querySelector(".profileTournamentHead>p")?.textContent || ""
        ).matchAll(/(\d{2})-(\d{2})-(\d{4})/g),
      ].map((x) => `${x[3]}-${x[2]}-${x[1]}`),
      start = dates[0] || "",
      end = dates[1] || start;
    section.dataset.tournamentStatus = statusFromDates(start, end);
    section.classList.toggle(
      "ongoingTournament",
      section.dataset.tournamentStatus === "ongoing",
    );
    section.dataset.tournamentStart = start;
    section.dataset.tournamentEnd = end;
    const body = section.querySelector(".profileTournamentMatches"),
      sectionHead = section.querySelector(".profileTournamentHead");
    if (section.dataset.tournamentStatus === "scheduled") {
      const stats = section.querySelector(".tournamentStats");
      if (stats)
        stats.innerHTML =
          '<span class="scheduledTournamentLabel">PROGRAMMATO</span>';
      stats?.classList.add("scheduledTournamentStats");
      stats?.setAttribute("aria-label", "Torneo programmato");
      if (body) body.hidden = true;
      openProfileTournamentKeys.delete(section.dataset.profileTournament || "");
      if (sectionHead) {
        sectionHead.classList.remove("expandableTournamentRow");
        sectionHead.removeAttribute("tabindex");
        sectionHead.removeAttribute("role");
        sectionHead.setAttribute("aria-label", "Torneo programmato");
        sectionHead.onclick = null;
        sectionHead.onkeydown = null;
      }
    }
    const startYear = Number(start.slice(0, 4)),
      endYear = Number(end.slice(0, 4));
    if (
      startYear &&
      endYear &&
      endYear >= startYear &&
      endYear - startYear <= 20
    )
      for (let year = startYear; year <= endYear; year++)
        availableYears.add(year);
    const toggle = section.querySelector(".tournamentToggle"),
      isOpen = openProfileTournamentKeys.has(
        section.dataset.profileTournament || "",
      );
    if (body && section.dataset.tournamentStatus !== "scheduled")
      body.hidden = !isOpen;
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Nascondi partite" : "Mostra partite",
      );
    }
  }
  const circuitSelect = $("profileCircuitFilter"),
    typeSelect = $("profileMatchTypeFilter"),
    yearSelect = $("profileTournamentYearFilter"),
    statusSelect = $("profileTournamentStatusFilter"),
    baseCircuitChange = circuitSelect?.onchange,
    baseTypeChange = typeSelect?.onchange,
    baseOutcomeClicks = new Map(
      [...(hero?.querySelectorAll("[data-outcome]") || [])].map((x) => [
        x,
        x.onclick,
      ]),
    );
  if (yearSelect) {
    yearSelect.innerHTML =
      '<option value="all">Tutti gli anni</option>' +
      [...availableYears]
        .sort((a, b) => b - a)
        .map((year) => `<option value="${year}">${year}</option>`)
        .join("");
    if (
      !availableYears.has(Number(profileYearFilter)) &&
      profileYearFilter !== "all"
    )
      profileYearFilter = currentYear;
    yearSelect.value = profileYearFilter;
  }
  const matchTournamentDates = (m) => {
      const t = (state.data.tournaments || []).find(
          (x) =>
            x.playerId === id &&
            circuit(x) === circuit(m) &&
            String(
              x.competitionId ||
                x.itfTournamentKey ||
                x.teTournamentId ||
                x.name ||
                "",
            ) ===
              String(
                m.competitionId ||
                  m.itfTournamentKey ||
                  m.teTournamentId ||
                  m.tournamentName ||
                  "",
              ),
        ),
        start = String(t?.startDate || m.date || "").slice(0, 10),
        end = String(t?.endDate || start).slice(0, 10);
      return { start, end };
    },
    matchTournamentStatus = (m) => {
      const { start, end } = matchTournamentDates(m);
      return statusFromDates(start, end);
    },
    overlapsYear = (start, end, year) =>
      year === "all" ||
      (Boolean(start) &&
        start <= year + "-12-31" &&
        (end || start) >= year + "-01-01");
  const renderYearDividers = () => {
    list
      ?.querySelectorAll(".profileYearDivider")
      .forEach((divider) => divider.remove());
    if (profileYearFilter !== "all") return;
    let previousYear = "";
    for (const section of list?.querySelectorAll(".profileTournament") || []) {
      if (section.hidden) continue;
      const year = String(
        section.dataset.tournamentStart || section.dataset.tournamentEnd || "",
      ).slice(0, 4);
      if (!/^\d{4}$/.test(year) || year === previousYear) continue;
      const divider = document.createElement("div");
      divider.className = "profileYearDivider";
      divider.textContent = year;
      section.before(divider);
      previousYear = year;
    }
  };
  const applyTournamentStatus = () => {
    profileTournamentStatusFilter = statusSelect?.value || "all";
    profileYearFilter = yearSelect?.value || currentYear;
    let visible = 0;
    for (const section of list?.querySelectorAll(".profileTournament") || []) {
      const statusVisible =
          profileTournamentStatusFilter === "all" ||
          section.dataset.tournamentStatus === profileTournamentStatusFilter,
        yearVisible = overlapsYear(
          section.dataset.tournamentStart || "",
          section.dataset.tournamentEnd || "",
          profileYearFilter,
        );
      if (!statusVisible || !yearVisible) section.hidden = true;
      if (!section.hidden) visible++;
      if (section.dataset.tournamentStatus !== "scheduled") {
        const stats = section.querySelector(".tournamentStats"),
          statRows = [
            ...section.querySelectorAll(".profileTournamentMatches .unifiedMatchRow"),
          ].filter((item) => !item.hidden),
          statSpans = [...(stats?.querySelectorAll(":scope > span") || [])],
          statWins = statRows.filter((item) =>
            item.querySelector(".result.win"),
          ).length,
          statLosses = statRows.filter((item) =>
            item.querySelector(".result.loss"),
          ).length;
        if (statSpans.length >= 3) {
          statSpans[0]
            .querySelector("b")
            ?.replaceChildren(String(statRows.length));
          statSpans[1].querySelector("b")?.replaceChildren(String(statWins));
          statSpans[2].querySelector("b")?.replaceChildren(String(statLosses));
          statSpans[0].hidden = profileOutcomeFilter !== "all";
          statSpans[1].hidden = profileOutcomeFilter === "loss";
          statSpans[2].hidden = profileOutcomeFilter === "win";
        }
      }
    }
    renderYearDividers();
    const count = head?.querySelector(":scope > span");
    if (count) count.textContent = String(visible);
    const circuitValue = circuitSelect?.value || "all",
      typeValue = typeSelect?.value || "all",
      base = matches.filter((m) => {
        const dates = matchTournamentDates(m);
        return (
          (circuitValue === "all" || circuit(m) === circuitValue) &&
          (typeValue === "all" ||
            (typeValue === "doubles" && matchMeta(m).isDouble) ||
            (typeValue === "singles" && !matchMeta(m).isDouble)) &&
          (profileTournamentStatusFilter === "all" ||
            matchTournamentStatus(m) === profileTournamentStatusFilter) &&
          overlapsYear(dates.start, dates.end, profileYearFilter)
        );
      }),
      wins = base.filter((m) => m.advances === true).length,
      losses = base.filter((m) => m.advances === false).length;
    hero
      ?.querySelector('[data-stat="all"]')
      ?.replaceChildren(String(base.length));
    hero?.querySelector('[data-stat="won"]')?.replaceChildren(String(wins));
    hero?.querySelector('[data-stat="lost"]')?.replaceChildren(String(losses));
  };
  if (statusSelect) {
    statusSelect.value = profileTournamentStatusFilter;
    statusSelect.onchange = () => {
      baseCircuitChange?.call(circuitSelect);
      applyTournamentStatus();
    };
  }
  if (yearSelect)
    yearSelect.onchange = () => {
      baseCircuitChange?.call(circuitSelect);
      applyTournamentStatus();
    };
  if (circuitSelect)
    circuitSelect.onchange = () => {
      baseCircuitChange?.call(circuitSelect);
      applyTournamentStatus();
    };
  if (typeSelect)
    typeSelect.onchange = () => {
      baseTypeChange?.call(typeSelect);
      applyTournamentStatus();
    };
  for (const [button, baseClick] of baseOutcomeClicks)
    button.onclick = () => {
      baseClick?.call(button);
      applyTournamentStatus();
    };
  applyTournamentStatus();
};
wire();
wireAccount();
route();
load();
loadAccount();
refreshMatchAnalysisStatus();
setInterval(() => {
  if (!/^#opponent(?:-profile)?\//.test(location.hash)) load();
}, 30000);
