"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  X, 
  Minus, 
  Send, 
  Mic, 
  Volume2, 
  VolumeX, 
  Paperclip, 
  Sparkles, 
  FileText, 
  ArrowUpRight,
  Loader2,
  History,
  Trash2,
  Printer,
  Pin,
  Edit2,
  Maximize2
} from "lucide-react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useAuth } from "@/context/AuthContext";
import { AttachmentFile, ChatMessage, ChatConversation } from "@/lib/chatService";

const getPageSuggestions = (tab: string) => {
  switch (tab) {
    case "dashboard":
      return [
        { label: "Analyze dashboard", text: "Please analyze the active threat index of 9.4 and summarize the system logs." },
        { label: "Check officer status", text: "Are there any critical warnings or anomalies detected in the officer activity logs?" },
        { label: "Explain cells", text: "What does the active cells count of 1482 imply for district command centers?" }
      ];
    case "analytics":
      return [
        { label: "Analyze threat graph", text: "Explain the threat scoring trend and crime distribution graph on this page." },
        { label: "Hotspot analysis", text: "What regions are projected to increase in crime threat score next month?" },
        { label: "Detect anomalies", text: "Are there any statistical anomalies in the crime analytics graphs?" }
      ];
    case "fir":
      return [
        { label: "Summarize case", text: "Provide a detailed intelligence briefing on the active FIR case dossier." },
        { label: "List case timeline", text: "Analyze the active FIR timeline and highlight any severe events." },
        { label: "Identify suspects", text: "List the suspect associates and connection weights linked to this FIR." }
      ];
    case "heatmap":
      return [
        { label: "Explain district scores", text: "Explain the statewide threat scores and how district risk rankings are compiled." },
        { label: "Identify hotspots", text: "Which high-threat districts are currently flagged on the map?" }
      ];
    case "networks":
      return [
        { label: "Analyze Vikram Hegde network", text: "Outline criminal network syndicates linked to target Vikram Hegde." },
        { label: "Explain nodes", text: "What do the different color weights on the network graph indicate?" }
      ];
    case "reports":
      return [
        { label: "Audit draft report", text: "Audit the official bulletins draft status and recommend improvements." },
        { label: "Rewrite bulletin", text: "Make this intelligence briefing bullet list professional and concise." }
      ];
    case "verification-document":
      return [
        { label: "Check verification status", text: "Explain the barcode validation integrity and verification status of the uploaded document." },
        { label: "Verify document hash", text: "Check document SHA-256 hash match weight against the central state vault." }
      ];
    case "settings":
      return [
        { label: "Verify security level", text: "Explain the security audit level and credentials requirement for settings modifications." }
      ];
    default:
      return [
        { label: "Help with active page", text: "How does this module assist the police command center?" }
      ];
  }
};

const getHumanReadableTab = (tab: string) => {
  switch (tab) {
    case "dashboard": return "Dashboard";
    case "analytics": return "Analytics";
    case "fir": return "FIR Vault";
    case "heatmap": return "Heatmap";
    case "networks": return "Criminal Networks";
    case "copilot": return "Copilot";
    case "reports": return "Reports";
    case "verification-document": return "Verification";
    case "settings": return "Settings";
    default: return tab;
  }
};

const detectTextLanguage = (text: string): string => {
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return "kn-IN";
  }
  if (/[\u0900-\u097F]/.test(text)) {
    return "hi-IN";
  }
  return "en-US";
};

