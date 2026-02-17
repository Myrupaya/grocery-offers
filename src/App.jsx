import React, { useEffect, useState } from "react";
import axios from "axios";
import Papa from "papaparse";
import "./App.css";

/** -------------------- CONFIG -------------------- */
const LIST_FIELDS = {
  credit: ["Eligible Credit Cards", "Eligible Cards"],
  debit: ["Eligible Debit Cards", "Applicable Debit Cards"],
  upi: ["UPI"],
  netBanking: ["Net Banking"],
  title: ["Offer", "Title"],
  image: ["Image", "Credit Card Image", "Offer Image", "image", "Image URL"],
  link: ["Link", "Offer Link"],
  desc: ["Description", "Details", "Offer Description", "Flight Benefit"],
  // Permanent (inbuilt) CSV fields
  permanentCCName: ["Eligible Credit Cards"],
  permanentBenefit: ["Grocery Benefits", "Benefit", "Offer", "Hotel Benefit"],
};

const MAX_SUGGESTIONS = 50;

/** Sites that should display the red per-card “Applicable only on {variant} variant” note */
const VARIANT_NOTE_SITES = new Set([
  "EaseMyTrip",
  "Yatra (Domestic)",
  "Yatra (International)",
  "Ixigo",
  "MakeMyTrip",
  "ClearTrip",
  "Goibibo",
  "Airline",
  "Permanent",
  // grocery-specific:
  "Blinkit",
  "Swiggy Instamart",
]);

/** -------------------- FALLBACK LOGOS -------------------- */
/* If the CSV has no valid image OR the image fails to load,
   we'll replace it with this per-site logo. */
const FALLBACK_IMAGE_BY_SITE = {
  bookmyshow:
    "https://upload.wikimedia.org/wikipedia/commons/f/f2/Bookmyshow-logo.svg",
  blinkit:
    "https://yt3.googleusercontent.com/oe7za_pjcm3tYZKtTAs6aWuZCOzB6aHWnZOGYwrYjuZe72SMkVs3qoCElDQl-ob8CaKNimXI=s900-c-k-c0x00ffffff-no-rj",
  "swiggy instamart":
    "https://static.businessworld.in/Swiggy%20Instamart%20Orange-20%20(1)_20240913021826_original_image_44.webp",
  zepto:
    "https://static.toiimg.com/thumb/msid-111158305,imgsize-14390,width-400,resizemode-4/111158305.jpg",
  bigbasket:
    "https://tse4.mm.bing.net/th/id/OIP.8ti6MSe9X039YNinnER4fwAAAA?pid=Api&P=0&h=180",
};

/** -------------------- HELPERS -------------------- */
const toNorm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function firstField(obj, keys) {
  for (const k of keys) {
    if (
      obj &&
      Object.prototype.hasOwnProperty.call(obj, k) &&
      obj[k] !== undefined &&
      obj[k] !== null &&
      String(obj[k]).trim() !== ""
    ) {
      return obj[k];
    }
  }
  return undefined;
}

