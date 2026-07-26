"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  FIRCase, 
  firDatabase as initialFirDatabase, 
  districtDatabase, 
  suspectDossiers, 
  aiReportDatabase, 
  AIPresetBrief,
  initialTelemetryLogs,
  initialOfficerLogs,
  TelemetryLogEntry
} from "@/lib/mock";
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
  firCases: FIRCase[];
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
  threatIndex: number;
  activeCells: number;
  patrolRate: number;
  ocrIntegrity: number;

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
  addMessageToActiveConv: (text: string, attachments?: AttachmentFile[], report?: any, sender?: "user" | "orca", customConvId?: string, media?: any) => Promise<string>;
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
  const [activeFirId, setActiveFirId] = useState("FIR/2026/BLR/104");
  const [selectedSuspectId, setSelectedSuspectId] = useState("sus-01");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("BLR_U");
  const [firCases, setFirCases] = useState<FIRCase[]>(initialFirDatabase);
  
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

  // Fluctuating dashboard indicators
  const [threatIndex, setThreatIndex] = useState(9.4);
  const [activeCells, setActiveCells] = useState(1482);
  const [patrolRate, setPatrolRate] = useState(96.2);
  const [ocrIntegrity, setOcrIntegrity] = useState(99.4);

  // Real-time logs
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>(initialTelemetryLogs);
  const [officerLogs, setOfficerLogs] = useState(initialOfficerLogs);

  // Ingestion workflow states
  const [uploadingState, setUploadingState] = useState<"idle" | "checksum" | "ocr" | "entity" | "timeline" | "complete">("idle");
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);

  // Real-time correlation states
  const [criminalClusters, setCriminalClusters] = useState<any[]>([]);
  const [crossCaseAlerts, setCrossCaseAlerts] = useState<any[]>([]);
  const [activeNetworkGraph, setActiveNetworkGraph] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

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
    media?: any
  ) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: `${sender}-${Date.now()}`,
      sender,
      text,
      timestamp,
      attachments,
      report,
      media
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

  const refreshCorrelationData = async () => {
    try {
      // 1. Fetch clusters
      const clustersRes = await fetch("http://localhost:8000/api/v1/correlation/clusters");
      if (clustersRes.ok) {
        const clustersData = await clustersRes.json();
        if (clustersData.success && clustersData.clusters) {
          setCriminalClusters(clustersData.clusters);
        }
      }

      // 2. Fetch alerts
      const alertsRes = await fetch("http://localhost:8000/api/v1/correlation/alerts");
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        if (alertsData.success && alertsData.alerts) {
          setCrossCaseAlerts(alertsData.alerts);
        }
      }

      // 3. Fetch network graph
      const networkRes = await fetch("http://localhost:8000/api/v1/correlation/network");
      if (networkRes.ok) {
        const networkData = await networkRes.json();
        if (networkData.success && networkData.graph) {
          setActiveNetworkGraph(networkData.graph);
        }
      }
    } catch (e) {
      console.warn("FastAPI Correlation engine offline. Working in sandbox model:", e);
    }
  };

  useEffect(() => {
    refreshCorrelationData();
  }, []);

  // Initialize presets
  useEffect(() => {
    runAiQuery("preset-1");
  }, []);

  // Interval loop for fluctuating state telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      const timeStr = new Date().toTimeString().split(' ')[0];
      
      // Fluctuate stats
      setThreatIndex(prev => {
        const delta = (Math.random() * 0.2 - 0.1);
        const next = prev + delta;
        return next > 9.9 ? 9.9 : next < 8.0 ? 8.0 : +(next.toFixed(2));
      });
      setActiveCells(prev => {
        const delta = Math.floor(Math.random() * 10 - 5);
        const next = prev + delta;
        return next > 1550 ? 1550 : next < 1400 ? 1400 : next;
      });
      setPatrolRate(prev => {
        const delta = (Math.random() * 0.4 - 0.2);
        const next = prev + delta;
        return next > 99.9 ? 99.9 : next < 90.0 ? 90.0 : +(next.toFixed(1));
      });
      setOcrIntegrity(prev => {
        const delta = (Math.random() * 0.2 - 0.1);
        const next = prev + delta;
        return next > 100.0 ? 100.0 : next < 95.0 ? 95.0 : +(next.toFixed(1));
      });

      // Randomly append a realistic telemetric ping log matching crime cell operations
      const logTemplates: Omit<TelemetryLogEntry, "timestamp">[] = [
        { source: "BLR-CYB-02", message: "CYBER CELL NODE BLR-CYB-02 REQUESTED FINANCIAL TRACE", type: "info" },
        { source: "HQ-GRID", message: "THREAT INDEX — BENGALURU URBAN ↑ 2.1%", type: "alert" },
        { source: "ISD-BORDER", message: "INTERSTATE TRAFFICKING WATCH ACTIVATED", type: "success" },
        { source: "MYS-CYB", message: "MYSURU SECTOR 04 CORRIDOR: DEVICE ANOMALY TOWER PING REGISTERED", type: "danger" },
        { source: "BLR-SOUTH", message: "DEVICE DETECTED AT COOLDOWN LOCATION NEAR JP NAGAR", type: "info" },
        { source: "HQ-INTELL", message: "ESCALATION: BNS SECTION 111 (ORGANIZED CRIME) FLAG ASSIGNED", type: "danger" }
      ];
      const selectedLog = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      setTelemetryLogs(prev => [
        { timestamp: timeStr, ...selectedLog },
        ...prev.slice(0, 7) // keep last 8 pings
      ]);

      // Randomly append an officer activity log
      const officerTemplates = [
        "INSPECTOR R KUMAR ACCESSED NODE-41",
        "MANGALURU CYBER UNIT FLAGGED NEW DEVICE CLUSTER",
        "FIR-108/2026 ESCALATED TO ORGANIZED CRIME CELL",
        "DSP R. K. SHASTRY ACCESS GRANTED: EXPORTS VAULT NODE 09",
        "CYBER CELL EXECUTED CELLULAR CELL CORRELATION MODEL",
        "ISD COMMAND UNIT SCHEDULED PATROL ROADBLOCK ON NH44 CORRIDOR"
      ];
      const selectedOfficerMsg = officerTemplates[Math.floor(Math.random() * officerTemplates.length)];
      setOfficerLogs(prev => [
        { time: timeStr.substring(0, 5), message: selectedOfficerMsg },
        ...prev.slice(0, 7)
      ]);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const runAiQuery = async (presetId: string | null, customText: string = "") => {
    setAiReportLoading(true);
    setActiveReport(null);

    // If it's a preset and we are using standard mocked database
    if (presetId && aiReportDatabase[presetId]) {
      setTimeout(() => {
        setActiveReport(aiReportDatabase[presetId]);
        setAiReportLoading(false);
      }, 600);
      return;
    }

    const queryText = customText || "CONSOLE_AUDIT_LOG";

    try {
      // Direct REST query to the FastAPI backend
      const response = await fetch("http://localhost:8000/api/v1/intelligence/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: queryText,
          clearanceLevel: "ISD-LEVEL-IV",
          officerName: "Command Officer"
        })
      });

      if (!response.ok) {
        throw new Error(`FastAPI Intelligence query returned status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.intelReport) {
        setActiveReport({
          title: result.intelReport.title,
          classification: result.intelReport.classification,
          content: result.intelReport.content
        });
        setAiReportLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Backend intelligence query offline, executing sandbox response:", err);
    }

    // Fallback sandbox response if backend is offline or errors
    setTimeout(() => {
      setActiveReport({
        title: `EXEC DYNAMIC INQUIRY: ${queryText.toUpperCase()}`,
        classification: "SECRET // CONFIDENTIAL // INTERNAL SECURITY DIVISION",
        content: `<h4>1. Captured Custom Parameter Inquiry</h4>
<p style="font-style:italic; color:#475569; font-family:var(--font-mono); font-size:11.5px;">"${queryText}"</p>
<h4>2. Relational Correlation Results</h4>
<p>The ISD-Rakshak criminal parser audited unified district databases matching the semantic constraints of your query. Tower pings and escrow logs show high association coefficients (0.91) with <strong>Vikram Hegde (Cyber Operator)</strong>.</p>
<div style="background-color:#f8fafc; border:1px solid #cbd5e1; border-left:3.5px solid #1e3a8a; padding:8px 12px; margin:12px 0; font-family:var(--font-mono); font-size:11px;">
  <strong>Forensic Citation:</strong> Automated correlation generated in 1,220ms. Mapped against active case file FIR/2026/BLR/104 nodes.
</div>
<h4>3. Actionable Directives</h4>
<ul style="list-style-type:square; padding-left:16px; margin-bottom:12px;">
  <li style="margin-bottom:6px;">Cross-reference cell signals near the whitefield tower corridors at 09:30 IST.</li>
  <li style="margin-bottom:6px;">Coordinate localized physical audits at Pinnacle Trades premises in Malleshwaram.</li>
</ul>`
      });
      setAiReportLoading(false);
    }, 900);
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
      // Step 3: FIR Ingestion Vault (Ready state)
      setActiveTab("fir");
      setUploadingState("idle");
    } else if (nextStep === 4) {
      // Step 4: AI Extraction / Scanning OCR
      setActiveTab("fir");
      ingestNewCase("FIR_108_2026_Ingestion.pdf");
    } else if (nextStep === 5) {
      // Step 5: Timeline Reconstruction (still inside FIR tab)
      setActiveTab("fir");
    } else if (nextStep === 6) {
      // Step 6: Criminal Network Mapping
      setActiveTab("networks");
      setSelectedSuspectId("sus-01");
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
    setActiveFirId("FIR/2026/BLR/104");
    setSelectedSuspectId("sus-01");
    setSelectedDistrictCode("BLR_U");
    setUploadingState("idle");
    setUploadLogs([]);
  };

  const ingestNewCase = async (fileOrName: File | string): Promise<void> => {
    const fileName = typeof fileOrName === "string" ? fileOrName : fileOrName.name;
    setUploadingState("checksum");
    setUploadLogs(["Initiating secure evidence vault ingestion..."]);

    const appendLog = (msg: string, delay: number): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          setUploadLogs(prev => [...prev, msg]);
          resolve();
        }, delay);
      });
    };

    // If a real file was uploaded, trigger the FastAPI real pipeline
    if (fileOrName instanceof File) {
      try {
        await appendLog(`Ingesting secure packet: ${fileName} (${(fileOrName.size / 1024).toFixed(1)} KB)`, 200);
        await appendLog("Generating SHA-256 validation checksum...", 300);
        setUploadingState("ocr");
        await appendLog("Activating PyMuPDF parsing streams & Tesseract OCR sweeps...", 300);
        
        const formData = new FormData();
        formData.append("file", fileOrName);
        
        setUploadingState("entity");
        await appendLog("Extracting Named Entities & Legal Mappings via spaCy...", 300);
        
        setUploadingState("timeline");
        await appendLog("Synthesizing NVIDIA NIM LLM Intelligence report timeline...", 300);

        const response = await fetch("http://localhost:8000/api/v1/fir/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`FastAPI Ingest Service returned status ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.case) {
          setUploadingState("complete");
          await appendLog(`Ingested successfully in ${result.processingTimeMs}ms! Sealed secure cryptology.`, 200);
          
          // Add the parsed backend case to local cases array
          setFirCases(prev => [result.case, ...prev]);
          setActiveFirId(result.case.id);
          
          // Print detailed OCR logs to console log feed
          if (result.ocrLogs) {
            for (const logMsg of result.ocrLogs) {
              await appendLog(`[OCR ENGINE] ${logMsg}`, 100);
            }
          }
          
          setTimeout(() => {
            setUploadingState("idle");
            setUploadLogs([]);
          }, 3000);
          return;
        } else {
          throw new Error("Invalid response format received from FastAPI Ingest Server.");
        }
      } catch (error: any) {
        console.warn("FastAPI Ingestion failed, switching gracefully to local sandbox mode:", error);
        await appendLog(`[INGEST ERROR] backend offline or network timeout: ${error.message}`, 400);
        await appendLog("[SYSTEM ADVICE] Activating offline high-fidelity simulation model...", 400);
      }
    }

    // High-Fidelity Mock Ingestion Fallback
    await appendLog("SHA-256 packet hash generated: c2b8f9e29a8a34b22c8e9f...", 400);
    setUploadingState("ocr");
    await appendLog("OCR text recognition sweep: Quality Index 99.4% secure...", 400);
    setUploadingState("entity");
    await appendLog("Entity matcher identified suspects: Vikram Hegde (91%), Gurudev Patil (86%)...", 400);
    setUploadingState("timeline");
    await appendLog("Modus Operandi mapped to BNS Section 308 (Extortion) & 318 (Cheating)...", 400);
    setUploadingState("complete");
    await appendLog("Ingested case successfully. Chain-of-custody seal approved.", 300);

    return new Promise((resolve) => {
      setTimeout(() => {
        const customId = `FIR/2026/BLR/${Math.floor(Math.random() * 800) + 200}`;
        const newCase: FIRCase = {
          id: customId,
          title: `Parsed Case: ${fileName.replace(/\.[^/.]+$/, "")} dossier`,
          district: "Bengaluru Urban",
          datetime: new Date().toISOString().replace('T', ' ').substring(0, 16),
          severity: "high",
          category: "Extracted Incident",
          summary: `Parsed crime dossier from document '${fileName}'. Initial semantic models indicate physical extortion mapping to electronic transit corridors. The suspect acted under organized organized dispatch parameters with a local financial sponsor.`,
          modusOperandi: "Synthetically audited transit fraud loops",
          sha256Hash: "c2b8f9e29a8a34b22c8e9f1a0e9d9ef504d6a8f89e24b31a29ff0182bc8e92f",
          forensicMetadata: {
            ingestTerminal: "ISD-BLR-CYB-TERM-02",
            ocrConfidence: "99.4%",
            entityMatchWeight: "91.8%",
            validationStatus: "VERIFIED // ENCRYPTED"
          },
          chainOfCustody: [
            { timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16), action: "Scanned digital packet ingested", operator: "Command Officer", hash: "c2b8f9e..." }
          ],
          legalSections: [
            { code: "BNS Section 308", title: "Extortion Threat", desc: "Fear of injury used to extract property assets." },
            { code: "BNS Section 318", title: "Cheating / Impersonation", desc: "Forgeries deployed to hijack commercial cargo." }
          ],
          suspects: [
            { id: "sus-01", name: "Vikram 'Ghost' Hegde", age: 34, role: "Likely Cyber Operator Liaison", record: "Identified correlation 91%", confidence: "91%", photo: "VH", watchlistStatus: "CRITICAL", aliases: "Ghost", associates: "Gurudev Patil" },
            { id: "sus-04", name: "Gurudev 'Dada' Patil", age: 49, role: "Suspected Financial Sponsor", record: "High network connection weight", confidence: "86%", photo: "GP", watchlistStatus: "CRITICAL", aliases: "Dada Patil", associates: "Vikram Hegde" }
          ],
          timeline: [
            { time: "09:00", desc: "System incident record created from external upload.", severe: false },
            { time: "09:40", desc: "AI engine linked suspect pattern to Vikram Hegde cyber node with 91% confidence.", severe: true }
          ],
          confidenceScore: 88
        };

        setFirCases(prev => [newCase, ...prev]);
        setActiveFirId(customId);
        setUploadingState("idle");
        setUploadLogs([]);
        resolve();
      }, 500);
    });
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
      setSelectedDistrictCode,
      firCases,
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
      threatIndex,
      activeCells,
      patrolRate,
      ocrIntegrity,

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
