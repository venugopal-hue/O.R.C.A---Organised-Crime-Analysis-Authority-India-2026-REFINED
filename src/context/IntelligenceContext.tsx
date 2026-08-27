"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  FirCaseListItem,
  FirCaseDetail,
  AIPresetBrief,
  TelemetryLogEntry,
} from "@/lib/intelligenceTypes";
import { useAuth } from "./AuthContext";
import { 
  AttachmentFile, 
  ChatMessage, 
  ChatConversation, 
  dbSaveConversation, 
  dbDeleteConversation, 
  dbLoadConversations 
} from "@/lib/chatService";

interface IngestLog {
  time: string;
  msg: string;
  type: "info" | "success" | "alert";
}

interface IntelligenceContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeFirId: string;
  setActiveFirId: (id: string) => void;
  selectedSuspectId: string;
  setSelectedSuspectId: (id: string) => void;
  selectedDistrictCode: string;
  setSelectedDistrictCode: (code: string) => void;
  /**
   * Identifiers carried from a case or exhibit into the task assignment form.
   *
   * An officer raising a forensic follow-up on an exhibit should not retype its
   * number — retyping is where the wrong exhibit gets attached to the work.
   */
  taskPreset: { caseMasterId: number | null; evidenceId: number | null } | null;
  setTaskPreset: (p: { caseMasterId: number | null; evidenceId: number | null } | null) => void;
  firCases: FirCaseListItem[];
  /** The open case, loaded on demand — the list carries only what the
   *  sidebar shows, not the people and sections behind it. */
  activeCase: FirCaseDetail | null;
  activeCaseLoading: boolean;
  aiReportLoading: boolean;
  activeReport: AIPresetBrief | null;
  runAiQuery: (presetId: string | null, customText?: string) => void;
  ingestNewCase: (fileOrName: File | string) => Promise<void>;
  
  // Presentation Demo HUD state
  demoStep: number;
  setDemoStep: (step: number) => void;
  advanceDemo: () => void;
  resetDemo: () => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;

  // Real-time fluctuating state logs
  telemetryLogs: TelemetryLogEntry[];
  officerLogs: { time: string; message: string }[];
  
  // Real-time upload processing states
  uploadingState: "idle" | "checksum" | "ocr" | "entity" | "timeline" | "complete";
  uploadLogs: string[];

  // Real-time fluctuating state parameters for Command dashboard
  /** Real counts from CaseMaster — see the note where these are loaded. */
  heinousCount: number;
  underInvestigationCount: number;
  chargeSheetedCount: number;
  casesRegistered: number;
  /** False until the counts have actually been read, so 0 is not mistaken for "none". */
  statsLoaded: boolean;
  casesLoaded: boolean;

  // Real-time statewide correlation states
  criminalClusters: any[];
  crossCaseAlerts: any[];
  activeNetworkGraph: { nodes: any[]; links: any[] };
  refreshCorrelationData: () => Promise<void>;

  // Chat History & Sync states
  conversations: ChatConversation[];
  activeConvId: string | null;
  setActiveConvId: (id: string | null) => void;
  createConversation: (title?: string) => string;
  addMessageToActiveConv: (text: string, attachments?: AttachmentFile[], report?: any, sender?: "user" | "orca", customConvId?: string, media?: any, evidence?: ChatMessage["evidence"]) => Promise<string>;
  deleteConv: (id: string) => Promise<void>;
  renameConv: (id: string, title: string) => Promise<void>;
  pinConv: (id: string, pinned: boolean) => Promise<void>;
  isGeneratingChat: boolean;
  setIsGeneratingChat: (val: boolean) => void;
  pendingChatQuery: string | null;
  setPendingChatQuery: (q: string | null) => void;
}

const IntelligenceContext = createContext<IntelligenceContextType | undefined>(undefined);