function splitList(val) {
  if (!val) return [];
  return String(val)
    .replace(/\n/g, " ")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strip trailing parentheses: "HDFC Regalia (Visa Signature)" -> "HDFC Regalia" */
function getBase(name) {
  if (!name) return "";
  return String(name).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Variant if present at end-in-parens: "… (Visa Signature)" -> "Visa Signature" */
function getVariant(name) {
  if (!name) return "";
  const m = String(name).match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : "";
}

/** Canonicalize some common brand spellings */
function brandCanonicalize(text) {
  let s = String(text || "");
  s = s.replace(/\bMakemytrip\b/gi, "MakeMyTrip");
  s = s.replace(/\bIcici\b/gi, "ICICI");
  s = s.replace(/\bHdfc\b/gi, "HDFC");
  s = s.replace(/\bSbi\b/gi, "SBI");
  s = s.replace(/\bIdfc\b/gi, "IDFC");
  s = s.replace(/\bPnb\b/gi, "PNB");
  s = s.replace(/\bRbl\b/gi, "RBL");
  s = s.replace(/\bYes\b/gi, "YES");
  return s;
}

/** Levenshtein distance */
function lev(a, b) {
  a = toNorm(a);
  b = toNorm(b);
  const n = a.length,
    m = b.length;
  if (!n) return m;
  if (!m) return n;
  const d = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[n][m];
}

function scoreCandidate(q, cand) {
  const qs = toNorm(q);
  const cs = toNorm(cand);
  if (!qs) return 0;
  if (cs.includes(qs)) return 100;

  const qWords = qs.split(" ").filter(Boolean);
  const cWords = cs.split(" ").filter(Boolean);

  const matchingWords = qWords.filter((qw) =>
    cWords.some((cw) => cw.includes(qw))
  ).length;
  const sim = 1 - lev(qs, cs) / Math.max(qs.length, cs.length);

  return (matchingWords / Math.max(1, qWords.length)) * 0.7 + sim * 0.3;
}

/** 🔹 Fuzzy name matcher – handles typos like "selct" ≈ "select" */
function isFuzzyNameMatch(query, label) {
  const q = toNorm(query);
  const l = toNorm(label);
  if (!q || !l) return false;

  // direct substring
  if (l.includes(q)) return true;

  // whole-string similarity
  const wholeDist = lev(q, l);
  const wholeSim = 1 - wholeDist / Math.max(q.length, l.length);
  if (wholeSim >= 0.6) return true;

  // per-word similarity ("selct" vs "select")
  const qWords = q.split(" ").filter(Boolean);
  const lWords = l.split(" ").filter(Boolean);

  for (const qw of qWords) {
    if (qw.length < 3) continue;
    for (const lw of lWords) {
      if (lw.length < 3) continue;
      const d = lev(qw, lw);
      const sim = 1 - d / Math.max(qw.length, lw.length);
      if (sim >= 0.7) return true;
    }
  }
  return false;
}

/** Dropdown entry builder */
function makeEntry(raw, type) {
  const base = brandCanonicalize(getBase(raw));
  return { type, display: base, baseNorm: toNorm(base) };
}

function normalizeUrl(u) {
  if (!u) return "";
  let s = String(u).trim().toLowerCase();
  s = s.replace(/^https?:\/\/\/?/, "").replace(/^www\./, "");
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}
function normalizeText(s) {
  return toNorm(s || "");
}
function offerKey(offer) {
  const image = normalizeUrl(firstField(offer, LIST_FIELDS.image) || "");
  const title = normalizeText(
    firstField(offer, LIST_FIELDS.title) || offer.Website || ""
  );
  const desc = normalizeText(firstField(offer, LIST_FIELDS.desc) || "");
  const link = normalizeUrl(firstField(offer, LIST_FIELDS.link) || "");
  return `${title}||${desc}||${image}||${link}`;
}

function dedupWrappers(arr, seen) {
  const out = [];
  for (const w of arr || []) {
    const k = offerKey(w.offer);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  return out;
}

/** Decide if an image from CSV is usable (not blank / N/A / etc.) */
function isUsableImage(val) {
  if (!val) return false;
  const s = String(val).trim();
  if (!s) return false;
  if (/^(na|n\/a|null|undefined|-|image unavailable)$/i.test(s)) return false;
  return true;
}

function getFallbackImage(site) {
  const key = toNorm(site || "");
  if (!key) return "";

  for (const [siteKey, url] of Object.entries(FALLBACK_IMAGE_BY_SITE)) {
    const normSiteKey = toNorm(siteKey);
    if (
      key === normSiteKey ||
      key.includes(normSiteKey) ||
      normSiteKey.includes(key)
    ) {
      return url;
    }
  }
  return "";
}

/** Choose final image src + whether it's fallback */
function resolveImage(site, candidate) {
  const fallback = getFallbackImage(site);
  const shouldFallback = !isUsableImage(candidate) && !!fallback;
  return {
    src: shouldFallback ? fallback : candidate,
    usingFallback: shouldFallback,
  };
}

/** onError -> switch to fallback (if not already) */
function handleImgError(e, site) {
  const fallback = getFallbackImage(site);
  const el = e.currentTarget;
  if (fallback && el.src !== fallback) {
    el.src = fallback;
    el.classList.add("is-fallback");
  } else {
    // nothing works, hide it
    el.style.display = "none";
  }
}

/** Disclaimer */
const Disclaimer = () => (
  <section className="disclaimer">
    <h3>Disclaimer</h3>
    <p>
      All offers, coupons, and discounts listed on our platform are provided
      for informational purposes only. We do not guarantee the accuracy,
      availability, or validity of any offer. Users are advised to verify the
      terms and conditions with the respective merchants before making any
      purchase. We are not responsible for any discrepancies, expired offers,
      or losses arising from the use of these coupons.
    </p>
  </section>
);

/** -------------------- COMPONENT -------------------- */
const AirlineOffers = () => {
  // dropdown data (from allCards.csv ONLY)
  const [creditEntries, setCreditEntries] = useState([]);
  const [debitEntries, setDebitEntries] = useState([]);
  const [upiEntries, setUpiEntries] = useState([]);
  const [netBankingEntries, setNetBankingEntries] = useState([]);

  // chip strips (from offer CSVs ONLY — NOT allCards.csv)
  const [chipCC, setChipCC] = useState([]); // credit bases
  const [chipDC, setChipDC] = useState([]); // debit bases
  const [chipUPI, setChipUPI] = useState([]); // upi providers
  const [chipNB, setChipNB] = useState([]); // net banking providers

  // ui state
  const [filteredCards, setFilteredCards] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // {type, display, baseNorm}
  const [noMatches, setNoMatches] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // offers (ONLY these CSVs)
  const [blinkitOffers, setBlinkitOffers] = useState([]);
  const [swiggyOffers, setSwiggyOffers] = useState([]);
  const [zeptoOffers, setZeptoOffers] = useState([]);
  const [bigbasketOffers, setBigbasketOffers] = useState([]);
  const [permanentOffers, setPermanentOffers] = useState([]);

  // responsive
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 1) Load allCards.csv for dropdown lists ONLY
  useEffect(() => {
    async function loadAllCards() {
      try {
        const res = await axios.get(`/allCards.csv`);
        const parsed = Papa.parse(res.data, { header: true });
        const rows = parsed.data || [];

        const creditMap = new Map();
        const debitMap = new Map();

        for (const row of rows) {
          const ccList = splitList(firstField(row, LIST_FIELDS.credit));
          for (const raw of ccList) {
            const base = brandCanonicalize(getBase(raw));
            const baseNorm = toNorm(base);
            if (baseNorm)
              creditMap.set(baseNorm, creditMap.get(baseNorm) || base);
          }
          const dcList = splitList(firstField(row, LIST_FIELDS.debit));
          for (const raw of dcList) {
            const base = brandCanonicalize(getBase(raw));
            const baseNorm = toNorm(base);
            if (baseNorm)
              debitMap.set(baseNorm, debitMap.get(baseNorm) || base);
          }
        }

        const credit = Array.from(creditMap.values())
          .sort((a, b) => a.localeCompare(b))
          .map((d) => makeEntry(d, "credit"));
        const debit = Array.from(debitMap.values())
          .sort((a, b) => a.localeCompare(b))
          .map((d) => makeEntry(d, "debit"));

        setCreditEntries(credit);
        setDebitEntries(debit);

        setFilteredCards([
          ...(credit.length ? [{ type: "heading", label: "Credit Cards" }] : []),
          ...credit,
          ...(debit.length ? [{ type: "heading", label: "Debit Cards" }] : []),
          ...debit,
        ]);

        if (!credit.length && !debit.length) {
          setNoMatches(true);
          setSelected(null);
        }
      } catch (e) {
        console.error("allCards.csv load error:", e);
        setNoMatches(true);
        setSelected(null);
      }
    }
    loadAllCards();
  }, []);

  // 2) Load offer CSVs (blinkit, swiggy_instamart, zepto, bigbasket, permanent_offers)
  useEffect(() => {
    async function loadOffers() {
      try {
        const files = [
          { name: "blinkit.csv", setter: setBlinkitOffers },
          { name: "swiggy_instamart.csv", setter: setSwiggyOffers },
          { name: "zepto.csv", setter: setZeptoOffers },
          { name: "bigbasket.csv", setter: setBigbasketOffers },
          { name: "permanent_offers.csv", setter: setPermanentOffers },
        ];

        await Promise.all(
          files.map(async (f) => {
            const res = await axios.get(`/${encodeURIComponent(f.name)}`);
            const parsed = Papa.parse(res.data, {
              header: true,
              skipEmptyLines: true,
            });
            f.setter(parsed.data || []);
          })
        );
      } catch (e) {
        console.error("Offer CSV load error:", e);
      }
    }
    loadOffers();
  }, []);

  /** Build chip strips from OFFER CSVs (exclude allCards.csv) */
  useEffect(() => {
    const ccMap = new Map(); // baseNorm -> display
    const dcMap = new Map();
    const upiMap = new Map();
    const nbMap = new Map();

    const harvestList = (val, targetMap) => {
      for (const raw of splitList(val)) {
        const base = brandCanonicalize(getBase(raw));
        const baseNorm = toNorm(base);
        if (baseNorm) targetMap.set(baseNorm, targetMap.get(baseNorm) || base);
      }
    };

    const harvestRows = (rows) => {
      for (const o of rows || []) {
        const ccField = firstField(o, LIST_FIELDS.credit);
        if (ccField) harvestList(ccField, ccMap);

        const dcField = firstField(o, LIST_FIELDS.debit);
        if (dcField) harvestList(dcField, dcMap);

        const upiField = firstField(o, LIST_FIELDS.upi);
        if (upiField) harvestList(upiField, upiMap);

        const nbField = firstField(o, LIST_FIELDS.netBanking);
        if (nbField) harvestList(nbField, nbMap);
      }
    };

    // grocery offer files
    harvestRows(blinkitOffers);
    harvestRows(swiggyOffers);
    harvestRows(zeptoOffers);
    harvestRows(bigbasketOffers);

    // Permanent credit cards (credit only)
    for (const o of permanentOffers || []) {
      const nm = firstField(o, LIST_FIELDS.permanentCCName);
      if (nm) {
        const base = brandCanonicalize(getBase(nm));
        const baseNorm = toNorm(base);
        if (baseNorm) ccMap.set(baseNorm, ccMap.get(baseNorm) || base);
      }
    }

    setChipCC(Array.from(ccMap.values()).sort((a, b) => a.localeCompare(b)));
    setChipDC(Array.from(dcMap.values()).sort((a, b) => a.localeCompare(b)));
    setChipUPI(Array.from(upiMap.values()).sort((a, b) => a.localeCompare(b)));
    setChipNB(Array.from(nbMap.values()).sort((a, b) => a.localeCompare(b)));

    setUpiEntries(
      Array.from(upiMap.values())
        .sort((a, b) => a.localeCompare(b))
        .map((d) => makeEntry(d, "upi"))
    );
    setNetBankingEntries(
      Array.from(nbMap.values())
        .sort((a, b) => a.localeCompare(b))
        .map((d) => makeEntry(d, "netbanking"))
    );
  }, [blinkitOffers, swiggyOffers, zeptoOffers, bigbasketOffers, permanentOffers]);

  /** search box – UPDATED with fuzzy + select + debit-first logic */
  const onChangeQuery = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);

    if (!val.trim()) {
      setFilteredCards([]);
      setNoMatches(false);
      return;
    }

    const trimmed = val.trim();
    const qLower = trimmed.toLowerCase();

    const scored = (arr) =>
      arr
        .map((it) => {
          const baseScore = scoreCandidate(trimmed, it.display);
          const inc = it.display.toLowerCase().includes(qLower);
          const fuzzy = isFuzzyNameMatch(trimmed, it.display);

          let s = baseScore;
          if (inc) s += 2.0; // strong boost if substring match
          if (fuzzy) s += 1.5; // boost typo-ish matches

          return { it, s, inc, fuzzy };
        })
        .filter(({ s, inc, fuzzy }) => inc || fuzzy || s > 0.3)
        .sort((a, b) => b.s - a.s || a.it.display.localeCompare(b.it.display))
        .slice(0, MAX_SUGGESTIONS)
        .map(({ it }) => it);

    let cc = scored(creditEntries);
    let dc = scored(debitEntries);
    let upi = scored(upiEntries);
    let nb = scored(netBankingEntries);

    if (!cc.length && !dc.length && !upi.length && !nb.length) {
      setNoMatches(true);
      setFilteredCards([]);
      return;
    }

    // ---- SPECIAL CASE 1: "select" intent (even with typos like "selct") ----
    const qNorm = toNorm(trimmed);
    const qWords = qNorm.split(" ").filter(Boolean);

    const hasSelectWord = qWords.some((w) => {
      if (w === "select") return true;
      if (w.length < 3) return false;
      const d = lev(w, "select");
      const sim = 1 - d / Math.max(w.length, "select".length);
      return sim >= 0.7; // "selct", "selec", "slect", etc.
    });

    const isSelectIntent =
      qNorm.includes("select credit card") ||
      qNorm.includes("select card") ||
      hasSelectWord;

    if (isSelectIntent) {
      const reorderBySelect = (arr) => {
        const selectCards = [];
        const others = [];
        arr.forEach((item) => {
          const labelNorm = toNorm(item.display);
          if (labelNorm.includes("select")) selectCards.push(item);
          else others.push(item);
        });
        return [...selectCards, ...others];
      };
      cc = reorderBySelect(cc);
      dc = reorderBySelect(dc);
      upi = reorderBySelect(upi);
      nb = reorderBySelect(nb);
    }

    // ---- SPECIAL CASE 2: payment intent => matching section first ----
    const lv = qLower;
    const debitIntent =
      lv.includes("debit card") || lv.includes("debit") || lv.includes("dc");
    const upiIntent = lv.includes("upi");
    const netBankingIntent =
      lv.includes("net banking") ||
      lv.includes("netbanking") ||
      lv.includes("nb");

    const sectionMap = {
      credit: { label: "Credit Cards", items: cc },
      debit: { label: "Debit Cards", items: dc },
      upi: { label: "UPI", items: upi },
      netbanking: { label: "Net Banking", items: nb },
    };
    const buildSections = (order) =>
      order.flatMap((k) => {
        const sec = sectionMap[k];
        return sec.items.length
          ? [{ type: "heading", label: sec.label }, ...sec.items]
          : [];
      });

    const order = upiIntent
      ? ["upi", "netbanking", "credit", "debit"]
      : netBankingIntent
      ? ["netbanking", "upi", "credit", "debit"]
      : debitIntent
      ? ["debit", "credit", "upi", "netbanking"]
      : ["credit", "debit", "upi", "netbanking"];

    setNoMatches(false);
    setFilteredCards(buildSections(order));
  };

  const onPick = (entry) => {
    setSelected(entry);
    setQuery(entry.display);
    setFilteredCards([]);
    setNoMatches(false);
  };

  // Chip click → set the dropdown + selected entry
  const handleChipClick = (name, type) => {
    const display = brandCanonicalize(getBase(name));
    const baseNorm = toNorm(display);
    setQuery(display);
    setSelected({ type, display, baseNorm });
    setFilteredCards([]);
    setNoMatches(false);
  };

  /** Build matches for one CSV: return wrappers {offer, site, variantText} */
  function matchesFor(offers, type, site) {
    if (!selected) return [];
    const out = [];
    for (const o of offers || []) {
      let list = [];
      if (type === "permanent") {
        const nm = firstField(o, LIST_FIELDS.permanentCCName);
        if (nm) list = [nm];
      } else if (type === "upi") {
        list = splitList(firstField(o, LIST_FIELDS.upi));
      } else if (type === "netbanking") {
        list = splitList(firstField(o, LIST_FIELDS.netBanking));
      } else if (type === "debit") {
        list = splitList(firstField(o, LIST_FIELDS.debit));
      } else {
        list = splitList(firstField(o, LIST_FIELDS.credit));
      }

      let matched = false;
      let matchedVariant = "";
      for (const raw of list) {
        const base = brandCanonicalize(getBase(raw));
        if (toNorm(base) === selected.baseNorm) {
          matched = true;
          const v = getVariant(raw);
          if (v) matchedVariant = v;
          break;
        }
      }
      if (matched) {
        out.push({ offer: o, site, variantText: matchedVariant });
      }
    }
    return out;
  }

  const selectedTypeForRetail =
    selected?.type === "debit"
      ? "debit"
      : selected?.type === "upi"
      ? "upi"
      : selected?.type === "netbanking"
      ? "netbanking"
      : "credit";

  // Collect matches, then dedup
  const wPermanent = matchesFor(permanentOffers, "permanent", "Permanent");
  const wBlinkit = matchesFor(
    blinkitOffers,
    selectedTypeForRetail,
    "Blinkit"
  );
  const wSwiggy = matchesFor(
    swiggyOffers,
    selectedTypeForRetail,
    "Swiggy Instamart"
  );
  const wZepto = matchesFor(
    zeptoOffers,
    selectedTypeForRetail,
    "Zepto"
  );
  const wBigbasket = matchesFor(
    bigbasketOffers,
    selectedTypeForRetail,
    "BigBasket"
  );

  const seen = new Set();
  // permanent for credit only
  const dPermanent =
    selected?.type === "credit" ? dedupWrappers(wPermanent, seen) : [];
  const dBlinkit = dedupWrappers(wBlinkit, seen);
  const dSwiggy = dedupWrappers(wSwiggy, seen);
  const dZepto = dedupWrappers(wZepto, seen);
  const dBigbasket = dedupWrappers(wBigbasket, seen);

  const hasAny = Boolean(
    dPermanent.length ||
      dBlinkit.length ||
      dSwiggy.length ||
      dZepto.length ||
      dBigbasket.length
  );

  /** Offer card UI */
  const OfferCard = ({ wrapper, isPermanent, isRetail }) => {
    const o = wrapper.offer;
    const siteName = wrapper.site; // "Blinkit", "Swiggy Instamart", "Zepto", "BigBasket", "Permanent"

    const titleFromCsv =
      firstField(o, LIST_FIELDS.title) || o.Website || o["Offer"];
    const descFromCsv =
      firstField(o, LIST_FIELDS.desc) || o["Description"] || "";

    const permanentBenefit = isPermanent
      ? firstField(o, LIST_FIELDS.permanentBenefit)
      : "";

    const link = firstField(o, LIST_FIELDS.link);

    const rawImage = firstField(o, LIST_FIELDS.image);
    const fallbackSiteName = o.Website || o.Site || siteName;
    const { src: finalImg, usingFallback } = resolveImage(
      fallbackSiteName,
      rawImage
    );

    const showVariantNote =
      VARIANT_NOTE_SITES.has(siteName) &&
      wrapper.variantText &&
      wrapper.variantText.trim().length > 0;

    // 🔹 Scrollable description for Blinkit, Swiggy Instamart, BigBasket
    const isScrollableDescSite =
      siteName === "Blinkit" ||
      siteName === "Swiggy Instamart" ||
      siteName === "BigBasket";

    return (
      <div className="offer-card">
        {finalImg && (
          <img
            className={`offer-img ${usingFallback ? "is-fallback" : ""}`}
            src={finalImg}
            alt={titleFromCsv || "Offer"}
            onError={(e) => handleImgError(e, fallbackSiteName)}
          />
        )}

        <div className="offer-info">
          <h3 className="offer-title">{titleFromCsv || "Offer"}</h3>

          {isPermanent ? (
            <>
              {permanentBenefit && (
                <p className="offer-desc">{permanentBenefit}</p>
              )}
              <p className="inbuilt-note">
                <strong>This is a inbuilt feature of this credit card</strong>
              </p>
            </>
          ) : (
            descFromCsv &&
            (isScrollableDescSite ? (
              <div
                style={{
                  maxHeight: 100,
                  overflowY: "auto",
                  paddingRight: 6,
                }}
              >
                <p className="offer-desc">{descFromCsv}</p>
              </div>
            ) : (
              <p className="offer-desc">{descFromCsv}</p>
            ))
          )}

          {showVariantNote && (
            <p className="network-note">
              <strong>Note:</strong> This benefit is applicable only on{" "}
              <em>{wrapper.variantText}</em> variant
            </p>
          )}

          {link && (
            <button className="btn" onClick={() => window.open(link, "_blank")}>
              View Offer
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="App" style={{ fontFamily: "'Libre Baskerville', serif" }}>
      {/* Cards-with-offers strip container */}
      {(chipCC.length > 0 ||
        chipDC.length > 0 ||
        chipUPI.length > 0 ||
        chipNB.length > 0) && (
        <div
          style={{
            maxWidth: 1200,
            margin: "14px auto 0",
            padding: "14px 16px",
            background: "#F7F9FC",
            border: "1px solid #E8EDF3",
            borderRadius: 10,
            boxShadow: "0 6px 18px rgba(15,23,42,.06)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: "#1F2D45",
              marginBottom: 10,
              display: "flex",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span>Credit And Debit Cards Which Have Offers</span>
          </div>

          {/* Credit strip */}
          {chipCC.length > 0 && (
            <marquee
              direction="left"
              scrollAmount="4"
              style={{
                marginBottom: 8,
                whiteSpace: "nowrap",
              }}
            >
              <strong style={{ marginRight: 10, color: "#1F2D45" }}>
                Credit Cards:
              </strong>
              {chipCC.map((name, idx) => (
                <span
                  key={`cc-chip-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChipClick(name, "credit")}
                  onKeyDown={(e) =>
                    e.key === "Enter" ? handleChipClick(name, "credit") : null
                  }
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    border: "1px solid #E0E6EE",
                    borderRadius: 9999,
                    marginRight: 8,
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1.2,
                    userSelect: "none",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#F0F5FF")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "#fff")
                  }
                  title="Click to select this card"
                >
                  {name}
                </span>
              ))}
            </marquee>
          )}

          {/* Debit strip */}
          {chipDC.length > 0 && (
            <marquee
              direction="left"
              scrollAmount="4"
              style={{ whiteSpace: "nowrap" }}
            >
              <strong style={{ marginRight: 10, color: "#1F2D45" }}>
                Debit Cards:
              </strong>
              {chipDC.map((name, idx) => (
                <span
                  key={`dc-chip-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChipClick(name, "debit")}
                  onKeyDown={(e) =>
                    e.key === "Enter" ? handleChipClick(name, "debit") : null
                  }
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    border: "1px solid #E0E6EE",
                    borderRadius: 9999,
                    marginRight: 8,
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1.2,
                    userSelect: "none",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#F0F5FF")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "#fff")
                  }
                  title="Click to select this card"
                >
                  {name}
                </span>
              ))}
            </marquee>
          )}

          {/* UPI + Net Banking strip (single row) */}
          {(chipUPI.length > 0 || chipNB.length > 0) && (
            <marquee
              direction="left"
              scrollAmount="4"
              style={{ whiteSpace: "nowrap", marginTop: 8 }}
            >
              <strong style={{ marginRight: 10, color: "#1F2D45" }}>
                UPI/Net Banking:
              </strong>
              {chipUPI.map((name, idx) => (
                <span
                  key={`upi-chip-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChipClick(name, "upi")}
                  onKeyDown={(e) =>
                    e.key === "Enter" ? handleChipClick(name, "upi") : null
                  }
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    border: "1px solid #E0E6EE",
                    borderRadius: 9999,
                    marginRight: 8,
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1.2,
                    userSelect: "none",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#F0F5FF")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "#fff")
                  }
                  title="Click to select this UPI offer type"
                >
                  {name}
                </span>
              ))}
              {chipNB.map((name, idx) => (
                <span
                  key={`nb-chip-${idx}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChipClick(name, "netbanking")}
                  onKeyDown={(e) =>
                    e.key === "Enter"
                      ? handleChipClick(name, "netbanking")
                      : null
                  }
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    border: "1px solid #E0E6EE",
                    borderRadius: 9999,
                    marginRight: 8,
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1.2,
                    userSelect: "none",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#F0F5FF")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "#fff")
                  }
                  title="Click to select this Net Banking offer type"
                >
                  {name}
                </span>
              ))}
            </marquee>
          )}
        </div>
      )}

      {/* Search / dropdown */}
      <div
        className="dropdown"
        style={{
          position: "relative",
          width: "600px",
          margin: "20px auto",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={onChangeQuery}
          placeholder="Type a Credit Card, Debit Card, UPI, or Net Banking..."
          className="dropdown-input"
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            border: `1px solid ${noMatches ? "#d32f2f" : "#ccc"}`,
            borderRadius: "6px",
          }}
        />
        {query.trim() && !!filteredCards.length && (
          <ul
            className="dropdown-list"
            style={{
              listStyle: "none",
              padding: "10px",
              margin: 0,
              width: "100%",
              maxHeight: "260px",
              overflowY: "auto",
              border: "1px solid #ccc",
              borderRadius: "6px",
              backgroundColor: "#fff",
              position: "absolute",
              zIndex: 1000,
            }}
          >
            {filteredCards.map((item, idx) =>
              item.type === "heading" ? (
                <li
                  key={`h-${idx}`}
                  style={{
                    padding: "8px 10px",
                    fontWeight: 700,
                    background: "#fafafa",
                  }}
                >
                  {item.label}
                </li>
              ) : (
                <li
                  key={`i-${idx}-${item.display}`}
                  onClick={() => onPick(item)}
                  style={{
                    padding: "10px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f2f2f2",
                  }}
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "#f7f9ff")
                  }
                  onMouseOut={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {item.display}
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {noMatches && query.trim() && (
        <p
          style={{
            color: "#d32f2f",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          No matching card/payment method found. Please try a different name.
        </p>
      )}

      {/* Offers by section */}
      {selected && hasAny && !noMatches && (
        <div
          className="offers-section"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: 20,
          }}
        >
          {!!dPermanent.length && (
            <div className="offer-group">
              <h2 style={{ textAlign: "center" }}>Permanent Offers</h2>
              <div className="offer-grid">
                {dPermanent.map((w, i) => (
                  <OfferCard key={`perm-${i}`} wrapper={w} isPermanent />
                ))}
              </div>
            </div>
          )}

          {!!dBlinkit.length && (
            <div className="offer-group">
              <h2 style={{ textAlign: "center" }}>Offers On Blinkit</h2>
              <div className="offer-grid">
                {dBlinkit.map((w, i) => (
                  <OfferCard key={`bl-${i}`} wrapper={w} isRetail />
                ))}
              </div>
            </div>
          )}

          {!!dSwiggy.length && (
            <div className="offer-group">
              <h2 style={{ textAlign: "center" }}>
                Offers On Swiggy Instamart
              </h2>
              <div className="offer-grid">
                {dSwiggy.map((w, i) => (
                  <OfferCard key={`sw-${i}`} wrapper={w} isRetail />
                ))}
              </div>
            </div>
          )}

          {!!dZepto.length && (
            <div className="offer-group">
              <h2 style={{ textAlign: "center" }}>Offers On Zepto</h2>
              <div className="offer-grid">
                {dZepto.map((w, i) => (
                  <OfferCard key={`zp-${i}`} wrapper={w} isRetail />
                ))}
              </div>
            </div>
          )}

          {!!dBigbasket.length && (
            <div className="offer-group">
              <h2 style={{ textAlign: "center" }}>Offers On BigBasket</h2>
              <div className="offer-grid">
                {dBigbasket.map((w, i) => (
                  <OfferCard key={`bb-${i}`} wrapper={w} isRetail />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selected && !hasAny && !noMatches && (
        <p
          style={{
            color: "#d32f2f",
            textAlign: "center",
            marginTop: 10,
          }}
        >
          No offer available for this card
        </p>
      )}

      {selected && hasAny && !noMatches && (
        <button
          onClick={() =>
            window.scrollBy({
              top: window.innerHeight,
              behavior: "smooth",
            })
          }
          style={{
            position: "fixed",
            right: 20,
            bottom: isMobile ? 220 : 250,
            padding: isMobile ? "12px 15px" : "10px 20px",
            backgroundColor: "#1e7145",
            color: "white",
            border: "none",
            borderRadius: isMobile ? "50%" : 8,
            cursor: "pointer",
            fontSize: 18,
            zIndex: 1000,
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            width: isMobile ? 50 : 140,
            height: isMobile ? 50 : 50,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {isMobile ? "↓" : "Scroll Down"}
        </button>
      )}

      <Disclaimer />
    </div>
  );
};

export default AirlineOffers;
