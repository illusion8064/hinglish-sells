/* =========================================================================
   Hinglish Sells? — STUDY CONFIGURATION (single source of truth)
   Everything a researcher may need to change lives in this file:
   backend URL, timing, products/brands/slogans, and all questionnaire text.
   ========================================================================= */
window.STUDY = {
  studyId: "hinglish-sells-main-v1",
  title: "How people evaluate advertisements for new brands", // neutral title (no hypothesis)

  /* ---------- Backend ----------
     Paste the Google Apps Script web-app URL (ends in /exec) after deployment.
     When the page is served from localhost (tools/dev_server.py) the local
     mock backend "/api" is used automatically. If both are unavailable, the
     participant can download their data file at the end (fallback). */
  backendUrl: "https://script.google.com/macros/s/AKfycbxLohGVv-5WFxAXrX2UzKaHuX7wcl4FPwaJEBTwu68leEhaXICTr5VvdBmTb_YbsK_ZkQ/exec",

  /* ---------- Timing ---------- */
  exposureMs: 10000,       // FIXED exposure per ad (do not change)
  fixationMs: 800,         // blank "next ad" screen before each ad
  pendingWindowMin: 40,    // started-but-unfinished sessions count as "pending" for balanced assignment

  /* ---------- Versions (course requirement: 2 versions) ----------
     lab    = in person, IIIT-H lab laptop, researcher present (?v=lab)
     online = own device, anywhere (default)                     (?v=online) */
  versions: ["lab", "online"],

  /* ---------- Languages ---------- */
  languages: {
    E: { label: "English",  script: "Latn" },
    H: { label: "Hindi",    script: "Deva" },
    X: { label: "Hinglish", script: "Latn" }
  },

  /* ---------- Products & stimuli ----------
     8 fictitious international brands: N1-N4 = necessities, L1-L4 = luxuries.
     Each ad is a finished image (16:9) in experiment/assets/ads/ad_<slot>_<lang>.jpg
     (web copies of presentation/figures/). The slogan is part of the image; the
     text below is a transcription, stored with every trial for the data file.
     Category membership is checked by the product pretest and by the
     manipulation check in the main study. */
  adImage: (slot, lang) => `assets/ads/ad_${slot}_${lang}.jpg`,
  adAspect: 16 / 9,
  products: {
    N1: { category: "necessity", product: "detergent", brand: "Brevano",
      slogans: { E: "Absolutely clean clothes!", H: "बिल्कुल साफ़ कपड़े!", X: "Bilkul clean kapde!" } },
    N2: { category: "necessity", product: "toothpaste", brand: "Corvane",
      slogans: { E: "A bright smile every day!", H: "हर दिन चमकती मुस्कान!", X: "Har din chamakti smile!" } },
    N3: { category: "necessity", product: "atta (wheat flour)", brand: "Millora",
      slogans: { E: "Soft rotis every day!", H: "हर दिन नरम रोटियाँ!", X: "Har din naram rotis!" } },
    N4: { category: "necessity", product: "cooking oil", brand: "Olivaro",
      slogans: { E: "Taste and health in every dish!", H: "हर पकवान में स्वाद और सेहत!",
                 X: "Har roz ke khane mein zyada swaad, zyada sehat!" } },
    L1: { category: "luxury", product: "chocolate", brand: "Velmora",
      slogans: { E: "A Richer Chocolate Experience", H: "हर बाइट में स्मूथ चॉकलेट का मज़ा",
                 X: "Har Bite Mein Smoother Chocolate Ka Mazaa" } },
    L2: { category: "luxury", product: "ice cream", brand: "Zelvia",
      slogans: { E: "Indulgence in Every Scoop", H: "हर स्कूप में थोड़ी सी लज़्ज़त",
                 X: "Har Scoop Mein Pure Ice Cream Wali Khushi" } },
    L3: { category: "luxury", product: "perfume", brand: "Aurévia",
      slogans: { E: "A Scent That Stays With You", H: "एक ऐसी ख़ुशबू जो हमेशा साथ रहे",
                 X: "Ek Aisi Khushboo Jo Saath Nibhaye" } },
    L4: { category: "luxury", product: "sunglasses", brand: "Solvane",
      slogans: { E: "Style for Every Perspective", H: "हर नज़रिए के लिए परफेक्ट स्टाइल",
                 X: "Har Perspective Ke Liye Perfect Style" } }
  },

  /* ---------- Per-ad rating items (presented identically after every ad) ----------
     7-point bipolar scales. Sources and adaptations: docs/02_Methods_Protocol.md §6. */
  ratingBlocks: [
    { id: "eval", prompt: "Your overall reaction to this ad:", items: [
      { id: "ae_good", left: "Bad",     right: "Good" },
      { id: "ae_like", left: "Dislike", right: "Like" }
    ]},
    { id: "assoc", prompt: "This ad feels…", items: [
      { id: "so_cosmo",  left: "Rural",        right: "Cosmopolitan" },
      { id: "be_person", left: "Impersonal",   right: "Personal" },
      { id: "so_class",  left: "Middle class", right: "Upper class" },
      { id: "be_close",  left: "Distant",      right: "Close, like family" },
      { id: "so_global", left: "Local",        right: "Global" },
      { id: "be_friend", left: "Formal",       right: "Friendly" }
    ]},
    { id: "trust", prompt: "This ad seems…", items: [
      { id: "tr_honest",  left: "Dishonest",  right: "Honest" },
      { id: "tr_sincere", left: "Insincere",  right: "Sincere" },
      { id: "tr_reliab",  left: "Unreliable", right: "Reliable" }
    ]},
    { id: "pi", prompt: "Buying {PRODUCT} from {BRAND}:", items: [
      { id: "pi_intend",   left: "Definitely do not intend to buy", right: "Definitely intend to buy" },
      { id: "pi_interest", left: "Very low purchase interest",      right: "Very high purchase interest" }
    ]}
  ],
  // Two instructed-response items (one per half of the session); both must be correct.
  attentionChecks: [
    { position: 8,  id: "attn1", text: "Attention check: for this row, please select the middle circle (4).", correct: 4 },
    { position: 19, id: "attn2", text: "Attention check: for this row, please select the second circle from the left (2).", correct: 2 }
  ],

  /* ---------- Manipulation check: luxury–necessity (Bearden & Etzel, 1982; K&A, 2008) ---------- */
  luxNecScale: { points: 6, left: "A luxury for everyone", right: "A necessity for everyone" },

  /* ---------- Contacts (from the approved consent form) ---------- */
  contacts: {
    pi: "Ritama Sanyal (ritama.sanyal@research.iiit.ac.in)",
    coPi: "Priyanshi Jain (priyanshi.jain@research.iiit.ac.in)",
    supervisors: "Prof. Vinoo Alluri and Prof. Bapi Raju, IIIT Hyderabad",
    withdrawUntil: "[2026-11-10]"
  }
};