export const IntelligenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login, logout } = useAuth();
  const isLoggedIn = !!user;
  const setIsLoggedIn = (val: boolean) => {}; // no-op backward compatibility wrapper

  const [activeTab, setActiveTab] = useState("reports");
  const [pendingChatQuery, setPendingChatQuery] = useState<string | null>(null);
  /**
   * No seeded ids.
   *
   * `activeFirId` was "FIR/2026/BLR/104" and `selectedSuspectId` was "sus-01" —
   * rows from the fabricated database that used to back these screens. Both
   * pointed at records that do not exist, so the console opened claiming to
   * show a case nobody had registered.
   */
  const [activeFirId, setActiveFirId] = useState("");
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  // District ID as a string, or "" for nothing selected. It used to default
  // to "BLR_U" — a hardcoded code from the six-district map — which both
  // pre-selected Bengaluru on every load and could not name the other 25
  // districts at all.
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");

  const [taskPreset, setTaskPreset] = useState<{ caseMasterId: number | null; evidenceId: number | null } | null>(null);
  /**
   * Starts EMPTY and is filled from Catalyst.
   *
   * This used to be seeded with the invented FIR database, and real cases were
   * prepended to it — so genuine and fabricated casework sat in one list with
   * nothing distinguishing them.
   */
  const [firCases, setFirCases] = useState<FirCaseListItem[]>([]);
  const [activeCase, setActiveCase] = useState<FirCaseDetail | null>(null);
  const [activeCaseLoading, setActiveCaseLoading] = useState(false);
  const [casesLoaded, setCasesLoaded] = useState(false);
  
  // AI report states
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<AIPresetBrief | null>(null);

  // Presentation HUD state & login status
  const [demoStep, setDemoStep] = useState(1);

  // Restore session step state
  useEffect(() => {
    if (isLoggedIn) {
      setDemoStep(prev => prev === 1 ? 2 : prev);
    } else {
      setDemoStep(1);
    }
  }, [isLoggedIn]);

  // Read and consume pending chatbot queries on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const query = sessionStorage.getItem("orca_pending_query") || localStorage.getItem("orca_pending_query");
      if (query) {
        setPendingChatQuery(query);
        setActiveTab("chatbot");
        sessionStorage.removeItem("orca_pending_query");
        localStorage.removeItem("orca_pending_query");
      }
    }
  }, []);

  /**
   * Command Overview figures — counted from CaseMaster, not invented.
   *
   * These four were 9.4 / 1,482 / 96.2% / 99.4%, drifting by a random delta
   * every six seconds so they LOOKED live. They were the first thing an officer
   * saw on signing in. They now hold real counts from /api/analytics/crime, and
   * `statsLoaded` lets the cards say "no cases registered" rather than show a
   * confident zero that might mean "failed to load".
   */
  const [heinousCount, setHeinousCount] = useState(0);
  const [underInvestigationCount, setUnderInvestigationCount] = useState(0);
  const [chargeSheetedCount, setChargeSheetedCount] = useState(0);
  const [casesRegistered, setCasesRegistered] = useState(0);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // The accused-persons data path that backed the old dossier and co-accused
  // graph was removed when the Relation Graph was rebuilt to read records
  // directly (see src/lib/networkGraph.ts).

  /**
   * Real-time logs — both start empty.
   *
   * They were seeded with invented pings ("THREAT INDEX — BENGALURU URBAN
   * ↑ 2.1%") and topped up every six seconds from a list of templates, naming
   * officers and cases that do not exist. `officerLogs` is now the signed-in
   * officer's own recorded activity; `telemetryLogs` has no state-wide feed
   * behind it, so it stays empty until one exists.
   */
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([]);
  const [officerLogs, setOfficerLogs] = useState<{ time: string; message: string }[]>([]);

  // Ingestion workflow states
  const [uploadingState, setUploadingState] = useState<"idle" | "checksum" | "ocr" | "entity" | "timeline" | "complete">("idle");
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);

  // Real-time correlation states

  // Chat History & Sync State Hooks
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);

  useEffect(() => {
    const loadChats = async () => {
      if (user?.uid) {
        const list = await dbLoadConversations(user.uid);
        setConversations(list);
        if (list.length > 0) {
          const active = list.find(c => c.pinned) || list[0];
          setActiveConvId(active.id);
        } else {
          // Create an initial empty chat conversation
          const newId = `conv-${Date.now()}`;
          const initialConv: ChatConversation = {
            id: newId,
            title: "New Conversation",
            createdAt: new Date().toISOString(),
            pinned: false,
            messages: []
          };
          setConversations([initialConv]);
          setActiveConvId(newId);
          await dbSaveConversation(user.uid, initialConv);
        }
      } else {
        setConversations([]);
        setActiveConvId(null);
      }
    };
    loadChats();
  }, [user]);

  const createConversation = (title?: string) => {
    const newId = `conv-${Date.now()}`;
    const newConv: ChatConversation = {
      id: newId,
      title: title || "New Conversation",
      createdAt: new Date().toISOString(),
      pinned: false,
      messages: [],
      moduleContext: activeTab
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConvId(newId);
    if (user?.uid) {
      dbSaveConversation(user.uid, newConv);
    }
    return newId;
  };

  const addMessageToActiveConv = async (
    text: string, 
    attachments?: AttachmentFile[], 
    report?: any,
    sender: "user" | "orca" = "user",
    customConvId?: string,
    media?: any,
    evidence?: ChatMessage["evidence"]
  ) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: `${sender}-${Date.now()}`,
      sender,
      text,
      timestamp,
      attachments,
      report,
      media,
      evidence
    };

    let targetId = customConvId || activeConvId;
    if (!targetId) {
      targetId = createConversation();
    }

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === targetId) {
          let newTitle = c.title;
          if (c.title === "New Conversation" && sender === "user" && text.trim()) {
            newTitle = text.split(" ").slice(0, 5).join(" ") + (text.split(" ").length > 5 ? "..." : "");
          }
          const updatedConv = {
            ...c,
            title: newTitle,
            messages: [...c.messages, newMsg],
            moduleContext: activeTab
          };
          if (user?.uid) {
            dbSaveConversation(user.uid, updatedConv);
          }
          return updatedConv;
        }
        return c;
      });
      return updated;
    });

    return targetId;
  };

  const deleteConv = async (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeConvId === id) {
        if (filtered.length > 0) {
          setActiveConvId(filtered[0].id);
        } else {
          setActiveConvId(null);
        }
      }
      return filtered;
    });
    if (user?.uid) {
      await dbDeleteConversation(user.uid, id);
    }
  };

  const renameConv = async (id: string, title: string) => {
    setConversations(prev => {
      return prev.map(c => {
        if (c.id === id) {
          const updated = { ...c, title };
          if (user?.uid) {
            dbSaveConversation(user.uid, updated);
          }
          return updated;
        }
        return c;
      });
    });
  };

  const pinConv = async (id: string, pinned: boolean) => {
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === id) {
          const u = { ...c, pinned };
          if (user?.uid) {
            dbSaveConversation(user.uid, u);
          }
          return u;
        }
        return c;
      });
      return [...updated].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
  };

  /**
   * Load the open case in full.
   *
   * The list endpoint returns one line per case; the workspace needs the
   * accused, the victims, the complainants and the charged sections, which are
   * four more tables. Fetching them per selection keeps the sidebar cheap.
   *
   * A sequence number guards against a slow response for a case the officer
   * has already navigated away from overwriting a newer one.
   */
  const caseSeq = React.useRef(0);
  useEffect(() => {
    if (!isLoggedIn || !activeFirId) {
      setActiveCase(null);
      return;
    }
    const seq = ++caseSeq.current;
    setActiveCaseLoading(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/fir/cases?view=console&id=${encodeURIComponent(activeFirId)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (seq !== caseSeq.current) return;
        // On failure the workspace shows nothing rather than a stale case.
        setActiveCase(data?.success && data.case ? data.case : null);
      } catch {
        if (seq === caseSeq.current) setActiveCase(null);
      } finally {
        if (seq === caseSeq.current) setActiveCaseLoading(false);
      }
    })();
  }, [isLoggedIn, activeFirId]);

  /**
   * The correlation engine is gone, not stubbed.
   *
   * `refreshCorrelationData` fired three requests at
   * http://localhost:8000/api/v1/correlation/* on every mount — a FastAPI
   * service that is not part of this project — caught the failures, and logged
   * "working in sandbox model". Its results were never used either way: the
   * context has always provided `criminalClusters`, `crossCaseAlerts` and
   * `activeNetworkGraph` as empty literals, and exposed the refresh itself as
   * an empty async function. It was three guaranteed-failing network calls per
   * page load, doing nothing.
   */

  /**
   * Load the real console data: registered cases, the crime counts behind the
   * Command Overview cards, and the officer's own activity trail.
   *
   * This replaces a six-second `setInterval` that invented all three. A failure
   * here leaves the empty state in place — it must never fall back to made-up
   * figures, which is exactly what made the old screens untrustworthy.
   */
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/fir/cases?view=console", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && data?.success && Array.isArray(data.cases)) {
          setFirCases(data.cases);
          // `activeFirId` holds a CaseMasterID, which is what the detail
          // endpoint takes — not the printed CrimeNo shown on the card.
          if (data.cases.length) setActiveFirId((prev) => prev || data.cases[0].caseMasterId);
        }
      } catch {
        /* leave the list empty — see the note on firCases */
      } finally {
        if (!cancelled) setCasesLoaded(true);
      }

      try {
        const res = await fetch("/api/analytics/crime", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && data?.success && data.totals) {
          setHeinousCount(Number(data.totals.heinous) || 0);
          setUnderInvestigationCount(Number(data.totals.underInvestigation) || 0);
          setChargeSheetedCount(Number(data.totals.chargeSheeted) || 0);
          setCasesRegistered(Number(data.casesInSystem) || 0);
          setStatsLoaded(true);
        }
      } catch {
        /* cards stay in their "not loaded" state */
      }


      try {
        const res = await fetch("/api/officer/telemetry", { credentials: "include" });
        const data = await res.json();
        if (!cancelled && data?.success) {
          const entries = [
            ...(data.downloads || []).map((d: any) => ({ at: d.occurredAt || d.OccurredAt, message: `${d.activityType || "ACTIVITY"} — ${d.detail || d.Detail || ""}`.trim() })),
            ...(data.aiQueries || []).map((q: any) => ({ at: q.occurredAt || q.OccurredAt, message: `AI QUERY — ${q.detail || q.Detail || ""}`.trim() })),
          ]
            .filter((e) => e.at)
            .sort((a, b) => String(b.at).localeCompare(String(a.at)))
            .slice(0, 8)
            .map((e) => ({ time: String(e.at).slice(11, 16), message: e.message.toUpperCase() }));
          setOfficerLogs(entries);
        }
      } catch {
        /* empty trail is the honest answer */
      }
    })();

    return () => { cancelled = true; };
  }, [isLoggedIn]);

  /**
   * Run an intelligence query.
   *
   * WHAT THIS USED TO DO
   *
   * Three things, none of them real. A preset id returned a canned brief from
   * the fabricated `aiReportDatabase`. Anything else was POSTed to
   * `http://localhost:8000` — a FastAPI service that is not part of this
   * project and was never running — and when that failed, which was always, it
   * invented a report: a named suspect, a correlation coefficient of 0.91, a
   * premises address, and a citation to case FIR/2026/BLR/104. It was rendered
   * on an official letterhead with a classification banner.
   *
   * It now calls the real chat route. If that fails the report is left null and
   * the screen says so, because a plausible answer is worse than no answer when
   * an officer may act on it.
   */
  const runAiQuery = async (presetId: string | null, customText: string = "") => {
    const queryText = (customText || "").trim();
    if (!queryText) {
      setActiveReport(null);
      setAiReportLoading(false);
      return;
    }

    setAiReportLoading(true);
    setActiveReport(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: queryText }),
      });
      const result = await response.json();
      const content = result?.reply || result?.message || result?.content;
      if (response.ok && content) {
        setActiveReport({
          title: queryText.toUpperCase(),
          classification: "GENERATED BY O.R.C.A AI — VERIFY BEFORE ACTING",
          content: String(content),
        });
      } else {
        setActiveReport(null);
      }
    } catch {
      setActiveReport(null);
    } finally {
      setAiReportLoading(false);
    }
  };

  // Coordinated presentation workflow transitions (8 Steps)
  const advanceDemo = () => {
    const nextStep = demoStep + 1;
    setDemoStep(nextStep);

    if (nextStep === 2) {
      // Step 2: Threat Overview - Trigger background sign-in for pilot review if not logged in
      // Step 2: Threat Overview
      setActiveTab("dashboard");
    } else if (nextStep === 3) {
      // Step 3-5 used to walk the Forensic Evidence Copilot vault, which has
      // been removed. They now land on Case Registration — the living path for
      // getting an FIR into the ledger — so the demo has no dead stops.
      setActiveTab("case-registration");
    } else if (nextStep === 4) {
      setActiveTab("case-registration");
    } else if (nextStep === 5) {
      setActiveTab("analytics");
    } else if (nextStep === 6) {
      // Step 6: Threat Mapping
      setActiveTab("networks");
      setSelectedSuspectId("");
    } else if (nextStep === 7) {
      // Step 7: District Surveillance
      setActiveTab("heatmap");
      setSelectedDistrictCode("MYS"); // active alert near Mysuru corridor
    } else if (nextStep === 8) {
      // Step 8: Court Exhibit Export
      setActiveTab("copilot");
      runAiQuery("preset-3"); // Auto load court charge-sheet
    }
  };

  const resetDemo = () => {
    setDemoStep(1);
    logout().catch(() => {}); // Securely sign out from Firebase
    setActiveTab("dashboard");
    // Cleared, not re-seeded: these ids named fabricated records.
    setActiveFirId(firCases[0]?.caseMasterId || "");
    setSelectedSuspectId("");
    setSelectedDistrictCode("BLR_U");
    setUploadingState("idle");
    setUploadLogs([]);
  };

  /**
   * Accept a dropped FIR document.
   *
   * WHAT THIS USED TO DO, AND WHY IT HAD TO GO
   *
   * Dropping ANY file — any name, any content — fabricated a complete case
   * file and inserted it into the case list as though it had been registered:
   * a plausible FIR number (`FIR/2026/BLR/` plus a random three digits), two
   * named suspects with ages, aliases and "91% confidence", two BNS sections,
   * a hard-coded SHA-256, a forensic metadata block reading
   * "VERIFIED // ENCRYPTED", and a chain-of-custody entry signed by the
   * officer who happened to be logged in.
   *
   * It reached that fallback every time, because the pipeline it tried first
   * was a FastAPI service on localhost:8000 that is not part of this project.
   * The progress log narrated OCR sweeps and entity matching that never ran.
   *
   * There is no document-extraction service. Rather than simulate one, this
   * now says so and points at Case Registration — the real module, which
   * writes a real row to CaseMaster.
   */
  const ingestNewCase = async (fileOrName: File | string): Promise<void> => {
    const fileName = fileOrName instanceof File ? fileOrName.name : String(fileOrName);

    setUploadingState("checksum");
    setUploadLogs([
      `Received: ${fileName}`,
      "Automatic extraction is not available on this deployment.",
      "No case has been created from this document.",
      "Register the case in Case Registration to add it to the ledger.",
    ]);

    // Held briefly so the message is readable, then the panel returns to idle.
    await new Promise((r) => setTimeout(r, 2500));
    setUploadingState("idle");
  };

  return (
    <IntelligenceContext.Provider value={{
      activeTab,
      setActiveTab,
      activeFirId,
      setActiveFirId,
      selectedSuspectId,
      setSelectedSuspectId,
      selectedDistrictCode,
      taskPreset,
      setTaskPreset,
      setSelectedDistrictCode,
      firCases,
      activeCase,
      activeCaseLoading,
      aiReportLoading,
      activeReport,
      runAiQuery,
      ingestNewCase,
      
      // presentation states
      demoStep,
      setDemoStep,
      advanceDemo,
      resetDemo,
      isLoggedIn,
      setIsLoggedIn,

      // dynamic log feeds
      telemetryLogs,
      officerLogs,

      // dynamic uploads
      uploadingState,
      uploadLogs,

      // fluctuating metrics
      heinousCount,
      underInvestigationCount,
      chargeSheetedCount,
      casesRegistered,
      statsLoaded,
      casesLoaded,

      // statewide correlation stubs (interface compatibility)
      criminalClusters: [],
      crossCaseAlerts: [],
      activeNetworkGraph: { nodes: [], links: [] },
      refreshCorrelationData: async () => {},

      // Chat History & Sync states
      conversations,
      activeConvId,
      setActiveConvId,
      createConversation,
      addMessageToActiveConv,
      deleteConv,
      renameConv,
      pinConv,
      isGeneratingChat,
      setIsGeneratingChat,
      pendingChatQuery,
      setPendingChatQuery
    }}>
      {children}
    </IntelligenceContext.Provider>
  );
};

export const useIntelligence = () => {
  const context = useContext(IntelligenceContext);
  if (context === undefined) {
    throw new Error("useIntelligence must be used within an IntelligenceProvider");
  }
  return context;
};
