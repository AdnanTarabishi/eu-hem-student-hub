// Join the Directory: the choices the form offers, with stable ids (what is sent) and labels (what people see).
// The backend (integrations/directory-apps-script/Code.gs) has the same OPTIONS and VIS_RULES and checks
// every answer against them; scripts/check-content.js fails if the two files differ.
// Current track names come from content/tracks.json (ids eeh, ep, mhi, phm), see join.js.
window.EUHEM_DIRECTORY_OPTIONS = {
  OPTIONS: {
    userTypes: {
      current_student: "Current EU-HEM student",
      alumni: "EU-HEM alumnus / former student",
      shared_course_student: "Student from another programme",
      faculty_staff: "Faculty, staff or programme partner"
    },
    directoryEligible: { current_student: true, alumni: true, shared_course_student: false, faculty_staff: false },
    currentTracks: {
      eeh: "Economic Evaluation in Healthcare",
      ep: "Health Economics & Policy",
      mhi: "Management of Healthcare Institutions",
      phm: "Population Health Management"
    },
    legacyTracks: {
      dmh: "Decision Making in Healthcare",
      gh: "Global Health",
      hfm: "Healthcare Finance and Management"
    },
    trackChoices: {
      not_chosen: "I haven't chosen my track yet",
      other_former: "Other / former EU-HEM specialisation",
      prefer_not_to_share: "Prefer not to share"
    },
    academicFields: {
      medicine: "Medicine",
      dentistry: "Dentistry & Oral Health",
      nursing_midwifery: "Nursing & Midwifery",
      pharmacy: "Pharmacy & Pharmaceutical Sciences",
      public_health: "Public Health",
      health_sciences: "Health Sciences / Health Policy & Management",
      allied_health: "Physiotherapy / Rehabilitation / Allied Health",
      nutrition: "Nutrition & Dietetics",
      biomedical_life_sciences: "Biomedical Sciences / Life Sciences / Biotechnology",
      quantitative_data: "Statistics / Mathematics / Data Science",
      engineering_technology: "Engineering / Technology",
      economics: "Economics / Health Economics",
      business_management_finance: "Business / Management / Finance",
      psychology_behaviour: "Psychology / Behavioural Sciences",
      political_policy_ir: "Political Science / Public Policy / International Relations",
      social_sciences: "Sociology / Social Sciences",
      law: "Law",
      philosophy_ethics_humanities: "Philosophy / Ethics / Humanities",
      other: "Other"
    },
    degrees: {
      bsc: "Bachelor of Science (BSc / BS)",
      ba: "Bachelor of Arts (BA)",
      bba: "Bachelor of Business Administration (BBA)",
      medicine: "Medicine (MD / MBBS / equivalent)",
      dentistry: "Dentistry (BDS / DDS / DMD / equivalent)",
      pharmacy: "Pharmacy (BPharm / PharmD / MPharm)",
      nursing: "Nursing (BN / BSN / BSc Nursing)",
      msc: "Master of Science (MSc)",
      ma: "Master of Arts (MA)",
      mph: "Master of Public Health (MPH)",
      mba: "Master of Business Administration (MBA)",
      other_master: "Other master's degree",
      other_professional: "Other professional degree",
      other: "Other"
    },
    programmeRoles: {
      faculty: "Faculty",
      lecturer: "Lecturer",
      coordinator: "Programme coordinator",
      thesis_supervisor: "Thesis supervisor",
      admin_staff: "Administrative staff",
      partner: "Partner organisation",
      guest: "Guest contributor",
      researcher: "Researcher",
      other: "Other"
    },
    features: {
      timetable: "Live Timetable",
      exams: "Exams & Deadlines",
      calendar: "Calendar Subscription",
      study_plan: "Study Plan & Progress",
      tracks: "Tracks Explorer",
      notes_resources: "Notes & Resources",
      flashcards_qbank: "Flashcards & Question Bank",
      thesis: "Thesis Hub / Past Thesis Explorer",
      student_directory: "Student Directory & Cohort Map",
      city_guides: "City Guides / Life Across EU-HEM",
      events: "Events & Student Activities",
      announcements: "Announcements",
      useful_links: "Useful Links & Official Resources",
      mobile_offline: "Mobile / Offline Experience",
      ai_study_assistant: "AI Study Assistant",
      careers: "Internships & Career Opportunities",
      alumni_network: "Alumni Network",
      peer_matching: "Study Groups / Peer Matching",
      mobility_housing: "Housing & Mobility Planner",
      other: "Other"
    },
    citizenshipGroups: {
      eu_eea_swiss: "EU / EEA / Swiss citizen",
      non_eu_eea_swiss: "Non-EU / EEA / Swiss citizen",
      prefer_not_to_say: "Prefer not to say"
    },
    studyVisaExperience: { yes: "Yes", no: "No", not_sure: "Not sure", not_applicable: "Not applicable", prefer_not_to_say: "Prefer not to say" },
    mobilityVisibility: { private: "Keep private", cohort: "Share with verified EU-HEM students" },
    visibility: { public: "Public", cohort: "EU-HEM members only", hidden: "Hidden" },
    roleVerification: { pending: "Pending", verified: "Verified", rejected: "Rejected" }
  },

  // Which visibility each detail may have, for each profile choice. Email is never public.
  // Nothing can be wider than the profile itself. Citizenship and study-visa answers are not here:
  // they are never public (mobilityVisibility: private or verified EU-HEM students only).
  VIS_RULES: {
    public: {
      photo: ["public", "cohort", "hidden"], linkedin: ["public", "cohort", "hidden"], email: ["cohort", "hidden"],
      country: ["public", "cohort", "hidden"], field: ["public", "cohort", "hidden"], degree: ["public", "cohort", "hidden"],
      university: ["public", "cohort", "hidden"], track: ["public", "cohort", "hidden"], bio: ["public", "cohort", "hidden"]
    },
    cohort: {
      photo: ["cohort", "hidden"], linkedin: ["cohort", "hidden"], email: ["cohort", "hidden"],
      country: ["cohort", "hidden"], field: ["cohort", "hidden"], degree: ["cohort", "hidden"],
      university: ["cohort", "hidden"], track: ["cohort", "hidden"], bio: ["cohort", "hidden"]
    },
    hidden: {
      photo: ["hidden"], linkedin: ["hidden"], email: ["hidden"],
      country: ["hidden"], field: ["hidden"], degree: ["hidden"], university: ["hidden"], track: ["hidden"], bio: ["hidden"]
    }
  },

  // Form only: how the academic fields are grouped in the list
  FIELD_GROUPS: [
    { label: "Clinical & health", ids: ["medicine", "dentistry", "nursing_midwifery", "pharmacy", "public_health", "health_sciences", "allied_health", "nutrition"] },
    { label: "Science & quantitative", ids: ["biomedical_life_sciences", "quantitative_data", "engineering_technology"] },
    { label: "Economics & management", ids: ["economics", "business_management_finance"] },
    { label: "Social & policy", ids: ["psychology_behaviour", "political_policy_ir", "social_sciences", "law", "philosophy_ethics_humanities"] },
    { label: "Other", ids: ["other"] }
  ]
};