export const MiniAIAssistant: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeFirId,
    conversations,
    activeConvId,
    setActiveConvId,
    addMessageToActiveConv,
    createConversation,
    deleteConv,
    renameConv,
    pinConv,
    isGeneratingChat,
    setIsGeneratingChat
  } = useIntelligence();

  const { officerProfile } = useAuth();

  // Dialog & UI state
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentFile[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);
  
  // Drawer States
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Voice States
  const [isListening, setIsListening] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState("en-US");
  const [ttsEnabled, setTtsEnabled] = useState(false);

  // Dragging States
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const messages = activeConv ? activeConv.messages : [];
  const suggestions = getPageSuggestions(activeTab);

  // Automatically update suggestion badge count on page navigation
  useEffect(() => {
    if (activeTab !== "chatbot") {
      const activeSugg = getPageSuggestions(activeTab);
      setBadgeCount(activeSugg.length);
    }
  }, [activeTab]);

  // Keyboard shortcut Ctrl + Shift + O to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isGeneratingChat, isOpen]);

  // Load and cache voices for Web Speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      };
    }
  }, []);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.posX + dx,
        y: dragRef.current.posY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Speech-to-Text Recognition
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setInputText(prev => prev + (prev ? " " : "") + speechToText);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        console.warn("Speech recognition: no speech detected (silent timeout).");
      } else {
        console.error("Speech recognition error:", event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  const toggleMicrophone = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      startListening();
    }
  };

  // Text-to-Speech Narration
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_\-⚠️]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Dynamically detect language from the actual text block characters
    const detectedLang = detectTextLanguage(cleanText);
    utterance.lang = detectedLang;
    
    const voices = window.speechSynthesis.getVoices();
    let voice = voices.find(v => v.lang.toLowerCase() === detectedLang.toLowerCase().replace("_", "-"));
    if (!voice) {
      const langPrefix = detectedLang.split("-")[0].toLowerCase();
      voice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    }
    if (voice) {
      utterance.voice = voice;
    }
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleToggleTts = () => {
    const nextVal = !ttsEnabled;
    setTtsEnabled(nextVal);
    if (nextVal) {
      const lastOrcaMsg = [...messages].reverse().find(m => m.sender === "orca");
      if (lastOrcaMsg) {
        speakText(lastOrcaMsg.text);
      }
    } else {
      stopSpeaking();
    }
  };

  // Submit Chat Message
  const handleSubmit = async (customPrompt?: string) => {
    const queryText = customPrompt || inputText;
    if (!queryText.trim() && pendingAttachments.length === 0) return;

    const userPrompt = queryText.trim();
    
    // Append to conversation
    const targetConvId = await addMessageToActiveConv(userPrompt, pendingAttachments, undefined, "user");
    
    setInputText("");
    setPendingAttachments([]);
    setIsGeneratingChat(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: userPrompt, 
          history: messages,
          moduleContext: getHumanReadableTab(activeTab),
          activeCaseId: activeFirId
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to contact Groq API server");
      }

      let responseText = data.text || "ORCA AI Core processed your directive.";
      
      await addMessageToActiveConv(responseText, undefined, undefined, "orca", targetConvId);

      if (ttsEnabled) {
        speakText(responseText);
      }
    } catch (err: any) {
      console.error("[Groq Chat Error]:", err);
      const errorMsg = `⚠️ **API Error**: Unable to reach O.R.C.A AI Core (${err.message || "Network Error"}).`;
      await addMessageToActiveConv(errorMsg, undefined, undefined, "orca", targetConvId);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type || "document"
      }));
      setPendingAttachments(prev => [...prev, ...filesArray]);
    }
  };

  const handleContinueInChatbot = () => {
    setIsOpen(false);
    setActiveTab("chatbot");
  };

  // Export PDF trigger
  const handleExportPdf = () => {
    if (!activeConv) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented exporting PDF. Please allow popups for this site.");
      return;
    }

    const officerName = officerProfile?.name || "Command Officer";
    const dateStr = new Date().toLocaleString() + " IST";
    
    const messagesHtml = activeConv.messages.map(msg => {
      const senderLabel = msg.sender === "user" ? "Investigating Officer" : "O.R.C.A AI Core";
      
      let formattedText = msg.text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br/>");
      
      if (formattedText.includes("```")) {
        formattedText = formattedText.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code class='language-$1'>$2</code></pre>");
      }

      return `
        <div class="message-card ${msg.sender}">
          <div class="message-meta">${senderLabel} &bull; ${msg.timestamp}</div>
          <div class="message-body">${formattedText}</div>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>ORCA_Briefing_${activeConv.title.replace(/\s+/g, "_")}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
            
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              background: white;
              padding: 40px;
              margin: 0;
            }

            .report-container {
              position: relative;
              min-height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }

            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 5rem;
              font-weight: 900;
              color: rgba(0, 31, 63, 0.25);
              z-index: 0;
              pointer-events: none;
              text-align: center;
            }

            .watermark img {
              width: 180px;
              opacity: 0.25;
              margin-bottom: 12px;
            }

            header {
              border-bottom: 2px solid #001f3f;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              z-index: 10;
              position: relative;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: 15px;
            }

            .brand img {
              width: 50px;
              height: 50px;
              object-fit: contain;
            }

            .brand-details {
              display: flex;
              flex-direction: column;
            }

            .brand-title {
              font-weight: 800;
              font-size: 11px;
              color: #0a192f;
              letter-spacing: 0.05em;
              text-transform: uppercase;
              font-family: 'Inter', sans-serif;
              line-height: 1.1;
            }

            .brand-sub {
              font-size: 8.5px;
              color: #64748b;
              font-family: 'JetBrains Mono', monospace;
              margin-top: 3px;
              letter-spacing: 0.02em;
            }

            .header-meta {
              text-align: right;
              font-family: 'JetBrains Mono', monospace;
              font-size: 10.5px;
              color: #475569;
              line-height: 1.5;
            }

            .doc-title-section {
              margin-bottom: 30px;
              z-index: 10;
              position: relative;
            }

            .doc-title {
              font-size: 20px;
              font-weight: 800;
              color: #001f3f;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: -0.01em;
            }

            .doc-subtitle {
              font-size: 12px;
              color: #64748b;
              margin-top: 4px;
            }

            .feed-container {
              z-index: 10;
              position: relative;
              flex-grow: 1;
            }

            .message-card {
              margin-bottom: 24px;
              border-left: 3px solid #cbd5e1;
              padding-left: 16px;
            }

            .message-card.user {
              border-left-color: #001f3f;
            }

            .message-card.orca {
              border-left-color: #FF9933;
            }

            .message-meta {
              font-size: 11px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 6px;
              font-family: 'JetBrains Mono', monospace;
            }

            .message-body {
              font-size: 13px;
              line-height: 1.6;
              color: #1e293b;
            }

            pre {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 14px;
              overflow-x: auto;
              font-family: 'JetBrains Mono', monospace;
              font-size: 12px;
              color: #0f172a;
              margin: 12px 0;
            }

            code {
              font-family: 'JetBrains Mono', monospace;
              background: #f1f5f9;
              padding: 2px 5px;
              border-radius: 4px;
              font-size: 12px;
              color: #0f172a;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
              font-size: 13px;
            }

            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
              text-align: left;
            }

            th {
              background: #f8fafc;
              font-weight: 700;
              color: #001f3f;
            }

            footer {
              border-top: 1px solid #cbd5e1;
              padding-top: 15px;
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9px;
              color: #94a3b8;
              font-family: 'JetBrains Mono', monospace;
              z-index: 10;
              position: relative;
            }

            .disclaimer {
              max-width: 75%;
              line-height: 1.4;
            }

            @media print {
              body {
                padding: 20px;
              }
              footer {
                position: fixed;
                bottom: 0;
                width: 100%;
              }
              .page-number::after {
                content: counter(page);
              }
            }
          </style>
        </head>
        <body>
          <div class="watermark">
            <img src="/logo.png" alt="Emblem"/>
            <div style="font-size: 3.5rem; font-weight: 900; color: rgba(0, 31, 63, 0.25); letter-spacing: 0.08em; line-height: 1;">O.R.C.A</div>
            <div style="font-size: 1.8rem; margin-top: 6px; color: rgba(0, 31, 63, 0.25); font-weight: bold; letter-spacing: 0.12em; line-height: 1;">CONFIDENTIAL</div>
          </div>
          
          <div class="report-container">
            <header>
              <div class="brand">
                <img src="/logo.png" alt="O.R.C.A Emblem"/>
                <div class="brand-details">
                  <span class="brand-title">O.R.C.A &nbsp;·&nbsp; Organized Crime Analysis Authority</span>
                  <span class="brand-sub">Karnataka State Police &nbsp;·&nbsp; SCRB &nbsp;·&nbsp; AI Intelligence &amp; Crime Analytics Platform</span>
                </div>
              </div>
              <div class="header-meta">
                Ref: BRIEF-${activeConv.id.substring(5, 12).toUpperCase()}<br/>
                Officer: ${officerName}<br/>
                Clearance: ISD-LEVEL-IV
              </div>
            </header>
            
            <div class="doc-title-section">
              <h1 class="doc-title">Forensic Chat Intelligence Report</h1>
              <div class="doc-subtitle">Transcript Log: ${activeConv.title} &bull; Generated ${dateStr}</div>
            </div>
            
            <div class="feed-container">
              ${messagesHtml}
            </div>
            
            <footer>
              <div class="disclaimer">
                CLASSIFICATION: SECURE BRIEFING / CONFIDENTIAL STATE DOCUMENT. This record is electronically generated by the internal police analyzer tool. Storage or disclosure to unauthorized third-parties is subject to police prosecution under IT and Police Codes.
              </div>
              <div class="page-number">Page </div>
            </footer>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter conversations inside popup history drawer
  const filteredHistory = conversations.filter(c => 
    c.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  // Disable popup on chatbot, settings, and live news pages
  if (activeTab === "chatbot" || activeTab === "settings" || activeTab === "news") {
    return null;
  }

  return (
    <>
      {/* 1. FLOATING BUTTON BADGE */}
      {!isOpen && (
        <button
          id="mini-ai-float-btn"
          onClick={() => {
            setIsOpen(true);
            setBadgeCount(0);
          }}
          title="Open ORCA Mini Assistant (Ctrl+Shift+O)"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #001f3f 0%, #002855 100%)",
            border: "1.5px solid #FF9933",
            boxShadow: "0 8px 30px rgba(0, 31, 63, 0.45)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            transition: "transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 12px 35px rgba(0, 31, 63, 0.55)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "scale(1) translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 30px rgba(0, 31, 63, 0.45)";
          }}
        >
          <Bot style={{ width: 26, height: 26, color: "#FF9933" }} />
          
          {badgeCount > 0 && (
            <span style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              background: "#FF9933",
              borderRadius: "50%",
              width: "10px",
              height: "10px",
              border: "1.5px solid #001f3f"
            }} />
          )}
        </button>
      )}

      {/* 2. CHAT POPUP WINDOW */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: `calc(24px - ${position.y}px)`,
            right: `calc(24px - ${position.x}px)`,
            width: "400px",
            height: "600px",
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "16px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9999,
            transition: "all 0.3s ease",
            animation: "fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          {/* Header Bar */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              padding: "16px 20px",
              background: "rgba(10, 15, 30, 0.4)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "move",
              userSelect: "none"
            }}
          >
            {/* Context & Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255, 153, 51, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(255, 153, 51, 0.2)"
              }}>
                <Bot style={{ width: 18, height: 18, color: "#FF9933" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "white", letterSpacing: "0.01em" }}>O.R.C.A Assistant</span>
                {/* Compact Context pill */}
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "rgba(255, 153, 51, 0.08)",
                  border: "1px solid rgba(255, 153, 51, 0.15)",
                  padding: "2px 6px",
                  borderRadius: 10,
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#FF9933",
                  width: "fit-content",
                  lineHeight: 1
                }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#FF9933" }} />
                  <span>{getHumanReadableTab(activeTab)}</span>
                </div>
              </div>
            </div>

            {/* Actions & controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={e => e.stopPropagation()}>
              
              {/* Workspace Redirect button */}
              <button
                onClick={handleContinueInChatbot}
                title="Continue in dedicated AI Chatbot Workspace"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "white",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)"; }}
              >
                <span>Workspace</span>
                <ArrowUpRight style={{ width: 12, height: 12, color: "#FF9933" }} />
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                style={{ background: "none", border: "none", color: "rgba(255, 255, 255, 0.5)", cursor: "pointer", padding: "2px" }}
              >
                <Minus style={{ width: 16, height: 16 }} />
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                title="Close assistant"
                style={{ background: "none", border: "none", color: "rgba(255, 255, 255, 0.5)", cursor: "pointer", padding: "2px" }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {/* History Drawer Overlay (Slides from left/top when history toggled) */}
          {showHistory && (
            <div style={{
              position: "absolute",
              top: 56,
              left: 0,
              width: "100%",
              height: "calc(100% - 56px)",
              background: "rgba(10, 15, 30, 0.98)",
              zIndex: 100,
              display: "flex",
              flexDirection: "column",
              padding: 20,
              animation: "fadeIn 0.2s ease"
            }}>
              {/* Drawer header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h4 style={{ color: "white", fontSize: "14px", fontWeight: 700, margin: 0 }}>Recent Conversations</h4>
                <button
                  onClick={() => setShowHistory(false)}
                  style={{ background: "none", border: "none", color: "rgba(255, 255, 255, 0.6)", cursor: "pointer" }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* History Search bar */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Search case chats..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12.5px",
                    color: "white",
                    outline: "none"
                  }}
                />
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredHistory.map(conv => {
                  const isActive = conv.id === activeConvId;
                  const isEditing = editingId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        if (!isEditing) {
                          setActiveConvId(conv.id);
                          setShowHistory(false);
                        }
                      }}
                      style={{
                        padding: "10px 12px",
                        background: isActive ? "rgba(255, 153, 51, 0.1)" : "rgba(255, 255, 255, 0.03)",
                        border: isActive ? "1px solid rgba(255, 153, 51, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                renameConv(conv.id, editTitle);
                                setEditingId(null);
                              }
                            }}
                            onBlur={() => {
                              renameConv(conv.id, editTitle);
                              setEditingId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                            style={{
                              background: "black",
                              color: "white",
                              border: "1px solid #FF9933",
                              padding: "2px 4px",
                              borderRadius: 4,
                              fontSize: 12,
                              width: "90%"
                            }}
                          />
                        ) : (
                          <div style={{ color: "white", fontSize: "12.5px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {conv.title}
                          </div>
                        )}
                        <div style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                          {conv.moduleContext ? `Context: ${conv.moduleContext}` : "No Context"}
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => pinConv(conv.id, !conv.pinned)}
                          style={{ background: "none", border: "none", color: conv.pinned ? "#FF9933" : "rgba(255,255,255,0.4)", cursor: "pointer" }}
                        >
                          <Pin style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(conv.id);
                            setEditTitle(conv.title);
                          }}
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
                        >
                          <Edit2 style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this conversation?")) {
                              deleteConv(conv.id);
                            }
                          }}
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conversation Feed Area */}
          <div
            ref={chatContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 20
            }}
          >
            {messages.length === 0 ? (
              /* Centered layout for Empty state */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "16px 0" }}>
                <Bot style={{ width: 44, height: 44, color: "#FF9933", marginBottom: 12 }} />
                <h4 style={{ color: "white", fontSize: "15px", fontWeight: 700, margin: 0, letterSpacing: "0.01em" }}>Welcome, Investigating Officer</h4>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: 6, marginBottom: 24, maxWidth: "280px", lineHeight: "1.5" }}>
                  O.R.C.A AI Core parses active variables. Select a page-aware suggestion chip to analyze:
                </p>

                {/* natural wrap suggestion chips */}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: "340px" }}>
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSubmit(s.text)}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "16px",
                        padding: "6px 12px",
                        color: "white",
                        fontSize: "11.5px",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(255, 153, 51, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(255, 153, 51, 0.25)";
                        e.currentTarget.style.color = "#FF9933";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.color = "white";
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Render chat messages capsules */
              messages.map(msg => {
                const isUser = msg.sender === "user";
                return (
                  <div key={msg.id} style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    width: "100%",
                    gap: 6
                  }}>
                    {/* Timestamp & Meta Row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "10.5px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 600 }}>
                      <span>{isUser ? "Officer" : "O.R.C.A Core"}</span>
                      <span>&bull;</span>
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => speakText(msg.text)}
                          title="Narrate response"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "rgba(255,255,255,0.4)" }}
                        >
                          <Volume2 style={{ width: 11, height: 11 }} />
                        </button>
                      )}
                    </div>

                    {/* Capsule Bubble */}
                    <div style={{
                      background: isUser ? "#002855" : "rgba(255, 255, 255, 0.05)",
                      color: isUser ? "white" : "rgba(240, 240, 240, 0.95)",
                      border: isUser ? "1px solid rgba(0, 31, 63, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                      padding: "12px 16px",
                      borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                      maxWidth: "85%",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      wordBreak: "break-word",
                      boxShadow: isUser ? "0 4px 10px rgba(0,0,0,0.15)" : "none"
                    }}>
                      {msg.text.split("\n").map((line, lIdx) => {
                        const parts = line.split(/(\*\*.*?\*\*)/g);
                        return (
                          <div key={lIdx} style={{ marginBottom: line.trim() ? 4 : 8 }}>
                            {parts.map((part, pIdx) => {
                              if (part.startsWith("**") && part.endsWith("**")) {
                                return <strong key={pIdx} style={{ color: isUser ? "#FF9933" : "#FF9933", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
                              }
                              return part;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing Loader */}
            {isGeneratingChat && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: "8px", width: "fit-content" }}>
                <Loader2 style={{ width: 14, height: 14, color: "#FF9933", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>O.R.C.A AI is auditing...</span>
              </div>
            )}
          </div>

          {/* Controls & Composer Bar Container */}
          <div style={{
            background: "rgba(10, 15, 30, 0.5)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "12px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}>
            
            {/* Dynamic File Upload row */}
            {pendingAttachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {pendingAttachments.map((att, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "2px 8px",
                    fontSize: "10.5px",
                    color: "white"
                  }}>
                    <FileText style={{ width: 11, height: 11, color: "#FF9933" }} />
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</span>
                    <button onClick={() => setPendingAttachments([])} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 0 }}>
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* TOOLBAR: Pinned secondary actions in a compact row */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              paddingBottom: "8px"
            }}>
              {/* Left actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                
                {/* Conversations History button */}
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  title="Show recent conversations"
                  style={{
                    background: showHistory ? "rgba(255,153,51,0.1)" : "none",
                    border: "none",
                    color: showHistory ? "#FF9933" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.2s"
                  }}
                  onMouseEnter={e => { if (!showHistory) e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { if (!showHistory) e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                >
                  <History style={{ width: 14, height: 14 }} />
                </button>

                {/* Export PDF */}
                <button
                  onClick={handleExportPdf}
                  title="Export Chat to professional PDF"
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                >
                  <Printer style={{ width: 14, height: 14 }} />
                </button>

                {/* Reset / Clear Chat */}
                <button
                  onClick={() => {
                    if (confirm("Clear this conversation? All messages will be wiped.")) {
                      // Create a new conversation and clear UI
                      createConversation();
                    }
                  }}
                  title="Clear conversation"
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Right actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Voice Narration toggle */}
                <button
                  onClick={handleToggleTts}
                  title={ttsEnabled ? "Disable vocal feedback" : "Enable vocal feedback"}
                  style={{
                    background: "none",
                    border: "none",
                    color: ttsEnabled ? "#10b981" : "rgba(255,255,255,0.5)",
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.2s"
                  }}
                >
                  {ttsEnabled ? <Volume2 style={{ width: 14, height: 14 }} /> : <VolumeX style={{ width: 14, height: 14 }} />}
                </button>

                {/* Language Select Code */}
                <select
                  value={speechLanguage}
                  onChange={e => setSpeechLanguage(e.target.value)}
                  title="Select Speech Language"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    padding: "2px 4px",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    color: "white",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  <option value="en-US" style={{ color: "black" }}>EN</option>
                  <option value="hi-IN" style={{ color: "black" }}>HI</option>
                  <option value="kn-IN" style={{ color: "black" }}>KN</option>
                </select>
              </div>
            </div>

            {/* COMPOSER ROW */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "20px",
              padding: "6px 14px",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)"
            }}>
              {/* Attachment link */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach case evidence file"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.6)",
                  padding: 4,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <Paperclip style={{ width: 15, height: 15 }} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                onClick={e => { (e.target as HTMLInputElement).value = ""; }}
                style={{ display: "none" }}
              />

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Message ORCA Assistant..."
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  fontSize: "12.5px",
                  color: "white",
                  fontFamily: "inherit"
                }}
              />

              {/* Speech Micro */}
              <button
                onClick={toggleMicrophone}
                title={isListening ? "Listening... click to lock" : "Transcribe speech"}
                style={{
                  background: isListening ? "rgba(239, 68, 68, 0.2)" : "none",
                  border: isListening ? "1px solid #ef4444" : "none",
                  borderRadius: "50%",
                  width: "26px",
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: isListening ? "#ef4444" : "rgba(255,255,255,0.6)",
                  transition: "background 0.2s"
                }}
              >
                <Mic style={{ width: 14, height: 14 }} />
              </button>

              {/* Submit */}
              <button
                onClick={() => handleSubmit()}
                disabled={!inputText.trim() && pendingAttachments.length === 0}
                style={{
                  background: (!inputText.trim() && pendingAttachments.length === 0) ? "rgba(255,255,255,0.12)" : "#FF9933",
                  border: "none",
                  borderRadius: "50%",
                  width: "26px",
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: (!inputText.trim() && pendingAttachments.length === 0) ? "not-allowed" : "pointer",
                  transition: "background 0.2s"
                }}
              >
                <Send style={{ width: 12, height: 12, color: "#001f3f" }} />
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
