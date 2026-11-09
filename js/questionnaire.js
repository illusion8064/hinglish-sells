/* =========================================================================
   Questionnaire definitions (screening + post-task sections).
   Each item records its source in `src` (see docs/02_Methods_Protocol.md §6).
   Types: radio | number | scale (n-point row) | percent3 | text | select
   ========================================================================= */
window.QUESTIONNAIRE = {

  screening: [
    { id: "age", type: "number", min: 15, max: 80, required: true,
      q: "How old are you (in years)?", src: "eligibility" },
    { id: "student", type: "radio", required: true,
      q: "Are you currently enrolled as a student at a college or university (undergraduate, postgraduate or PhD)?",
      options: ["Yes", "No"], src: "eligibility (college-student sample)" },
    { id: "deva_word", type: "radio", required: true, shuffle: true,
      q: "What does this Hindi word mean?  <span class='deva-big' lang='hi'>पानी</span>",
      options: ["Water", "Fire", "House", "Book"], correct: "Water",
      src: "Devanagari reading screen (new)" },
    { id: "deva_sentence", type: "radio", required: true, shuffle: true,
      q: "What does this Hindi sentence mean?  <span class='deva-big' lang='hi'>मुझे चाय पसंद है।</span>",
      options: ["I like tea.", "I want to sleep.", "The shop is closed.", "It is raining."], correct: "I like tea.",
      src: "Devanagari reading screen (new)" },
    { id: "prior", type: "radio", required: true,
      q: "Have you already taken part in an earlier survey for this project (a product survey or a slogan survey), or helped prepare its materials?",
      options: ["No", "Yes"], src: "exclusion (non-naïve participants)" }
  ],

  luxNec: { // manipulation check, rendered for the 4 study products
    q: "For each product below, how would you describe it? (1 = a luxury for everyone … 6 = a necessity for everyone)",
    src: "Bearden & Etzel (1982) luxury–necessity scale as used by Krishna & Ahluwalia (2008), 6 points"
  },

  coverCheck: { id: "cover_check", type: "radio", required: true,
    q: "Earlier in this study, the eight brands were described as…",
    options: ["Indian brands", "International brands launching in India", "I don't remember"],
    src: "check of the held-constant brand framing (new)" },

  language: [
    { id: "first_lang", type: "radio", required: true,
      q: "Which language did you learn first?",
      options: ["Hindi", "English", "Hindi and English at the same time", "Another language"],
      src: "LEAP-Q item 2 (order of acquisition), adapted to closed format" },
    { id: "first_lang_other", type: "text", required: false, showIf: { first_lang: "Another language" },
      q: "Which other language?", src: "LEAP-Q item 2" },
    { id: "aoa_hindi", type: "number", min: 0, max: 40, required: true,
      q: "At what age did you begin learning <b>Hindi</b>? (0 = from birth)", src: "LEAP-Q L-section item 1" },
    { id: "aoa_english", type: "number", min: 0, max: 40, required: true,
      q: "At what age did you begin learning <b>English</b>? (0 = from birth)", src: "LEAP-Q L-section item 1" },
    { id: "prof_hi_speak",  type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>speaking Hindi</b>", src: "LEAP-Q L-section item 3" },
    { id: "prof_hi_under",  type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>understanding spoken Hindi</b>", src: "LEAP-Q L-section item 3" },
    { id: "prof_hi_readdeva", type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>reading Hindi in Devanagari script</b> (हिंदी)", src: "LEAP-Q item 3 (reading), script specified" },
    { id: "prof_hi_readroman", type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>reading Hindi written in Roman script</b> (e.g. “kya haal hai”)", src: "new item modelled on LEAP-Q item 3 (script familiarity)" },
    { id: "prof_en_speak",  type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>speaking English</b>", src: "LEAP-Q L-section item 3" },
    { id: "prof_en_under",  type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>understanding spoken English</b>", src: "LEAP-Q L-section item 3" },
    { id: "prof_en_read",   type: "scale", points: 11, start: 0, left: "0 = none", right: "10 = perfect", required: true,
      q: "Your level of proficiency in <b>reading English</b>", src: "LEAP-Q L-section item 3" },
    { id: "exposure", type: "percent3", required: true, labels: ["Hindi", "English", "Other languages"],
      q: "What percentage of the time are you <b>currently</b> exposed to each language? (should add up to 100%)",
      src: "LEAP-Q item 3 (current exposure %)" },
    { id: "ctx_hi_friends", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How much are you currently exposed to <b>Hindi</b> when interacting with <b>friends</b>?", src: "LEAP-Q L-section item 5" },
    { id: "ctx_hi_family", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How much are you currently exposed to <b>Hindi</b> when interacting with <b>family</b>?", src: "LEAP-Q L-section item 5" },
    { id: "ctx_hi_social", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How much are you currently exposed to <b>Hindi</b> on <b>social media</b>?", src: "LEAP-Q item 5, context updated (radio → social media)" },
    { id: "ctx_en_friends", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How much are you currently exposed to <b>English</b> when interacting with <b>friends</b>?", src: "LEAP-Q L-section item 5" },
    { id: "ctx_en_family", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How much are you currently exposed to <b>English</b> when interacting with <b>family</b>?", src: "LEAP-Q L-section item 5" },
    { id: "ctx_en_social", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How much are you currently exposed to <b>English</b> on <b>social media</b>?", src: "LEAP-Q item 5, context updated" },
    { id: "hinglish_use", type: "scale", points: 11, start: 0, left: "0 = never", right: "10 = always", required: true,
      q: "How often do you <b>mix Hindi and English</b> in the same sentence when talking or texting with friends?", src: "new item (code-mixing frequency), LEAP-Q response format" }
  ],

  favourability: { // Krishna & Ahluwalia (2008) language-favourability items -> net favourability covariate
    src: "Krishna & Ahluwalia (2008) pilot study; two 7-point items per language",
    langs: [ { key: "en", name: "English" }, { key: "hi", name: "Hindi" } ],
    items: [
      { id: "fav_{L}_1", left: "Extremely unfavourable", right: "Extremely favourable" },
      { id: "fav_{L}_2", left: "Extremely negative",     right: "Extremely positive" }
    ],
    q: "Overall, how do you feel about the use of <b>{NAME}</b>?"
  },

  demographics: [
    { id: "gender", type: "radio", required: true,
      q: "Gender", options: ["Woman", "Man", "Non-binary / another gender", "Prefer not to say"], src: "descriptive" },
    { id: "level", type: "radio", required: true,
      q: "Current programme", options: ["Undergraduate", "Postgraduate (Masters)", "PhD", "Other"], src: "descriptive" },
    { id: "field", type: "radio", required: true,
      q: "Field of study", options: ["Computer science / IT / engineering", "Natural sciences", "Humanities / social sciences",
        "Design / arts", "Management / commerce", "Other"], src: "descriptive" },
    { id: "region", type: "radio", required: true,
      q: "Where did you spend most of your childhood?",
      options: ["A Hindi-speaking state (e.g. UP, MP, Bihar, Rajasthan, Delhi, Haryana)", "Another Indian state",
        "Outside India", "Prefer not to say"],
      src: "descriptive only — NOT used to infer language dominance" }
  ],

  awareness: [
    { id: "aware_purpose", type: "text", long: true, required: false,
      q: "In one or two sentences: what do you think this study was trying to find out?",
      src: "funnel-type hypothesis-awareness probe (demand characteristics)" },
    { id: "comments", type: "text", long: true, required: false,
      q: "Any comments (e.g. problems seeing the ads, anything unclear)?", src: "pilot / data quality" }
  ]
};
