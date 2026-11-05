
// ==UserScript==
// @name         UVA1 Critical Role Highlighter
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Highlight Batchers (blue), IB Permitted (green), and BIGS Trained (orange) on the AFT Lite labor tracking page with side-by-side toggle buttons.
// @match        https://na.store-management.f3.amazon.dev/labortracking/findPeople*
// @match        https://na.labor-admin.gsf.a2z.com/opportunities/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // CONFIGURATION — Four groups
  // -----------------------------------------------------------------------

  const GROUPS = {
    batcher: {
      label: "Batcher",
      emoji: "\ud83d\udfe6",
      highlightColor: "#BBDEFB",
      badgeBg: "#1565C0",
      btnBg: "#1565C0",
      btnHover: "#0D47A1",
      btnActive: "#1976D2",
      labelClass: "batcher-trained-label",
      btnId: "batcher-highlight-btn",
      members: new Set([
        "abdacmo", "abdmonfa", "abdurise", "abrasarm", "abtamene", "accimafr", "aegom", "afportil", "agoncilr", "ahdanisu",
        "altsulli", "alvhuynh", "ambergor", "andiegot", "andydora", "anxchiba", "aqnaseri", "araohenr", "asefdest", "asmelate",
        "awisi", "belleug", "benjpage", "bmehmoos", "braodele", "brevejam", "bseyoum", "cabalvi", "caemelye", "carloiza",
        "carpereo", "carrluzu", "cdeaneil", "cdgallow", "chicashm", "clargkha", "cobroadw", "cokmiles", "cyriopan", "dacdevau",
        "dacostp", "dakevino", "dayanseg", "daylinpo", "ddimauna", "delelegn", "dicrichj", "diecampo", "domidinh", "donnebu",
        "dortizbr", "dstevenk", "dylachic", "dylokuno", "eblackmm", "edgmarce", "edwtrayv", "egymkore", "ehabhas", "eliolive",
        "erichstr", "escowwil", "ferlobos", "frimponm", "fzelalem", "genimadu", "gilbesca", "girodagi", "girvicto", "glsanch",
        "gmouzamm", "guisseao", "gutemwoy", "haydennk", "hchashak", "hdavidx", "heavjone", "hgonbrya", "hsankevi", "hugjamil",
        "hummbash", "hunntha", "hunteboy", "hwjoseli", "iaakinfe", "iddriham", "igirmabz", "iiclayto", "imatnels", "ivansali",
        "jabarnoo", "jacmasha", "jakiyegr", "jamellfl", "jasonrie", "jocewrey", "joediaj", "jofarquu", "johjucor", "jrclauro",
        "jsteagal", "kaberazn", "kamayafl", "kejdeguz", "khdzgaby", "kofsampe", "laballim", "lapranat", "lasousma", "lbhermon",
        "lbishafa", "lobjuliv", "locderri", "lopjonav", "lstamali", "lsusamue", "mabranw", "macjdan", "mamahm", "marlonnd",
        "mattdb", "mcdonban", "melgarcr", "mendgern", "menksebo", "mohabolf", "mrichsam", "mromerj", "mussyacs", "nanasimo",
        "naranmat", "natnaelb", "nesrmohw", "nettdelo", "nguyebaw", "nguyenuw", "nichjang", "nijchris", "nmunozjo", "oadrston",
        "obrejust", "odicwill", "ohermote", "pajerrod", "patrcwh", "patrichy", "pazritzi", "polio", "popchaun", "qmilmatt",
        "quachduc", "rdelabae", "reffetlj", "rodrjefk", "rsakenne", "russarne", "salotfol", "samutaiy", "satainam", "sduardo",
        "seidsher", "seifesel", "sewatjay", "seyekd", "shayansh", "sheharkk", "shomamcg", "sllarive", "soterrah", "soudenjs",
        "sshahroo", "steezelj", "sttipto", "sultanez", "svasquka", "swalldro", "tadyonas", "tairhonp", "tateivi", "tdarbouz",
        "tframurp", "thowdean", "thtrishn", "vsqale", "vvelchri", "walkernp", "wardakza", "wcarrold", "weibings", "weslehun",
        "whitglyr", "wimelend", "wmohamms", "wworrawi", "xasfanah", "xavantch", "xelirose", "xhasamo", "youanzal", "zdiazjay",
        "ziabilad", "ziazaing", "zstephep", "ahussent", "albrigou", "alesliei", "alevallc", "allisrec", "alrochac", "altongui",
        "aluisand", "amanueta", "artdonnm", "asepsamu", "ashtimia", "bahabdir", "balahili", "baldisai", "bermekur", "bngyen",
        "cashib", "castanaq", "cerrdian", "ceslopeq", "chdjosso", "cookljac", "cruzjias", "cunmarli", "darwzapz", "dgideoya",
        "diazaraf", "diegmerm", "digoflo", "diojenkf", "dionewas", "donstews", "dppugnet", "eelerajo", "ellizam", "emandolt",
        "eyasudha", "eyfritzn", "gabrmeri", "garettie", "gljamiso", "gonanw", "gordotkn", "grgbrock", "gtamickj", "guwaleja",
        "hakimabm", "hecflorg", "hejovany", "hgaribjo", "hisaiahg", "hoovejul", "hudlinba", "idcordov", "jeffeame", "jesswtra",
        "jimenbrd", "jjratlif", "joonhlef", "joshchoe", "jpflore", "jruge", "jzoukryo", "kamandst", "kammegjo", "khpomarh",
        "knamiyah", "kofiqadj", "kristocw", "lancfant", "lesramst", "lfuemich", "lopenfer", "lopeznk", "lopicl", "marsangf",
        "merkelt", "meshariv", "mirnicho", "mpotterv", "muladven", "myousabd", "naohmajo", "natnaleb", "ngtna", "nkeirnin",
        "ochicasl", "ochofeli", "ohamayoo", "oicra", "ologuled", "omauaziz", "omehusna", "omesahar", "primasni", "qcantwer",
        "qcasmari", "qpenajos", "ramnyano", "richaloe", "rimorenw", "rivraae", "rodasbma", "rossnicn", "saadatis", "santoemo",
        "semsudiy", "slinasp", "slytawia", "torrharf", "trevinle", "truopham", "ualvadri", "ugletici", "vdantyp", "victogca",
        "vispence", "warneebd", "wilyniya", "wurandre", "yabvalde", "yariethr", "yarshehr", "yohajohz", "zcamachc", "ztyleken",
      ])
    },
    inbound: {
      label: "IB Permitted",
      emoji: "\ud83d\udfe2",
      highlightColor: "#90EE90",
      badgeBg: "#2e7d32",
      btnBg: "#2e7d32",
      btnHover: "#1b5e20",
      btnActive: "#388e3c",
      labelClass: "ib-permitted-label",
      btnId: "ib-highlight-btn",
      members: new Set([
        "abdacmo", "abdmonfa", "abtamene", "acapote", "accimafr", "acunlore", "agarcma", "agoncilr", "ahardesg", "ahussent",
        "ajaybeac", "alabullm", "altongui", "altsulli", "aluisand", "alvaujul", "amaisina", "ambergor", "anaiglec", "anamcfnu",
        "anasokol", "anbrowk", "andradgr", "andydora", "ansofra", "antwonnj", "araohenr", "arganc", "armindh", "arnaomig",
        "asamuea", "asefdest", "asmelate", "astridpe", "athjo", "atusarah", "awisi", "azenithn", "azrasoul", "beberear",
        "belleug", "benavdia", "benilda", "benjpage", "bericech", "betsynun", "binroman", "bngyen", "bonnedor", "bouzrjmo",
        "bradmcne", "braodele", "brevejam", "briyanut", "brookoen", "brzmiran", "bseyoum", "cabalvi", "cabrajef", "caemelye",
        "camellij", "camgordz", "canaheid", "carloiza", "carpereo", "carrluzu", "castanaq", "cazeauec", "cdeaneil", "cherybla",
        "cinthios", "cobroadw", "cokmiles", "cordonka", "cquirosa", "cruzqafr", "cyriopan", "daishoba", "dakevino", "dardoris",
        "dayanseg", "daylinpo", "dbbuxeda", "dbounnie", "dcarrnel", "ddimauna", "delicgom", "deviguru", "devoinya", "diazaraf",
        "diecampo", "diegmerm", "digoflo", "divinaif", "doantran", "domidinh", "donnebu", "dppugnet", "dylokuno", "eddydomt",
        "edgmarce", "eelerajo", "ehabhas", "eizambra", "elalaora", "eliolive", "elizaart", "ellizam", "eriknia", "ettorric",
        "farhjoti", "farzas", "ferlobos", "floresdq", "fperrnij", "frimponm", "fromiyah", "fsimanoo", "fuesulma", "fuljasea",
        "fzelalem", "gabrahim", "gabrmeri", "gaebivan", "gamaybe", "garretl", "gblancas", "genimadu", "ghafbery", "ghafoodi",
        "gilbesca", "gironguz", "girvicto", "gljamiso", "glsanch", "gmouzamm", "goergduk", "grgbrock", "gsiasat", "gutemwoy",
        "guwaleja", "hafsaal", "harrebeg", "hatnjean", "haudreyp", "haydennk", "hchashak", "heavjone", "hecflorg", "hejovany",
        "hoskiali", "hrasmus", "hsankevi", "hsharlin", "hugjamil", "hunntha", "hunteboy", "huonquac", "hwilliae", "hwjoseli",
        "hzzewdie", "ialexatr", "iddriham", "iiclayto", "imatnels", "irmbarka", "isitarra", "ivansali", "jacquavg", "jaemespi",
        "jamellfl", "jamgarct", "jasonrie", "jaweuraz", "jennycis", "jeremuse", "jesswtra", "jhbrock", "jhoalber", "jimenbrd",
        "jjratlif", "jllazart", "jocewrey", "joediaj", "johsrn", "joshchoe", "jsalcd", "jsteagal", "juhotero", "jzcarla",
        "kaberazn", "kahsak", "kamayafl", "kammegjo", "katjeffe", "kddelfi", "kejdeguz", "kelmoni", "kharybat", "khdzgaby",
        "kidestwl", "kjjolico", "knamiyah", "kniuella", "kofsampe", "kyongby", "lamaashb", "lapranat", "lashafok", "lbhermon",
        "lbishafa", "lenaatki", "lewimaxi", "lfuemich", "lgregord", "ligiaj", "lobjuliv", "locderri", "lockekal", "lopenfer",
        "lrimando", "lsusamue", "ltesfay", "mabranw", "mamahm", "mantega", "maperea", "mattdb", "mavirata", "mbasto",
        "mcbchloe", "mccainkz", "mcdenesh", "mcdonban", "mendgern", "mendozti", "menksebo", "meshariv", "mflemlem", "milhagui",
        "mitton", "mlazarte", "mloant", "mmaradan", "mnthl", "mohabolf", "mpotterv", "muhrezai", "muladven", "mussyacs",
        "mwdsn", "nanasimo", "nanvcast", "naranmat", "nasamimu", "natnaelb", "navmiri", "nazelaya", "ndrrobe", "nesrmohw",
        "nettdelo", "newsoqda", "nguyenuw", "nharjay", "nichjang", "nicolber", "nijahada", "nledukes", "nmunozjo", "noussael",
        "ohermote", "onyeliza", "onykeith", "ortizgge", "pajerrod", "palmajen", "pannicol", "pashtonx", "patrcwh", "pazritzi",
        "pdandres", "pdenbank", "penrobec", "pninoska", "polio", "popchaun", "popkenis", "powerkp", "qaziraki", "qcantwer",
        "qcasmari", "qdav", "qmicswan", "qmilmatt", "qpenajos", "quachduc", "ramnyano", "rarlenes", "rbimchr", "reffetlj",
        "rivemore", "rivraae", "rmkedija", "rossleid", "rossnicn", "rosspedr", "rsakenne", "sadfred", "sahmesua", "sajaktar",
        "samumsam", "sasaberi", "satainam", "sblessy", "scooless", "seidsher", "seifesel", "semmoss", "semsudiy", "seyekd",
        "shavonbb", "shayansh", "sheshamh", "shresmer", "sidameaz", "sidllano", "skkhwah", "slytawia", "soterrah", "sshahroo",
        "steezelj", "stmunozy", "sttipto", "sunnynoe", "svasquka", "swalldro", "tabrito", "tadallaj", "tadessep", "tadyonas",
        "tafudani", "tairhonp", "taniarex", "tanitro", "tateivi", "tddevkot", "tekugabs", "tequahew", "tframurp", "thowdean",
        "thtrishn", "tilleykt", "tionnajs", "tmarlita", "tmetshet", "tommyq", "trishnan", "twalekur", "umanzbla", "vasqyerl",
        "verotand", "victogca", "vispence", "vjangela", "vmuhahme", "vpacheck", "vsqale", "vvelchri", "wadelaid", "walkernp",
        "wardakza", "warneebd", "webqbria", "weibings", "weslehen", "weslehun", "whdolore", "whitelza", "whitglyr", "wigentqu",
        "wilsejad", "wimelend", "wmelendr", "woldmety", "xelirose", "xpachlil", "yanetdel", "yarngtas", "yasmimen", "yjacquag",
        "ysufm", "zairebef", "zdiazjay", "zenbonil", "ziazaing", "zidandra", "zstephep", "johnwayy", "adenopto", "aegom",
        "amanueta", "anmap", "arguyeni", "artdonnm", "asepsamu", "baldisai", "behuntep", "beirorcu", "betersha", "bigesant",
        "blackfzi", "cpishadi", "cryzfave", "cunmarli", "doralpmi", "dstevenk", "epetronj", "evelncas", "eyfritzn", "fatremel",
        "gonanw", "gtamickj", "gyimahk", "hchricam", "hgaribjo", "higdolaa", "iaakinfe", "icaguiaj", "idcordov", "jainajal",
        "jakyliah", "jeffeame", "jennyore", "jhenkers", "jportoca", "justnock", "kawskhan", "kdecopel", "kofiqadj", "letiking",
        "levzomet", "madelwas", "malybris", "menhanth", "mshynsim", "newkirsy", "ocuchris", "odondbri", "omcleanj", "omesahar",
        "palexaam", "qgaldani", "raquelpi", "rfrederh", "rijohnsa", "rodvdamo", "samibwis", "savtjack", "shawkeye", "tamannep",
        "tantajok", "trystequ", "wekimbra", "wharrer", "whitelyv", "willbder", "wmetades", "wynonc", "xpinedda", "yabvalde",
        "yebshann", "yonasha", "zhabtoml", "ikennama", "rcantjua", "wikennel", "dnajabdu", "gjanelgr", "javahem", "merkelt",
        "mmallini", "quimarga", "samipatv", "slawsjos", "wrxjanet",
      ])
    },
    bigs: {
      label: "BIGS Trained",
      emoji: "\ud83d\udfe0",
      highlightColor: "#FFD580",
      badgeBg: "#E65100",
      btnBg: "#E65100",
      btnHover: "#BF360C",
      btnActive: "#dc2626",
      labelClass: "bigs-trained-label",
      btnId: "bigs-highlight-btn",
      members: new Set([
          "abdacmo", "abtamene", "acapote", "aegom", "agoncilr", "aluisand", "andydora", "asefdest", "brevejam", "brookoen",
          "bseyoum", "cabalvi", "carrluzu", "cobroadw", "cokmiles", "cookljac", "dacostp", "devoinya", "digoflo", "domidinh",
          "donnebu", "eelerajo", "ehabhas", "ellizam", "fromiyah", "fzelalem", "garkeva", "girodagi", "girvicto", "glsanch",
          "gomezjrn", "gordotkn", "grokamro", "heigdawn", "hgonbrya", "hugjamil", "igirmabz", "ivansali", "jaemespi", "jakiyegr",
          "jasonrie", "joediaj", "joshchoe", "juhotero", "kapereze", "kmartkay", "lapranat", "lbishafa", "lembekel", "lobjuliv",
          "locderri", "lopjonav", "lsusamue", "mabranw", "malaloud", "mamahm", "marlonnd", "mrichsam", "nanasimo", "naranmat",
          "ndrrobe", "nesrmohw", "nettdelo", "nguyenuw", "nmunozjo", "pajerrod", "pcharqui", "polio", "qcasmari", "qgaldani",
          "qmilmatt", "qpenajos", "quachduc", "quintkia", "rodrjefk", "sadsaber", "salotfol", "satainam", "sedalb", "seifesel",
          "seyekd", "shayansh", "sronnida", "stmunozy", "sttipto", "svasquka", "swalldro", "tamundon", "tateivi", "tdarbouz",
          "trishnan", "vicparko", "vinativi", "wadelaid", "walkernp", "whitglyr", "wmohamms", "wworrawi", "yjacquag", "zdiazjay",
          "zidandra", "zjohnsha", "zstephep", "macjdan", "belleug", "wcarrold", "nanvcast", "cerrdian", "morenomb", "abdmonfa",
          "afportil", "ahussent", "ambergor", "andiegot", "asmelate", "bmehmoos", "carloiza", "ceslopeq", "cunmarli", "erichstr",
          "evelncas", "genimadu", "guwaleja", "haydennk", "hchashak", "hdavidx", "hummbash", "hunteboy", "idcordov", "jesswtra",
          "jgbrown", "lstamali", "mattdb", "mnthl", "natnaelb", "nguyebaw", "nkeirnin", "ohamayoo", "omesahar", "patrcwh",
          "seidsher", "sshahroo", "torrharf", "warneebd", "xasfanah", "yarshehr", "youanzal", "zcamachc", "ztyleken", "abalbura",
          "ahdanisu", "edgmarce", "eliolive", "iaakinfe", "ketselya", "mendgern", "popchaun", "rsakenne", "weibings",
      ])
    },
    icqa: {
      label: "ICQA Trained",
      emoji: "\ud83d\udfe3",
      highlightColor: "#E1BEE7",
      badgeBg: "#6A1B9A",
      btnBg: "#6A1B9A",
      btnHover: "#4A148C",
      btnActive: "#8E24AA",
      labelClass: "icqa-trained-label",
      btnId: "icqa-highlight-btn",
      members: new Set([
        "abdmonfa", "acapote", "altsulli", "anaiglec", "andydora", "arganc", "azenithn", "beberear", "betsynun", "binroman",
        "cazeauec", "cinthios", "cobroadw", "cokmiles", "dbbuxeda", "dbounnie", "delicgom", "deviguru", "devoinya", "digoflo",
        "divinaif", "ellizam", "ettorric", "farzas", "gamaybe", "garretl", "genimadu", "glsanch", "hrasmus", "hugjamil",
        "hwilliae", "hzzewdie", "jasonrie", "jennyore", "jllazart", "joshchoe", "jsalcd", "jsteagal", "jzcarla", "katjeffe",
        "lamaashb", "lbhermon", "ligiaj", "lrimando", "mabranw", "mamahm", "mavirata", "mitton", "mlazarte", "mloant",
        "mmaradan", "mpotterv", "naranmat", "nazelaya", "nettdelo", "patrcwh", "polio", "qcasmari", "qdav", "qmilmatt",
        "rarlenes", "rivemore", "rivraae", "rossleid", "shresmer", "sidllano", "skkhwah", "svasquka", "taniarex", "tilleykt",
        "tmarlita", "wadelaid", "warneebd", "weslehen", "yasmimen", "yjacquag", "zenbonil", "zidandra", "ahardesg", "ambergor",
        "anasokol", "behuntep", "eelerajo", "elizaart", "gljamiso", "heavjone", "hunteboy", "johnwayy", "lchrisz", "macjdan",
        "madelwas", "mattdb", "meshariv", "mussyacs", "navmiri", "nicolber", "niorvrod", "shabanr", "slytawia", "thomkcoo",
        "verotand"
      ])
    }
  };

  // Track active state per group
  const activeState = { batcher: false, inbound: false, bigs: false, icqa: false };

  // -------------------------
  // Core highlight logic
  // -------------------------

  function scanAndHighlight(groupKey) {
    const group = GROUPS[groupKey];
    let matched = 0;

    const tables = document.querySelectorAll("table");
    tables.forEach((table) => {
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        cells.forEach((cell) => {
          const login = (cell.textContent || "").trim().toLowerCase();
          if (group.members.has(login)) {
            matched++;
            row.style.backgroundColor = group.highlightColor;

            if (!row.querySelector("." + group.labelClass)) {
              const badge = document.createElement("span");
              badge.className = group.labelClass;
              badge.textContent = group.emoji + " " + group.label;
              badge.style.cssText = [
                "margin-left:8px",
                "padding:2px 6px",
                "background:" + group.badgeBg,
                "color:white",
                "border-radius:4px",
                "font-size:11px",
                "font-weight:bold",
                "vertical-align:middle"
              ].join(";");
              cell.appendChild(badge);
            }
          }
        });
      });
    });

    return matched;
  }

  function clearHighlights(groupKey) {
    const group = GROUPS[groupKey];
    // Remove badges for this group
    document.querySelectorAll("." + group.labelClass).forEach((badge) => badge.remove());

    // Reapply colors for any other active groups
    document.querySelectorAll("table tr").forEach((row) => {
      let newColor = "";
      Object.keys(GROUPS).forEach((otherKey) => {
        if (otherKey === groupKey) return;
        if (!activeState[otherKey]) return;
        if (row.querySelector("." + GROUPS[otherKey].labelClass)) {
          newColor = GROUPS[otherKey].highlightColor;
        }
      });
      row.style.backgroundColor = newColor;
    });
  }

  // -------------------------
  // Button Bar
  // -------------------------

  function createButtonBar() {
    if (document.getElementById("uva1-highlighter-bar")) return;

    const bar = document.createElement("div");
    bar.id = "uva1-highlighter-bar";
    bar.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "z-index:9999",
      "display:flex",
      "gap:8px",
      "align-items:center",
      "background:#f5f5f5",
      "padding:6px 10px",
      "border-radius:10px",
      "box-shadow:0 4px 12px rgba(0,0,0,0.2)",
      "font-family:Arial,sans-serif"
    ].join(";");

    const title = document.createElement("span");
    title.textContent = "UVA1";
    title.style.cssText = "font-size:12px;font-weight:bold;color:#333;margin-right:4px;";
    bar.appendChild(title);

    // Create a button for each group
    Object.keys(GROUPS).forEach((groupKey) => {
      const group = GROUPS[groupKey];

      const btn = document.createElement("button");
      btn.id = group.btnId;
      btn.textContent = group.emoji + " " + group.label;
      btn.style.cssText = [
        "padding:6px 12px",
        "background:" + group.btnBg,
        "color:white",
        "border:none",
        "border-radius:6px",
        "font-size:12px",
        "font-weight:bold",
        "cursor:pointer",
        "transition:background 0.2s ease",
        "white-space:nowrap"
      ].join(";");

      btn.onmouseenter = () => {
        btn.style.background = activeState[groupKey] ? group.btnActive : group.btnHover;
      };
      btn.onmouseleave = () => {
        btn.style.background = activeState[groupKey] ? group.btnActive : group.btnBg;
      };

      btn.onclick = () => {
        if (!activeState[groupKey]) {
          const count = scanAndHighlight(groupKey);
          activeState[groupKey] = true;
          btn.textContent = group.emoji + " " + count + " " + group.label + " \u2714";
          btn.style.background = group.btnActive;
        } else {
          clearHighlights(groupKey);
          activeState[groupKey] = false;
          btn.textContent = group.emoji + " " + group.label;
          btn.style.background = group.btnBg;
        }
      };

      bar.appendChild(btn);
    });

    // Clear All button
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "\u2716 Clear All";
    clearBtn.style.cssText = [
      "padding:6px 12px",
      "background:#757575",
      "color:white",
      "border:none",
      "border-radius:6px",
      "font-size:12px",
      "font-weight:bold",
      "cursor:pointer",
      "transition:background 0.2s ease",
      "white-space:nowrap"
    ].join(";");

    clearBtn.onmouseenter = () => { clearBtn.style.background = "#616161"; };
    clearBtn.onmouseleave = () => { clearBtn.style.background = "#757575"; };

    clearBtn.onclick = () => {
      Object.keys(GROUPS).forEach((groupKey) => {
        const group = GROUPS[groupKey];
        document.querySelectorAll("." + group.labelClass).forEach((badge) => badge.remove());
        activeState[groupKey] = false;
        const btn = document.getElementById(group.btnId);
        if (btn) {
          btn.textContent = group.emoji + " " + group.label;
          btn.style.background = group.btnBg;
        }
      });
      document.querySelectorAll("table tr").forEach((row) => {
        row.style.backgroundColor = "";
      });
    };

    bar.appendChild(clearBtn);

    // Make bar draggable
    let isDragging = false, offsetX, offsetY;
    bar.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      isDragging = true;
      offsetX = e.clientX - bar.offsetLeft;
      offsetY = e.clientY - bar.offsetTop;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      bar.style.left = e.clientX - offsetX + "px";
      bar.style.top = e.clientY - offsetY + "px";
      bar.style.right = "auto";
    });
    document.addEventListener("mouseup", () => (isDragging = false));

    document.body.appendChild(bar);
  }

  // -------------------------
  // Init
  // -------------------------

  function init() {
    createButtonBar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();


(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // CONFIGURATION — Three groups
  // -----------------------------------------------------------------------

  const GROUPS = {
    batcher: {
      label: "Batcher",
      emoji: "\ud83d\udfe6",
      highlightColor: "#BBDEFB",
      badgeBg: "#1565C0",
      btnBg: "#1565C0",
      btnHover: "#0D47A1",
      btnActive: "#1976D2",
      labelClass: "batcher-trained-label",
      btnId: "batcher-highlight-btn",
      members: new Set([
        "abdacmo", "abdmonfa", "abdurise", "abrasarm", "abtamene", "accimafr", "aegom", "afportil", "agoncilr", "ahdanisu",
        "altsulli", "alvhuynh", "ambergor", "andiegot", "andydora", "anxchiba", "aqnaseri", "araohenr", "asefdest", "asmelate",
        "awisi", "belleug", "benjpage", "bmehmoos", "braodele", "brevejam", "bseyoum", "cabalvi", "caemelye", "carloiza",
        "carpereo", "carrluzu", "cdeaneil", "cdgallow", "chicashm", "clargkha", "cobroadw", "cokmiles", "cyriopan", "dacdevau",
        "dacostp", "dakevino", "dayanseg", "daylinpo", "ddimauna", "delelegn", "dicrichj", "diecampo", "domidinh", "donnebu",
        "dortizbr", "dstevenk", "dylachic", "dylokuno", "eblackmm", "edgmarce", "edwtrayv", "egymkore", "ehabhas", "eliolive",
        "erichstr", "escowwil", "ferlobos", "frimponm", "fzelalem", "genimadu", "gilbesca", "girodagi", "girvicto", "glsanch",
        "gmouzamm", "guisseao", "gutemwoy", "haydennk", "hchashak", "hdavidx", "heavjone", "hgonbrya", "hsankevi", "hugjamil",
        "hummbash", "hunntha", "hunteboy", "hwjoseli", "iaakinfe", "iddriham", "igirmabz", "iiclayto", "imatnels", "ivansali",
        "jabarnoo", "jacmasha", "jakiyegr", "jamellfl", "jasonrie", "jocewrey", "joediaj", "jofarquu", "johjucor", "jrclauro",
        "jsteagal", "kaberazn", "kamayafl", "kejdeguz", "khdzgaby", "kofsampe", "laballim", "lapranat", "lasousma", "lbhermon",
        "lbishafa", "lobjuliv", "locderri", "lopjonav", "lstamali", "lsusamue", "mabranw", "macjdan", "mamahm", "marlonnd",
        "mattdb", "mcdonban", "melgarcr", "mendgern", "menksebo", "mohabolf", "mrichsam", "mromerj", "mussyacs", "nanasimo",
        "naranmat", "natnaelb", "nesrmohw", "nettdelo", "nguyebaw", "nguyenuw", "nichjang", "nijchris", "nmunozjo", "oadrston",
        "obrejust", "odicwill", "ohermote", "pajerrod", "patrcwh", "patrichy", "pazritzi", "polio", "popchaun", "qmilmatt",
        "quachduc", "rdelabae", "reffetlj", "rodrjefk", "rsakenne", "russarne", "salotfol", "samutaiy", "satainam", "sduardo",
        "seidsher", "seifesel", "sewatjay", "seyekd", "shayansh", "sheharkk", "shomamcg", "sllarive", "soterrah", "soudenjs",
        "sshahroo", "steezelj", "sttipto", "sultanez", "svasquka", "swalldro", "tadyonas", "tairhonp", "tateivi", "tdarbouz",
        "tframurp", "thowdean", "thtrishn", "vsqale", "vvelchri", "walkernp", "wardakza", "wcarrold", "weibings", "weslehun",
        "whitglyr", "wimelend", "wmohamms", "wworrawi", "xasfanah", "xavantch", "xelirose", "xhasamo", "youanzal", "zdiazjay",
        "ziabilad", "ziazaing", "zstephep"
      ])
    },
    inbound: {
      label: "IB Permitted",
      emoji: "\ud83d\udfe2",
      highlightColor: "#90EE90",
      badgeBg: "#2e7d32",
      btnBg: "#2e7d32",
      btnHover: "#1b5e20",
      btnActive: "#388e3c",
      labelClass: "ib-permitted-label",
      btnId: "ib-highlight-btn",
      members: new Set([
        "abdacmo", "abdmonfa", "abtamene", "acapote", "accimafr", "acunlore", "agarcma", "agoncilr", "ahardesg", "ahussent",
        "ajaybeac", "alabullm", "altongui", "altsulli", "aluisand", "alvaujul", "amaisina", "ambergor", "anaiglec", "anamcfnu",
        "anasokol", "anbrowk", "andradgr", "andydora", "ansofra", "antwonnj", "araohenr", "arganc", "armindh", "arnaomig",
        "asamuea", "asefdest", "asmelate", "astridpe", "athjo", "atusarah", "awisi", "azenithn", "azrasoul", "beberear",
        "belleug", "benavdia", "benilda", "benjpage", "bericech", "betsynun", "binroman", "bngyen", "bonnedor", "bouzrjmo",
        "bradmcne", "braodele", "brevejam", "briyanut", "brookoen", "brzmiran", "bseyoum", "cabalvi", "cabrajef", "caemelye",
        "camellij", "camgordz", "canaheid", "carloiza", "carpereo", "carrluzu", "castanaq", "cazeauec", "cdeaneil", "cherybla",
        "cinthios", "cobroadw", "cokmiles", "cordonka", "cquirosa", "cruzqafr", "cyriopan", "daishoba", "dakevino", "dardoris",
        "dayanseg", "daylinpo", "dbbuxeda", "dbounnie", "dcarrnel", "ddimauna", "delicgom", "deviguru", "devoinya", "diazaraf",
        "diecampo", "diegmerm", "digoflo", "divinaif", "doantran", "domidinh", "donnebu", "dppugnet", "dylokuno", "eddydomt",
        "edgmarce", "eelerajo", "ehabhas", "eizambra", "elalaora", "eliolive", "elizaart", "ellizam", "eriknia", "ettorric",
        "farhjoti", "farzas", "ferlobos", "floresdq", "fperrnij", "frimponm", "fromiyah", "fsimanoo", "fuesulma", "fuljasea",
        "fzelalem", "gabrahim", "gabrmeri", "gaebivan", "gamaybe", "garretl", "gblancas", "genimadu", "ghafbery", "ghafoodi",
        "gilbesca", "gironguz", "girvicto", "gljamiso", "glsanch", "gmouzamm", "goergduk", "grgbrock", "gsiasat", "gutemwoy",
        "guwaleja", "hafsaal", "harrebeg", "hatnjean", "haudreyp", "haydennk", "hchashak", "heavjone", "hecflorg", "hejovany",
        "hoskiali", "hrasmus", "hsankevi", "hsharlin", "hugjamil", "hunntha", "hunteboy", "huonquac", "hwilliae", "hwjoseli",
        "hzzewdie", "ialexatr", "iddriham", "iiclayto", "imatnels", "irmbarka", "isitarra", "ivansali", "jacquavg", "jaemespi",
        "jamellfl", "jamgarct", "jasonrie", "jaweuraz", "jennycis", "jeremuse", "jesswtra", "jhbrock", "jhoalber", "jimenbrd",
        "jjratlif", "jllazart", "jocewrey", "joediaj", "johsrn", "joshchoe", "jsalcd", "jsteagal", "juhotero", "jzcarla",
        "kaberazn", "kahsak", "kamayafl", "kammegjo", "katjeffe", "kddelfi", "kejdeguz", "kelmoni", "kharybat", "khdzgaby",
        "kidestwl", "kjjolico", "knamiyah", "kniuella", "kofsampe", "kyongby", "lamaashb", "lapranat", "lashafok", "lbhermon",
        "lbishafa", "lenaatki", "lewimaxi", "lfuemich", "lgregord", "ligiaj", "lobjuliv", "locderri", "lockekal", "lopenfer",
        "lrimando", "lsusamue", "ltesfay", "mabranw", "mamahm", "mantega", "maperea", "mattdb", "mavirata", "mbasto",
        "mcbchloe", "mccainkz", "mcdenesh", "mcdonban", "mendgern", "mendozti", "menksebo", "meshariv", "mflemlem", "milhagui",
        "mitton", "mlazarte", "mloant", "mmaradan", "mnthl", "mohabolf", "mpotterv", "muhrezai", "muladven", "mussyacs",
        "mwdsn", "nanasimo", "nanvcast", "naranmat", "nasamimu", "natnaelb", "navmiri", "nazelaya", "ndrrobe", "nesrmohw",
        "nettdelo", "newsoqda", "nguyenuw", "nharjay", "nichjang", "nicolber", "nijahada", "nledukes", "nmunozjo", "noussael",
        "ohermote", "onyeliza", "onykeith", "ortizgge", "pajerrod", "palmajen", "pannicol", "pashtonx", "patrcwh", "pazritzi",
        "pdandres", "pdenbank", "penrobec", "pninoska", "polio", "popchaun", "popkenis", "powerkp", "qaziraki", "qcantwer",
        "qcasmari", "qdav", "qmicswan", "qmilmatt", "qpenajos", "quachduc", "ramnyano", "rarlenes", "rbimchr", "reffetlj",
        "rivemore", "rivraae", "rmkedija", "rossleid", "rossnicn", "rosspedr", "rsakenne", "sadfred", "sahmesua", "sajaktar",
        "samumsam", "sasaberi", "satainam", "sblessy", "scooless", "seidsher", "seifesel", "semmoss", "semsudiy", "seyekd",
        "shavonbb", "shayansh", "sheshamh", "shresmer", "sidameaz", "sidllano", "skkhwah", "slytawia", "soterrah", "sshahroo",
        "steezelj", "stmunozy", "sttipto", "sunnynoe", "svasquka", "swalldro", "tabrito", "tadallaj", "tadessep", "tadyonas",
        "tafudani", "tairhonp", "taniarex", "tanitro", "tateivi", "tddevkot", "tekugabs", "tequahew", "tframurp", "thowdean",
        "thtrishn", "tilleykt", "tionnajs", "tmarlita", "tmetshet", "tommyq", "trishnan", "twalekur", "umanzbla", "vasqyerl",
        "verotand", "victogca", "vispence", "vjangela", "vmuhahme", "vpacheck", "vsqale", "vvelchri", "wadelaid", "walkernp",
        "wardakza", "warneebd", "webqbria", "weibings", "weslehen", "weslehun", "whdolore", "whitelza", "whitglyr", "wigentqu",
        "wilsejad", "wimelend", "wmelendr", "woldmety", "xelirose", "xpachlil", "yanetdel", "yarngtas", "yasmimen", "yjacquag",
        "ysufm", "zairebef", "zdiazjay", "zenbonil", "ziazaing", "zidandra", "zstephep"
      ])
    },
    bigs: {
      label: "BIGS Trained",
      emoji: "\ud83d\udfe0",
      highlightColor: "#FFD580",
      badgeBg: "#E65100",
      btnBg: "#E65100",
      btnHover: "#BF360C",
      btnActive: "#dc2626",
      labelClass: "bigs-trained-label",
      btnId: "bigs-highlight-btn",
      members: new Set([
        "abdacmo", "abtamene", "acapote", "aegom", "agoncilr", "aluisand", "andydora", "asefdest", "brevejam", "brookoen",
        "bseyoum", "cabalvi", "carrluzu", "cobroadw", "cokmiles", "cookljac", "dacostp", "devoinya", "digoflo", "domidinh",
        "donnebu", "eelerajo", "ehabhas", "ellizam", "fromiyah", "fzelalem", "garkeva", "girodagi", "girvicto", "glsanch",
        "gomezjrn", "gordotkn", "grokamro", "heigdawn", "hgonbrya", "hugjamil", "igirmabz", "ivansali", "jaemespi", "jakiyegr",
        "jasonrie", "joediaj", "joshchoe", "juhotero", "kapereze", "kmartkay", "lapranat", "lbishafa", "lembekel", "lobjuliv",
        "locderri", "lopjonav", "lsusamue", "mabranw", "malaloud", "mamahm", "marlonnd", "mrichsam", "nanasimo", "naranmat",
        "ndrrobe", "nesrmohw", "nettdelo", "nguyenuw", "nmunozjo", "pajerrod", "pcharqui", "polio", "qcasmari", "qgaldani",
        "qmilmatt", "qpenajos", "quachduc", "quintkia", "rodrjefk", "sadsaber", "salotfol", "satainam", "sedalb", "seifesel",
        "seyekd", "shayansh", "sronnida", "stmunozy", "sttipto", "svasquka", "swalldro", "tamundon", "tateivi", "tdarbouz",
        "trishnan", "vicparko", "vinativi", "wadelaid", "walkernp", "whitglyr", "wmohamms", "wworrawi", "yjacquag", "zdiazjay",
        "zidandra", "zjohnsha", "zstephep"
      ])
    }
  };

  // Track active state per group
  const activeState = { batcher: false, inbound: false, bigs: false };

  // -------------------------
  // Core highlight logic
  // -------------------------

  function scanAndHighlight(groupKey) {
    const group = GROUPS[groupKey];
    let matched = 0;

    const tables = document.querySelectorAll("table");
    tables.forEach((table) => {
      const rows = table.querySelectorAll("tr");
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        cells.forEach((cell) => {
          const login = (cell.textContent || "").trim().toLowerCase();
          if (group.members.has(login)) {
            matched++;
            row.style.backgroundColor = group.highlightColor;

            if (!row.querySelector("." + group.labelClass)) {
              const badge = document.createElement("span");
              badge.className = group.labelClass;
              badge.textContent = group.emoji + " " + group.label;
              badge.style.cssText = [
                "margin-left:8px",
                "padding:2px 6px",
                "background:" + group.badgeBg,
                "color:white",
                "border-radius:4px",
                "font-size:11px",
                "font-weight:bold",
                "vertical-align:middle"
              ].join(";");
              cell.appendChild(badge);
            }
          }
        });
      });
    });

    return matched;
  }

  function clearHighlights(groupKey) {
    const group = GROUPS[groupKey];
    // Remove badges for this group
    document.querySelectorAll("." + group.labelClass).forEach((badge) => badge.remove());

    // Reapply colors for any other active groups
    document.querySelectorAll("table tr").forEach((row) => {
      let newColor = "";
      // Check all OTHER active groups for this row
      Object.keys(GROUPS).forEach((otherKey) => {
        if (otherKey === groupKey) return;
        if (!activeState[otherKey]) return;
        if (row.querySelector("." + GROUPS[otherKey].labelClass)) {
          newColor = GROUPS[otherKey].highlightColor;
        }
      });
      row.style.backgroundColor = newColor;
    });
  }

  // -------------------------
  // Button Bar
  // -------------------------

  function createButtonBar() {
    if (document.getElementById("uva1-highlighter-bar")) return;

    // Container bar
    const bar = document.createElement("div");
    bar.id = "uva1-highlighter-bar";
    bar.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "z-index:9999",
      "display:flex",
      "gap:8px",
      "align-items:center",
      "background:#f5f5f5",
      "padding:6px 10px",
      "border-radius:10px",
      "box-shadow:0 4px 12px rgba(0,0,0,0.2)",
      "font-family:Arial,sans-serif"
    ].join(";");

    // Title label
    const title = document.createElement("span");
    title.textContent = "UVA1";
    title.style.cssText = "font-size:12px;font-weight:bold;color:#333;margin-right:4px;";
    bar.appendChild(title);

    // Create a button for each group
    Object.keys(GROUPS).forEach((groupKey) => {
      const group = GROUPS[groupKey];

      const btn = document.createElement("button");
      btn.id = group.btnId;
      btn.textContent = group.emoji + " " + group.label;
      btn.style.cssText = [
        "padding:6px 12px",
        "background:" + group.btnBg,
        "color:white",
        "border:none",
        "border-radius:6px",
        "font-size:12px",
        "font-weight:bold",
        "cursor:pointer",
        "transition:background 0.2s ease",
        "white-space:nowrap"
      ].join(";");

      btn.onmouseenter = () => {
        btn.style.background = activeState[groupKey] ? group.btnActive : group.btnHover;
      };
      btn.onmouseleave = () => {
        btn.style.background = activeState[groupKey] ? group.btnActive : group.btnBg;
      };

      btn.onclick = () => {
        if (!activeState[groupKey]) {
          const count = scanAndHighlight(groupKey);
          activeState[groupKey] = true;
          btn.textContent = group.emoji + " " + count + " " + group.label + " \u2714";
          btn.style.background = group.btnActive;
        } else {
          clearHighlights(groupKey);
          activeState[groupKey] = false;
          btn.textContent = group.emoji + " " + group.label;
          btn.style.background = group.btnBg;
        }
      };

      bar.appendChild(btn);
    });

    // Clear All button
    const clearBtn = document.createElement("button");
    clearBtn.textContent = "\u2716 Clear All";
    clearBtn.style.cssText = [
      "padding:6px 12px",
      "background:#757575",
      "color:white",
      "border:none",
      "border-radius:6px",
      "font-size:12px",
      "font-weight:bold",
      "cursor:pointer",
      "transition:background 0.2s ease",
      "white-space:nowrap"
    ].join(";");

    clearBtn.onmouseenter = () => { clearBtn.style.background = "#616161"; };
    clearBtn.onmouseleave = () => { clearBtn.style.background = "#757575"; };

    clearBtn.onclick = () => {
      Object.keys(GROUPS).forEach((groupKey) => {
        const group = GROUPS[groupKey];
        document.querySelectorAll("." + group.labelClass).forEach((badge) => badge.remove());
        activeState[groupKey] = false;
        const btn = document.getElementById(group.btnId);
        if (btn) {
          btn.textContent = group.emoji + " " + group.label;
          btn.style.background = group.btnBg;
        }
      });
      document.querySelectorAll("table tr").forEach((row) => {
        row.style.backgroundColor = "";
      });
    };

    bar.appendChild(clearBtn);

    // Make bar draggable
    let isDragging = false, offsetX, offsetY;
    bar.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      isDragging = true;
      offsetX = e.clientX - bar.offsetLeft;
      offsetY = e.clientY - bar.offsetTop;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      bar.style.left = e.clientX - offsetX + "px";
      bar.style.top = e.clientY - offsetY + "px";
      bar.style.right = "auto";
    });
    document.addEventListener("mouseup", () => (isDragging = false));

    document.body.appendChild(bar);
  }

  // -------------------------
  // Init
  // -------------------------

  function init() {
    createButtonBar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();

