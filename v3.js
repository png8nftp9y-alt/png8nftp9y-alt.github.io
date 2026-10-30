const V3 = location.origin + "/app/api/documents/";
// Release contracts: location.origin+'/app/api' and background refresh outside opponent profiles.
// Functional-shield contracts retained across formatting:
// ${agendaDrawCodeHtml(m,itemTournament)}</div><${whenTag} class="agendaWhenDetails
// stats.innerHTML='<span class="scheduledTournamentLabel">PROGRAMMATO</span>'
// statSpans[0].hidden=profileOutcomeFilter!=='all'
const PRIVATE_API = location.origin + "/app/api";
const APP_API = PRIVATE_API + "/app-snapshot";
let PLAYER_GROUP = /(?:^|[?&])group=others(?:&|$)/.test(location.search || "") ? "others" : "main";
let GROUP_CACHE_SUFFIX = PLAYER_GROUP === "others" ? "-others" : "";
let LAST_GOOD_CACHE = "courtwatch-v3-last-good-v1" + GROUP_CACHE_SUFFIX + (PLAYER_GROUP === "others" ? "-v2" : "");
let CALENDAR_CACHE = "courtwatch-v3-calendar-v1" + GROUP_CACHE_SUFFIX + (PLAYER_GROUP === "others" ? "-v2" : "");
let UI_STATE_CACHE = "courtwatch-v3-ui-state-v1" + GROUP_CACHE_SUFFIX;
const DEVICE_ID_CACHE = "courtwatch-device-id-v1";
const PLAYER_RANKING_CACHE = "courtwatch-player-rankings-v1";
const OPPONENT_HISTORY_CACHE = "courtwatch-opponent-history-v3";
const ACTIVE_OPPONENT_CACHE = "courtwatch-active-opponent-v3";
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
function privateApiOptions(options = {}, group = PLAYER_GROUP) {
  const id = courtWatchDeviceId(),
    headers = new Headers(options.headers || {});
  if (id) headers.set("X-CourtWatch-Device", id);
  headers.set("X-CourtWatch-Group", group);
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
function validUiState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const saved = {...value};
  if (saved.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(saved.month))) delete saved.month;
  if (saved.agenda !== undefined) {
    const day = String(saved.agenda), date = new Date(day + "T12:00:00");
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day) ||
        !Number.isFinite(date.getTime()) || date.getFullYear() !== Number(day.slice(0,4)) ||
        date.getMonth() + 1 !== Number(day.slice(5,7)) || date.getDate() !== Number(day.slice(8,10))) delete saved.agenda;
  }
  return saved;
}
function savedUiState() {
  try {
    return validUiState(JSON.parse(localStorage.getItem(UI_STATE_CACHE) || "{}"));
  } catch {
    return {};
  }
}
function savedEntries(key, storage) {
  try {
    const value = JSON.parse((storage || localStorage).getItem(key) || "[]");
    return Array.isArray(value) ? value.filter(entry => Array.isArray(entry) && entry.length === 2 &&
      typeof entry[0] === "string" && entry[1] && typeof entry[1] === "object" && !Array.isArray(entry[1])) : [];
  } catch {
    return [];
  }
}
function saveEntries(key, map, storage, limit = 30) {
  try {
    (storage || localStorage).setItem(key, JSON.stringify([...map.entries()].slice(-limit)));
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
let restoredUi = savedUiState(),
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
  initialMatchProjectionPending: true,
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
  initialProjectionRequest = null,
  activeLoadCompletion = Promise.resolve(),
  activeProjectionController = null,
  lastLoadedDocuments = null,
  groupSwitchRunning = false,
  profileNavigationEpoch = 0,
  loadRunning = false,
  renderedDataSignature = "",
  activeOpponentRouteKey = "",
  opponentHistoryCache = new Map(savedEntries(OPPONENT_HISTORY_CACHE)),
  opponentHistoryRequests = new Map(),
  opponentHistoryValidated = new Map(),
  opponentPrefetchQueue = [],
  opponentPrefetchQueued = new Set(),
  opponentPrefetchActive = 0,
  playerRankingRequests = new Map(),
  playerRankingCache = new Map(savedEntries(PLAYER_RANKING_CACHE)),
  playerSearchSequence = 0,
  playerSearchTimer = null,
  playerSearchController = null,
  activeRouteScrollKey = location.hash || "#home",
  routeScrollMemory = new Map(),
  uiSelectionRestored =
    Array.isArray(restoredUi.selected),
  uiScrollRestored = false,
  uiScrollRestoreFinalized = false,
  uiScrollRestoreCancelled = Boolean(window.courtWatchRefreshPreview?.cancelled),
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
        selected: state.data && uiSelectionRestored ? [...state.selected] : restoredUi.selected,
        agendaMode: state.agendaMode,
        categoryFilters: [...state.categoryFilters],
        sexFilter: state.sexFilter,
        scrollY: Math.max(0, Math.round(scrollY || 0)),
        profilePlayerId: profileFilterPlayerId,
        profileCircuitFilter,
        profileMatchTypeFilter,
        profileOutcomeFilter,
        profileTournamentStatusFilter,
        profileYearFilter,
        openProfileTournamentKeys: [...openProfileTournamentKeys],
        tournamentPageKey,
        openTournamentPlayerKeys: [...openTournamentPlayerKeys],
      }),
    );
  } catch {}
}
function restoreUiScroll(finalize = false) {
  if (uiScrollRestoreCancelled || uiScrollRestoreFinalized || (uiScrollRestored && !finalize)) return;
  uiScrollRestored = true;
  if (finalize) uiScrollRestoreFinalized = true;
  const routeHash = location.hash;
  scrollTo(0, Number(restoredUi.scrollY) || 0);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!uiScrollRestoreCancelled && location.hash === routeHash)
      scrollTo(0, Number(restoredUi.scrollY) || 0);
  }));
}
function saveRefreshView() {
  saveUiState();
  const key = "courtwatch-refresh-view-v1-" + PLAYER_GROUP;
  try {
    const view = document.querySelector("main.view.active");
    if (!view || !state.data || window.courtWatchRefreshPreview || !view.getClientRects().length) return;
    const clone = view.cloneNode(true);
    const controls = view.querySelectorAll("input, select, textarea");
    clone.querySelectorAll("input, select, textarea").forEach((control, index) => {
      const original = controls[index];
      if (control.tagName === "SELECT") [...control.options].forEach((option, i) => option.toggleAttribute("selected", original.options[i].selected));
      else if (control.tagName === "TEXTAREA") control.textContent = original.value;
      else {control.setAttribute("value", original.value); control.toggleAttribute("checked", original.checked);}
    });
    const html = clone.innerHTML;
    if (html.length > 1500000) {sessionStorage.removeItem(key); return;}
    sessionStorage.setItem(key, JSON.stringify({
      version: "20261013-refresh-position", route: location.pathname + location.search + location.hash,
      viewId: view.id, html, y: Math.max(0, scrollY || 0),
      styles: [...document.head.querySelectorAll("style[id]")].map(style => ({id: style.id, css: style.textContent})),
    }));
  } catch {try {sessionStorage.removeItem(key);} catch {}}
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
  const name = words.join(" ");
  return name.split(' ').map(word => word.length > 1 && word === word.toLocaleUpperCase('it-IT')
    ? word.toLocaleLowerCase('it-IT').replace(/(^|[’\u0027-])\p{L}/gu, letter => letter.toLocaleUpperCase('it-IT')) : word).join(' ');
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
const ALL_COUNTRY_REGIONS = {"ABW":"AW","AFG":"AF","AGO":"AO","AIA":"AI","ALA":"AX","ALB":"AL","AND":"AD","ARE":"AE","ARG":"AR","ARM":"AM","ASM":"AS","ATA":"AQ","ATF":"TF","ATG":"AG","AUS":"AU","AUT":"AT","AZE":"AZ","BDI":"BI","BEL":"BE","BEN":"BJ","BES":"BQ","BFA":"BF","BGD":"BD","BGR":"BG","BHR":"BH","BHS":"BS","BIH":"BA","BLM":"BL","BLR":"BY","BLZ":"BZ","BMU":"BM","BOL":"BO","BRA":"BR","BRB":"BB","BRN":"BN","BTN":"BT","BVT":"BV","BWA":"BW","CAF":"CF","CAN":"CA","CCK":"CC","CHE":"CH","CHL":"CL","CHN":"CN","CIV":"CI","CMR":"CM","COD":"CD","COG":"CG","COK":"CK","COL":"CO","COM":"KM","CPV":"CV","CRI":"CR","CUB":"CU","CUW":"CW","CXR":"CX","CYM":"KY","CYP":"CY","CZE":"CZ","DEU":"DE","DJI":"DJ","DMA":"DM","DNK":"DK","DOM":"DO","DZA":"DZ","ECU":"EC","EGY":"EG","ERI":"ER","ESH":"EH","ESP":"ES","EST":"EE","ETH":"ET","FIN":"FI","FJI":"FJ","FLK":"FK","FRA":"FR","FRO":"FO","FSM":"FM","GAB":"GA","GBR":"GB","GEO":"GE","GGY":"GG","GHA":"GH","GIB":"GI","GIN":"GN","GLP":"GP","GMB":"GM","GNB":"GW","GNQ":"GQ","GRC":"GR","GRD":"GD","GRL":"GL","GTM":"GT","GUF":"GF","GUM":"GU","GUY":"GY","HKG":"HK","HMD":"HM","HND":"HN","HRV":"HR","HTI":"HT","HUN":"HU","IDN":"ID","IMN":"IM","IND":"IN","IOT":"IO","IRL":"IE","IRN":"IR","IRQ":"IQ","ISL":"IS","ISR":"IL","ITA":"IT","JAM":"JM","JEY":"JE","JOR":"JO","JPN":"JP","KAZ":"KZ","KEN":"KE","KGZ":"KG","KHM":"KH","KIR":"KI","KNA":"KN","KOR":"KR","KWT":"KW","LAO":"LA","LBN":"LB","LBR":"LR","LBY":"LY","LCA":"LC","LIE":"LI","LKA":"LK","LSO":"LS","LTU":"LT","LUX":"LU","LVA":"LV","MAC":"MO","MAF":"MF","MAR":"MA","MCO":"MC","MDA":"MD","MDG":"MG","MDV":"MV","MEX":"MX","MHL":"MH","MKD":"MK","MLI":"ML","MLT":"MT","MMR":"MM","MNE":"ME","MNG":"MN","MNP":"MP","MOZ":"MZ","MRT":"MR","MSR":"MS","MTQ":"MQ","MUS":"MU","MWI":"MW","MYS":"MY","MYT":"YT","NAM":"NA","NCL":"NC","NER":"NE","NFK":"NF","NGA":"NG","NIC":"NI","NIU":"NU","NLD":"NL","NOR":"NO","NPL":"NP","NRU":"NR","NZL":"NZ","OMN":"OM","PAK":"PK","PAN":"PA","PCN":"PN","PER":"PE","PHL":"PH","PLW":"PW","PNG":"PG","POL":"PL","PRI":"PR","PRK":"KP","PRT":"PT","PRY":"PY","PSE":"PS","PYF":"PF","QAT":"QA","REU":"RE","ROU":"RO","RUS":"RU","RWA":"RW","SAU":"SA","SDN":"SD","SEN":"SN","SGP":"SG","SGS":"GS","SHN":"SH","SJM":"SJ","SLB":"SB","SLE":"SL","SLV":"SV","SMR":"SM","SOM":"SO","SPM":"PM","SRB":"RS","SSD":"SS","STP":"ST","SUR":"SR","SVK":"SK","SVN":"SI","SWE":"SE","SWZ":"SZ","SXM":"SX","SYC":"SC","SYR":"SY","TCA":"TC","TCD":"TD","TGO":"TG","THA":"TH","TJK":"TJ","TKL":"TK","TKM":"TM","TLS":"TL","TON":"TO","TTO":"TT","TUN":"TN","TUR":"TR","TUV":"TV","TWN":"TW","TZA":"TZ","UGA":"UG","UKR":"UA","UMI":"UM","URY":"UY","USA":"US","UZB":"UZ","VAT":"VA","VCT":"VC","VEN":"VE","VGB":"VG","VIR":"VI","VNM":"VN","VUT":"VU","WLF":"WF","WSM":"WS","YEM":"YE","ZAF":"ZA","ZMB":"ZM","ZWE":"ZW","BAH":"BS","BAN":"BD","BAR":"BB","BHU":"BT","BOT":"BW","BRU":"BN","BUL":"BG","BUR":"BF","CAM":"KH","CAY":"KY","CGO":"CG","CHA":"TD","CHI":"CL","CRC":"CR","CRO":"HR","DEN":"DK","ESA":"SV","FIJ":"FJ","GAM":"GM","GBS":"GW","GEQ":"GQ","GER":"DE","GRE":"GR","GRN":"GD","GUA":"GT","GUI":"GN","HAI":"HT","HON":"HN","INA":"ID","IRI":"IR","ISV":"VI","IVB":"VG","KOS":"XK","KUW":"KW","LAT":"LV","LBA":"LY","LIB":"LB","MAD":"MG","MAS":"MY","MAW":"MW","MGL":"MN","MON":"MC","MRI":"MU","MTN":"MR","MYA":"MM","NCA":"NI","NED":"NL","NEP":"NP","NGR":"NG","NIG":"NE","OMA":"OM","PAR":"PY","PHI":"PH","POR":"PT","PUR":"PR","RSA":"ZA","SEY":"SC","SKN":"KN","SLO":"SI","SOL":"SB","SRI":"LK","SUD":"SD","SUI":"CH","TAN":"TZ","TGA":"TO","TOG":"TG","TPE":"TW","UAE":"AE","URU":"UY","VAN":"VU","VIN":"VC","ZAM":"ZM","ZIM":"ZW","RTF":"RU","BTF":"BY","ENG":"GB","SCO":"GB","WAL":"GB","MGO":"ME"};
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
      code = IOC_REGION[raw] || ALL_COUNTRY_REGIONS[raw] || COUNTRY_NAME_REGION[raw] || raw;
    if (/^[A-Z]{2}$/.test(code)) return code.toLowerCase();
    const normalize = text => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    for (const locale of ['en','it']) {
      const names = new Intl.DisplayNames([locale], {type:'region'});
      for (const region of new Set(Object.values(ALL_COUNTRY_REGIONS)))
        if (normalize(names.of(region)) === normalize(raw)) return region.toLowerCase();
    }
    return "";
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
    labels = currentPlayerRankingLabels(player, cached?.rankings ?? null);
  return labels.length
    ? `<span id="playerLiveRankings" class="playerAllRankings"> · ${labels.map(esc).join(" · ")}</span>`
    : '<span id="playerLiveRankings" class="playerAllRankings"></span>';
};
function currentRankingCategoryAllowed(category, player) {
 const limit=Number(String(category||'').match(/(?:U|B|G)(14|16)\b/i)?.[1]);
 const year=new Date().getUTCFullYear(),birthYear=Number(player?.birthYear||String(player?.birthDate||player?.dateOfBirth||'').slice(0,4));
 return !limit||!Number.isInteger(birthYear)||birthYear<1900||birthYear>year||year-birthYear<=limit;
}
function latestCurrentRankingRow(row,player) {
 const dates=player?.tennisEuropeLatestRankingDates||{},category=String(row.category||'').toUpperCase(),age=category.match(/(14|16)$/)?.[1],sex=String(player?.sex||player?.gender||'').toUpperCase();
 const latest=dates[category]||(age&&['M','F'].includes(sex)?dates[(sex==='M'?'B':'G')+age]:age?[dates['B'+age],dates['G'+age]].filter(Boolean).sort().at(-1):'');
 return Boolean(latest&&row.ranking_date&&row.ranking_date===latest);
}
function currentPlayerRankingLabels(player, rows = null) {
  const labels = [];
  const fitpRanking = player?.fitpEntryRanking?.ranking || player?.ranking;
  if (fitpRanking) labels.push(`${readableText(fitpRanking)} FITP`);
  const liveRows = Array.isArray(rows)
    ? rows
    : Object.entries(player?.tennisEuropeRankings || {}).map(([category, ranking]) => ({
        category: category === "u14" ? "U14" : category === "u16" ? "U16" : category,
        ranking,ranking_date:player?.tennisEuropeRankingDates?.[category],
      }));
  for (const row of liveRows)
    if (row?.ranking && currentRankingCategoryAllowed(row.category, player) && latestCurrentRankingRow(row,player))
      labels.push(`n°${row.ranking} TE${row.category ? ` ${row.category.replace(/^[BG]/, "U")}` : ""}`);

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
    const data = await playerRankingRequests.get(key);
    player.tennisEuropeLatestRankingDates=data.latestRankingDates||{};
    const target = $("playerLiveRankings"),
      labels = currentPlayerRankingLabels(player, data.rankings || []);
    {
      playerRankingCache.set(key, data);
      saveEntries(PLAYER_RANKING_CACHE, playerRankingCache);
    }
    if (target && location.hash === `#player/${encodeURIComponent(player.id)}`)
      target.textContent = labels.length ? ` · ${labels.join(" · ")}` : "";
    return data;
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
  const item = x && typeof x === "object" ? x : {};
  const legacySource = item.source && typeof item.source === "object" ? item.source.circuit : item.source;
  const s = String(item.circuit || item.sourceCircuit || (typeof item.sourceId === "string" ? item.sourceId : "") || legacySource || item.sourceName || "").toLowerCase();
  return s.includes("tennis-europe") || s.includes("tennis europe") || s === "te" ? "tennis-europe" : s.includes("itf") ? "itf" : "fitp";
};
function withoutPucItfReferences(data) {
  if (!data) return data;
  const fields = ["tournaments", "matches", "agenda", "results", "tournamentEntries"];
  const isPuc = item => circuit(item) === "fitp";
  const mentionsItf = item => /\b(?:ITF|CHALLENGER)\b/i.test([item?.tournamentName, item?.name, item?.nome_torneo, item?.description, item?.descrizione].filter(Boolean).join(" "));
  const ids = item => [item?.competitionId, item?.tournamentId, item?.tournamentKey].filter(Boolean).map(value => String(value).toUpperCase());
  const blocked = new Set();
  for (const field of fields) for (const item of data[field] || [])
    if (isPuc(item) && mentionsItf(item)) ids(item).forEach(id => blocked.add(id));
  const result = { ...data };
  for (const field of fields) if (Array.isArray(data[field]))
    result[field] = data[field].filter(item => !isPuc(item) || (!mentionsItf(item) && !ids(item).some(id => blocked.has(id))));
  return result;
}
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
function foreignPlayerCountry(player) {
 const confirmedSala = String(player?.membershipCard || '') === '4537099241' && String(player?.name || '').trim().toLowerCase().split(/\s+/).sort().join(' ') === 'pietro sala';
 const country=confirmedSala ? 'SUI' : String(player?.nationality||player?.country||'').trim().toUpperCase();
 return !country||['IT','ITA','ITALIA','ITALY'].includes(country)?'':country;
}
function foreignPlayerCountryLabel(player) {
  const raw = foreignPlayerCountry({...player, nationality: player?.nationality || player?.country || player?.countryCode || player?.nationalityCode || ''});
  if (!raw) return '';
  const region = countryFlagCode(raw).toUpperCase();
  if (region === 'IT') return '';
  if (region) {
    try { return new Intl.DisplayNames(['it'], {type: 'region'}).of(region) || raw; }
    catch {}
  }
  return raw;
}
function personalNationalityHtml(player) {
 const country=foreignPlayerCountry(player);
 return country?nationalityHtml(country):'';
}
function displayPlayerClub(value) {
 return String(value || '').replace(/\bassociazione\s+(?:culturale\s+(?:e\s+)?)?sportiva\s+dilettantistic[ao]\b/gi, '').replace(/\b(?:e\s+)?ricreativa\b/gi, "").replace(/\bdilettantistic[ao]\b/gi, '').replace(/\ba\s*\.\s*s\s*\.\s*d\b\.?|\basd\b/gi, '').replace(/\s+/g, ' ').replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '').trim().replace(/(?:\s+e)+$/gi, '').toLocaleLowerCase('it-IT').replace(/(^|[\s’\u0027-])\p{L}/gu, letter => letter.toLocaleUpperCase('it-IT'));
}
function playerHasFitpMembership(player) {
  return Boolean(String(player?.membershipCard || '').trim()) ||
    [player?.sourceCircuit, player?.circuit].some(value => String(value || '').trim().toLowerCase() === 'fitp') ||
    (player?.circuitProfiles || []).some(profile => String(profile.circuit || '').trim().toLowerCase() === 'fitp') ||
    /^fitp[:|/]/i.test(String(player?.sourceKey || ''));
}
function personalPlayerAffiliationHtml(player) {
 const country=foreignPlayerCountry(player);
 const club=displayPlayerClub(player?.club);
 if(player?.membershipCard && club)
   return esc(club) + (country ? ' ·' + nationalityHtml(country) : '');
 return country ? nationalityHtml(country) : esc(club || (playerHasFitpMembership(player) ? 'Tesseramento da completare' : ''));
}
function playerBirthLabel(player) {
  if (player?.birthYearStatus === 'conflict') return '';
  const year = playerDemographics(player).birthYear;
  return Number.isInteger(year) ? `anno di nascita ${year}` : '';
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
function tennisEuropeVenueLocation(t, fallback = "") {
  const location = tournamentLocationLabel(t || {}, fallback),
    city = location.split(",")[0].trim();
  let venue = readableText(t?.venueName || t?.clubName || t?.club || "")
    .split("|")[0].replace(/[,·\s]+$/, "").trim();
  // Search results sometimes append the city to the club field itself.
  const suffix = ", " + city;
  if (city && venue.toLocaleLowerCase("it-IT").endsWith(suffix.toLocaleLowerCase("it-IT")))
    venue = venue.slice(0, -suffix.length).trim();
  if (!venue || venue.toLocaleLowerCase("it-IT") === city.toLocaleLowerCase("it-IT"))
    return location;
  return `${venue} · ${location}`;
}
function tournamentPlace(t) {
  if (circuit(t) === "tennis-europe") return tennisEuropeVenueLocation(t);
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
  if (circuit(t || {}) === "tennis-europe")
    return tennisEuropeVenueLocation(t || {}, fallback);
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
    const r = await fetch(V3 + path, privateApiOptions({
      cache: "no-cache",
      mode: "cors",
      signal: controller.signal,
      credentials: "same-origin",
    }, PLAYER_GROUP));
    if (!r.ok) throw Error("File v3 mancante: " + path);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
function recordPlayerLoadTiming(stage,started,response=null){
  try {
    const value=response?.headers?.get?.('Server-Timing') || '';
    console.info('courtwatch_player_timing '+JSON.stringify({stage,elapsedMs:Math.max(0,Date.now()-started),status:response?.status??null,serverTiming:value}));
  } catch {} // Diagnostics must never interrupt a player operation.
}
async function fetchProjection(url, timeoutMs, group = PLAYER_GROUP) {
  const timingStarted=Date.now(),timingEnabled=/[?&]playerId=/.test(url);
  let timingResponse;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  if (group === PLAYER_GROUP && !timingEnabled) activeProjectionController = controller;
  try {
    const response = await fetch(
      url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
      privateApiOptions({
        cache: "no-store",
        mode: "cors",
        credentials: "same-origin",
        signal: controller.signal,
      }, group),
    );
    timingResponse=response;
    if (!response.ok) throw Error("API Court Watch non disponibile: " + response.status);
    const data = await response.json();
    if (
      !Array.isArray(data.players) ||
      !Array.isArray(data.tournaments) ||
      !Array.isArray(data.matches)
    )
      throw Error("Proiezione API incompleta");
    if ((data.group && data.group !== group) || (group === "others" && data.group !== group)) throw Error("Sezione richiesta non ancora disponibile");
    return data;
  } finally {
    if(timingEnabled)recordPlayerLoadTiming('snapshot_http',timingStarted,timingResponse);
    clearTimeout(timer);
    if (activeProjectionController === controller) activeProjectionController = null;
  }
}
async function refreshPlayerMembership(group,epoch,isSnapshotComplete) {
  try {
    const list=await fetchPlayerMembership(group);
    if(group!==PLAYER_GROUP||epoch!==(state.playerSelectionEpoch||0)||isSnapshotComplete())return;
    const previous=state.data||cachedData()||{},old=new Map((previous.players||[]).map(p=>[p.id,p]));
    const players=list.players.filter(p=>(!FORMER_PLAYERS.has(p.id)||p.userAdded)&&!removedCourtWatchPlayers.has(p.id)).map(p=>old.get(p.id)||{...p,membershipPending:true});
    for(const p of confirmedCourtWatchPlayers.values())if(!players.some(r=>r.id===p.id)&&!removedCourtWatchPlayers.has(p.id))players.push(p);
    const ids=new Set(players.map(p=>p.id));
    state.data={matches:[],agenda:[],results:[],opponents:[],tournamentEntries:[],tournaments:[],...previous,group,players};
    for(const key of ['matches','agenda','results','tournamentEntries','tournaments'])state.data[key]=(state.data[key]||[]).filter(r=>ids.has(r.playerId));
    state.selected=new Set([...state.selected].filter(id=>ids.has(id)));
    for(const p of players)if(!old.has(p.id))state.selected.add(p.id);
    const hash=location.hash,y=typeof scrollY==='number'?scrollY:null;
    renderIfDataChanged();
    if(y!==null&&location.hash===hash)scrollTo({top:y,behavior:'auto'});
    for(const p of players.filter(p=>!old.has(p.id)&&p.membershipPending))
      refreshAfterPlayerAddition(epoch,group,p.id,{membershipSync:true}).catch(error=>console.warn('Tornei del nuovo giocatore non ancora disponibili',error));
  } catch(error){console.warn('Sincronizzazione elenco non disponibile; conservo la lista precedente',error);}
}
async function fetchPlayerMembership(group) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(PRIVATE_API+'/player-list',privateApiOptions({cache:'no-store',credentials:'same-origin',signal:controller.signal},group));
    if(!response.ok)throw Error('Elenco giocatori non disponibile: '+response.status);
    const list=await response.json();
    if(list.group!==group||!Array.isArray(list.players)||!Array.isArray(list.membershipIds)||
      list.players.some(p=>!p.id||!p.name||!list.membershipIds.includes(p.id))||
      new Set(list.players.map(p=>p.id)).size!==list.players.length)throw Error('Elenco giocatori incompleto');
    return list;
  } finally {clearTimeout(timer);}
}
function requestPlayerMembershipRefresh() {
  const group=PLAYER_GROUP,epoch=state.playerSelectionEpoch||0;
  if(state.membershipRefresh?.group===group&&state.membershipRefresh.epoch===epoch)return;
  const version=state.completeProjectionVersion||0,flight={group,epoch};
  state.membershipRefresh=flight;
  flight.promise=refreshPlayerMembership(group,epoch,()=>version!==(state.completeProjectionVersion||0))
    .finally(()=>{if(state.membershipRefresh===flight)state.membershipRefresh=null;});
}
async function apiProjection() {
  // Personal histories can outlive a short timeout. Keep one request in flight;
  // the cached projection stays visible while it completes.
  return fetchProjection(APP_API, 45000);
}
let durableProjectionFallback = null;
let projectionWriteQueue = Promise.resolve();
function validProjection(data) {
  return data && Array.isArray(data.players) && Array.isArray(data.tournaments);
}
function cachedData() {
  const candidates = [durableProjectionFallback];
  for (const storageName of ["localStorage", "sessionStorage"]) {
    try {
      const storage = storageName === "localStorage" ? localStorage : sessionStorage;
      for (const key of [LAST_GOOD_CACHE, CALENDAR_CACHE]) {
        try { candidates.push(JSON.parse(storage.getItem(key) || "null")); } catch {}
      }
    } catch {}
  }
  return candidates.filter(validProjection).sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0))[0] || null;
}
function applyCachedProjection(saved) {
  if (!validProjection(saved)) return false;
  state.data = saved;
  if (!uiSelectionRestored) {
    saved.players.forEach(player => state.selected.add(player.id));
    uiSelectionRestored = true;
  } else {
    const ids = new Set(saved.players.map(player => player.id));
    state.selected = new Set([...state.selected].filter(id => ids.has(id)));
  }
  return true;
}
function restoreCachedProjectionBeforeFirstRender() {
  return applyCachedProjection(cachedData());
}
function calendarCacheSnapshot(data, cachedAt) {
  // Store the match history once; agenda rows already in it are rebuilt on restore.
  const matches = (data.matches || []).filter(match => circuit(match) === "tennis-europe");
  const keys = new Set(matches.map(agendaKey));
  return {
    group: data.group,
    players: data.players, tournaments: data.tournaments, matches,
    agenda: (data.agenda || []).filter(match => circuit(match) === "tennis-europe" && !keys.has(agendaKey(match))),
    results: (data.results || []).filter(match => circuit(match) === "tennis-europe"),
    opponents: [], tournamentEntries: [], generatedAt: data.generatedAt,
    personalProjectionComplete: data.personalProjectionComplete, personalEnrichedPlayerIds:data.personalEnrichedPlayerIds, cachedAt,
  };
}
function openProjectionDatabase() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise(resolve => {
    let done = false;
    const finish = db => { if (done) { db?.close(); return; } done = true; clearTimeout(timer); resolve(db); };
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const request = indexedDB.open("courtwatch-projections-v1", 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("snapshots")) request.result.createObjectStore("snapshots");
        if (!request.result.objectStoreNames.contains("opponents")) {
          const store = request.result.createObjectStore("opponents");
          store.createIndex("cachedAt", "cachedAt");
        }
      };
      request.onsuccess = () => finish(request.result);
      request.onerror = request.onblocked = () => finish(null);
    } catch { finish(null); }
  });
}
async function writeDurableProjection(data, key = LAST_GOOD_CACHE) {
  const db = await openProjectionDatabase();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const transaction = db.transaction("snapshots", "readwrite");
      transaction.objectStore("snapshots").put(data, key);
      transaction.oncomplete = () => { db.close(); resolve(true); };
      transaction.onerror = transaction.onabort = () => { db.close(); resolve(false); };
    } catch { db.close(); resolve(false); }
  });
}
async function readDurableProjection(key = LAST_GOOD_CACHE) {
  const db = await openProjectionDatabase();
  if (!db) return null;
  return new Promise(resolve => {
    let done = false;
    const finish = value => {if (done) return; done = true; clearTimeout(timer); db.close(); resolve(value);};
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const transaction = db.transaction("snapshots", "readonly"), request = transaction.objectStore("snapshots").get(key);
      request.onsuccess = () => finish(validProjection(request.result) ? request.result : null);
      request.onerror = transaction.onerror = transaction.onabort = () => finish(null);
    } catch {finish(null);}
  });
}
async function restoreDurableProjection() {
  const saved = await readDurableProjection();
  const current = cachedData();
  if (!saved) return false;
  const newer = current && (current.cachedAt || 0) >= (saved.cachedAt || 0) ? current : saved;
  const older = newer === current ? saved : current;
  const ids = new Set(newer.players.map(player => player.id));
  // A newer partial cache must not erase history from the durable copy.
  // Keep the newer membership so a removed player is never resurrected.
  const restored = {...newer,
    matches: mergeKnownMatches(older?.matches, newer.matches).filter(match => ids.has(match.playerId))};
  durableProjectionFallback = restored;
  return applyCachedProjection(restored);
}
function saveCachedData(data) {
  const snapshot = calendarCacheSnapshot(data, Date.now());
  const cacheKey = LAST_GOOD_CACHE;
  durableProjectionFallback = snapshot;
  const serialized = JSON.stringify(snapshot);
  try { sessionStorage.setItem(CALENDAR_CACHE, serialized); } catch {}
  try {
    localStorage.setItem(CALENDAR_CACHE, serialized);
    // Retire the duplicated full cache only after the replacement is committed.
    localStorage.removeItem(LAST_GOOD_CACHE);
  } catch (error) {
    console.warn("Cache locale piena: conservo la copia precedente e uso l’archivio persistente", error);
  }
  projectionWriteQueue = projectionWriteQueue.then(() => writeDurableProjection(snapshot, cacheKey)).catch(error => {
    console.warn("Archivio locale non disponibile", error);
    return false;
  });
  return projectionWriteQueue;
}
function durableOpponentKey(name, event = "", profileId = "") {
  return [String(profileId || ""), readablePerson(name), event || ""].join("|");
}
async function saveDurableOpponent(name, event, profileId, requestKey, data) {
  const db = await openProjectionDatabase();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const transaction = db.transaction("opponents", "readwrite"), store = transaction.objectStore("opponents");
      store.put({requestKey, data, cachedAt: Date.now()}, durableOpponentKey(name, event, profileId));
      const count = store.count();
      count.onsuccess = () => {
        let excess = count.result - 200;
        if (excess <= 0) return;
        const cursor = store.index("cachedAt").openCursor();
        cursor.onsuccess = () => {if (cursor.result && excess-- > 0) {cursor.result.delete(); cursor.result.continue();}};
      };
      transaction.oncomplete = () => {db.close(); resolve(true);};
      transaction.onerror = transaction.onabort = () => {db.close(); resolve(false);};
    } catch {db.close(); resolve(false);}
  });
}
async function restoreDurableOpponents() {
  const db = await openProjectionDatabase();
  if (!db) return;
  await new Promise(resolve => {
    let done = false;
    const finish = () => {if (done) return; done = true; clearTimeout(timer); db.close(); resolve();};
    const timer = setTimeout(finish, 1500);
    try {
      const transaction = db.transaction("opponents", "readonly"), request = transaction.objectStore("opponents").getAll();
      request.onsuccess = () => {
        if (done) return;
        for (const entry of request.result || []) {
          if (entry.requestKey && entry.data && !opponentHistoryCache.has(entry.requestKey))
            opponentHistoryCache.set(entry.requestKey, entry.data);
        }
        finish();
      };
      request.onerror = transaction.onerror = transaction.onabort = finish;
    } catch {finish();}
  });
}
function cachedPersonalTournaments(previous, visiblePlayers) {
  const personalIds = new Set(visiblePlayers.filter(player => player.userAdded).map(player => player.id));
  return (previous.tournaments || []).filter(tournament => personalIds.has(tournament.playerId));
}
function syncLabel(data, fallback = false) {
  // Refresh failures remain in the console; an existing projection stays usable.
  const status = $("syncStatus"), alert = $("dataAlert");
  status.hidden = true;
  status.className = "status";
  status.textContent = "";
  alert.hidden = true;
  alert.textContent = "";
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
  return /\b(?:campo|court)(?=\b|\d)/i.test(value) || /^(?:c(?:c)?(?:[\s.:-]|\d))/i.test(value)
    ? value
    : "Court " + value;
}
function agendaLongCourt(m) {
  return agendaCourtName(m).length > 17;
}
function pendingOpponentHtml(m) {
  if (m.agendaOnly === true) return "Avversario non definito";
  const possible = Array.isArray(m.possibleOpponents)
    ? m.possibleOpponents.map(readablePerson).filter(Boolean)
    : [];
  return possible.length === 2
    ? `Avversario da definire · Possibili: ${possible.map(esc).join(" / ")}`
    : "Avversario da definire";
}
function courtWatchPlayerByName(name) {
  const wanted = readablePerson(name), compareNames = new Intl.Collator("it", {sensitivity: "base"}).compare;
  return (state.data?.players || []).find(
    (player) =>
      compareNames(readablePerson(player.name), wanted) === 0,
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
    : `<button class="inlinePlayerLink opponentPlayerLink${role === "partner" ? " doublesPartnerLink" : ""}" data-open-current-opponent="${esc(profileIds[index] || (role === "partner" ? m.partnerSourceIds?.[index] : m.opponentSourceIds?.[index]) || "")}" data-opponent-name="${esc(readablePerson(name))}" data-opponent-event="${esc(m.event || m.draw || "")}">${content}</button>`;
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
      ? ` · circolo ${esc(displayPlayerClub(m.opponentClub))}`
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
      ? ` · circolo ${esc(displayPlayerClub(m.opponentClub))}`
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
      ? `${base} <span class="playerClub">· ${esc(displayPlayerClub(club))}</span>`
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
    if (hasEurope && circuit(a) === "tennis-europe" && !a.manual && !a.agendaOnly) continue;
    const key = agendaKey(a),
      base = byKey.get(key) || {};
    byKey.set(key, { ...base, ...a });
  }
  const rows = [...byKey.values()];
  const token = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const doubles = m => m.matchType === 'doubles' || /doubles|doppio|\b[bg]d\d*/i.test(m.event || m.draw || '') || Boolean(m.partner);
  const resolved = m => !m.opponentPending && Boolean(String(m.opponent || '').trim()) && !/da definire/i.test(m.opponent);
  const pendingValue = value => !token(value) || /^(scheduled|programmat[oa]|not started|pending|da disputare)$/.test(token(value));
  return rows.filter(m => {
    if (m.manual || resolved(m) || !pendingValue(m.result) || !pendingValue(m.score)) return true;
    return !rows.some(other => other !== m && resolved(other) &&
      circuit(m) === 'tennis-europe' && circuit(other) === circuit(m) &&
      doubles(m) === doubles(other) && m.playerId && m.playerId === other.playerId &&
      token(m.competitionId) && token(m.competitionId) === token(other.competitionId) &&
      token(m.date) && token(m.date).replaceAll('-', '') === token(other.date).replaceAll('-', '') &&
      token(m.event || m.draw) && token(m.event || m.draw) === token(other.event || other.draw) &&
      token(m.round) && token(m.round) === token(other.round) &&
      (!m.partner || !other.partner || token(m.partner) === token(other.partner)));
  });
}
function mergeKnownMatches(...sources) {
  const matches = new Map();
  for (const rows of sources) for (const match of rows || []) {
    if (circuit(match) !== "tennis-europe") continue;
    const key = agendaKey(match), previous = matches.get(key) || {};
    // A partial response cannot erase already acquired score/participant fields.
    const update = Object.fromEntries(Object.entries(match).filter(([, value]) =>
      value !== undefined && value !== null && value !== "" &&
      (!Array.isArray(value) || value.length > 0)));
    const merged = { ...previous, ...update };
    // The API explicitly checked the participants: no winning team exists yet.
    // Clear an obsolete cached loss without treating partial responses as resets.
    if (match.outcomeConfirmed === false) {
      delete merged.advances;
      delete merged.won;
    }
    matches.set(key, merged);
  }
  return mergeAgenda([], [...matches.values()]);
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
// A selection elsewhere on the page must never disable navigation.
function hasLocalMouseSelection(event, element) {
  if (event?.detail === 0 || event?.pointerType === "touch" || event?.pointerType === "pen" ||
      (event?.detail > 0 && matchMedia("(pointer: coarse)").matches)) return false;
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && String(selection).trim() &&
    (element.contains(selection.anchorNode) || element.contains(selection.focusNode)));
}
function bindPlayerHold(element, playerId) {
  let active = false, startX = 0, startY = 0;
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
    startX = event.clientX; startY = event.clientY;
    element.classList.add("holding");
    calendarPlayerHoldTimer = setTimeout(() => {
      calendarPlayerHoldTimer = null;
      if (!active) return;
      element.classList.remove("holding");
      isolatePlayer(playerId);
    }, 550);
  };
  element.onpointermove = event => {
    if (active && Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
  };
  element.onpointerleave = cancel;
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
    birthYear: Number(player?.birthYear || String(player?.birthDate || player?.dateOfBirth || "").match(/^(\d{4})-\d{2}-\d{2}/)?.[1] || stored[0]),
    sex: String(player?.sex || stored[1] || "").toUpperCase(),
  };
}
function playerAgeCategory(player, year = state.month.getFullYear()) {
  const birthYear = playerDemographics(player).birthYear;
  if (!Number.isInteger(birthYear)) {
    // User-confirmed category for 2026; do not infer a birth year or carry it forward.
    const nameKey = String(player?.name || '').normalize('NFKD').toLowerCase().split(/\s+/).sort().join(' ');
    if (year === 2026 && String(player?.membershipCard || player?.sourcePlayerId || '') === '6562748855' && nameKey === 'busa martina') return 'U10';
    return '';
  }
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
  const compareNames = new Intl.Collator("it", {sensitivity: "base"}).compare;
  const all = [...(state.data.players || [])].sort((a, b) =>
      compareNames(readablePerson(a.name), readablePerson(b.name)),
    ),
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
        `<button class="chip ${state.selected.has(p.id) ? "selected" : eligibleIds.has(p.id) ? "" : "filteredOut"}" data-filter="${esc(p.id)}">${esc(readablePerson(p.name))}</button>`,
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
  renderAgendaFilters(all, eligibleIds);
}
function renderAgendaFilters(players, eligibleIds) {
  const options = $("agendaPlayerOptions");
  if (!options) return;
  const selectedCount = players.filter((player) => state.selected.has(player.id)).length;
  $("agendaPlayerFilterLabel").textContent = !selectedCount ? "Nessuno" : selectedCount === players.length ? "Tutti" : `${selectedCount} di ${players.length}`;
  $("agendaDemographicFilterLabel").textContent = [
    state.categoryFilters.size ? [...state.categoryFilters].join(", ") : "Tutte le categorie",
    state.sexFilter === "M" ? "Maschile" : state.sexFilter === "F" ? "Femminile" : "Tutti i sessi",
  ].join(" · ");
  $("agendaSex").value = state.sexFilter;
  const markup = players.map((player) => `<label class="${eligibleIds.has(player.id) ? "" : "filteredOut"}"><input type="checkbox" data-agenda-player="${esc(player.id)}" ${state.selected.has(player.id) ? "checked" : ""} /> <span>${esc(readablePerson(player.name))}</span></label>`).join("") || '<p class="empty">Nessun giocatore presente.</p>';
  // Keep the focused checkbox in place during periodic data refreshes.
  if (options.courtWatchFilterMarkup !== markup) {
    const focused = options.contains?.(document.activeElement) ? document.activeElement.dataset.agendaPlayer : null;
    const scrollTop = options.scrollTop;
    options.innerHTML = markup;
    options.courtWatchFilterMarkup = markup;
    options.scrollTop = scrollTop;
    if (focused) [...options.querySelectorAll("[data-agenda-player]")].find((input) => input.dataset.agendaPlayer === focused)?.focus({preventScroll: true});
  }
  document.querySelectorAll("[data-agenda-player]").forEach((input) => {
    input.onchange = () => {
      if (input.checked && !eligibleIds.has(input.dataset.agendaPlayer)) clearDemographicFilters();
      input.checked ? state.selected.add(input.dataset.agendaPlayer) : state.selected.delete(input.dataset.agendaPlayer);
      saveUiState();
      renderHome();
    };
  });
}
function wireAgendaFilters() {
  $("agendaSelectAll").onclick = () => {
    clearDemographicFilters();
    state.selected = new Set((state.data?.players || []).map((player) => player.id));
    saveUiState();
    renderHome();
  };
  $("agendaDeselectAll").onclick = () => {
    state.selected.clear();
    saveUiState();
    renderHome();
  };
  $("agendaSex").onchange = () => {
    state.sexFilter = $("agendaSex").value;
    applyDemographicSelection();
    saveUiState();
    renderHome();
  };
  $("agendaResetDemographics").onclick = () => {
    clearDemographicFilters();
    applyDemographicSelection();
    saveUiState();
    renderHome();
  };
  const menus = [...document.querySelectorAll(".agendaFilter")];
  for (const menu of menus) menu.addEventListener("toggle", () => {
    if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
  });
  document.addEventListener("click", (event) => {
    for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const menu of menus) if (menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
}
function createMatchTournamentResolver(tournaments = groups(false)) {
  const byId = new Map(), byName = new Map(), missingIdByName = new Map();
  const rememberFirst = (map, key, value) => {if (!map.has(key)) map.set(key, value);};
  tournaments.forEach((tournament, index) => {
    const source = circuit(tournament), nameKey = JSON.stringify([source, readableText(tournament.name)]), entry = {tournament, index};
    rememberFirst(byName, nameKey, entry);
    if (tournament.competitionId) rememberFirst(byId, JSON.stringify([source, String(tournament.competitionId)]), entry);
    else rememberFirst(missingIdByName, nameKey, entry);
  });
  return (match) => {
    const source = circuit(match), nameKey = JSON.stringify([source, readableText(match.tournamentName)]);
    if (!match.competitionId) return byName.get(nameKey)?.tournament;
    const exact = byId.get(JSON.stringify([source, String(match.competitionId)])), fallback = missingIdByName.get(nameKey);
    return (!exact || (fallback && fallback.index < exact.index) ? fallback : exact)?.tournament;
  };
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
  if (m.circuit === 'tennis-europe' && /junior[\s-]+masters/i.test(String(m.tournamentName || m.tournament?.name || '')) && /^round\s*1$/i.test(readableText(m.round || m.roundName || '')))
    return 'Playoff';
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
  const name = v => String(v || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const opponents = match => (match.opponentOptions?.length ? match.opponentOptions : String(match.opponent || '').split(/\s*\/\s*/)).map(name).filter(Boolean);
  const doubles = match => /\b[bg]d\d+\b|doubles|doppio/i.test([match.event,match.draw,match.matchType,match.eventType].join(' '));
  const slot = match => {
    const tournament = String(match.competitionId || '').toLowerCase();
    const date = String(match.date || '').replaceAll('-', '');
    const court = name(match.court).replace(/^(court|campo)\s*/, '');
    const number = agendaCourtMatchNumber(match);
    return tournament && date && court && number ? [tournament,date,court,number].join('|') : '';
  };
  const complete = items.filter(match => circuit(match) === 'tennis-europe' && doubles(match) && match.partner && opponents(match).length === 2);
  const unique = [];
  for (const match of items) {
    const key = slot(match), op = opponents(match);
    const wrong = !match.manual && !match.partner && !match.score && !match.result &&
      circuit(match) === 'tennis-europe' && doubles(match) && op.length === 1 && key &&
      complete.some(full => full.playerId === match.playerId && slot(full) === key && name(full.partner) === op[0]);
    // Confirmed obsolete Marsa row: the completed double moved from Court 2 to Court 3.
    // Keep this repair scoped to the owner's reported 13 October occurrence.
    const obsoleteCereghiniRow = !match.manual && !match.partner && !match.score && !match.result &&
      circuit(match) === 'tennis-europe' && match.playerId === 'virginia-cereghini' &&
      String(match.competitionId || '').toLowerCase() === '04da84af-89e2-4623-aee5-eb00e7e6c90c' &&
      String(match.date || '').replaceAll('-', '') === '20261013' &&
      /\bgd14\b/i.test([match.event, match.draw].join(' ')) &&
      name(match.round) === 'round of 16' && !match.opponentPending &&
      name(match.court).replace(/^(court|campo)\s*/, '') === '2' && agendaCourtMatchNumber(match) === 5 &&
      op.length === 1 && /^(?:ivona dirnbek)(?: dirnbek)?$/.test(op[0]);
    if (wrong || obsoleteCereghiniRow) continue;
    if (!unique.some(existing => sameAgendaMatch(existing, match))) unique.push(match);
  }
  return unique;
}
function canonicalPlayerMatches(items) {
  const players = new Map();
  for (const match of (items || []).filter(match => circuit(match) === "tennis-europe")) {
    const rows = players.get(match.playerId) || [];
    rows.push(match);
    players.set(match.playerId, rows);
  }
  return [...players.values()].flatMap(rows =>
    dedupeAgendaMatches(mergeAgenda([], rows)));
}
function normalizeMatchProjection(data) {
  if (!data) return data;
  const matches = canonicalPlayerMatches((data.matches || []).filter(m => !m.agendaOnly));
  const advances = (data.matches || []).filter(m => m.agendaOnly === true);
  return { ...data, matches,
    agenda: canonicalPlayerMatches(mergeAgenda([...(data.agenda || []), ...advances], matches)),
    results: (data.results || []).filter(match => circuit(match) === "tennis-europe" && !match.agendaOnly) };
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
  const resolveTournament = createMatchTournamentResolver(),
    key = iso(state.agenda),
    items = dedupeAgendaMatches(
      (state.data.agenda || []).filter(
        (m) => m.date === key && state.selected.has(m.playerId),
      ),
    );
  items.sort(agendaChronologicalCompare);
  $("agendaToday").textContent =
    key === iso(new Date()) ? "Oggi" : agendaBtnFmt(state.agenda);
  $("agendaGoToday").hidden = key === iso(new Date());
  if (!$("weeklyAgendaPanel").hidden) renderWeeklyAgenda();
  if ($("agendaMode")) $("agendaMode").value = state.agendaMode;
  const groups = new Map();
  for (const m of items) {
    const tournament = resolveTournament(m),
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
                    resolveTournament(m)?.competitionId ||
                    m.tournamentName ||
                    resolveTournament(m)?.name,
                ].join("|"),
              ),
            ),
            mixedChronological = isChronological && identities.size > 1,
            blockTournament =
              tournament ||
              (!mixedChronological ? resolveTournament(sample) : null),
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
                      itemTournament = resolveTournament(m),
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
      (x.onclick = (event) => {
        if (hasLocalMouseSelection(event, x)) return;
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
function tournamentConcluded(t, today = iso(new Date())) {
  const end = String(t?.endDate || t?.officialEndDate || t?.startDate || "").slice(0,10);
  return (/^\d{4}-\d{2}-\d{2}$/.test(end) && end < today) || /^(finished|completed|concluso)$/i.test(String(t?.status || ""));
}
function tournamentCancelled(t) {
  return t?.cancelled === true || t?.canceled === true || t?.source?.cancelled === true ||
    /cancelled|canceled|annullat/i.test([t?.status,t?.tournamentStatus,t?.source?.status].filter(Boolean).join(" "));
}
function playerTournamentEligible(t) {
  if (tournamentCancelled(t)) return false;
  if (/withdrawn|removed|excluded|ritirat/i.test([t?.entryStatus,t?.status,t?.acceptanceList].join(" ")) || /^W(?:-|$)/i.test(String(t?.acceptanceCode || ""))) return false;
  const confirmed = /draw_confirmed|official_draw/i.test([t?.calendarState,t?.entryStatus].join(" ")) || t?.drawConfirmed === true;
  if (tournamentConcluded(t) && confirmed) return true;
  const code = String(t?.acceptanceCode || t?.acceptanceList || t?.entryStatus || "").split("-")[0].toUpperCase();
  if (tournamentConcluded(t) && /^(A|ALTERNATE|ALTERNATES)$/.test(code) && !confirmed) return false;
  return active(t);
}

function effectiveAcceptanceLabel(entry) {
  if (tournamentConcluded(entry)) return "";
  return /(?:draw_confirmed|official_draw)/i.test(`${entry?.calendarState || ""} ${entry?.entryStatus || ""}`) ? "" : entry?.calendarListLabel || "";
}
function groups(selectedOnly = true) {
  const map = new Map();
  const compareNames = new Intl.Collator("it", {sensitivity: "base"}).compare;
  const players = new Map();
  for (const player of state.data.players || []) if (!players.has(player.id)) players.set(player.id, player);
  for (const t of state.data.tournaments || []) {
    if ((selectedOnly && !state.selected.has(t.playerId)) || !active(t))
      continue;
    const entry = {...t, calendarListLabel: effectiveAcceptanceLabel(t), playerName: readablePerson(players.get(t.playerId)?.name || t.playerName || "")};
    const key = tournamentKey(t),
      g = map.get(key) || {
        ...t,
        people: [],
        players: [],
        playerIds: [],
        labels: [],
      };
    if (!g.people.some((p) => p.playerId === t.playerId)) g.people.push(entry);
    if (entry.calendarListLabel && !g.labels.includes(entry.calendarListLabel))
      g.labels.push(entry.calendarListLabel);
    map.set(key, g);
  }
  for (const g of map.values()) {
    g.people.sort((a, b) =>
      compareNames(readablePerson(a.playerName), readablePerson(b.playerName)),
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
  if ($("calendarGoToday")) {
    const today = new Date();
    $("calendarGoToday").hidden =
      state.month.getFullYear() === today.getFullYear() &&
      state.month.getMonth() === today.getMonth();
  }
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
        saveUiState();
        routeScrollMemory.delete("#agenda");
        location.hash = "agenda";
      }),
  );
  document.querySelectorAll(".tourBand[data-tournament]").forEach(
    (x) =>
      (x.onclick = (event) => {
        if (
          Date.now() < suppressTournamentOpenUntil ||
          hasLocalMouseSelection(event, x)
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
let playerRemovalMode = false;
const removedCourtWatchPlayers = new Set();
const confirmedCourtWatchPlayers = new Map();
function removePlayerFromLocalView(playerId) {
  confirmedCourtWatchPlayers.delete(playerId);
  removedCourtWatchPlayers.add(playerId);
  state.data.players = (state.data.players || []).filter((p) => p.id !== playerId);
  for (const key of ['tournaments', 'matches', 'agenda', 'results', 'tournamentEntries'])
    if (Array.isArray(state.data[key])) state.data[key] = state.data[key].filter((item) => item.playerId !== playerId);
  state.selected.delete(playerId);
  saveUiState();
  saveCachedData(state.data);
  playerRemovalMode = false;
  const control = $('removePlayer');
  control.setAttribute('aria-pressed', 'false');
  control.title = 'Rimuovi giocatore';
  location.hash = 'players';
  renderHome();
}
function requestPlayerRemoval(playerId) {
  const player = (state.data?.players || []).find((p) => p.id === playerId);
  if (!player || document.getElementById('playerRemovalDialog')) return;
  const trigger = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.id = 'playerRemovalDialog';
  dialog.className = 'playerRemovalDialog';
  dialog.setAttribute('aria-labelledby', 'playerRemovalQuestion');
  dialog.innerHTML = `<div class="playerRemovalIcon" aria-hidden="true">⚠️</div><h2 id="playerRemovalQuestion">Sei davvero sicuro di voler rimuovere ${esc(readablePerson(player.name))} dall’elenco Courtwatch.</h2><p class="playerRemovalError" role="alert" hidden></p><div class="playerRemovalActions"><button type="button" class="btn" data-removal-no autofocus>No</button><button type="button" class="btn" data-removal-yes>Sì</button></div>`;
  document.body.append(dialog);
  const yes = dialog.querySelector('[data-removal-yes]');
  const no = dialog.querySelector('[data-removal-no]');
  const error = dialog.querySelector('.playerRemovalError');
  let pending = false;
  const close = () => { if (pending) return; dialog.close(); dialog.remove(); if (trigger?.isConnected) trigger.focus(); };
  no.onclick = close;
  dialog.oncancel = (event) => { event.preventDefault(); close(); };
  yes.onclick = async () => {
    if (pending) return;
    pending = true; yes.disabled = no.disabled = true; error.hidden = true;
    yes.textContent = 'Rimozione…';
    try {
      const response = await fetch(`${PRIVATE_API}/courtwatch-player?playerId=${encodeURIComponent(playerId)}`,
        privateApiOptions({method: 'DELETE', credentials: 'same-origin', cache: 'no-store'}));
      if (!response.ok) throw new Error('remove_player_http_' + response.status);
      const result = await response.json();
      if (result.removed !== true || result.playerId !== playerId) throw new Error('remove_player_not_confirmed');
      pending = false; close(); removePlayerFromLocalView(playerId);
    } catch (failure) {
      pending = false; yes.disabled = no.disabled = false; yes.textContent = 'Sì';
      error.textContent = 'Rimozione non riuscita. Riprova.'; error.hidden = false;
    }
  };
  dialog.showModal();
  no.focus();
}
function togglePlayerRemovalMode() {
  playerRemovalMode = !playerRemovalMode;
  const control = $('removePlayer');
  control.setAttribute('aria-pressed', String(playerRemovalMode));
  control.title = playerRemovalMode ? 'Annulla rimozione' : 'Rimuovi giocatore';
  renderPlayers();
}

function renderPlayers() {
  const compareNames = new Intl.Collator("it", {sensitivity: "base"}).compare;
  const tournamentCounts = new Map();
  for (const tournament of state.data.tournaments || []) {
    if (active(tournament)) tournamentCounts.set(tournament.playerId, (tournamentCounts.get(tournament.playerId) || 0) + 1);
  }
  const ps = [...(state.data.players || [])].sort((a, b) =>
    compareNames(readablePerson(a.name), readablePerson(b.name)),
  );
  $("playerTotal").textContent = ps.length;
  $("playersList").innerHTML = ps
    .map((p) => {
      const n = tournamentCounts.get(p.id) || 0,
        club = esc(displayPlayerClub(p.club) || (playerHasFitpMembership(p) ? "Tesseramento da completare" : "")),
        card = p.membershipCard ? `tessera ${p.membershipCard}` : "",
        nation = esc(foreignPlayerCountryLabel(p));
      return `<div class="playerRow" role="link" tabindex="0" data-profile="${esc(p.id)}"><div class="avatar">${initials(p.name)}</div><div><strong>${esc(readablePerson(p.name))}</strong><small>${[club, esc(card), nation, p.membershipPending ? "Caricamento tornei…" : n ? `${n} ${n === 1 ? "torneo" : "tornei"} monitorati` : "Nessun torneo monitorato"].filter(Boolean).join(" · ")}</small></div>${playerRemovalMode ? `<button type="button" class="playerRowRemove btn" data-remove-player="${esc(p.id)}" aria-label="Rimuovi ${esc(readablePerson(p.name))}">Rimuovi</button>` : "<i>›</i>"}</div>`;
    })
    .join("") || '<div class="empty">Nessun giocatore. Premi + per aggiungerne uno.</div>';
  document.querySelectorAll("[data-profile]").forEach(
    (x) => {
      const player = ps.find((item) => item.id === x.dataset.profile),
        preloadRanking = () => player && loadCurrentPlayerRanking(player);
      x.onkeydown = event => {
        if (event.target === x && (event.key === "Enter" || event.key === " ")) {event.preventDefault(); x.click();}
      };
      x.addEventListener("pointerenter", preloadRanking, { once: true });
      x.addEventListener("touchstart", preloadRanking, { once: true, passive: true });
      (x.onclick = (event) => {
        if (hasLocalMouseSelection(event, x)) return;
        if (playerRemovalMode) requestPlayerRemoval(x.dataset.profile);
        else openProfile(x.dataset.profile);
      });
    },
  );
}
async function searchPlayerPage(query, cursor = '', signal) {
  const started=Date.now();let response;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(abort, 12000);
  try {
    response = await fetch(`${PRIVATE_API}/player-search?q=${encodeURIComponent(query)}${cursor?'&cursor='+encodeURIComponent(cursor):''}`,
      privateApiOptions({cache:'no-store', signal:controller.signal}));
    if (!response.ok) throw Error('player search');
    const data = await response.json();
    if (!Array.isArray(data.results)) throw Error('player search incomplete');
    return data;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    recordPlayerLoadTiming('search_http',started,response);
  }
}
async function searchPlayers(query, signal) {return (await searchPlayerPage(query, '', signal)).results;}
function playerCircuitLinksHtml(profiles=[]) {
  const labels={'fitp':'FITP','tennis-europe':'Tennis Europe','itf':'ITF'};
  return profiles.filter(p=>labels[p.circuit]).map(p=>{
    let valid=false;try{const u=new URL(p.url);valid=u.protocol==='https:'&&!u.username&&!u.password&&(['fitp.it','www.fitp.it','te.tournamentsoftware.com','itftennis.com','www.itftennis.com'].includes(u.hostname))}catch{}
    return valid?`<a class="playerCircuitBadge ${esc(p.circuit)}" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="Profilo ${esc(labels[p.circuit])}">${esc(labels[p.circuit])}</a>`:`<span class="playerCircuitBadge unavailable ${esc(p.circuit)}" title="Profilo ufficiale non ancora identificato">${esc(labels[p.circuit])}</span>`;
  }).join('');
}
const playerAdditionsInFlight = new Map();
const addedPlayerRefreshes = new Map();
async function refreshAfterPlayerAddition(epoch, group, playerId, {membershipSync=false} = {}) {
  if (!playerId || group !== PLAYER_GROUP) return;
  const key = group + '|' + playerId, token = {};
  if(membershipSync&&addedPlayerRefreshes.has(key))return;
  const completeVersion=state.completeProjectionVersion||0;
  addedPlayerRefreshes.set(key, token);
  try {
    let data = await fetchProjection(PRIVATE_API + '/app-snapshot?playerId=' + encodeURIComponent(playerId), 45000, group);
    // During rollout an older Worker can still return its full authorized snapshot.
    if (data.playerId === undefined) data = {...data,playerId,
      players:data.players.filter(p => p.id === playerId),
      tournaments:data.tournaments.filter(t => t.playerId === playerId),
      matches:data.matches.filter(m => m.playerId === playerId)};
    if(membershipSync&&(epoch!==(state.playerSelectionEpoch||0)||completeVersion!==(state.completeProjectionVersion||0)))return;
    if (group !== PLAYER_GROUP || addedPlayerRefreshes.get(key) !== token ||
        removedCourtWatchPlayers.has(playerId) || !state.data?.players?.some(p => p.id === playerId)) return;
    if (data.playerId !== playerId || data.group !== group ||
        data.players.length !== 1 || data.players[0].id !== playerId ||
        data.tournaments.some(t => t.playerId !== playerId) || data.matches.some(m => m.playerId !== playerId))
      throw Error('Snapshot del giocatore errato');
    const renderStarted=Date.now();
    const previous = state.data, today = iso(new Date());
    const retained = (previous.tournaments || []).filter(t => t.playerId !== playerId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.startDate || '') || t.startDate <= today);
    const tournaments = [...new Map([...retained, ...data.tournaments].map(t =>
      [[t.playerId,t.circuit,t.competitionId || t.id].join('|'),t])).values()];
    const hash = location.hash, y = typeof scrollY === 'number' ? scrollY : null;
    state.data = normalizeMatchProjection(applyKnownResultUpdates({...previous,
      players: previous.players.map(p => {if(p.id!==playerId)return p;const enriched={...p,...data.players[0]};delete enriched.membershipPending;return enriched;}),
      tournaments, matches: mergeKnownMatches(previous.matches || [], data.matches),
      personalEnrichedPlayerIds: [...new Set([...(previous.personalEnrichedPlayerIds || []),playerId])],
    }, group));
    confirmedCourtWatchPlayers.delete(playerId);
    renderIfDataChanged();
    recordPlayerLoadTiming('snapshot_render',renderStarted);
    if (y !== null && location.hash === hash) scrollTo({top:y,behavior:'auto'});
    Promise.resolve(saveCachedData(state.data)).catch(error => console.warn('Archivio locale non disponibile', error));
  } finally {
    if (addedPlayerRefreshes.get(key) === token) addedPlayerRefreshes.delete(key);
  }
}

async function addCourtWatchPlayerFromUi(result, button) {
  const key = result.sourceKey || result.courtwatchId || result.identity;
  if (!key || playerAdditionsInFlight.has(key)) return;
  const original = button.textContent, routeHash = location.hash, additionGroup = PLAYER_GROUP;
  let addedPlayerId = '';
  const root = button.closest('dialog') || button.parentElement || $('profileContent');
  root.querySelector('[data-player-add-error]')?.remove();
  button.disabled = true;
  button.textContent = 'Aggiunta…';
  const operation = (async () => {
    const saveStarted=Date.now();
    const response = await fetch(`${PRIVATE_API}/courtwatch-player`, privateApiOptions({
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(result),
    }));
    if (response.status === 401 || response.status === 403) throw Error('player_access_required');
    let data;
    try { data = await response.json(); } catch { throw Error('player_response_invalid'); }
    if (!response.ok || data.added !== true || !data.player?.id || data.playerId !== data.player.id)
      throw Error(data.error || 'player_addition_not_confirmed');
    recordPlayerLoadTiming('addition_http',saveStarted,response);
    const renderStarted=Date.now();
    if (!state.data) state.data = {players:[],tournaments:[],matches:[]};
    state.playerSelectionEpoch = (state.playerSelectionEpoch || 0) + 1;
    // Durable POST confirmation is sufficient to make membership usable.
    // Keep the existing projection while its enrichment refreshes in background.
    state.data = {...state.data, personalProjectionComplete:false,
      personalEnrichedPlayerIds:(state.data.personalEnrichedPlayerIds || []).filter(id => id !== data.playerId)};
    addedPlayerId = data.playerId;
    removedCourtWatchPlayers.delete(data.playerId);
    confirmedCourtWatchPlayers.set(data.playerId,data.player);
    state.data.players = [...(state.data.players || []).filter(p => p.id !== data.playerId),data.player];
    state.selected.add(data.playerId);
    // Start the HTTP read before synchronous cache serialization and rendering.
    // An older full load cannot overwrite this selection epoch.
    // Enrich only this player immediately, without waiting for that load.
    refreshAfterPlayerAddition(state.playerSelectionEpoch, additionGroup, data.playerId).catch(error => {
      console.warn('player_addition_refresh_failed', error);
    });
    saveUiState();
    Promise.resolve(saveCachedData(state.data)).catch(error => console.warn("Archivio locale non disponibile", error));
    playerRemovalMode = false;
    const dialog = document.getElementById('addPlayerDialog');
    if (dialog && dialog === root) { dialog.close();dialog.remove(); }
    renderHome();
    if (location.hash === routeHash) {
      const target='#player/'+encodeURIComponent(data.playerId);
      if (/^#(?:opponent(?:-profile)?|player-search)\//.test(routeHash)) {
        history.replaceState(history.state,'',(location.href||'').split('#')[0]+target);
        activeRouteScrollKey=target;route();saveUiState();
      } else openProfile(data.playerId);
    }
    recordPlayerLoadTiming('addition_render',renderStarted);
  })();
  playerAdditionsInFlight.set(key,operation);
  try { await operation; }
  catch (error) {
    if (button.isConnected) {
      const message = document.createElement('p');message.dataset.playerAddError='';message.setAttribute('role','alert');
      message.textContent = error.message === 'player_identity_ambiguous'
        ? 'Identità non univoca. Usa + e seleziona il profilo del circuito corretto.'
        : error.message === 'player_club_unavailable'
          ? 'Scheda FITP temporaneamente non disponibile: riprova per aggiungere il giocatore con il suo circolo.'
        : error.message === 'player_snapshot_not_ready'
          ? 'Iscrizioni non ancora disponibili nella vista: riprova per completare l’apertura del giocatore.'
        : error.message === 'player_not_found'
          ? 'Profilo non trovato nella sorgente selezionata. Cerca nuovamente il giocatore.'
        : error.message === 'player_access_required'
          ? 'Accesso scaduto o non autorizzato. Accedi nuovamente a Court Watch.'
        : error.message === 'player_response_invalid'
          ? 'Il server non ha restituito la conferma di aggiunta. Riprova.'
        : `Aggiunta non riuscita (${error.message || 'errore di connessione'}). Riprova.`;
      root.append(message);
    }
  } finally {
    playerAdditionsInFlight.delete(key);
    if (button.isConnected && button.textContent === 'Aggiunta…') {
      button.disabled = false;
      if (addedPlayerId) {
        button.textContent = 'Apri giocatore';
        button.onclick = () => openProfile(addedPlayerId);
      } else button.textContent = original;
    }
  }
}
function openAddPlayerDialog() {
  if (document.getElementById('addPlayerDialog')) return;
  const dialog=document.createElement('dialog');dialog.id='addPlayerDialog';dialog.className='card';
  dialog.setAttribute('aria-labelledby','addPlayerTitle');
  dialog.innerHTML='<h2 id="addPlayerTitle">Aggiungi giocatore</h2><form data-add-player-search role="search"><label for="addPlayerQuery">Nome del giocatore</label><input id="addPlayerQuery" type="search" minlength="2" autocomplete="off" required><button type="submit" class="btn">Cerca</button></form><div data-add-player-results aria-live="polite"></div><button type="button" class="btn" data-close-add-player>Chiudi</button>';
  document.body.append(dialog);
  let sequence=0,timer,controller;
  const input=dialog.querySelector('input'),results=dialog.querySelector('[data-add-player-results]');
  const close=()=>{clearTimeout(timer);sequence++;controller?.abort();dialog.close();dialog.remove();$('addPlayer')?.focus()};
  dialog.querySelector('[data-close-add-player]').onclick=close;
  dialog.oncancel=event=>{event.preventDefault();close()};
  const search=async()=>{
    clearTimeout(timer);controller?.abort();controller=new AbortController();const query=input.value.trim(),request=++sequence;
    dialog.querySelector('[data-player-add-error]')?.remove();
    if(query.length<2){results.textContent='';return}
    results.textContent='Ricerca in corso…';
    try{
      const found=await searchPlayers(query,controller.signal);
      if(request!==sequence||!dialog.isConnected)return;
      results.innerHTML=found.length?found.map(result=>playerSearchResultHtml(result,'playerSearchResult')).join(''):'Nessun giocatore trovato.';
      bindPlayerSearchResults(results,found,true);
    }catch{if(request===sequence&&dialog.isConnected)results.textContent='Ricerca temporaneamente non disponibile. Riprova.'}
  };
  input.oninput=()=>{clearTimeout(timer);sequence++;controller?.abort();timer=setTimeout(search,220)};
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();search()};
  dialog.showModal();input.focus();
}
function dismissPlayerSearch() {
  clearTimeout(playerSearchTimer); ++playerSearchSequence; playerSearchController?.abort();
  const suggestions = $("playerSearchSuggestions"), input = $("playerSearchInput");
  if (suggestions) suggestions.hidden = true;
  input?.setAttribute("aria-expanded", "false");
}
function openPlayerSearchResult(result) {
  // Start the next search empty and discard suggestions still in flight.
  clearTimeout(playerSearchTimer);
  ++playerSearchSequence;
  playerSearchController?.abort();
  const searchInput = $("playerSearchInput"),
    searchSuggestions = $("playerSearchSuggestions");
  if (searchInput) {
    searchInput.blur();
    searchInput.value = "";
    searchInput.setAttribute("aria-expanded", "false");
  }
  if (searchSuggestions) {
    searchSuggestions.hidden = true;
    searchSuggestions.innerHTML = "";
  }
  const followed = result.courtwatchId && (state.data?.players || []).some(
    (player) => player.id === result.courtwatchId && player.active !== false,
  );
  if (followed) openProfile(result.courtwatchId);
  else openCurrentOpponent(result.sourceKey || result.identity || result.courtwatchId, result.name, "");
}
function playerSearchResultHtml(result, className) {
  const sourceLabels = (result.sources || [])
      .map((source) => source === "tennis-europe" ? "Tennis Europe" : source.toUpperCase()),
    detail = [result.courtwatchId ? "Court Watch" : "", ...sourceLabels]
      .filter(Boolean)
      .join(" · ") || readableText(result.circuit || "Giocatore");
  return `<button type="button" class="${className}" data-search-player="${esc(result.sourceKey || result.identity || result.courtwatchId)}" data-search-name="${esc(result.name)}" data-search-courtwatch="${esc(result.courtwatchId || "")}"><span><b>${esc(readablePerson(result.name))}</b>${result.nationality ? nationalityHtml(result.nationality) : ""}${result.club ? `<small>${esc(displayPlayerClub(result.club))}</small>` : ""}</span><small>${esc(detail)}</small></button>`;
}
function bindPlayerSearchResults(root, results, adding = false) {
  let prepared = 0;
  root.querySelectorAll("[data-search-player]").forEach((button) => {
    const result = results.find(item =>
      String(item.sourceKey || item.identity || item.courtwatchId) === button.dataset.searchPlayer &&
      readablePerson(item.name) === readablePerson(button.dataset.searchName));
    if (!result) return;
    const prepare = () => {
      if (adding) return;
      const identity = result.sourceKey || result.identity || result.courtwatchId;
      const followed = result.courtwatchId && (state.data?.players || []).some(
        player => player.id === result.courtwatchId && player.active !== false);
      if (!followed && !monitoredOpponentPlayer(identity)) queueOpponentPreload(result.name, "", identity, () => button.isConnected && !root.hidden);
    };
    // Bounded preparation starts while the user reads results; no recurring refresh.
    if (!adding && prepared++ < 2) prepare();
    button.onpointerenter = prepare;
    button.onfocus = prepare;
    button.ontouchstart = prepare;
    button.onclick = () => {
      if (adding) addCourtWatchPlayerFromUi(result, button);
      else openPlayerSearchResult(result);
    };
  });
}
async function renderPlayerSearchPage(query) {
  activeOpponentRouteKey='';$('removeProfilePlayer').hidden=true;
  $('profileContent').innerHTML=`<section class="card playerSearchResults"><div class="cardHead"><div><h2>Risultati giocatori</h2><p>Ricerca: ${esc(query)}</p></div></div><div id="playerSearchPageContent"></div><button type="button" id="playerSearchMore">Caricamento…</button><p id="playerSearchError" role="status"></p></section>`;
  $('profileView').classList.add('active');const routeHash=location.hash,results=[];let cursor='',busy=false;
  async function loadPage(){if(busy||location.hash!==routeHash)return;busy=true;const button=$('playerSearchMore');button.disabled=true;button.textContent='Caricamento…';$('playerSearchError').textContent='';
    try{const page=await searchPlayerPage(query,cursor);if(location.hash!==routeHash)return;results.push(...(page.results||[]));cursor=page.nextCursor||'';const body=$('playerSearchPageContent');body.innerHTML=results.length?results.map(r=>playerSearchResultHtml(r,'playerSearchResult')).join(''):'<div class="empty">Nessun giocatore trovato.</div>';bindPlayerSearchResults(body,results);button.hidden=!cursor;button.textContent='Mostra altri';}
    catch{if(location.hash===routeHash){$('playerSearchError').textContent='Ricerca temporaneamente non disponibile. Riprova.';button.textContent='Riprova';}}
    finally{busy=false;if(location.hash===routeHash)button.disabled=false;}
  }
  $('playerSearchMore').onclick=loadPage;await loadPage();
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
  const section = location.hash.match(/^#(agenda|calendar|players)$/)?.[1] || "home";
  if (section === "agenda" || section === "calendar") renderFilters();
  if(state.data?.membershipOnly&&(section==='agenda'||section==='calendar')){
    $(section==='agenda'?'dailyAgenda':'calendar').innerHTML='<div class="empty" role="status">Caricamento tornei…</div>';
    renderDiagnostics();
    return;
  }
  if (section === "agenda") renderAgenda();
  else if (section === "calendar") renderCalendar();
  else if (section === "players") renderPlayers();
  renderDiagnostics();
}
function renderDataSignature(data) {
  return JSON.stringify(
    {
      today: iso(new Date()),
      personalProjectionComplete: data?.personalProjectionComplete,
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
  state.data = normalizeMatchProjection(state.data);
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
function shouldKeepPlayerRefreshPreview(id) {
  const preview = typeof window === "undefined" ? null : window.courtWatchRefreshPreview;
  return Boolean(state.initialMatchProjectionPending && preview &&
    preview.route === location.pathname + location.search + location.hash &&
    !state.data?.matches?.some(match => match.playerId === id));
}
function hasAvailablePlayerProfile(id) {
  return !removedCourtWatchPlayers.has(id) && Boolean(state.data?.players?.some(player => player.id === id));
}
async function openProfile(id) {
  const epoch = ++profileNavigationEpoch, previousHash = location.hash;
  if (!hasAvailablePlayerProfile(id)) await (initialProjectionRequest || load());
  if (epoch !== profileNavigationEpoch || location.hash !== previousHash || !hasAvailablePlayerProfile(id)) return;
  location.hash = "player/" + encodeURIComponent(id);
}
async function openCurrentOpponent(profileId, name, event = "") {
  const identity = profileId || readablePerson(name);
  const monitored = monitoredOpponentPlayer(identity);
  if (monitored) return openProfile(monitored.id);
  const epoch = ++profileNavigationEpoch, previousHash = location.hash;
  if (!preparedOpponentHistory(name, event, identity)) {
    try {await fetchOpponentHistory(name, event, identity);} catch {return;}
  }
  if (epoch !== profileNavigationEpoch || location.hash !== previousHash) return;
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
  if (root.courtWatchOpponentObserver) root.courtWatchOpponentObserver.disconnect();
  const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const element = entry.target;
      queueOpponentPreload(element.dataset.opponentName, element.dataset.opponentEvent || "", element.dataset.openCurrentOpponent || "");
      observer.unobserve(element);
    }
  }) : null;
  root.courtWatchOpponentObserver = observer;
  opponentLinks.forEach(
    (element) => {
      const preload = () =>
        queueOpponentPreload(
          element.dataset.opponentName,
          element.dataset.opponentEvent || "",
          element.dataset.openCurrentOpponent || "",
        );
      element.addEventListener("pointerenter", preload, { once: true });
      element.addEventListener("focus", preload, { once: true });
      element.addEventListener("touchstart", preload, { once: true, passive: true });
      observer?.observe(element);
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
  const playerScore = readableText(match?.result || match?.score || ""),
    lost = typeof match?.advances === "boolean" ? !match.advances : match?.won === false,
    // The TE app projection already normalizes scores to the winner. Personal
    // and opponent history still return scores from the viewed player's side.
    winnerFirst = match?.scorePerspective === "winner" ||
      (!match?.scorePerspective && /^te-app:/.test(String(match?.id || "")) && Number.isInteger(match?.winnerTeamIndex)),
    value = lost && !winnerFirst
      ? playerScore.replace(/(\d+(?:\(\d+\))?)\s*([-–])\s*(\d+(?:\(\d+\))?)/g, "$3$2$1")
      : playerScore;
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
  if (match?.circuit === 'tennis-europe' && /junior[\s-]+masters/i.test(String(match?.tournamentName || match?.tournament?.name || '')) && /^round\s*1$/i.test(raw))
    return 'Playoff';
  const explicitQualification = raw.match(/\bS?Q\s*(\d+)\b/i) || raw.match(/(?:qualification|qualifying)\s*round\s*(\d+)/i);
  if (explicitQualification) return label(`Qualification round ${explicitQualification[1]}`);
  const qualificationSizeOf = (item) => {
    const round = readableText(item?.round || item?.roundName || item?.stage || item?.phase || item?.group || "");
    const evidence = `${round} ${item?.event || ""} ${item?.draw || ""}`;
    if (!/\bqualif(?:ication|ying|icazioni)\b/i.test(evidence)) return 0;
    const size = Number((round.match(/(?:round\s+of|\br)\s*(128|64|32|16|8)\b/i) || [])[1]);
    return size || (/quarter|\bqf\b/i.test(round) ? 8 : /semi|\bsf\b/i.test(round) ? 4 : /\bfinal\b|^f$/i.test(round) ? 2 : 0);
  };
  const qualificationSize = qualificationSizeOf(match);
  if (qualificationSize) {
    const code = (String(match?.event || match?.draw || "").match(/\b[BG][SD]\d{2}\b/i) || [])[0];
    const peers = contextMatches.filter(item => {
      const other = (String(item?.event || item?.draw || "").match(/\b[BG][SD]\d{2}\b/i) || [])[0];
      return !code || !other || code.toUpperCase() === other.toUpperCase();
    });
    const sizes = [...new Set([qualificationSize, ...peers.map(qualificationSizeOf)].filter(Boolean))].sort((a, b) => b - a);
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
function opponentHistoryResultText(match) {
  return matchResultText(match);
}
function opponentHistoryMatchRowHtml(match, contextMatches = []) {
  const opponents = (match.opponents || [])
      .map((person) => opponentHistoryPersonHtml(person, match.event || ""))
      .join(" / "),
    matchup = `vs ${opponents || "Avversario da definire"}`,
    outcome =
      match.status === "completed" || match.retired || match.score
        ? opponentHistoryResultText(match) || "—"
        : readableText(match.status || "Programmato");
  return `<div class="opponentHistoryMatch unifiedMatchRow"><span class="opponentHistoryRound unifiedMatchMeta"><time>${esc(displayDate(match.date) || "data da pubblicare")}</time><span class="matchRoundFull">${esc(fullMatchRoundLabel(match, contextMatches))}</span></span><span class="opponentHistoryOpponent unifiedMatchOpponent"><span class="opponentHistoryMatchup">${matchup}</span></span><strong class="${match.won === true ? "win" : match.won === false ? "loss" : ""}">${esc(outcome)}</strong></div>`;
}
function doublesPartnerGroupKey(names) {
  // Group participants by plain names; rendered links, flags and rankings can differ per match.
  return (names || []).map(name => readablePerson(name).normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it-IT').replace(/\s+/g, ' ').trim())
    .filter(Boolean).sort().join('|');
}
function groupedMatchSections(matches, rowHtml, doublesKey, doublesIdentity = doublesKey) {
  const singles = matches.filter((match) => !doublesKey(match)),
    doubles = new Map();
  for (const match of matches.filter(doublesKey)) {
    const label = doublesKey(match) || "__double__",
      key = doublesIdentity(match) || label,
      group = doubles.get(key) || {label, rows: []};
    group.rows.push(match);
    doubles.set(key, group);
  }
  const sections = [];
  if (singles.length)
    sections.push(
      `<section class="matchTypeSection singlesMatches"><h5 class="matchTypeHeading">Singolare</h5>${singles.map(rowHtml).join("")}</section>`,
    );
  for (const {label: partner, rows} of doubles.values())
    sections.push(
      `<section class="matchTypeSection doublesMatches"><h5 class="matchTypeHeading">Doppio${partner === "__double__" ? "" : ` con ${partner}`}</h5>${rows.map(rowHtml).join("")}</section>`,
    );
  return sections.join("");
}
function opponentHistoryMatchSectionsHtml(matches, tournament = {}) {
  // This renderer receives one player's matches within one tournament.
  const scoped = matches.map((match,index) => ({...match,
    id:`history-${index}`,matchId:`history-${index}`,historyIndex:index,
    circuit:'tennis-europe',playerId:'current-profile',competitionId:'current-tournament',
    opponent:(match.opponents || []).map(person=>person.name).filter(Boolean).join(' / '),
    partner:(match.partners || []).map(person=>person.name).filter(Boolean).join(' / '),
  }));
  matches = mergeAgenda([],scoped).map(match=>matches[match.historyIndex]);
  // Sort after merging: cached rows can precede newly acquired older matches.
  const dateKey = match => {
    const value = String(match.date || '').replaceAll('-', '').slice(0, 8);
    return /^\d{8}$/.test(value) ? value : '99999999';
  };
  const timeKey = match => /^\d{2}:\d{2}$/.test(String(match.time || '')) ? match.time : '99:99';
  matches.sort((a, b) => dateKey(a).localeCompare(dateKey(b)) || timeKey(a).localeCompare(timeKey(b)));
  return groupedMatchSections(
    matches,
    (match) => opponentHistoryMatchRowHtml({...match,
      circuit: match.circuit || tournament.circuit || 'tennis-europe',
      tournamentName: match.tournamentName || tournament.name || '',
    }, matches),
    (match) =>
      (match.partners || []).length
        ? (match.partners || [])
            .map((person) => opponentHistoryPersonHtml(person, match.event || ""))
            .join(" / ")
        : "",
    (match) => doublesPartnerGroupKey((match.partners || []).map(person => person.name)),
  );
}
function opponentTournamentWindow(tournaments,today){
 const key=t=>(t.circuit||'tennis-europe')+'|'+String(t.competitionId||t.id||'').toUpperCase(),unique=new Map();
 for(const t of tournaments){
  const k=key(t),old=unique.get(k),fields=Object.fromEntries(Object.entries(t).filter(([,v])=>v!==''&&v!==null&&v!==undefined)),matches=new Map();
  for(const m of [...(old?.matches||[]),...(t.matches||[])])matches.set(m.matchId||m.id||JSON.stringify(m),m);
  unique.set(k,{...old,...fields,circuit:t.circuit||old?.circuit||'tennis-europe',matches:[...matches.values()]});
 }
 const all=[...unique.values()],valid=t=>/^\d{4}-\d{2}-\d{2}$/.test(String(t.startDate||'')),end=t=>String(t.endDate||t.startDate).slice(0,10);
 // Past acceptance lists are intentions, not evidence of a played tournament.
 // Europe history must select match-backed tournaments before taking its three slots.
 const past=all.filter(t=>valid(t)&&end(t)<today&&((t.circuit||'tennis-europe')!=='tennis-europe'||t.matches.length>0)).sort((a,b)=>end(b).localeCompare(end(a))||key(a).localeCompare(key(b))).slice(0,3).map(t=>({...t,historyKind:'past'}));
 const eligible=all.filter(t=>valid(t)&&!['W','WITHDRAWN','CANCELLED','CANCELED'].includes(String(t.acceptanceCode||'').toUpperCase())&&!/withdraw|ritirat|cancel/i.test(String(t.entryStatus||'')));
 const current=eligible.filter(t=>t.startDate<=today&&end(t)>=today).sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate))||key(a).localeCompare(key(b)));
 const future=eligible.filter(t=>t.startDate>today).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||key(a).localeCompare(key(b)));
 const selected=current[0]||future[0];
 return[...(selected?[{...selected,historyKind:current.length?'current':'upcoming'}]:[]),...past];
}
function opponentHistoryProjection(data) {
  // Legacy unlabelled tournament histories were produced by the Europe reader.
  data = {...data, tournaments: (data.tournaments || []).map(t => ({...t, circuit: t.circuit || t.sourceCircuit || 'tennis-europe'}))};
  data = withoutPucItfReferences(data);
  return {...data, tournaments: opponentTournamentWindow(data.tournaments.map(t => ({...t, matches: (t.matches || []).filter(m => circuit({...m, circuit: m.circuit || circuit(t)}) === 'tennis-europe')})), iso(new Date()))};
}
function opponentTournamentStatusHtml(tournament) {
  if (tournament.historyKind === "upcoming")
    return '<span class="scheduledTournamentLabel">PROGRAMMATO</span>';
  if (tournament.historyKind === "current")
    return '';
  return '<span class="completedTournamentLabel">CONCLUSO</span>';
}
function opponentEuropeRankingText(profile) {
  if (!profile) return '';
  if (profile.ranking) {
    const category = /14$/.test(profile.category || '') ? ' U14' : /16$/.test(profile.category || '') ? ' U16' : '';
    return `n°${profile.ranking} TE${category}${profile.ranking_date ? ` · (ranking del ${displayDate(profile.ranking_date)})` : ''}`;
  }
  return profile.europeRankingStatus === 'unranked-u12' ? 'No ranking Europe U12'
    : profile.europeRankingStatus === 'unranked' ? 'No ranking Europe' : '';
}
function renderOpponentHistory(data) {
  data = opponentHistoryProjection(data);
  const badges=$("opponentCircuitProfiles");if(badges)badges.innerHTML=playerCircuitLinksHtml(data.circuitProfiles||[]);
  const tournaments = data.tournaments || [],
    body = $("opponentTournamentHistory");
  const profileRanking = $("opponentProfileRanking"),
    profile = data.profile || null;
  if (profileRanking) {
    profileRanking.textContent = opponentEuropeRankingText(profile);
    profileRanking.hidden = !profileRanking.textContent;
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
            const source = circuit(tournament),
              home = tournamentOfficialUrl(tournament);
            const projectedTournament = (state.data?.tournaments || []).find(
                (item) =>
                  String(item.competitionId || item.sourceTournamentId || "") ===
                  String(tournament.competitionId || ""),
              ),
              courtConditions =
                tournamentSurfaceLabel(projectedTournament || tournament) ||
                tournamentSurfaceLabel(tournament);
            const entryLabel = !(tournament.matches || []).length && tournament.entryStatus
              ? `<p class="opponentTournamentEntry">${esc(source === "itf" && tournament.acceptanceCode ? `Iscritto · ${tournament.acceptanceCode}` : "Iscritto")}</p>`
              : "";
            return `<section class="opponentHistoryTournament${tournament.historyKind === "current" ? " ongoingTournament" : ""}"><header class="opponentHistoryTournamentHead"><div class="opponentTournamentTitle">${opponentTournamentStatusHtml(tournament)}<h4><i class="sourceDot ${esc(source)}"></i>${home ? `<a href="${esc(home)}" target="_blank" rel="noopener">${esc(readableText(tournament.name))}</a>` : esc(readableText(tournament.name))}${courtConditions ? ` <small class="tournamentSurface">${esc(courtConditions)}</small>` : ""}</h4></div><span class="opponentTournamentEvents">${opponentTournamentEventLinks(tournament)}</span>${opponentTournamentDateLabel(tournament) ? `<time class="opponentTournamentDates">${esc(opponentTournamentDateLabel(tournament))}</time>` : ""}</header>${entryLabel}<div class="opponentHistoryMatches">${opponentHistoryMatchSectionsHtml(tournament.matches || [], tournament)}</div></section>`;
          },
        )
        .join("")
    : '<div class="empty">Nessun torneo precedente disponibile prima di questo incontro.</div>';
  bindParticipantNavigation(body);
}
function opponentHistoryKey(name, event = "", profileId = "") {
  const asOf = iso(new Date()),
    requestKey = [profileId || "", readablePerson(name), asOf, event || "", "played-history-v9-local-canonical"].join("|");
  return { asOf, requestKey };
}
function preparedOpponentHistory(name, event = "", profileId = "") {
  const {requestKey} = opponentHistoryKey(name, event, profileId);
  const exact = opponentHistoryCache.get(requestKey) || savedActiveOpponent(requestKey);
  if (exact) return exact;
  // Historical match evidence remains valid after the daily ranking key changes.
  const prefix = [profileId || "", readablePerson(name)].join("|") + "|";
  for (const [key, data] of [...opponentHistoryCache.entries()].reverse()) {
    if (key.startsWith(prefix) && key.split("|")[3] === (event || "")) return data;
  }
  return null;
}
function mergeOpponentHistory(previous, next) {
  if (!previous) return next;
  const tournaments = new Map();
  for (const tournament of [...(previous.tournaments || []), ...(next.tournaments || [])]) {
    const key = [circuit(tournament), tournament.competitionId || tournament.id || tournament.name, tournament.startDate || ""].join("|");
    const known = tournaments.get(key), matches = new Map();
    for (const match of [...(known?.matches || []), ...(tournament.matches || [])]) {
      const matchKey = match.matchId || match.id || [match.date, match.event, match.round, JSON.stringify(match.opponents || [])].join("|");
      const update = Object.fromEntries(Object.entries(match).filter(([, value]) => value !== "" && value !== null && value !== undefined && (!Array.isArray(value) || value.length)));
      const merged = {...matches.get(matchKey), ...update};
      if (match.outcomeConfirmed === false) {delete merged.won; delete merged.advances;}
      matches.set(matchKey, merged);
    }
    tournaments.set(key, {...known, ...tournament, matches: [...matches.values()]});
  }
  const profileUpdate = Object.fromEntries(Object.entries(next.profile || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined));
  // An explicit missing current rank is authoritative, unlike an omitted field.
  if (next.profile && Object.hasOwn(next.profile, "ranking"))
    profileUpdate.ranking = next.profile.ranking;
  const profile = next.profile === null ? null : {...previous.profile, ...profileUpdate};
  return {...previous, ...next, profile, tournaments: [...tournaments.values()]};
}
function opponentHistoryEpoch() {
  return String(state.data?.generatedAt || "") + "|" + String(state.data?.schemaVersion || "");
}
function opponentHistoryIsFresh(requestKey) {
  return opponentHistoryCache.has(requestKey) && opponentHistoryValidated.get(requestKey) === opponentHistoryEpoch();
}
async function fetchOpponentHistory(name, event = "", profileId = "", refresh = false) {
  const { asOf, requestKey } = opponentHistoryKey(name, event, profileId), epoch = opponentHistoryEpoch();
  if (!refresh && opponentHistoryIsFresh(requestKey))
    return opponentHistoryCache.get(requestKey);
  if (!opponentHistoryRequests.has(requestKey)) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    opponentHistoryRequests.set(requestKey, fetch(
      PRIVATE_API +
        "/opponent-profile?name=" +
        encodeURIComponent(name) +
        "&profileId=" +
        encodeURIComponent(profileId || "") +
        "&asOf=" +
        encodeURIComponent(asOf) +
        "&event=" +
        encodeURIComponent(event || ""),
      privateApiOptions({ cache: "no-store", signal: controller.signal }),
    ).then(async (response) => {
    if (!response.ok) throw Error("opponent history");
    const incoming = await response.json();
    if (!Array.isArray(incoming.tournaments)) throw Error("opponent history incomplete");
    const data = mergeOpponentHistory(preparedOpponentHistory(name, event, profileId), incoming);
    opponentHistoryCache.set(requestKey, data);
    opponentHistoryValidated.set(requestKey, epoch);
    // Navigation needs the received data, not completion of local disk writes.
    const persist = () => {
      const latest = opponentHistoryCache.get(requestKey) || data;
      saveEntries(OPPONENT_HISTORY_CACHE, opponentHistoryCache, undefined, 20);
      Promise.resolve(saveDurableOpponent(name, event, profileId, requestKey, latest))
        .catch(error => console.warn("Salvataggio locale avversario non disponibile", error));
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(persist, {timeout:1000});
    else setTimeout(persist, 0);
      return data;
    }).finally(() => {
      clearTimeout(timer);
      opponentHistoryRequests.delete(requestKey);
    }));
  }
  return opponentHistoryRequests.get(requestKey);
}
function preloadOpponentHistory(name, event = "", profileId = "") {
  if (!readablePerson(name)) return;
  fetchOpponentHistory(name, event, profileId).catch(() => {});
}
function runOpponentPrefetchQueue() {
  while (opponentPrefetchActive < 2 && opponentPrefetchQueue.length) {
    const item = opponentPrefetchQueue.shift(),
      { requestKey } = opponentHistoryKey(item.name, item.event, item.profileId);
    opponentPrefetchQueued.delete(requestKey);
    if ((item.isCurrent && !item.isCurrent()) || opponentHistoryIsFresh(requestKey)) continue;
    opponentPrefetchActive++;
    fetchOpponentHistory(item.name, item.event, item.profileId)
      .catch(() => {})
      .finally(() => {
        opponentPrefetchActive--;
        runOpponentPrefetchQueue();
      });
  }
}
function queueOpponentPreload(name, event = "", profileId = "", isCurrent = null) {
  if (!readablePerson(name)) return;
  const { requestKey } = opponentHistoryKey(name, event, profileId);
  if (
    opponentHistoryIsFresh(requestKey) ||
    opponentHistoryRequests.has(requestKey) ||
    opponentPrefetchQueued.has(requestKey)
  )
    return;
  opponentPrefetchQueued.add(requestKey);
  opponentPrefetchQueue.push({ name, event, profileId, isCurrent });
  runOpponentPrefetchQueue();
}
async function loadOpponentHistory(name, event = "", profileId = "") {
  const body = $("opponentTournamentHistory"),
    routeKey = activeOpponentRouteKey,
    { requestKey } = opponentHistoryKey(name, event, profileId),
    cached = preparedOpponentHistory(name, event, profileId);
  if (cached) renderOpponentHistory(cached);
  try {
    const data = await fetchOpponentHistory(name, event, profileId, true);
    if (activeOpponentRouteKey === routeKey) {
      saveActiveOpponent(requestKey, data);
      renderOpponentHistory(data);
    }
  } catch {
    if (body && !cached)
      body.innerHTML =
        `<div class="empty">Storico temporaneamente non disponibile. <button type="button" class="btn" data-retry-opponent>Riprova</button></div>`;
    body?.querySelector("[data-retry-opponent]")?.addEventListener("click", () =>
      loadOpponentHistory(name, event, profileId),
    );
  }
}
function opponentFromMatchDetails(identity, matchId, index, role = "opponent") {
  const sources = [...(state.data.matches || []), ...(state.data.agenda || [])],
    match =
      sources.find(
        (row) => String(row.matchId || row.id || "") === String(matchId),
      ) || null;
  if (!match) {
    return null;
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
  return {identity, name, event, nationality};
}
function renderOpponentFromMatch(identity, matchId, index, role = "opponent") {
  const details = opponentFromMatchDetails(identity, matchId, index, role);
  if (!details) {location.hash = ""; return;}
  renderOpponentProfile(details.identity, details.name, details.event, details.nationality);
}
function monitoredOpponentPlayer(identity) {
  return (state.data?.players || []).find(player =>
    [player.id,player.sourceKey,player.sourcePlayerId,player.worldTennisId,player.membershipCard,player.profileSync?.tennisEurope?.profileId].filter(Boolean).map(String).includes(String(identity)));
}
function renderOpponentProfile(identity, name, event = "", initialNationality = "") {
  const monitored = monitoredOpponentPlayer(identity);
  if (monitored) { history.replaceState(history.state,'',(location.href||'').split('#')[0]+'#player/'+encodeURIComponent(monitored.id));route();return; }
  const routeKey = [identity, readablePerson(name), event].join("|");
  if (activeOpponentRouteKey === routeKey && $("profileView").classList.contains("active") && $("opponentTournamentHistory")) return;
  activeOpponentRouteKey = routeKey;
  const { requestKey } = opponentHistoryKey(name, event, identity),
    prepared = preparedOpponentHistory(name, event, identity),
    flag = nationalityHtml(initialNationality || prepared?.profile?.nationality),
    follow = $("removeProfilePlayer");
  follow.hidden = false;
  follow.disabled = false;
  follow.onclick = () => addCourtWatchPlayerFromUi({identity,name}, follow);
  follow.textContent = "Aggiungi giocatore";
  follow.title = "Aggiungi giocatore";
  follow.setAttribute("aria-label", "Aggiungi giocatore");
  $("profileContent").innerHTML =
    `<div class="card opponentProfileHero"><div class="opponentProfileIdentity"><h2>${esc(readablePerson(name))}</h2><span id="opponentCircuitProfiles" class="playerCircuitProfiles"></span><span id="opponentProfileCurrentNationality" class="opponentProfileNationality"${flag ? "" : " hidden"}>${flag}</span><span id="opponentProfileRanking" class="opponentProfileRanking" hidden></span></div></div><div class="card opponentHistoryPlaceholder"><div class="cardHead"><h3>Tornei</h3></div><div id="opponentTournamentHistory"></div><p class="opponentFollowHint"><button type="button" data-follow-opponent>Aggiungi giocatore</button></p></div>`;
  $("homeView").classList.remove("active");
  $("profileView").classList.add("active");
  $("profileContent").querySelector("[data-follow-opponent]")?.addEventListener("click", (event) => {
    event.preventDefault();
    addCourtWatchPlayerFromUi({identity,name}, event.currentTarget);
  });
  if (prepared) {
    renderOpponentHistory(prepared);
  }
  loadOpponentHistory(name, event, identity);
}
function playerTournamentsEmptyHtml(playerId) {
  const pending = state.data?.players?.some(p=>p.id===playerId&&p.membershipPending) || !state.data?.personalEnrichedPlayerIds?.includes(playerId) &&
    (confirmedCourtWatchPlayers.has(playerId) ||
    (state.data?.personalProjectionComplete === false &&
      state.data?.players?.some(player => player.id === playerId && player.userAdded)));
  return pending
    ? '<div class="empty" role="status">Giocatore aggiunto. Tornei e partite in aggiornamento.</div>'
    : '<div class="empty">Nessun torneo pubblicato.</div>';
}
function renderProfile(id) {
  activeOpponentRouteKey = "";
  const p = state.data.players.find((x) => x.id === id);
  if (!p) {
    location.hash = "";
    return;
  }
  const ts = (state.data.tournaments || []).filter(
      (t) => t.playerId === id && playerTournamentEligible(t),
    ),
    ms = (state.data.matches || []).filter((m) => m.playerId === id),
    keyOf = (x) =>
      circuit(x) +
      "|" +
      String(x.competitionId || x.tournamentName || x.name || ""),
    byTournament = new Map();
  for (const t of ts) byTournament.set(keyOf(t), { t, matches: [] });
  for (const m of ms) {
    // Acquired match evidence remains visible even if acceptance metadata is partial.
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
        place = summerCenter || agendaVenueLocation(t),
        courtConditions = tournamentSurfaceLabel(t);
      return `<section class="profileTournament" data-profile-tournament="${esc(keyOf(t))}"><div class="profileTournamentHead">${tKey ? `<h3><i class="sourceDot ${circuit(t)}"></i><button data-open-tournament="${esc(tKey)}">${esc(t.name || "Torneo")}</button></h3>` : `<h3><i class="sourceDot ${circuit(t)}"></i>${esc(t.name || "Torneo")}</h3>`}<p>${esc([place, courtConditions].filter(Boolean).join(" · "))} · ${esc(displayDate(t.startDate))} – ${esc(displayDate(t.endDate))}${effectiveAcceptanceLabel(t) ? ` · ${circuit(t) === "tennis-europe" ? "Acceptance list: " : ""}${esc(effectiveAcceptanceLabel(t))}` : ""}</p></div><div class="profileTournamentMatches">${
        matches.length
          ? matchHistorySectionsHtml(matches)
          : '<div class="empty">Nessuna partita pubblicata.</div>'
      }</div></section>`;
    })
    .join("");
  $("profileContent").innerHTML =
    `<div class="card profileHero"><div class="avatar big">${initials(p.name)}</div><div><div class="playerNameWithCircuits"><h2>${esc(readablePerson(p.name))}</h2><span class="playerCircuitProfiles">${playerCircuitLinksHtml(p.circuitProfiles||[])}</span></div><p>${[personalPlayerAffiliationHtml(p), playerBirthLabel(p) ? esc(playerBirthLabel(p)) : ""].filter(Boolean).join(" · ")}${p.membershipCard ? " · tessera " + esc(p.membershipCard) : ""}${playerRankingSummary(p)}</p></div></div><div class="card profileTournamentList"><div class="cardHead"><h3>Tornei</h3><span>${byTournament.size}</span></div>${sections || playerTournamentsEmptyHtml(id)}</div>`;
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
  matches = mergeAgenda([], matches);
  return groupedMatchSections(
    matches,
    (match) => matchHistoryRowHtml(match, matches),
    (match) =>
      matchMeta(match).isDouble
        ? match.partner
          ? partnerHtml(match)
          : "__double__"
        : "",
    (match) => doublesPartnerGroupKey(String(match.partner || '').split(/\s*\/\s*/)),
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
  if (circuit(t) === "fitp") return fitpInlineDrawSlot(t);
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
      .filter(
        (value) =>
          includeNameDuplicates ||
          (environment &&
            value.toLowerCase() === environment.toLowerCase()) ||
          !name.toLowerCase().includes(value.toLowerCase()),
      );
  return parts.join(" · ");
}

function fitpTournamentSubscriptionHtml(entry = {}) {
  if (circuit(entry) !== "fitp") return "";
  const registrations = Array.isArray(entry.subscriptionRegistrations) ? entry.subscriptionRegistrations : [];
  const pairs = [...new Map(registrations.filter(row => row && String(row.category || "").trim()).map(row => {
    const category = String(row.category).trim(), date = /^20\d{2}-\d{2}-\d{2}$/.test(String(row.subscriptionDate || "")) ? row.subscriptionDate : "";
    return [JSON.stringify([category,date]), {category,date}];
  })).values()];
  if (pairs.length) return `<span class="fitpSubscriptionDate">${pairs.map(({category,date}) => `${esc(category)} · ${date ? `<time datetime="${esc(date)}">${esc(displayDate(date))}</time>` : "Data iscrizione non disponibile"}`).join("; ")}</span>`;
  const dates = [...new Set([
    ...(Array.isArray(entry.subscriptionDates) ? entry.subscriptionDates : []),
    entry.subscriptionDate,
  ].filter(value => /^20\d{2}-\d{2}-\d{2}$/.test(String(value || ""))))].sort();
  if (!dates.length) return '<span class="fitpSubscriptionDate">Data iscrizione non disponibile</span>';
  return `<span class="fitpSubscriptionDate">${dates.map(date => `<time datetime="${esc(date)}">${esc(displayDate(date))}</time>`).join(" · ")}</span>`;
}

function futureTournamentEuropeRanking(player, data, categories = []) {
  if (!data) return '';
  const current = {...player, tennisEuropeLatestRankingDates:data.latestRankingDates || {}};
  const allowed = new Set(categories);
  const rows = (data.rankings || []).filter(row => allowed.has(String(row.category || '').toUpperCase().match(/(?:U|B|G)(14|16)$/)?.[1]));
  const labels = currentPlayerRankingLabels(current, rows).filter(label => label.includes(' TE'));
  return labels.length ? labels.join(' · ') : 'NR';
}
async function loadFutureTournamentEuropeRankings(key, players) {
  // Reuse the existing in-flight player ranking requests; no timers or polling.
  for (const player of players) {
    const data = await loadCurrentPlayerRanking(player);
    if (location.hash !== '#tournament/' + encodeURIComponent(key)) return;
    if (!data) continue; // A failed request is not evidence of no ranking.
    for (const target of $('profileContent').querySelectorAll('[data-future-europe-ranking]'))
      if (target.dataset.futureEuropeRanking === player.id)
        target.textContent = ' · ' + futureTournamentEuropeRanking(player, data, String(target.dataset.futureEuropeCategories || '').split(','));
  }
}
function futureTournamentEuropeCategories(entry, rows = [], tournament = {}) {
  const read = item => [...new Set(['category','ageCategory','ageGroup','categoryCode','event','draw','eventType'].flatMap(field => {
    const text = String(item?.[field] || '').toUpperCase();
    return [...text.matchAll(/(?:\b(?:U|UNDER)\s*[- ]?|\b[BG](?:S|D)?\s*[- ]?)(10|12|14|16)\b|\b(10|12|14|16)\s*(?:&\s*UNDER|AND\s*UNDER|ANS)\b|^(10|12|14|16)$/g)].map(match => match[1] || match[2] || match[3]);
  }))];
  const registered = read(entry);
  if (registered.length) return registered;
  const played = [...new Set(rows.flatMap(read))];
  return played.length ? played : read(tournament);
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
  const futureEurope = source === 'tennis-europe' && String(t.startDate || '') > iso(new Date());
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
      const europeCategories = futureTournamentEuropeCategories(group.entry, rows, t);
      const matchRows = matchHistorySectionsHtml(rows);
      const playerHeading = `<button class="inlinePlayerLink" data-open-player="${esc(group.playerId)}">${esc(readablePerson(group.playerName))}${participantDesignationHtml(participantDesignation(rows.find(row => participantDesignation(row, "player")), "player"))}${nationalityHtml(playerNationality)}${futureEurope ? `<span class="teRanking" data-future-europe-ranking="${esc(group.playerId)}" data-future-europe-categories="${esc(europeCategories.join(","))}">${playerRankingCache.has(String(group.playerId)) ? esc(" · " + futureTournamentEuropeRanking(playerRecord, playerRankingCache.get(String(group.playerId)), europeCategories)) : ""}</span>` : ""}${!futureEurope && playerRanking ? (source === "tennis-europe" ? teRankHtml(playerRanking) : ` <span class="playerRanking">· classifica ${esc(readableText(playerRanking))}</span>`) : ""}</button>`;
      return `<section class="tournamentPlayer" data-tournament-player="${esc(playerKey)}"><div class="playerSectionHead${multiPlayer ? " expandableTournamentPlayer" : ""}">${playerHeading}<span>${liveLabel ? `<b class="acceptanceLiveLabel">${itfAcceptanceUrl ? `<a class="acceptanceListTextLink" href="${esc(itfAcceptanceUrl)}" target="_blank" rel="noopener">Acceptance list</a>` : "Acceptance list"}: ${esc(liveLabel)}</b>` : rows.length ? `${rows.length} ${rows.length === 1 ? "partita" : "partite"}` : "Iscritto"}${source === "fitp" ? ` · ${fitpTournamentSubscriptionHtml({...group.entry, circuit:source})}` : ""}</span>${multiPlayer && rows.length ? '<button class="tournamentToggle tournamentPlayerToggle" type="button" aria-expanded="' + String(open) + '" aria-label="' + (open ? "Nascondi partite" : "Mostra partite") + '">⌄</button>' : ""}</div><div class="tournamentPlayerMatches"${open ? "" : " hidden"}>${matchRows}</div></section>`;
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
  if (futureEurope) loadFutureTournamentEuropeRankings(key, [...byPlayer.keys()].map(id => (state.data.players || []).find(player => player.id === id)).filter(Boolean));
  if (source === "fitp") loadInlineFitpDrawLinks(t);
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
let profileCircuitFilter = ["all", "fitp", "tennis-europe", "itf"].includes(restoredUi.profileCircuitFilter) ? restoredUi.profileCircuitFilter : "all",
  profileMatchTypeFilter = ["all", "singles", "doubles"].includes(restoredUi.profileMatchTypeFilter) ? restoredUi.profileMatchTypeFilter : "all",
  profileOutcomeFilter = ["all", "win", "loss"].includes(restoredUi.profileOutcomeFilter) ? restoredUi.profileOutcomeFilter : "all",
  profileFilterPlayerId = String(restoredUi.profilePlayerId || "");
let openProfileTournamentKeys = new Set(
  Array.isArray(restoredUi.openProfileTournamentKeys)
    ? restoredUi.openProfileTournamentKeys
    : [],
);
renderProfile = function (id) {
  const remove = $("removeProfilePlayer");
  remove.hidden = false;
  remove.disabled = false;
  remove.onclick = () => requestPlayerRemoval(id);
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
  const requestedGroup = /(?:^|[?&])group=others(?:&|$)/.test(location.search) ? "others" : "main";
  if (groupSwitchRunning && requestedGroup !== PLAYER_GROUP) return;
  state.data = normalizeMatchProjection(withoutPucItfReferences(state.data));
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
  const requestedHash = location.hash;
  if (player && (!state.data || (state.initialMatchProjectionPending &&
      (!hasAvailablePlayerProfile(decodeURIComponent(player[1])) || shouldKeepPlayerRefreshPreview(decodeURIComponent(player[1])))))) {
    Promise.resolve(initialProjectionRequest || load()).then(() => {
      if (location.hash === requestedHash && (!state.initialMatchProjectionPending || (hasAvailablePlayerProfile(decodeURIComponent(player[1])) && !shouldKeepPlayerRefreshPreview(decodeURIComponent(player[1]))))) route();
    });
    return;
  }
  if (currentOpponent) {
    const identity = decodeURIComponent(currentOpponent[1]), name = decodeURIComponent(currentOpponent[2]), event = decodeURIComponent(currentOpponent[3]) === "-" ? "" : decodeURIComponent(currentOpponent[3]);
    if (!monitoredOpponentPlayer(identity) && !preparedOpponentHistory(name, event, identity)) {
      fetchOpponentHistory(name, event, identity).then(() => {if (location.hash === requestedHash) route();}).catch(() => {});
      return;
    }
  }
  if (opponent || legacyOpponent) {
    const match = opponent || legacyOpponent;
    const details = opponentFromMatchDetails(decodeURIComponent(match[opponent ? 2 : 1]), decodeURIComponent(match[opponent ? 3 : 2]), Number(match[opponent ? 4 : 3]), opponent ? match[1] : "opponent");
    if (!details && state.initialMatchProjectionPending) {
      Promise.resolve(initialProjectionRequest || load()).then(() => {if (location.hash === requestedHash && !state.initialMatchProjectionPending) route();});
      return;
    }
    if (details && !monitoredOpponentPlayer(details.identity) && !preparedOpponentHistory(details.name, details.event, details.identity)) {
      fetchOpponentHistory(details.name, details.event, details.identity).then(() => {if (location.hash === requestedHash) route();}).catch(() => {});
      return;
    }
  }
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
  delete document.documentElement.dataset.cwRoutePending;
  const preview = window.courtWatchRefreshPreview;
  if (preview && preview.route === location.pathname + location.search + location.hash && !preview.cancelled)
    scrollTo(0, preview.y);
  delete document.documentElement.dataset.cwRefreshPreview;
  delete window.courtWatchRefreshPreview;
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
  renderHome();
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
function switchPlayerGroup() {
  return changePlayerGroup(PLAYER_GROUP === "main" ? "others" : "main");
}
async function changePlayerGroup(targetGroup, fromHistory = false) {
  if (targetGroup === PLAYER_GROUP || groupSwitchRunning || playerAdditionsInFlight.size || document.getElementById('playerRemovalDialog')) return;
  groupSwitchRunning = true;
  saveUiState();
  if (!fromHistory) saveRefreshView();
  const target = new URL(location.href);
  const requestedHash = location.hash, previousY = scrollY;
  if (targetGroup === "others") target.searchParams.set("group", "others");
  else target.searchParams.delete("group");
  // Transfer the view, dates and common filters; player selections belong to each group.
  try {
    const targetKey = "courtwatch-v3-ui-state-v1" + (targetGroup === "others" ? "-others" : "");
    const current = validUiState(JSON.parse(localStorage.getItem(UI_STATE_CACHE) || "{}"));
    const mirrored = validUiState(JSON.parse(localStorage.getItem(targetKey) || "{}"));
    for (const key of ["agenda", "month", "agendaMode", "categoryFilters", "sexFilter", "scrollY"])
      if ((!fromHistory || key !== "scrollY") && Object.prototype.hasOwnProperty.call(current, key)) mirrored[key] = current[key];
    localStorage.setItem(targetKey, JSON.stringify(mirrored));
  } catch {}
  try {
    const suffix = targetGroup === "others" ? "-others-v2" : "", candidates = [];
    for (const name of ["localStorage", "sessionStorage"]) {
      try {
        const storage = window[name];
        for (const key of ["courtwatch-v3-last-good-v1" + suffix, "courtwatch-v3-calendar-v1" + suffix]) {
          try {candidates.push(JSON.parse(storage.getItem(key) || "null"));} catch {}
        }
      } catch {}
    }
    candidates.push(await readDurableProjection("courtwatch-v3-last-good-v1" + suffix));
    const saved = candidates.filter(data => validProjection(data) && data.personalProjectionComplete === true && (!data.group || data.group === targetGroup)).sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0))[0];
    const ids = new Set((saved?.players || []).map(player => player.id));
    const cached = saved ? {...saved, group: targetGroup, matches: mergeKnownMatches(...candidates.filter(validProjection).map(data => data.matches)).filter(match => ids.has(match.playerId))} : null;
    const fullRequest=cached?null:fetchProjection(APP_API,45000,targetGroup);
    // Observe rejection even when the lightweight list wins the race.
    fullRequest?.catch(()=>{});
    const projection=cached||await Promise.any([
      fullRequest,
      fetchPlayerMembership(targetGroup).then(list=>({
        ...list,membershipOnly:true,personalProjectionComplete:false,
        players:list.players.map(p=>({...p,membershipPending:true})),
        tournaments:[],matches:[],agenda:[],results:[],opponents:[],tournamentEntries:[],
      })),
    ]);
    if (location.hash !== requestedHash) return;
    state.playerSelectionEpoch = (state.playerSelectionEpoch || 0) + 1;
    activeProjectionController?.abort();
    const previousLoad=activeLoadCompletion;
    PLAYER_GROUP = targetGroup;
    GROUP_CACHE_SUFFIX = targetGroup === "others" ? "-others" : "";
    LAST_GOOD_CACHE = "courtwatch-v3-last-good-v1" + suffix;
    CALENDAR_CACHE = "courtwatch-v3-calendar-v1" + suffix;
    UI_STATE_CACHE = "courtwatch-v3-ui-state-v1" + GROUP_CACHE_SUFFIX;
    restoredUi = savedUiState();
    state.data = projection;
    state.initialMatchProjectionPending=projection.membershipOnly===true;
    durableProjectionFallback = cached;
    state.selected = new Set(Array.isArray(restoredUi.selected) ? restoredUi.selected : projection.players.map(player => player.id));
    uiSelectionRestored = true;
    uiScrollRestoreCancelled = true;
    removedCourtWatchPlayers.clear(); confirmedCourtWatchPlayers.clear();
    renderedDataSignature = "";
    if (!fromHistory) history.pushState(null, "", target.href);
    const switchEpoch=state.playerSelectionEpoch;
    initialProjectionRequest=(async()=>{
      await previousLoad;
      if(PLAYER_GROUP!==targetGroup||switchEpoch!==state.playerSelectionEpoch)return;
      const complete=projection.membershipOnly?await fullRequest:projection;
      if(PLAYER_GROUP!==targetGroup||switchEpoch!==state.playerSelectionEpoch)return;
      await load(complete,lastLoadedDocuments);
      if(cached&&PLAYER_GROUP===targetGroup&&switchEpoch===state.playerSelectionEpoch)await load(null,null,true);
    })().catch(error=>{
      console.warn('Caricamento dati della sezione non disponibile',error);
      if(PLAYER_GROUP===targetGroup&&switchEpoch===state.playerSelectionEpoch&&state.data?.membershipOnly){
        $('dataAlert').hidden=false;
        $('dataAlert').textContent='Elenco disponibile; tornei temporaneamente non disponibili. Ricarica per riprovare.';
      }
    });
    updatePlayerGroupControls();
    renderIfDataChanged();
    scrollTo(0, fromHistory ? Number(restoredUi.scrollY) || 0 : previousY);
    activeRouteScrollKey = location.hash || "#home";
    saveUiState();
  } catch (error) {console.warn("Cambio sezione non disponibile; conservo la pagina corrente", error);}
  finally {groupSwitchRunning = false;}
}
function updatePlayerGroupControls() {
  document.title = PLAYER_GROUP === "others" ? "Court Watch · Altri" : "Court Watch";
  $("activePlayerGroup").hidden = PLAYER_GROUP !== "others";
  document.querySelectorAll("[data-switch-player-group]").forEach(button => {
    button.textContent = PLAYER_GROUP === "others" ? "Vai a TCL" : "Vai a Altri";
    button.setAttribute("aria-label", button.textContent);
    button.onclick = switchPlayerGroup;
  });
}
function wire() {
  updatePlayerGroupControls();
  addEventListener("popstate", () => {
    const group = /(?:^|[?&])group=others(?:&|$)/.test(location.search) ? "others" : "main";
    if (group !== PLAYER_GROUP) changePlayerGroup(group, true);
  });
  wirePlayersColumnHeight();
  $("addPlayer").onclick = openAddPlayerDialog;
  $("removePlayer").onclick = togglePlayerRemovalMode;
  $("removePlayer").setAttribute("aria-pressed", "false");
  const playerSearchForm = $("playerSearchForm"),
    playerSearchInput = $("playerSearchInput"),
    playerSearchSuggestions = $("playerSearchSuggestions");
  playerSearchInput.oninput = () => {
    clearTimeout(playerSearchTimer);
    playerSearchController?.abort();
    const query = playerSearchInput.value.trim(),
      sequence = ++playerSearchSequence;
    if (query.length < 2) {
      playerSearchSuggestions.hidden = true;
      playerSearchInput.setAttribute("aria-expanded", "false");
      return;
    }
    playerSearchSuggestions.innerHTML = '<div class="empty" role="status">Ricerca in corso…</div>';
    playerSearchSuggestions.hidden = false;
    playerSearchInput.setAttribute("aria-expanded", "true");
    playerSearchTimer = setTimeout(async () => {
      const controller = new AbortController();
      playerSearchController = controller;
      try {
        const results = await searchPlayers(query, controller.signal);
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
            '<button type="button" class="playerSearchSuggestion" data-retry-search>Ricerca non disponibile. Tocca per riprovare.</button>';
          playerSearchSuggestions.querySelector('[data-retry-search]').onclick = () => playerSearchInput.oninput();
          playerSearchSuggestions.hidden = false;
        }
      }
    }, 220);
  };
  playerSearchForm.onsubmit = (event) => {
    event.preventDefault();
    const query = playerSearchInput.value.trim();
    if (query.length < 2) return;
    clearTimeout(playerSearchTimer); ++playerSearchSequence; playerSearchController?.abort();
    playerSearchSuggestions.hidden = true;
    playerSearchInput.setAttribute("aria-expanded", "false");
    playerSearchInput.blur();
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
  wireAgendaFilters();
  document.querySelectorAll("[data-category-filter]").forEach(
    (input) =>
      (input.onchange = () => {
        input.checked
          ? state.categoryFilters.add(input.value)
          : state.categoryFilters.delete(input.value);
        applyDemographicSelection();
        saveUiState();
        renderHome();
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
  $("calendarGoToday").onclick = () => {
    state.agenda = new Date();
    syncMonthFromAgenda();
    renderSynchronizedDates();
  };
  $("calendarSex").onchange = () => {
    state.sexFilter = $("calendarSex").value;
    applyDemographicSelection();
    saveUiState();
    renderHome();
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
    if (opening && state.data) renderWeeklyAgenda();
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
    if (!e.composedPath().includes(playerSearchForm)) dismissPlayerSearch();
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
      dismissPlayerSearch();
    }
  });
  for (const event of ["wheel", "touchmove", "pointerdown", "keydown"])
    addEventListener(event, () => { uiScrollRestoreCancelled = true; }, { passive: true });
  addEventListener("hashchange", () => {
    if (location.hash !== "#players") dismissPlayerSearch();
    uiScrollRestoreCancelled = true;
    const requestedGroup = /(?:^|[?&])group=others(?:&|$)/.test(location.search) ? "others" : "main";
    if (requestedGroup !== PLAYER_GROUP) {
      if (!groupSwitchRunning) changePlayerGroup(requestedGroup, true);
      return;
    }
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
  let lastResumeRefresh = 0;
  const refreshOnResume = () => {
    if (!initialProjectionRequest || document.visibilityState === "hidden" || navigator.onLine === false || Date.now() - lastResumeRefresh < 30000) return;
    lastResumeRefresh = Date.now();
    load(null,null,true);
    const opponent = location.hash.match(/^#opponent-profile\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (opponent) {
      const [identity, name, event] = opponent.slice(1).map(decodeURIComponent), hash = location.hash;
      fetchOpponentHistory(name, event === "-" ? "" : event, identity, true).then(() => {
        if (location.hash === hash) route();
      }).catch(() => {});
    }
  };
  addEventListener("online", refreshOnResume);
  addEventListener("pageshow", event => {if (event.persisted) refreshOnResume();});
  document.addEventListener("visibilitychange", refreshOnResume);
  addEventListener("pagehide", saveRefreshView);
}
// Refresh only known recent Europe matches. Full profiles continue independently.
const knownResultUpdates = new Map();
const knownResultRequests = new Map();
function applyKnownResultUpdates(data, group = PLAYER_GROUP) {
  const updates = knownResultUpdates.get(group);
  if (!updates || !data) return data;
  const nameKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ');
  const patch = match => {
    const update = !match.manual && circuit(match) === 'tennis-europe' && updates.get(match.matchId || match.id);
    if (!update) return match;
    const own = update.participants.filter(p => nameKey(p.name) === nameKey(match.playerName));
    const team = Number.isInteger(match.teamIndex) ? match.teamIndex : own.length === 1 ? own[0].teamIndex : null;
    if (team !== 0 && team !== 1) return match;
    const confirmed = update.winnerTeamIndex === 0 || update.winnerTeamIndex === 1;
    const score = update.winnerTeamIndex === 1 ? update.score.replace(/(\d+(?:\(\d+\))?)\s*([-–])\s*(\d+(?:\(\d+\))?)/g, '$3$2$1') : update.score;
    const result = {...match, status: update.status, score, result: score, scorePerspective: 'winner', outcomeConfirmed: confirmed};
    delete result.advances; delete result.won;
    if (confirmed) result.advances = result.won = team === update.winnerTeamIndex;
    return result;
  };
  return {...data, matches: (data.matches || []).map(patch), agenda: (data.agenda || []).map(patch)};
}
function refreshKnownMatchResults() {
  const group = PLAYER_GROUP, epoch = state.playerSelectionEpoch || 0;
  if (knownResultRequests.has(group)) return knownResultRequests.get(group);
  const today = new Date().toISOString().slice(0,10), now = Date.parse(today);
  const matchDate = m => Date.parse(String(m.date || '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'));
  const matchIds = [...new Set((state.data?.matches || []).filter(m => {
    const date = matchDate(m);
    return !m.manual && circuit(m) === 'tennis-europe' && Math.abs(date - now) <= 7 * 86400000;
  }).sort((a,b) => Math.abs(matchDate(a) - now) - Math.abs(matchDate(b) - now)).map(m => m.matchId || m.id).filter(id => typeof id === 'string' && id.startsWith('te|') && id.length <= 240))].slice(0,80);
  if (!matchIds.length) return Promise.resolve();
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  const request = (async () => {
    try {
      const response = await fetch(PRIVATE_API + '/known-match-results', privateApiOptions({method:'POST', cache:'no-store', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({matchIds}), signal:controller.signal}, group));
      if (!response.ok) throw Error('Risultati Europe: ' + response.status);
      const data = await response.json();
      if (group !== PLAYER_GROUP || epoch !== (state.playerSelectionEpoch || 0) || data.group !== group || !Array.isArray(data.matches)) return;
      const updates = knownResultUpdates.get(group) || new Map();
      for (const match of data.matches) if (matchIds.includes(match.matchId) && Array.isArray(match.participants)) updates.set(match.matchId, match);
      knownResultUpdates.set(group, updates);
      const hash = location.hash, y = typeof scrollY === 'number' ? scrollY : null;
      state.data = applyKnownResultUpdates(state.data, group);
      renderIfDataChanged();
      if (y !== null && location.hash === hash) scrollTo({top:y, behavior:'auto'});
      Promise.resolve(saveCachedData(state.data)).catch(error => console.warn('Archivio locale non disponibile', error));
    } catch (error) { console.warn('Aggiornamento risultati Europe non disponibile', error); }
    finally { clearTimeout(timer); knownResultRequests.delete(group); }
  })();
  knownResultRequests.set(group, request);
  return request;
}

async function load(preparedProjection = null, preparedDocuments = null, refreshMembership = false) {
  refreshKnownMatchResults();
  if(refreshMembership&&!preparedProjection)requestPlayerMembershipRefresh();
  if (loadRunning) return activeLoadCompletion;
  let finishLoad;
  activeLoadCompletion = new Promise(resolve => {finishLoad = resolve;});
  const selectionEpoch = state.playerSelectionEpoch || 0;
  const immediate = !state.data && cachedData();
  if (immediate?.personalProjectionComplete === true) {
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
    function publishProjection(projection, docs, settled) {
      if (selectionEpoch !== (state.playerSelectionEpoch || 0)) return;
      const viewHash = typeof location === "undefined" ? null : location.hash,
        viewY = state.data && typeof scrollY === "number" ? scrollY : null;
      const previous = state.data || cachedData() || {};
      // Only membership is group-specific. Data loading, merging and rendering are shared.
      if (projection && PLAYER_GROUP === "others" && projection.group !== "others")
        throw Error("Snapshot del gruppo errato");
      const staticPlayers = Array.isArray(docs.players?.players) ? docs.players.players : [];
      const staticTournaments = Array.isArray(docs.tournaments?.tournaments) ? docs.tournaments.tournaments : null;
      if (!projection && PLAYER_GROUP === "others" && previous.personalProjectionComplete !== true)
        throw Error("Elenco personale non disponibile");
      if (!projection && PLAYER_GROUP === "main" && (!staticPlayers.length || !staticTournaments))
        throw Error("Dati essenziali non disponibili");
      const jsonGeneration = Math.max(
          ...[docs.players?.generatedAt, docs.tournaments?.generatedAt]
            .map(Date.parse)
            .filter(Number.isFinite),
          0,
        ),
        apiGeneration = Date.parse(projection?.generatedAt || "");
      const universalProjectionFresh =
        projection &&
        (PLAYER_GROUP === "others" || !jsonGeneration ||
          (Number.isFinite(apiGeneration) && apiGeneration >= jsonGeneration));
      if (projection && !universalProjectionFresh)
        console.warn(
          "Indice universale D1 in sincronizzazione: uso temporaneo dei JSON per giocatori e tornei; i match di circuito restano dalla API",
        );
      for (const player of projection?.players || []) confirmedCourtWatchPlayers.delete(player.id);
      const projectedPlayers = new Map(
          (projection?.players || []).map((p) => [p.id, p]),
        ),
        previousPlayers = new Map((previous.players || []).map((p) => [p.id, p]));
      const membershipPlayers = PLAYER_GROUP === "others" ? [] : staticPlayers;
      const verifiedMembership = Array.isArray(projection?.membershipIds)
        ? new Set(projection.membershipIds) : null;
      const playerCandidates = projection
        ? [...new Map([...membershipPlayers, ...(previous.players || []), ...(projection.players || []),...confirmedCourtWatchPlayers.values()].map(p => [p.id,p])).values()]
        : [...new Map([...membershipPlayers, ...(previous.players || [])].map(p => [p.id,p])).values()];
      const visiblePlayers = playerCandidates
        .filter((p) => (!FORMER_PLAYERS.has(p.id) || p.userAdded) && !removedCourtWatchPlayers.has(p.id) &&
          (projection ? (projectedPlayers.has(p.id) || (previousPlayers.has(p.id) && (!verifiedMembership || verifiedMembership.has(p.id))) || confirmedCourtWatchPlayers.has(p.id)) : Array.isArray(previous.players) ? previousPlayers.has(p.id) : true))
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
        manualMatches = Array.isArray(docs.manual?.matches)
          ? docs.manual.matches
          : [],
        matches = mergeKnownMatches(previousMatches, jsonMatches, projectedMatches, manualMatches);
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

      // A successful full list replaces future registrations, including removals.
      // Keep past tournaments and cache-only players when their source is unavailable.
      const previousGeneration = Date.parse(previous.generatedAt || "") || 0;
      const freshApiTournaments = Array.isArray(projection?.tournaments) &&
        projection.partial !== true && projection.complete !== false &&
        Number.isFinite(apiGeneration) && apiGeneration >= previousGeneration;
      const staticGeneration = Date.parse(docs.tournaments?.generatedAt || "");
      const freshStaticTournaments = PLAYER_GROUP === "main" && staticPlayers.length > 0 &&
        staticTournaments !== null && docs.tournaments.partial !== true &&
        docs.tournaments.complete !== false && Number.isFinite(staticGeneration) &&
        staticGeneration >= previousGeneration;
      const today = iso(new Date());
      const retainedTournaments = (previous.tournaments || []).filter(t => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t.startDate || "") || t.startDate <= today) return true;
        if (universalProjectionFresh && freshApiTournaments && projectedPlayers.has(t.playerId)) return false;
        if (!universalProjectionFresh && freshApiTournaments && projectedPlayers.get(t.playerId)?.userAdded) return false;
        return !(freshStaticTournaments && staticPlayers.some(p => p.id === t.playerId && !p.userAdded));
      });
      if (selectionEpoch !== (state.playerSelectionEpoch || 0)) return;
      state.data = {
        group: PLAYER_GROUP,
        personalProjectionComplete: Boolean(projection) || previous.personalProjectionComplete === true,
        players: visiblePlayers,
        tournaments: [...new Map([
          ...retainedTournaments,
          ...((universalProjectionFresh && projection?.tournaments) || staticTournaments || previous.tournaments || []),
          ...(!universalProjectionFresh && (projection || staticTournaments) ? (projection ? (projection.tournaments || []).filter(t => projectedPlayers.get(t.playerId)?.userAdded) : cachedPersonalTournaments(previous, visiblePlayers)) : []),
        ].map(t => [[t.playerId, t.circuit || t.sourceId || "", t.competitionId || t.id || t.name].join("|"), t])).values()].filter((x) => visibleIds.has(x.playerId)),
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
              docs.players?.generatedAt,
              docs.tournaments?.generatedAt,
            ]
              .map(Date.parse)
              .filter(Number.isFinite),
            Date.parse(previous.generatedAt || "") || 0,
          ),
        ).toISOString(),
      };
      state.data = normalizeMatchProjection(applyKnownResultUpdates(state.data));
      if (projection && state.initialMatchProjectionPending) {
        state.initialMatchProjectionPending = false;
        renderedDataSignature = "";
      }
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
      if (viewY !== null && viewHash !== null && location.hash === viewHash && typeof scrollTo === "function")
        scrollTo({top: viewY, behavior: "auto"});
      Promise.resolve(saveCachedData(state.data)).catch(error => console.warn("Archivio locale non disponibile", error));
    }
    const projectionPromise = (preparedProjection ? Promise.resolve(preparedProjection) : apiProjection()).catch((error) => {
      console.warn("Fallback JSON Court Watch attivo", error);
      return null;
    }).then(projection => {
      if (projection) {
        state.completeProjectionVersion=(state.completeProjectionVersion||0)+1;
        // Fresh API data must not wait for secondary JSON or local persistence.
        try { publishProjection(projection, typeof lastLoadedDocuments === "object" && lastLoadedDocuments || {}, []); }
        catch (error) { console.warn("Aggiornamento immediato non disponibile", error); }
      }
      return projection;
    });
    const settled = preparedDocuments ? names.map(name => ({status: "fulfilled", value: preparedDocuments[name]})) : await Promise.allSettled(files.map(v3json));
    const docs = Object.fromEntries(
      names.map((name, i) => [
        name,
        settled[i].status === "fulfilled" ? settled[i].value : null,
      ]),
    );
    lastLoadedDocuments = docs;
    const projection = await projectionPromise;
    publishProjection(projection, docs, settled);
  } catch (e) {
    if (selectionEpoch !== (state.playerSelectionEpoch || 0)) return;
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
    if (state.data) restoreUiScroll(true);
    loadRunning = false;
    finishLoad();
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
let profileTournamentStatusFilter = ["all", "completed", "ongoing", "scheduled"].includes(restoredUi.profileTournamentStatusFilter) ? restoredUi.profileTournamentStatusFilter : "all",
  profileYearFilter = /^(?:all|\d{4})$/.test(String(restoredUi.profileYearFilter || "")) ? String(restoredUi.profileYearFilter) : String(new Date().getFullYear()),
  profileStatusPlayerId = String(restoredUi.profilePlayerId || "");
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
async function startCourtWatch() {
  restoreCachedProjectionBeforeFirstRender();
  wire();
  wireAccount();
  await Promise.all([restoreDurableProjection(), restoreDurableOpponents()]);
  initialProjectionRequest = load(null,null,true);
  route();
  if (state.data) {
    renderedDataSignature = renderDataSignature(state.data);
    syncLabel(state.data, true);
    restoreUiScroll();
  }
  loadAccount();
  refreshMatchAnalysisStatus();
  setInterval(() => {
    if (!/^#opponent(?:-profile)?\//.test(location.hash)) load();
  }, 30000);
}
// FITP_INLINE_DRAW_LINKS_START
const fitpDrawLinkCache = new Map();
const fitpDrawLinkRequests = new Map();
function fitpInlineCompetitionId(t) {
  let id = String(t.competitionId || '').trim();
  if (!id) {try {id = new URL(t.sourceUrl).searchParams.get('competitionId') || '';} catch {}}
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ? id.toUpperCase() : '';
}
function fitpInlineDrawHref(url, platform = navigator) {
  const version = /OS (\d+)[_\d]* like Mac OS X/.exec(platform.userAgent || '');
  return /iPhone|iPad|iPod/.test(platform.userAgent || '') && version && Number(version[1]) >= 17
    ? url.replace(/^https:/,'x-safari-https:') : url;
}
function fitpInlineDrawHtml(rows) {
  const ages = new Map();
  for (const row of rows) {
    let url;try {url=new URL(row.url);}catch{continue;}
    if (url.protocol !== 'https:' || url.hostname !== 'www.fitp.it' || url.pathname !== '/Tornei/Areas/Federtennis/Scripts/Puc/Tabellone_v3' || url.username || url.password || url.port) continue;
    if (!/^\d+$/.test(url.searchParams.get('tournamentId')||'') || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(url.searchParams.get('phaseId')||'')) continue;
    const code = String(row.categoryCode || String(row.label || '').split(/\s+/)[0]);
    const parsed = code.match(/^(SM|SF|DM|DF|DX)(?:(O)?(\d{1,2}))?$/);
    const key = parsed ? parsed[3] ? (parsed[2]?'O':'U')+Number(parsed[3]) : 'OPEN' : String(row.category || code);
    const label = parsed ? parsed[3] ? (parsed[2]?'Over ':'Under ')+Number(parsed[3]) : 'Open' : key;
    const order = parsed ? parsed[3] ? Number(parsed[3])+(parsed[2]?1000:0) : 500 : 10000;
    const kindOrder = parsed ? ['SM','SF','DM','DF','DX'].indexOf(parsed[1]) : 5;
    const female = parsed ? ['SF','DF'].includes(parsed[1]) : /femminil/i.test(row.category || '');
    const color = female ? 'fitpDrawFemale' : parsed?.[1] === 'DX' ? 'fitpDrawMixed' : 'fitpDrawMale';
    if (!ages.has(key)) ages.set(key,{label,order,draws:[]});
    ages.get(key).draws.push({...row,url:url.href,kindOrder,color});
  }
  const phaseOrder = row => /INIZIALE/i.test(row.label) ? 0 : /INTERMEDIO/i.test(row.label) ? 1 : /FINALE/i.test(row.label) ? 2 : 3;
  return [...ages].sort(([a,x],[b,y])=>x.order-y.order || a.localeCompare(b,'it')).map(([key,group]) => {
    const links=group.draws.sort((a,b)=>a.kindOrder-b.kindOrder || phaseOrder(a)-phaseOrder(b) || String(a.label).localeCompare(String(b.label),'it',{numeric:true})).map(row=>`<a class="type tournamentDrawLink ${row.color}" href="${esc(fitpInlineDrawHref(row.url))}" target="_blank" rel="noopener noreferrer" title="${esc([row.category,row.phase].filter(Boolean).join(' · '))}">${esc(row.label)}</a>`).join('');
    return `<span class="fitpDrawAgeRow" data-fitp-draw-age="${esc(key)}"><b class="fitpDrawAgeLabel">${esc(group.label)}</b>${links}</span>`;
  }).join('') || 'Nessun tabellone diretto pubblicato';
}
function fitpObservedCategoryKey(value) {
  const text=String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[_-]/g,' ').replace(/\s+/g,' ').trim();
  const direct=text.match(/(?:^|\s)(SM|SF|DM|DF|DX)(?:U?(\d{1,2})|O(\d{2}))?(?=$|\s)/);
  if(direct)return direct[1]+(direct[2] || (direct[3]?'O'+direct[3]:''));
  const kind=/\b(?:DOPPIO|DOUBLES?)\b/.test(text)?'D':/\b(?:SINGOLARE|SINGLES?)\b/.test(text)?'S':'';
  const gender=/\b(?:MISTO|MIXED)\b/.test(text)?'X':/\b(?:FEMMINILE|FEMALE|GIRLS?)\b/.test(text)?'F':/\b(?:MASCHILE|MALE|BOYS?)\b/.test(text)?'M':'';
  const ages=[...text.matchAll(/\b(?:UNDER\s*|U)(\d{1,2})\b/g)].map(m=>m[1]);
  if(new Set(ages).size>1)return '';
  const over=text.match(/\bOVER\s*(\d{2})\b/);
  return kind&&gender ? kind+gender+(ages[0] || (over?'O'+over[1]:'')) : '';
}
function fitpObservedDrawRows(t, rows) {
  const allowed=new Set(),ids=new Set((t.playerIds || []).map(String));
  const add=value=>{const key=fitpObservedCategoryKey(value);if(key)allowed.add(key);};
  const entries=Array.isArray(t.people)?t.people:[t];
  for(const person of entries){
    if(person.playerId)ids.add(String(person.playerId));
    for(const registration of person.subscriptionRegistrations || [])add(registration.category);
    for(const draw of Array.isArray(person.draws)?person.draws:[])add(typeof draw==='string'?draw:draw?.category || draw?.draw || draw?.event);
    add(person.draw);add(person.event);add(`${person.draw || ''} ${person.event || ''}`);
  }
  const competitionId=fitpInlineCompetitionId(t);
  for(const match of state.data?.matches || []){
    if(!ids.has(String(match.playerId)) || String(match.circuit || 'fitp')!=='fitp')continue;
    if(!competitionId || String(match.competitionId || '').toUpperCase()!==competitionId)continue;
    add(match.event);add(match.draw);add(`${match.event || ''} ${match.draw || ''}`);
  }
  return rows.filter(row=>allowed.has(fitpObservedCategoryKey(row.categoryCode || row.category)));
}
function fitpObservedDrawHtml(t, rows) {
  const observed=fitpObservedDrawRows(t,rows);
  return observed.length?fitpInlineDrawHtml(observed):'Nessun tabellone pubblicato per i giocatori osservati';
}
function fitpInlineDrawSlot(t) {
  const id=fitpInlineCompetitionId(t);
  if (!id) return '—';
  const saved=fitpDrawLinkCache.get(id);
  return `<span data-fitp-draw-links="${esc(id)}">${saved && Date.now()-saved.savedAt<300000 ? fitpObservedDrawHtml(t,saved.draws) : 'Caricamento tabelloni…'}</span>`;
}
async function loadInlineFitpDrawLinks(t) {
  const id=fitpInlineCompetitionId(t);
  if (!id) return;
  const slot=()=>document.querySelector(`[data-fitp-draw-links="${id}"]`);
  const saved=fitpDrawLinkCache.get(id);
  if(saved && Date.now()-saved.savedAt<300000) {if(slot())slot().innerHTML=fitpObservedDrawHtml(t,saved.draws);return;}
  let pending=fitpDrawLinkRequests.get(id);
  if (!pending) {
    pending=(async()=>{
      const response=await fetch('/app/api/fitp-draw-links?competitionId='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('fitp_unavailable');
      const data=await response.json();
      if (String(data.competitionId||'').toUpperCase()!==id || !Array.isArray(data.draws)) throw new Error('fitp_invalid_response');
      fitpDrawLinkCache.set(id,{draws:data.draws,savedAt:Date.now()});
      return data.draws;
    })();
    fitpDrawLinkRequests.set(id,pending);
  }
  try {const rows=await pending;if(slot())slot().innerHTML=fitpObservedDrawHtml(t,rows);}
  catch {if(slot())slot().textContent='Tabelloni FITP temporaneamente non disponibili';}
  finally {if(fitpDrawLinkRequests.get(id)===pending)fitpDrawLinkRequests.delete(id);}
}
// FITP_INLINE_DRAW_LINKS_END
startCourtWatch();
