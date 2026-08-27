"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Paperclip, 
  Mic,
  MicOff,
  Send, 
  Sparkles, 
  Bot, 
  User, 
  X, 
  FileText, 
  Loader2,
  Printer,
  Plus,
  Search,
  Trash2,
  Edit2,
  Pin,
  Volume2,
  VolumeX,
  Menu,
  ChevronLeft,
  ChevronRight,
  Settings,
  Grid,
  History,
  AlertTriangle,
  FolderOpen,
  MoreHorizontal,
  ShieldCheck,
  Crosshair,
  Eye,
  Cpu,
  Zap
} from "lucide-react";
import { Letterhead } from "./Letterhead";
// aiReportDatabase (a fabricated dossier) is deliberately NOT imported —
// see the note in the send handler. Only the shape is still needed.
import { AIPresetBrief } from "@/lib/intelligenceTypes";
import { useAuth } from "@/context/AuthContext";
import { useVoice } from "@/lib/useVoice";
import { useCatalystProfile } from "@/lib/useCatalystProfile";
import { useIntelligence } from "@/context/IntelligenceContext";
import { imagePayload, buildPromptWithAttachments, readAttachment, ATTACHMENT_ACCEPT } from "@/lib/imageAttachment";
import { AttachmentFile, ChatMessage, ChatConversation } from "@/lib/chatService";
import { EvidenceTrail } from "@/components/dynamic/EvidenceTrail";

/** Matches the language picker. Used where a tag would be unreadable. */
const LANGUAGE_NAMES: Record<string, string> = {
  "en-US": "English",
  "hi-IN": "Hindi",
  "kn-IN": "Kannada",
};

const getHumanReadableTab = (tab: string) => {
  switch (tab) {
    case "dashboard": return "Dashboard";
    case "analytics": return "Analytics";
    case "heatmap": return "Heatmap";
    case "networks": return "Threat Mapping";
    case "copilot": return "Copilot";
    case "reports": return "Reports";
    case "verification-document": return "Verification";
    case "settings": return "Settings";
    default: return tab;
  }
};


const UI_TRANSLATIONS: Record<string, {
  title: string;
  welcome: (name: string) => string;
  placeholder: string;
  followUpPlaceholder: string;
  exportBrief: string;
  newConversation: string;
  auditingText: string;
  cards: { title: string; desc: string; prompt: string }[];
}> = {
  "en-US": {
    title: "O.R.C.A's AI Assistant",
    welcome: (name) => `Hello, ${name}. How can I help you today?`,
    placeholder: "Message ORCA Assistant...",
    followUpPlaceholder: "Ask ORCA follow-up query...",
    exportBrief: "Export Brief",
    newConversation: "New Conversation",
    auditingText: "O.R.C.A AI is thinking...",
    cards: [
      { title: "Draft an FIR narrative", desc: "Turn your incident notes into a structured narrative.", prompt: "Help me draft a clear, factual FIR narrative. I will paste the incident details next." },
      { title: "Explain a BNS section", desc: "What a section covers, in plain language.", prompt: "Explain the BNS section I name: what it covers, its essential ingredients, and the punishment. Mention the IPC equivalent if there is one." },
      { title: "Which sections may apply", desc: "Describe an incident, get candidate sections.", prompt: "I will describe an incident. Suggest which BNS sections may apply and why, and flag anything that must be confirmed against the bare act before filing." },
      { title: "Translate a public notice", desc: "Into Kannada or Hindi for community communication.", prompt: "Translate the notice I paste into Kannada and Hindi, keeping legal terminology accurate." },
      { title: "IPC to BNS equivalent", desc: "Find the section that replaced an older one.", prompt: "I will give an IPC section number. Tell me the corresponding BNS section, note any change in scope or punishment, and say clearly if the mapping is not one-to-one. Remind me to confirm against the bare act before relying on it." },
      { title: "Summarise a statement", desc: "Condense a witness or complainant statement.", prompt: "Summarise the statement I paste into key facts: who, what, when, where, and what was seen or heard. Do not add, infer or embellish anything that is not in the text, and list separately any point that is unclear or contradictory." }
    ]
  },
  "hi-IN": {
    title: "ओ.आर.सी.ए एआई सहायक",
    welcome: (name) => `नमस्ते, ${name}। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
    placeholder: "ओआरसीए सहायक को संदेश भेजें...",
    followUpPlaceholder: "ओआरसीए से अगला प्रश्न पूछें...",
    exportBrief: "संक्षिप्त विवरण निर्यात करें",
    newConversation: "नई बातचीत",
    auditingText: "ओ.आर.सी.ए एआई सोच रहा है...",
    cards: [
      { title: "एफआईआर विवरण का प्रारूप बनाएं", desc: "अपने घटना नोट्स को व्यवस्थित विवरण में बदलें।", prompt: "मुझे एक स्पष्ट और तथ्यात्मक एफआईआर विवरण का प्रारूप तैयार करने में मदद करें। घटना का विवरण मैं आगे भेजूँगा।" },
      { title: "बीएनएस धारा समझाएं", desc: "कोई धारा क्या कवर करती है, सरल भाषा में।", prompt: "मैं जिस बीएनएस धारा का नाम बताऊँ उसे समझाएं: वह क्या कवर करती है, उसके आवश्यक तत्व और दंड। यदि आईपीसी समकक्ष धारा हो तो बताएं।" },
      { title: "कौन सी धाराएँ लागू हो सकती हैं", desc: "घटना बताएं, संभावित धाराएँ पाएं।", prompt: "मैं एक घटना का विवरण दूँगा। बताएं कि कौन सी बीएनएस धाराएँ लागू हो सकती हैं और क्यों, तथा दर्ज करने से पहले मूल अधिनियम से जिनकी पुष्टि आवश्यक है उन्हें चिह्नित करें।" },
      { title: "सार्वजनिक सूचना का अनुवाद", desc: "समुदाय संचार के लिए कन्नड़ या हिंदी में।", prompt: "मैं जो सूचना भेजूँ उसका कन्नड़ और हिंदी में अनुवाद करें, कानूनी शब्दावली की सटीकता बनाए रखते हुए।" },
      { title: "आईपीसी से बीएनएस समकक्ष", desc: "पुरानी धारा की जगह लेने वाली धारा खोजें।", prompt: "मैं एक आईपीसी धारा संख्या दूँगा। संबंधित बीएनएस धारा बताएं, दायरे या दंड में कोई बदलाव हो तो उल्लेख करें, और यदि मानचित्रण एक-से-एक नहीं है तो स्पष्ट रूप से कहें। उपयोग से पहले मूल अधिनियम से पुष्टि करने की याद दिलाएं।" },
      { title: "बयान का सारांश दें", desc: "गवाह या शिकायतकर्ता के बयान को संक्षेप में प्रस्तुत करें।", prompt: "मैं जो बयान भेजूँ उसका सारांश मुख्य तथ्यों में दें: कौन, क्या, कब, कहाँ, और क्या देखा या सुना गया। पाठ में जो नहीं है उसे न जोड़ें, न अनुमान लगाएं; जो बिंदु अस्पष्ट या विरोधाभासी हों उन्हें अलग सूचीबद्ध करें।" }
    ]
  },
  "kn-IN": {
    title: "ಒ.ಆರ್.ಸಿ.ಎ ಎಐ ಸಹಾಯಕ",
    welcome: (name) => `ನಮಸ್ಕಾರ, ${name}. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`,
    placeholder: "ಒಆರ್‌ಸಿಎ ಸಹಾಯಕರಿಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿ...",
    followUpPlaceholder: "ಮುಂದಿನ ಪ್ರಶ್ನೆ ಕೇಳಿ...",
    exportBrief: "ವರದಿ ರಫ್ತು ಮಾಡಿ",
    newConversation: "ಹೊಸ ಸಂಭಾಷಣೆ",
    auditingText: "ಒ.ಆರ್.ಸಿ.ಎ ಎಐ ಯೋಚಿಸುತ್ತಿದೆ...",
    cards: [
      { title: "ಎಫ್‌ಐಆರ್ ವಿವರಣೆ ಸಿದ್ಧಪಡಿಸಿ", desc: "ನಿಮ್ಮ ಘಟನೆಯ ಟಿಪ್ಪಣಿಗಳನ್ನು ಕ್ರಮಬದ್ಧ ವಿವರಣೆಯಾಗಿ ಪರಿವರ್ತಿಸಿ.", prompt: "ಸ್ಪಷ್ಟ ಮತ್ತು ವಾಸ್ತವಿಕ ಎಫ್‌ಐಆರ್ ವಿವರಣೆ ಸಿದ್ಧಪಡಿಸಲು ಸಹಾಯ ಮಾಡಿ. ಘಟನೆಯ ವಿವರಗಳನ್ನು ಮುಂದೆ ನೀಡುತ್ತೇನೆ." },
      { title: "ಬಿಎನ್‌ಎಸ್ ಕಲಂ ವಿವರಿಸಿ", desc: "ಒಂದು ಕಲಂ ಏನನ್ನು ಒಳಗೊಂಡಿದೆ, ಸರಳ ಭಾಷೆಯಲ್ಲಿ.", prompt: "ನಾನು ಹೆಸರಿಸುವ ಬಿಎನ್‌ಎಸ್ ಕಲಂ ಅನ್ನು ವಿವರಿಸಿ: ಅದು ಏನನ್ನು ಒಳಗೊಂಡಿದೆ, ಅದರ ಅಗತ್ಯ ಅಂಶಗಳು ಮತ್ತು ಶಿಕ್ಷೆ. ಐಪಿಸಿ ಸಮಾನ ಕಲಂ ಇದ್ದರೆ ತಿಳಿಸಿ." },
      { title: "ಯಾವ ಕಲಂಗಳು ಅನ್ವಯಿಸಬಹುದು", desc: "ಘಟನೆ ವಿವರಿಸಿ, ಸಂಭಾವ್ಯ ಕಲಂಗಳನ್ನು ಪಡೆಯಿರಿ.", prompt: "ನಾನು ಒಂದು ಘಟನೆಯನ್ನು ವಿವರಿಸುತ್ತೇನೆ. ಯಾವ ಬಿಎನ್‌ಎಸ್ ಕಲಂಗಳು ಅನ್ವಯಿಸಬಹುದು ಮತ್ತು ಏಕೆ ಎಂದು ಸೂಚಿಸಿ; ದಾಖಲಿಸುವ ಮೊದಲು ಮೂಲ ಕಾಯ್ದೆಯಿಂದ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಬೇಕಾದವುಗಳನ್ನು ಗುರುತಿಸಿ." },
      { title: "ಸಾರ್ವಜನಿಕ ಪ್ರಕಟಣೆ ಅನುವಾದ", desc: "ಸಮುದಾಯ ಸಂವಹನಕ್ಕಾಗಿ ಕನ್ನಡ ಅಥವಾ ಹಿಂದಿಗೆ.", prompt: "ನಾನು ನೀಡುವ ಪ್ರಕಟಣೆಯನ್ನು ಕನ್ನಡ ಮತ್ತು ಹಿಂದಿಗೆ ಅನುವಾದಿಸಿ, ಕಾನೂನು ಪದಗಳ ನಿಖರತೆ ಕಾಪಾಡಿ." },
      { title: "ಐಪಿಸಿಯಿಂದ ಬಿಎನ್‌ಎಸ್ ಸಮಾನ ಕಲಂ", desc: "ಹಳೆಯ ಕಲಂ ಬದಲಿಗೆ ಬಂದ ಕಲಂ ಹುಡುಕಿ.", prompt: "ನಾನು ಐಪಿಸಿ ಕಲಂ ಸಂಖ್ಯೆ ನೀಡುತ್ತೇನೆ. ಅದಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಬಿಎನ್‌ಎಸ್ ಕಲಂ ತಿಳಿಸಿ, ವ್ಯಾಪ್ತಿ ಅಥವಾ ಶಿಕ್ಷೆಯಲ್ಲಿ ಬದಲಾವಣೆ ಇದ್ದರೆ ಸೂಚಿಸಿ, ಮತ್ತು ಹೊಂದಾಣಿಕೆ ಒಂದಕ್ಕೊಂದು ಅಲ್ಲದಿದ್ದರೆ ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ. ಬಳಸುವ ಮೊದಲು ಮೂಲ ಕಾಯ್ದೆಯಿಂದ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಲು ನೆನಪಿಸಿ." },
      { title: "ಹೇಳಿಕೆಯ ಸಾರಾಂಶ", desc: "ಸಾಕ್ಷಿ ಅಥವಾ ದೂರುದಾರರ ಹೇಳಿಕೆಯನ್ನು ಸಂಕ್ಷಿಪ್ತಗೊಳಿಸಿ.", prompt: "ನಾನು ನೀಡುವ ಹೇಳಿಕೆಯನ್ನು ಮುಖ್ಯ ಸಂಗತಿಗಳಲ್ಲಿ ಸಾರಾಂಶಗೊಳಿಸಿ: ಯಾರು, ಏನು, ಯಾವಾಗ, ಎಲ್ಲಿ, ಮತ್ತು ಏನು ಕಂಡರು ಅಥವಾ ಕೇಳಿದರು. ಪಠ್ಯದಲ್ಲಿ ಇಲ್ಲದ್ದನ್ನು ಸೇರಿಸಬೇಡಿ ಅಥವಾ ಊಹಿಸಬೇಡಿ; ಅಸ್ಪಷ್ಟ ಅಥವಾ ವಿರೋಧಾಭಾಸದ ಅಂಶಗಳನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ಪಟ್ಟಿ ಮಾಡಿ." }
    ]
  }
};

export const AIChatbotModule: React.FC = () => {
  const { officerProfile } = useAuth();
  // Firebase authenticates; Catalyst holds the officer record.
  const { profile: catalystProfile } = useCatalystProfile();
  const {
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
  } = useIntelligence();

  // Sidebar Layout States (remember state in localStorage)
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("orca_chatbot_sidebar_expanded");
      if (saved !== null) return saved === "true";
      return window.innerWidth > 1024; // default expanded on desktop
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("orca_chatbot_sidebar_expanded", String(sidebarExpanded));
  }, [sidebarExpanded]);

  // Official Chatbot Icon: KSP Seal Crest (/logo.png)
  const renderChatbotIcon = (size = 34) => {
    return (
      <img 
        src="/logo.png" 
        alt="KSP Crest" 
        style={{ 
          width: size > 20 ? size + 10 : size + 2, 
          height: size > 20 ? size + 10 : size + 2, 
          objectFit: "contain",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" 
        }} 
      />
    );
  };

  // Settings Modal
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [autoDeleteConvos, setAutoDeleteConvos] = useState<"7days" | "30days" | "never">("never");
  const [crimeDataFileName, setCrimeDataFileName] = useState<string | null>(null);
  const crimeDataFileRef = useRef<HTMLInputElement | null>(null);

  // Sidebar search & inline edit states
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    if (activeMenuId) {
      window.addEventListener("click", handleOutsideClick);
    }
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [activeMenuId]);

  // Input states
  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentFile[]>([]);

  // Voice States. The recognition and synthesis plumbing lives in useVoice —
  // it was duplicated here and in MiniAIAssistant, and the copy here could not
  // actually stop the microphone. See src/lib/useVoice.ts.
  const [speechLanguage, setSpeechLanguage] = useState("en-US");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [handsFree, setHandsFree] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const emptyFileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;
  const messages = activeConv ? activeConv.messages : [];

  // Scroll to bottom on updates
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    const t1 = setTimeout(scrollToBottom, 100);
    const t2 = setTimeout(scrollToBottom, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages, isGeneratingChat]);

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

  // Handle suggestion prompt click
  const handleSuggestionClick = (promptText: string) => {
    setInputText(promptText);
  };

  // Handle File Upload Attachment
  /**
   * File types whose text the assistant can genuinely use. Anything else is
   * accepted but flagged, rather than being attached and silently ignored.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    // Reading, downscaling and the "cannot read this" wording all live in
    // imageAttachment, so this surface and MiniAIAssistant cannot drift apart.
    const files = await Promise.all(Array.from(e.target.files).map(readAttachment));
    setPendingAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  /*
   * Dictation and narration, from the shared hook.
   *
   * Hands-free needs `submitMessage`, which is declared below, so the hook is
   * handed a ref rather than the function itself — a plain reference here would
   * be a use-before-declaration.
   */
  const submitRef = useRef<(text: string) => void>(() => {});

  const voice = useVoice({
    language: speechLanguage,
    narrate: ttsEnabled,
    handsFree,
    onTranscript: (text) => setInputText(text),
    onUtteranceComplete: (text) => {
      setInputText("");
      submitRef.current(text);
    },
  });

  const { micState, interim, speaking } = voice;
  const isListening = micState === "listening";

  /**
   * Why the microphone cannot be used, in the officer's words rather than the
   * browser's. `inputAllowed` is null until the department policy has loaded,
   * and the control stays disabled until it is known — never optimistic.
   */
  const micUsable = micState !== "unsupported" && micState !== "disabled" && voice.inputAllowed === true;
  const micTitle =
    voice.transcribing ? "Transcribing your dictation..."
    : micState === "listening" ? (voice.cloudStt ? "Recording — click to stop and transcribe" : "Listening — click to stop")
    : micState === "unsupported" ? "This browser cannot capture speech. Chrome or Edge can."
    : micState === "disabled" || voice.inputAllowed === false ? "Voice input is switched off for this department in System Settings"
    : voice.inputAllowed === null ? "Checking whether voice input is permitted..."
    : micState === "denied" ? "Microphone access was blocked. Allow it in your browser's site settings."
    : micState === "error" ? "The microphone could not be started. Try again."
    : "Dictate a question";
  const speakText = voice.speak;
  const stopSpeaking = voice.stopSpeaking;
  const toggleMicrophone = voice.toggleListening;

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

  // Core Message Submission Logic
  const submitMessage = async (promptText: string, attachments: AttachmentFile[] = [], targetConvIdParam?: string) => {
    if (!promptText.trim() && attachments.length === 0) return;

    const cleanPrompt = promptText.trim();

    /**
     * Attachment text, appended to what the model receives.
     *
     * Attachments used to be display-only: the chip appeared in the thread and
     * nothing was sent, so the assistant answered "you didn't paste the notice"
     * while the officer was looking at their own attached file.
     *
     * Files that could not be read are named explicitly rather than dropped, so
     * the assistant can say so instead of ignoring a file the officer can see.
     */
    // One attachment is not one image: a scanned PDF contributes a page each.
    const imageParts = imagePayload(attachments);

    const promptForModel = buildPromptWithAttachments(cleanPrompt, attachments);

    // Add user message to sync context
    const targetConvId = await addMessageToActiveConv(cleanPrompt, attachments, undefined, "user", targetConvIdParam);
    
    setIsGeneratingChat(true);

    try {
      const currentQuery = cleanPrompt.toLowerCase();

      /**
       * Intent routing.
       *
       * These branches used to fire on bare substrings, which misrouted ordinary
       * questions:
       *   includes("map")      matched "mapping is not one-to-one"
       *   includes("generate") matched "generate an intelligence brief"
       *   includes("track")    matched "contract", "backtrack"
       *   includes("show me")  matched almost any polite request
       *
       * A request now has to actually ask for a picture or a place, and the
       * keyword has to stand as its own word.
       */
      const WANTS_IMAGE =
        /\b(?:generate|create|draw|make|render|produce|show)\b[^.?!]{0,40}\b(?:image|picture|photo|portrait|sketch|mugshot)\b/i;
      const WANTS_MAP =
        /\b(?:show|draw|display|open|get|find|plot)\b[^.?!]{0,30}\bmap\b|\bmap\s+of\b|\bwhere\s+is\b|\blocate\b|\bcoordinates?\s+(?:of|for)\b|\broute\s+(?:to|from|between)\b/i;
      let responseText = "";
      let structuredReport: AIPresetBrief | undefined = undefined;
      let media: any = undefined;
      let isMocked = false;
      let evidence: ChatMessage["evidence"] | undefined = undefined;

      if (WANTS_IMAGE.test(cleanPrompt) && !imageParts.length) {
        isMocked = true;

        // --- Extract subject from prompt ---
        // Strip instruction verbs and isolate the actual subject
        let subject = cleanPrompt
          .replace(/generate\s+an?\s+image\s+(of\s+)?/i, "")
          .replace(/generate\s+/i, "")
          .replace(/show\s+me\s+(an?\s+image\s+(of\s+)?)?/i, "")
          .replace(/create\s+an?\s+(image|picture|photo)\s+(of\s+)?/i, "")
          .replace(/get\s+an?\s+(image|picture|photo)\s+(of\s+)?/i, "")
          .replace(/draw\s+/i, "")
          .replace(/picture\s+of\s+/i, "")
          .replace(/photo\s+of\s+/i, "")
          .replace(/portrait\s+of\s+/i, "")
          .replace(/biometric\s+(profile\s+)?(of\s+)?/i, "")
          .replace(/mugshot\s+(of\s+)?/i, "")
          .replace(/image\s+of\s+/i, "")
          .trim();

        // Fallback to full prompt if extraction strips too much
        if (subject.length < 2) subject = cleanPrompt;

        /**
         * FACES OF PEOPLE ARE REFUSED.
         *
         * The prompt sent to the image service used to be
         *
         *     "realistic professional portrait of <subject>, detailed face,
         *      high resolution, dramatic lighting"
         *
         * and the extraction above deliberately strips "mugshot of",
         * "portrait of" and "biometric profile of" — so typing
         * "mugshot of <name>" in a police console produced a photorealistic
         * synthetic face of a named individual, from a public text-to-image
         * service, with the officer's text sent to that third party.
         *
         * The disclaimer under it was accurate but is not a control: a
         * realistic face, once rendered, gets screenshotted, forwarded and
         * mistaken for a record. There is no legitimate investigative use for
         * a generated likeness of a person, so the request is declined rather
         * than answered carefully.
         *
         * Illustrations of objects, scenes and diagrams still work.
         */
        // Built via RegExp so the word-boundary escapes survive: written as a
        // literal here, the escape was emitted as an actual backspace byte,
        // and unbounded "face" matches inside "interface".
        const PERSON_REQUEST = new RegExp(
          String.raw`\b(mugshot|portrait|suspect|accused|face|likeness|biometric)\b`,
          "i"
        );
        // Two capitalised words in a row reads as a personal name.
        const namedPerson = new RegExp(String.raw`\b[A-Z][a-z]+\s+[A-Z][a-z]+\b`).test(subject);

        if (PERSON_REQUEST.test(cleanPrompt) || namedPerson) {
          responseText = `**Request declined**

I do not generate images of people — including likenesses, portraits, mugshots or biometric reconstructions — in this console.

A generated face is not evidence and is not drawn from any police record, but once rendered it can be mistaken for one. If you need a photograph of a person on a case, it belongs in that person's record, not in a generated image.

I can still illustrate objects, vehicles, scenes and diagrams.`;
          media = undefined;
        } else {
          /**
           * A public text-to-image service. It consults NO police record, and
           * the subject text IS sent to a third party — so nothing that
           * identifies a person should reach it. That is what the check above
           * is for.
           */
          const pollinationsSubject = encodeURIComponent(`illustration of ${subject}, clean, neutral, diagrammatic`);
          const imageUrl = `https://image.pollinations.ai/prompt/${pollinationsSubject}?width=768&height=512&seed=${Date.now()}&nologo=true`;

          responseText = `**AI-generated illustration**

Rendered from your description of **${subject}** by a public image model.

⚠️ This is an artist's impression, not a photograph and not evidence. It is **not** drawn from any police record and must not be used to identify anything or anyone.`;
          media = {
            type: "image",
            url: imageUrl,
            caption: `AI-generated illustration from a text description · not evidence, not from any police record · subject as described: ${subject}`
          };
        }
      } else if (WANTS_MAP.test(cleanPrompt) && !imageParts.length) {
        isMocked = true;

        // --- Extract location from the prompt ---
        let locationQuery = cleanPrompt
          .replace(/draw\s+a\s+map\s+(of\s+)?/i, "")
          .replace(/show\s+(me\s+)?(a\s+)?map\s+(of\s+)?/i, "")
          .replace(/get\s+map\s+(of\s+)?/i, "")
          .replace(/track\s+/i, "")
          .replace(/route\s+(to|from|of)\s+/i, "")
          .replace(/location\s+of\s+/i, "")
          .replace(/grid\s+(of\s+)?/i, "")
          .trim();

        if (locationQuery.length < 2) locationQuery = "India";

        // --- Geocode via Nominatim (free, no API key) ---
        let lat = 20.5937, lon = 78.9629; // default: India
        let displayName = locationQuery;
        let bbox = { west: 68.1, south: 8.0, east: 97.4, north: 37.1 }; // India fallback bbox
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`, {
            headers: { "Accept-Language": "en" }
          });
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
            displayName = geoData[0].display_name?.split(",")[0] || locationQuery;
            if (geoData[0].boundingbox) {
              const bb = geoData[0].boundingbox; // [south, north, west, east]
              bbox = { south: parseFloat(bb[0]), north: parseFloat(bb[1]), west: parseFloat(bb[2]), east: parseFloat(bb[3]) };
            }
          }
        } catch (geoErr) {
          console.warn("[ORCA Map] Nominatim geocode failed, using fallback.", geoErr);
        }

        const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&layer=mapnik&marker=${lat},${lon}`;

        // The geocoding IS real (Nominatim). The claims around it were not: there
        // are no satellite uplinks, no intercept sensors, no "ORCA GIS Layer", and
        // the "97.3% confidence index" was a constant.
        responseText = `**Location lookup**

Matched **${displayName}**

* **Coordinates:** ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E
* **Source:** OpenStreetMap / Nominatim — public map data, not a police source`;
        media = {
          type: "map",
          iframeSrc,
          lat,
          lon,
          locationName: displayName,
          route: [],
          threats: []
        };
      }

      if (!isMocked) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptForModel,
            // Logged to the audit trail instead of promptForModel, which
            // carries the contents of any attached file.
            auditPrompt: cleanPrompt,
            history: messages,
            speechLanguage,
            images: imageParts,
          })
        });
        let data: any = {};
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error(`Server API Error (${res.status}): ${text.slice(0, 80)}`);
        }

        if (!res.ok) {
          throw new Error(data.error || "Failed to contact NVIDIA NIM server");
        }

        responseText = data.text || "ORCA AI Core processed your directive.";
        /*
         * The evidence trail travels with the answer.
         *
         * It is assembled on the server from the rows actually retrieved, so
         * nothing here is re-derived from the reply text: if the model names a
         * record it never read, `unsupported` says so and the panel below the
         * message labels it rather than letting it read as a finding.
         */
        if (data.retrieval || data.retrievalError || (data.unsupported || []).length || data.contradiction || data.unverifiedAbsence) {
          evidence = {
            retrieval: data.retrieval ?? null,
            retrievalError: data.retrievalError ?? null,
            unsupported: data.unsupported || [],
            contradiction: !!data.contradiction,
            unverifiedAbsence: !!data.unverifiedAbsence,
          };
        }
        // A hardcoded dossier used to be attached here whenever the question
        // mentioned "fir", "report", "briefing" or "dossier": a SECRET-classified
        // brief naming a suspect, with invented bank-ledger tables, presented
        // beside a genuine AI answer as though the system had produced it.
        // Nothing generated it and nothing verified it. A structured report is
        // attached only when there is a real source for one.
      }

      // Add assistant response to sync context with report & media
      await addMessageToActiveConv(responseText, undefined, structuredReport, "orca", targetConvId, media, evidence);

      // Narrates when enabled, and in hands-free mode reopens the microphone
      // once narration has FINISHED — never during it, or the assistant
      // transcribes its own voice.
      if (ttsEnabled || handsFree) {
        voice.handleReply(responseText);
      }
    } catch (err: any) {
      console.error("[NVIDIA NIM Chat Error]:", err);
      const errorMsg = `⚠️ **API Communication Error**: Unable to reach O.R.C.A AI Core backend (${err.message || "Network Error"}). Please verify server connection.`;
      await addMessageToActiveConv(errorMsg, undefined, undefined, "orca", targetConvId);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  // Kept current so hands-free dictation reaches the real submit function.
  useEffect(() => { submitRef.current = (text: string) => { submitMessage(text, []); }; });

  const querySentRef = useRef(false);

  useEffect(() => {
    if (pendingChatQuery && !querySentRef.current) {
      querySentRef.current = true;
      submitMessage(pendingChatQuery, []);
      setPendingChatQuery(null);
    }
  }, [pendingChatQuery, setPendingChatQuery]);

  // Submit User Prompt
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && pendingAttachments.length === 0) return;

    const pText = inputText;
    const pAtts = pendingAttachments;
    setInputText("");
    setPendingAttachments([]);
    await submitMessage(pText, pAtts);
  };

  // Listen for global searches targeting the chatbot
  useEffect(() => {
    const handleGlobalSearch = async (e: Event) => {
      const query = (e as CustomEvent).detail;
      if (query) {
        let currentId = activeConvId;
        if (!currentId) {
          currentId = await createConversation("Global Search: " + query);
        }
        await submitMessage(query, [], currentId);
      }
    };
    window.addEventListener("orca_chatbot_search", handleGlobalSearch);
    return () => window.removeEventListener("orca_chatbot_search", handleGlobalSearch);
  }, [activeConvId, createConversation, messages, ttsEnabled]);

  // Professional PDF Exporting Module
  const handleExportPdf = () => {
    if (!activeConv) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented exporting PDF. Please allow popups for this site.");
      return;
    }

    // From Catalyst, so an exported brief carries the officer's actual
    // identity and clearance rather than a constant.
    const officerName = catalystProfile?.name || "Not on record";
    const officerClearance = catalystProfile?.clearanceLevel || "Not on record";
    const officerKgid = catalystProfile?.kgid || "Not on record";
    const dateStr = new Date().toLocaleString() + " IST";

    // Citations carry names and places typed by officers. They go into the
    // document as text, never as markup.
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
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

      /*
       * The evidence trail is part of the document, not a screen decoration.
       *
       * An exported briefing gets filed, forwarded and quoted long after the
       * conversation is gone. A paragraph about an FIR is only usable if the
       * page also carries which query produced it, whose jurisdiction applied
       * and which records back it - and, where it applies, the warning that a
       * reference in the text is unsourced.
       */
      const ev = msg.evidence;
      let evidenceHtml = "";

      if (ev?.unsupported?.length) {
        evidenceHtml += `
          <div class="evidence-warning">
            <div class="evidence-label">UNVERIFIED REFERENCE</div>
            <div>The text above mentions ${esc(ev.unsupported.join(", "))}, which
            ${ev.unsupported.length === 1 ? "does" : "do"} not appear in any record retrieved for
            this question. Verify against the case file before acting on
            ${ev.unsupported.length === 1 ? "it" : "them"}.</div>
          </div>`;
      }
      if (ev?.retrievalError) {
        evidenceHtml += `
          <div class="evidence-warning">
            <div class="evidence-label">RECORDS UNAVAILABLE</div>
            <div>The crime database could not be read for this question
            (${esc(ev.retrievalError)}). Nothing above is drawn from case records.</div>
          </div>`;
      }
      if (ev?.retrieval) {
        const r = ev.retrieval;
        const filters = Object.entries(r.args || {})
          .filter(([, v]) => String(v ?? "").trim())
          .map(([k, v]) => `${k}: ${v}`)
          .join("  &middot;  ") || "no filters";
        const cites = (r.citations || []).length
          ? `<ul class="evidence-list">${(r.citations || [])
              .map((c: any) => `<li><strong>${esc(c.label)}</strong>${c.detail ? ` &mdash; ${esc(c.detail)}` : ""}<span class="evidence-src">${esc(c.table)} &middot; ${esc(c.recordId)}</span></li>`)
              .join("")}</ul>`
          : `<div class="evidence-note">A count rather than a set of records, computed over ${r.matched} case record(s). No individual record to cite.</div>`;

        evidenceHtml += `
          <div class="evidence">
            <div class="evidence-label">EVIDENCE TRAIL</div>
            <div class="evidence-row"><span>QUERY</span>${esc(r.toolLabel || r.tool)} (${esc(r.tool)})</div>
            <div class="evidence-row"><span>FILTERS</span>${esc(filters)}</div>
            <div class="evidence-row"><span>MATCHED</span>${r.matched} record(s)${r.truncated ? `, ${r.returned} used in the answer` : ""}</div>
            <div class="evidence-row"><span>JURISDICTION</span>${esc(r.scopeNote || "")}</div>
            ${cites}
            ${(r.notes || []).length ? `<div class="evidence-note">${esc((r.notes || []).join(" "))}</div>` : ""}
          </div>`;
      }

      return `
        <div class="message-card ${msg.sender}">
          <div class="message-meta">${senderLabel} &bull; ${msg.timestamp}</div>
          <div class="message-body">${formattedText}</div>
          ${evidenceHtml}
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

            .evidence {
              margin-top: 12px;
              border: 1px solid #cbd5e1;
              border-left: 3px solid #FF9933;
              border-radius: 6px;
              padding: 10px 12px;
              background: #f8fafc;
              font-size: 11px;
              color: #334155;
              page-break-inside: avoid;
            }

            .evidence-warning {
              margin-top: 12px;
              border: 1px solid #b91c1c;
              border-radius: 6px;
              padding: 10px 12px;
              background: #fef2f2;
              font-size: 11px;
              color: #7f1d1d;
              line-height: 1.6;
              page-break-inside: avoid;
            }

            .evidence-label {
              font-family: 'JetBrains Mono', monospace;
              font-size: 9px;
              letter-spacing: 0.08em;
              font-weight: 700;
              color: #001f3f;
              margin-bottom: 6px;
            }

            .evidence-warning .evidence-label { color: #b91c1c; }

            .evidence-row {
              display: flex;
              gap: 10px;
              margin-bottom: 4px;
              line-height: 1.5;
            }

            .evidence-row span {
              font-family: 'JetBrains Mono', monospace;
              font-size: 9px;
              letter-spacing: 0.06em;
              color: #94a3b8;
              min-width: 82px;
              flex-shrink: 0;
              padding-top: 2px;
            }

            .evidence-list {
              margin: 8px 0 0 0;
              padding-left: 16px;
            }

            .evidence-list li {
              margin-bottom: 5px;
              line-height: 1.5;
            }

            .evidence-src {
              display: block;
              font-family: 'JetBrains Mono', monospace;
              font-size: 9px;
              color: #94a3b8;
              letter-spacing: 0.04em;
            }

            .evidence-note {
              margin-top: 8px;
              padding-top: 7px;
              border-top: 1px solid #cbd5e1;
              color: #475569;
              line-height: 1.6;
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
                KGID: ${officerKgid}<br/>
                Clearance: ${officerClearance}
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

  // Date Grouping logic for conversations
  const groupConversationsByDate = (convs: ChatConversation[]) => {
    const groups: {
      pinned: ChatConversation[];
      today: ChatConversation[];
      yesterday: ChatConversation[];
      prev7days: ChatConversation[];
      older: ChatConversation[];
    } = {
      pinned: [],
      today: [],
      yesterday: [],
      prev7days: [],
      older: []
    };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOf7DaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    convs.forEach(c => {
      if (c.pinned) {
        groups.pinned.push(c);
        return;
      }
      const cTime = new Date(c.createdAt).getTime();
      if (cTime >= startOfToday) {
        groups.today.push(c);
      } else if (cTime >= startOfYesterday) {
        groups.yesterday.push(c);
      } else if (cTime >= startOf7DaysAgo) {
        groups.prev7days.push(c);
      } else {
        groups.older.push(c);
      }
    });

    return groups;
  };

  // Filter and group conversations
  const filteredConvs = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groupedConvs = groupConversationsByDate(filteredConvs);

  // `welcomeSuggestions` was removed: it duplicated the quick-action cards,
  // was never rendered, and still held the retired copy.

  return (
    <div style={{
      display: "flex",
      height: "100%",
      width: "100%",
      background: "#ffffff",
      overflow: "hidden",
      animation: "fadeIn 0.25s ease"
    }}>
      <style>{`
        .sidebar-chat-card:hover .chat-date-label {
          display: none !important;
        }
        .sidebar-chat-card:hover .chat-card-actions {
          display: flex !important;
        }
      `}</style>
      
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <div className="no-print" style={{
        width: sidebarExpanded ? "300px" : "68px",
        background: "#0c1524", // Deep obsidian blue to separate from main dashboard navy sidebar
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
        transition: "width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
        overflow: "hidden"
      }}>
        
        {/* New Chat Button */}
        <div style={{ padding: sidebarExpanded ? "16px 20px" : "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          {sidebarExpanded ? (
            <button
              onClick={() => createConversation()}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid #FF9933",
                borderRadius: "8px",
                padding: "10px 16px",
                color: "white",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "0.2s"
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,153,51,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Plus style={{ width: 15, height: 15, color: "#FF9933" }} />
              <span>New Case Chat</span>
            </button>
          ) : (
            <button
              onClick={() => { createConversation(); setSidebarExpanded(true); }}
              title="New Chat Session"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "transparent",
                border: "1.5px solid #FF9933",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                margin: "0 auto",
                transition: "0.2s"
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,153,51,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Plus style={{ width: 18, height: 18, color: "#FF9933" }} />
            </button>
          )}
        </div>

        {/* Sticky Search (Only visible when sidebar expanded) */}
        {sidebarExpanded && (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(255,255,255,0.35)" }} />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "6px",
                  padding: "8px 12px 8px 30px",
                  fontSize: "12.5px",
                  color: "white",
                  outline: "none",
                  fontFamily: "inherit"
                }}
              />
            </div>
          </div>
        )}

        {/* Conversation Folders/Groups list */}
        <div style={{ flex: 1, overflowY: "auto", padding: sidebarExpanded ? "12px 14px" : "8px 0" }}>
          {sidebarExpanded ? (
            /* Grouped scroll list on expanded mode */
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Pinned Folder */}
              {groupedConvs.pinned.length > 0 && (
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#FF9933", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 6, marginBottom: 6 }}>📌 Pinned Cases</div>
                  {groupedConvs.pinned.map(c => renderSidebarCard(c))}
                </div>
              )}

              {/* Today Folder */}
              {groupedConvs.today.length > 0 && (
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 6, marginBottom: 6 }}>🕒 Today</div>
                  {groupedConvs.today.map(c => renderSidebarCard(c))}
                </div>
              )}

              {/* Yesterday Folder */}
              {groupedConvs.yesterday.length > 0 && (
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 6, marginBottom: 6 }}>🕒 Yesterday</div>
                  {groupedConvs.yesterday.map(c => renderSidebarCard(c))}
                </div>
              )}

              {/* Prev 7 Days Folder */}
              {groupedConvs.prev7days.length > 0 && (
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 6, marginBottom: 6 }}>📅 Previous 7 Days</div>
                  {groupedConvs.prev7days.map(c => renderSidebarCard(c))}
                </div>
              )}

              {/* Older Folder */}
              {groupedConvs.older.length > 0 && (
                <div>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", paddingLeft: 6, marginBottom: 6 }}>📁 Older Sessions</div>
                  {groupedConvs.older.map(c => renderSidebarCard(c))}
                </div>
              )}

              {filteredConvs.length === 0 && (
                <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
                  No case chats registered.
                </div>
              )}
            </div>
          ) : (
            /* Collapsed Icon-only Rail */
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {filteredConvs.map(conv => {
                const isActive = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => { setActiveConvId(conv.id); setSidebarExpanded(true); }}
                    title={conv.title}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                      border: conv.pinned ? "1px solid #FF9933" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isActive ? "white" : "rgba(255,255,255,0.6)",
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    {renderChatbotIcon(conv.pinned ? 18 : 20)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div style={{
          padding: sidebarExpanded ? "16px 20px" : "12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.3)",
          flexShrink: 0
        }}>
          {sidebarExpanded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 12 }}>
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  title="Auditor Profile Configurations"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
                >
                  <Settings style={{ width: 15, height: 15 }} />
                </button>
                <button
                  onClick={handleExportPdf}
                  title="Compile A4 Dossier Report"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
                >
                  <Printer style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <button
                onClick={handleExportPdf}
                title="Print current brief"
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
              >
                <Printer style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={() => setSettingsModalOpen(true)}
                title="Auditor Profile Configurations"
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
              >
                <Settings style={{ width: 16, height: 16 }} />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 2. MAIN CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f8fafc" }}>
        
        {/* Chat Header */}
        <div className="no-print" style={{
          height: "60px",
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          flexShrink: 0
        }}>
          {/* Header Left: Toggle button + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#001f3f",
                display: "flex",
                alignItems: "center",
                padding: 6,
                borderRadius: 6,
                transition: "background 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
            >
              {sidebarExpanded ? <ChevronLeft style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
            </button>
            
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h2 style={{ fontSize: "14.5px", fontWeight: 700, color: "#001f3f", display: "flex", alignItems: "center", gap: 6 }}>
                {activeConv?.title || "Intelligence Auditing Station"}
                {activeConv?.pinned && <span style={{ color: "#FF9933", fontSize: "12px" }}>📌</span>}
              </h2>
              {activeConv?.moduleContext && (
                <span style={{ fontSize: "10.5px", color: "#64748b", fontWeight: 600 }}>
                  Active Context Workflow: {getHumanReadableTab(activeConv.moduleContext)}
                </span>
              )}
            </div>
          </div>

          {/* Header Right: Language select, TTS toggle, print trigger */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Language Selector */}
            <select
              value={speechLanguage}
              onChange={e => setSpeechLanguage(e.target.value)}
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                color: "#1e293b",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="en-US">English</option>
              <option value="hi-IN">Hindi (हिन्दी)</option>
              <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
            </select>

            {/*
              One switch for both halves of voice.

              Narration is always available — it runs in the browser and no
              audio leaves the machine. Hands-free additionally opens the
              MICROPHONE after each reply, so it is offered only where the
              department has permitted voice input.
            */}
            <button
              onClick={handleToggleTts}
              disabled={voice.narrationVoiceMissing}
              title={
                voice.narrationVoiceMissing
                  ? `No ${LANGUAGE_NAMES[speechLanguage] || speechLanguage} voice is installed on this computer, so replies in that language cannot be read aloud. Install one from Windows Settings > Time & language > Speech.`
                  : ttsEnabled
                    ? `Stop reading replies aloud${voice.narrationVoiceName ? ` (${voice.narrationVoiceName})` : ""}`
                    : `Read replies aloud${voice.narrationVoiceName ? ` (${voice.narrationVoiceName})` : ""}`
              }
              aria-pressed={ttsEnabled}
              style={{
                opacity: voice.narrationVoiceMissing ? 0.45 : 1,
                cursor: voice.narrationVoiceMissing ? "not-allowed" : "pointer",
                background: ttsEnabled ? "rgba(0,31,63,0.08)" : "#f1f5f9",
                border: `1px solid ${ttsEnabled ? "#001f3f" : "#cbd5e1"}`,
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: "#1e293b",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              {ttsEnabled && !voice.narrationVoiceMissing
                ? <Volume2 style={{ width: 14, height: 14 }} />
                : <VolumeX style={{ width: 14, height: 14 }} />}
              <span>{voice.narrationVoiceMissing ? "No voice installed" : "Read aloud"}</span>
            </button>

            {voice.inputAllowed === true && (
              <button
                onClick={() => {
                  const next = !handsFree;
                  setHandsFree(next);
                  if (next) { setTtsEnabled(true); voice.startListening(); }
                  else { voice.stopListening(); voice.stopSpeaking(); }
                }}
                title={
                  handsFree
                    ? "Hands-free is on. The microphone reopens after each reply. Click to stop."
                    : "Hands-free: speak, and the question sends itself when you stop. Replies are read aloud."
                }
                aria-pressed={handsFree}
                style={{
                  background: handsFree ? "rgba(255,153,51,0.12)" : "#f1f5f9",
                  border: `1px solid ${handsFree ? "#FF9933" : "#cbd5e1"}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1e293b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Mic style={{ width: 14, height: 14 }} className={handsFree && isListening ? "animate-pulse" : ""} />
                <span>Hands-free</span>
              </button>
            )}

             {/* A4 Export Brief */}
            <button
              onClick={handleExportPdf}
              style={{
                background: "#001f3f",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Printer style={{ width: 14, height: 14, color: "#FF9933" }} />
              <span>Export Brief</span>
            </button>
          </div>
        </div>

        {/* Scrollable messages and Empty welcome area */}
        <div 
          ref={chatContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: messages.length === 0 ? "0" : "32px 32px 40px",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {messages.length === 0 ? (
            /* Center welcome screen dashboard layout */
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 24px",
              maxWidth: 960,
              margin: "0 auto",
              width: "100%",
              textAlign: "center"
            }}>
              {/* Seal Ring */}
              <div style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: "linear-gradient(135deg, #001f3f 0%, #002855 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                boxShadow: "0 10px 25px rgba(0,31,63,0.22)",
                border: "1.5px solid rgba(255,153,51,0.4)"
              }}>
                {renderChatbotIcon(34)}
              </div>

              <h1 style={{
                fontSize: "30px",
                fontWeight: 800,
                color: "#001f3f",
                fontFamily: "var(--font-serif, serif)",
                letterSpacing: "-0.02em"
              }}>
                {(UI_TRANSLATIONS[speechLanguage] || UI_TRANSLATIONS["en-US"]).title}
              </h1>

              <p style={{
                fontSize: "16px",
                color: "#64748b",
                marginTop: 8,
                marginBottom: 32,
                fontWeight: 500
              }}>
                {(UI_TRANSLATIONS[speechLanguage] || UI_TRANSLATIONS["en-US"]).welcome(catalystProfile?.name || officerProfile?.name || "Officer")}
              </p>

              {/* Suggestions Prompts Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, width: "100%" }}>
                {(UI_TRANSLATIONS[speechLanguage] || UI_TRANSLATIONS["en-US"]).cards.map((card, idx) => {
                  // Every card sends its own prompt. Two cards used to be special-cased
                  // BY INDEX, which broke silently when the card set changed:
                  //
                  //   idx 0 opened window.prompt("Enter FIR Case Number:") pre-filled
                  //     with "FIR/2026/BLR/104" — a mock.ts format that does not exist
                  //     in the schema. A real case is CrimeNo, 18 digits (§4/§7):
                  //     1 category + 4 district + 4 unit + 4 year + 5 serial.
                  //     It then asked the model for "operational facts" about a case it
                  //     cannot read.
                  //   idx 2 opened window.prompt("Enter Syndicate Member Name:")
                  //     pre-filled with "Vikram Hegde" — the fabricated suspect from the
                  //     dossier removed in §23, still leaking into the UI.
                  //
                  // After the cards were rewritten those handlers landed on unrelated
                  // cards, so "Draft an FIR narrative" asked for a case number and
                  // "Which sections may apply" asked for a syndicate member.
                  const cardAction = () => handleSuggestionClick(card.prompt);

                  return (
                    <div
                      key={idx}
                      onClick={cardAction}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "16px 20px",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "0.2s transform, 0.2s border-color, 0.2s box-shadow",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)"
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#002855";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(-2.5px)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 20px rgba(0,31,63,0.06)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.02)";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#001f3f", fontWeight: 700, fontSize: "14px" }}>
                        <Sparkles style={{ width: 15, height: 15, color: "#FF9933" }} />
                        <span>{card.title}</span>
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>
                        {card.desc}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            /* CONVERSATION THREAD */
            <div style={{ maxWidth: "880px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 28 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                  width: "100%",
                  gap: 8
                }}>
                  {/* Sender meta info */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                    {msg.sender === "user" ? (
                      <>
                        <span>Investigating Officer</span>
                        <User style={{ width: 14, height: 14, color: "#002855" }} />
                      </>
                    ) : (
                      <>
                        {renderChatbotIcon(14)}
                        <span>O.R.C.A AI Core</span>
                      </>
                    )}
                    <span>• {msg.timestamp}</span>
                    {msg.sender === "orca" && (
                      <button 
                        onClick={() => speakText(msg.text)}
                        title="Speech narration"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "#94a3b8" }}
                      >
                        <Volume2 style={{ width: 12, height: 12 }} />
                      </button>
                    )}
                  </div>

                  {/* Message Bubble */}
                  {msg.sender === "user" ? (
                    <div style={{
                      background: "#001f3f",
                      color: "white",
                      padding: "16px 20px",
                      borderRadius: "16px 16px 2px 16px",
                      maxWidth: "80%",
                      fontSize: "14.5px",
                      lineHeight: "1.55",
                      boxShadow: "0 4px 12px rgba(0,31,63,0.12)"
                    }}>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                          {msg.attachments.map((att, i) => (
                            att.dataUrl || att.thumbUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                key={i}
                                src={att.dataUrl || att.thumbUrl}
                                alt={att.name}
                                title={att.name}
                                style={{
                                  maxWidth: 180,
                                  maxHeight: 180,
                                  borderRadius: 8,
                                  border: "1px solid rgba(255,255,255,0.35)",
                                  objectFit: "cover"
                                }}
                              />
                            ) : (
                            <div key={i} style={{
                              background: "rgba(255,255,255,0.15)",
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                              <FileText style={{ width: 12, height: 12, color: "#FF9933" }} />
                              <span>{att.name}</span>
                            </div>
                            )
                          ))}
                        </div>
                      )}
                      {msg.text}
                    </div>
                  ) : (
                    /* Assistant card */
                    <div style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px 16px 16px 2px",
                      maxWidth: "100%",
                      width: "100%",
                      padding: "24px 28px",
                      boxShadow: "0 4px 18px rgba(0,0,0,0.02)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16
                    }}>
                      <div style={{ fontSize: "14.5px", color: "#1e293b", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                        {msg.text.split("\n").map((line, lIdx) => {
                          const parts = line.split(/(\*\*.*?\*\*)/g);
                          return (
                            <div key={lIdx} style={{ marginBottom: line.trim() ? 6 : 10 }}>
                              {parts.map((part, pIdx) => {
                                if (part.startsWith("**") && part.endsWith("**")) {
                                  return <strong key={pIdx} style={{ color: "#001f3f", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
                                }
                                return part;
                              })}
                            </div>
                          );
                        })}
                      </div>

                      {/*
                        What the assistant read, under what it said. Renders
                        nothing for an ordinary conversational reply that
                        consulted no records.
                      */}
                      {msg.sender === "orca" && msg.evidence && (
                        <EvidenceTrail
                          retrieval={msg.evidence.retrieval}
                          retrievalError={msg.evidence.retrievalError}
                          unsupported={msg.evidence.unsupported}
                          contradiction={msg.evidence.contradiction}
                          unverifiedAbsence={msg.evidence.unverifiedAbsence}
                        />
                      )}

                      {/* Letterhead embedded police brief component */}
                      {msg.report && (
                        <div style={{ marginTop: 10, border: "1px solid #cbd5e1", borderRadius: 8, overflow: "hidden" }}>
                          <div style={{
                            background: "#002855",
                            color: "white",
                            padding: "12px 18px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, fontFamily: "monospace", color: "#FF9933", letterSpacing: "0.08em" }}>
                              SECURE STATE CASE RECORD BRIEFING EMBEDDED
                            </span>
                            <button
                              onClick={() => window.print()}
                              style={{
                                background: "rgba(255,255,255,0.15)",
                                border: "none",
                                color: "white",
                                padding: "5px 12px",
                                borderRadius: 4,
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              <Printer style={{ width: 12, height: 12 }} /> Print Brief
                            </button>
                          </div>
                          <div style={{ padding: 20, background: "#ffffff" }}>
                            <Letterhead report={msg.report} loading={false} />
                          </div>
                        </div>
                      )}

                      {/* Custom media renders */}
                      {msg.media && msg.media.type === "image" && (
                        <div style={{
                          marginTop: 12,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                          padding: 12,
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
                        }}>
                          <div style={{ position: "relative", overflow: "hidden", borderRadius: 8 }}>
                            <img 
                              src={msg.media.url} 
                              alt={msg.media.caption} 
                              style={{ width: "100%", maxHeight: 380, objectFit: "contain", background: "#0c1524", display: "block" }} 
                            />
                            {/* Watermark overlay */}
                            <div style={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              pointerEvents: "none",
                              opacity: 0.05,
                              color: "#ffffff",
                              fontSize: "42px",
                              fontWeight: 900,
                              letterSpacing: "0.2em",
                              textTransform: "uppercase"
                            }}>
                              O.R.C.A SECURITY
                            </div>
                          </div>
                          <div style={{
                            marginTop: 10,
                            fontSize: "11px",
                            fontFamily: "JetBrains Mono, monospace",
                            color: "#64748b",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#ffffff",
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #edf2f7"
                          }}>
                            <span>{msg.media.caption}</span>
                            <span style={{ color: "#FF9933", fontWeight: 700 }}>VERIFIED SUSPECT ✓</span>
                          </div>
                        </div>
                      )}

                      {msg.media && msg.media.type === "map" && (
                        <div style={{
                          marginTop: 12,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "1px solid #cbd5e1",
                          background: "#0c1524",
                          color: "#ffffff",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12)"
                        }}>
                          {/* Map Header */}
                          <div style={{
                            padding: "10px 16px",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "rgba(0,0,0,0.3)"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#FF9933", fontSize: 14 }}>📍</span>
                              <span style={{ fontSize: "11.5px", fontWeight: 700, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em", color: "rgba(255,255,255,0.9)" }}>
                                LOCATION — {msg.media.locationName?.toUpperCase()}
                              </span>
                            </div>
                            <span style={{
                              fontSize: "9.5px",
                              background: "rgba(255,153,51,0.18)",
                              color: "#FF9933",
                              padding: "3px 9px",
                              borderRadius: 4,
                              fontWeight: 700,
                              fontFamily: "JetBrains Mono",
                              border: "1px solid rgba(255,153,51,0.25)"
                            }}>
                              OPENSTREETMAP
                            </span>
                          </div>

                          {/* Real OpenStreetMap iframe */}
                          <div style={{ position: "relative", height: 320 }}>
                            <iframe
                              src={msg.media.iframeSrc}
                              title={`ORCA GIS — ${msg.media.locationName}`}
                              style={{ width: "100%", height: "100%", border: "none", display: "block", filter: "hue-rotate(180deg) invert(1) brightness(0.8) contrast(1.1)" }}
                              loading="lazy"
                              sandbox="allow-scripts allow-same-origin"
                            />
                            {/* Tactical overlay on top of map */}
                            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", border: "2px solid rgba(255,153,51,0.15)", borderRadius: 0 }} />
                            <div style={{
                              position: "absolute",
                              bottom: 10,
                              left: 10,
                              background: "rgba(0,0,0,0.72)",
                              padding: "5px 10px",
                              borderRadius: 5,
                              fontSize: "9.5px",
                              fontFamily: "JetBrains Mono, monospace",
                              color: "rgba(255,255,255,0.7)",
                              border: "1px solid rgba(255,255,255,0.08)"
                            }}>
                              {msg.media.lat?.toFixed(4)}° N · {msg.media.lon?.toFixed(4)}° E · OpenStreetMap
                            </div>
                          </div>

                          {/* Map Footer */}
                          <div style={{
                            padding: "10px 16px",
                            background: "rgba(0,0,0,0.4)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "11px"
                          }}>
                            <span style={{ color: "rgba(255,255,255,0.6)" }}>
                              <strong style={{ color: "#FF9933" }}>Matched place:</strong> {msg.media.locationName}
                            </span>
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${msg.media.lat}&mlon=${msg.media.lon}#map=10/${msg.media.lat}/${msg.media.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: "#FF9933",
                                borderRadius: 4,
                                color: "white",
                                fontWeight: 700,
                                fontSize: "10.5px",
                                padding: "4px 12px",
                                textDecoration: "none",
                                transition: "all 0.15s ease"
                              }}
                            >
                              Open Full Map ↗
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Query generating state spinner */}
              {isGeneratingChat && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, width: "fit-content" }}>
                  <Loader2 style={{ width: 18, height: 18, color: "#FF9933", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>
                    {/* Was hardcoded English claiming a records audit — it reads
                        no records, and it ignored the officer's chosen language. */}
                    {(UI_TRANSLATIONS[speechLanguage] || UI_TRANSLATIONS["en-US"]).auditingText}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/*composer area bar fixed at the bottom */}
        <div className="no-print" style={{
            flexShrink: 0,
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            padding: "20px 32px 32px",
            display: "flex",
            justifyContent: "center"
          }}>
            <div style={{
              maxWidth: "880px",
              width: "100%",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "24px",
              padding: "12px 20px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}>
              {pendingAttachments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
                  {pendingAttachments.map((att, idx) => (
                    <div key={idx} title={att.readError || undefined} style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      // An unreadable file is marked at attach time. Previously
                      // every file looked identical, so an officer had no way to
                      // know the assistant would never see their image.
                      background: att.readError ? "#fef3c7" : "#f1f5f9",
                      border: `1px solid ${att.readError ? "#f59e0b" : "#cbd5e1"}`,
                      borderRadius: 16,
                      padding: "4px 10px",
                      fontSize: 12,
                      color: att.readError ? "#92400e" : "#1e293b",
                      fontWeight: 600
                    }}>
                      {att.dataUrl || att.thumbUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={att.dataUrl || att.thumbUrl}
                          alt=""
                          style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover" }}
                        />
                      ) : (
                        <FileText style={{ width: 14, height: 14, color: att.readError ? "#b45309" : "#002855" }} />
                      )}
                      <span>{att.name}</span>
                      {att.readError ? (
                        <span style={{ fontWeight: 500, fontSize: 11 }}>· not readable</span>
                      ) : null}
                      <button onClick={() => removeAttachment(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0 }}>
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ))}
                  {pendingAttachments.some((a) => a.readError) && (
                    <div style={{ width: "100%", fontSize: 11, color: "#92400e", fontWeight: 500, paddingTop: 2 }}>
                      {pendingAttachments.find((a) => a.readError)?.readError}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button
                  type="button"
                  onClick={() => bottomFileInputRef.current?.click()}
                  title="Attach Images or PDF documents"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}
                >
                  <Paperclip style={{ width: 18, height: 18 }} />
                </button>
                <input
                  type="file"
                  ref={bottomFileInputRef}
                  accept={ATTACHMENT_ACCEPT}
                  onChange={handleFileUpload}
                  onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                  multiple
                  style={{ display: "none" }}
                />

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
                  placeholder={
                    isListening
                      ? (interim || "Listening...")
                      : messages.length === 0
                        ? (UI_TRANSLATIONS[speechLanguage] || UI_TRANSLATIONS["en-US"]).placeholder
                        : (UI_TRANSLATIONS[speechLanguage] || UI_TRANSLATIONS["en-US"]).followUpPlaceholder
                  }
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    fontSize: "13.5px",
                    color: "#1e293b",
                    background: "transparent",
                    fontFamily: "inherit"
                  }}
                />

                {/*
                  Microphone.

                  Every reason it cannot be used is stated on the control
                  itself. The old version popped an alert() for an unsupported
                  browser and logged a denied permission to the console, so an
                  officer whose microphone was blocked saw a button that simply
                  did nothing.
                */}
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  disabled={!micUsable}
                  title={micTitle}
                  aria-label={micTitle}
                  style={{
                    background: isListening ? "rgba(239, 68, 68, 0.1)" : "none",
                    border: isListening ? "1px solid #ef4444" : "none",
                    borderRadius: "50%",
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: micUsable ? "pointer" : "not-allowed",
                    opacity: micUsable ? 1 : 0.4,
                    color: isListening ? "#ef4444" : "#64748b"
                  }}
                >
                  {micUsable
                    ? <Mic style={{ width: 16, height: 16 }} className={isListening ? "animate-pulse" : ""} />
                    : <MicOff style={{ width: 16, height: 16 }} />}
                </button>

                {/* Stop narration. Only there while it is talking. */}
                {speaking && (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    title="Stop reading aloud"
                    aria-label="Stop reading aloud"
                    style={{
                      background: "rgba(0,31,63,0.06)",
                      border: "none",
                      borderRadius: "50%",
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#001f3f"
                    }}
                  >
                    <VolumeX style={{ width: 16, height: 16 }} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!inputText.trim() && pendingAttachments.length === 0}
                  style={{
                    background: (!inputText.trim() && pendingAttachments.length === 0) ? "#cbd5e1" : "#001f3f",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: (!inputText.trim() && pendingAttachments.length === 0) ? "not-allowed" : "pointer"
                  }}
                >
                  <Send style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
          </div>

      {/* ======================================================= */}
      {/* CHATBOT SETTINGS MODAL                                   */}
      {/* ======================================================= */}
      {settingsModalOpen && (
        <div
          onClick={() => setSettingsModalOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.2s ease"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, #0d1b2e 0%, #0a1628 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "32px 36px",
              width: 440,
              maxWidth: "90vw",
              boxShadow: "0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
              color: "white",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#FF9933", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>
                  ⚙ AUDITOR PROFILE
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                  Chatbot Configurations
                </h2>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "4px 0 0", fontFamily: "JetBrains Mono, monospace" }}>
                  {catalystProfile?.email || "Not on record"}
                </p>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginBottom: 24 }} />

            {/* Auto-delete conversations */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "JetBrains Mono, monospace" }}>
                Auto-Delete Conversations
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["7days", "30days", "never"] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAutoDeleteConvos(opt)}
                    style={{
                      flex: 1, padding: "10px 6px", borderRadius: 10,
                      border: autoDeleteConvos === opt ? "1.5px solid #FF9933" : "1.5px solid rgba(255,255,255,0.1)",
                      background: autoDeleteConvos === opt ? "rgba(255,153,51,0.12)" : "rgba(255,255,255,0.04)",
                      color: autoDeleteConvos === opt ? "#FF9933" : "rgba(255,255,255,0.55)",
                      cursor: "pointer", fontSize: 11.5, fontWeight: 700,
                      fontFamily: "Inter, sans-serif", transition: "all 0.18s ease", textAlign: "center"
                    }}
                  >
                    {opt === "7days" ? "7 Days" : opt === "30days" ? "30 Days" : "Never"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", margin: "8px 0 0", fontFamily: "JetBrains Mono, monospace" }}>
                {autoDeleteConvos === "never" ? "Conversations are retained indefinitely in secure memory." : `Conversations older than ${autoDeleteConvos === "7days" ? "7" : "30"} days will be auto-purged.`}
              </p>
            </div>

            {/* Feed Crime Data */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "JetBrains Mono, monospace" }}>
                Feed Crime Data
              </div>
              <input
                ref={crimeDataFileRef}
                type="file"
                accept=".csv,.xlsx,.json,.txt,.pdf"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setCrimeDataFileName(file.name);
                }}
              />
              <button
                onClick={() => crimeDataFileRef.current?.click()}
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: 10,
                  border: crimeDataFileName ? "1.5px solid #10b981" : "1.5px dashed rgba(255,255,255,0.15)",
                  background: crimeDataFileName ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
                  color: crimeDataFileName ? "#10b981" : "rgba(255,255,255,0.45)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600,
                  transition: "all 0.18s ease", textAlign: "left"
                }}
              >
                <span style={{ fontSize: 18 }}>📂</span>
                <div>
                  <div>{crimeDataFileName ? crimeDataFileName : "Select Crime Dataset File"}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,0.25)", marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>
                    Supports .csv · .xlsx · .json · .pdf · .txt
                  </div>
                </div>
              </button>
              {crimeDataFileName && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#10b981", fontFamily: "JetBrains Mono, monospace" }}>
                  <span>✓</span>
                  <span>Dataset staged for ingestion into O.R.C.A intelligence memory.</span>
                  <button onClick={() => setCrimeDataFileName(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 11, marginLeft: "auto", padding: 0 }}>✕</button>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontFamily: "JetBrains Mono, monospace" }}>
                Danger Zone
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Permanently wipe all conversation history from secure memory?")) {
                    conversations.forEach(c => deleteConv(c.id));
                    setSettingsModalOpen(false);
                  }
                }}
                style={{
                  width: "100%", padding: "11px 16px", borderRadius: 10,
                  border: "1.5px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.06)", color: "#ef4444",
                  cursor: "pointer", fontSize: 12, fontWeight: 700,
                  fontFamily: "Inter, sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.18s ease"
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.14)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.06)"; }}
              >
                🗑 Wipe All Conversations
              </button>
            </div>

            {/* Footer Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setSettingsModalOpen(false)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("orca_auto_delete_convos", autoDeleteConvos);
                  setSettingsModalOpen(false);
                }}
                style={{
                  flex: 2, padding: "12px 0", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #FF9933 0%, #e8851f 100%)",
                  color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  fontFamily: "Inter, sans-serif",
                  boxShadow: "0 4px 16px rgba(255,153,51,0.3)"
                }}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );

  // Render Conversation sidebar card card
  function renderSidebarCard(conv: ChatConversation) {
    const isActive = conv.id === activeConvId;
    const isEditing = editingId === conv.id;
    const formattedDate = new Date(conv.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });

    return (
      <div
        key={conv.id}
        className="sidebar-chat-card"
        onClick={() => !isEditing && setActiveConvId(conv.id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          minHeight: "54px", // Keeps the box size big and spacious
          borderRadius: "8px",
          background: isActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
          cursor: "pointer",
          marginBottom: 6,
          transition: "background 0.2s ease",
          position: "relative"
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <Bot style={{ width: 14, height: 14, color: conv.pinned ? "#FF9933" : "rgba(255,255,255,0.45)", flexShrink: 0 }} />
          
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (editTitle.trim()) renameConv(conv.id, editTitle.trim());
                  setEditingId(null);
                } else if (e.key === "Escape") {
                  setEditingId(null);
                }
              }}
              onBlur={() => {
                if (editTitle.trim()) renameConv(conv.id, editTitle.trim());
                setEditingId(null);
              }}
              onClick={e => e.stopPropagation()}
              autoFocus
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid #FF9933",
                borderRadius: 4,
                color: "white",
                fontSize: "12px",
                padding: "2px 6px",
                width: "100%",
                outline: "none"
              }}
            />
          ) : (
            <span style={{
              color: "white",
              fontSize: "12.5px", // Title font size is small, clean, and legible
              fontWeight: isActive ? 600 : 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {conv.title}
            </span>
          )}
        </div>

        {/* Right slot: Swap Date for Actions on Hover */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", width: "54px", flexShrink: 0, marginLeft: 8, position: "relative" }}>
          
          {/* Date is hidden when hovered or when menu is active */}
          <span 
            className="chat-date-label" 
            style={{ 
              fontSize: "10.5px", 
              color: "rgba(255,255,255,0.35)",
              display: activeMenuId === conv.id ? "none" : "block"
            }}
          >
            {formattedDate}
          </span>

          {/* Actions fade in on hover or when action menu is active */}
          {!isEditing && (
            <div
              className="chat-card-actions"
              style={{
                display: activeMenuId === conv.id ? "flex" : "none",
                alignItems: "center",
                gap: 6,
                zIndex: 50
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => pinConv(conv.id, !conv.pinned)}
                title={conv.pinned ? "Unpin case" : "Pin case"}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: conv.pinned ? "#FF9933" : "rgba(255,255,255,0.4)",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <Pin style={{ width: 13, height: 13 }} />
              </button>

              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                  }}
                  title="More actions"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: activeMenuId === conv.id ? "white" : "rgba(255,255,255,0.4)",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <MoreHorizontal style={{ width: 13, height: 13 }} />
                </button>

                {activeMenuId === conv.id && (
                  <div style={{
                    position: "absolute",
                    top: "22px",
                    right: "0",
                    background: "#0c1524",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "4px 0",
                    minWidth: "100px",
                    zIndex: 100
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(conv.id);
                        setEditTitle(conv.title);
                        setActiveMenuId(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.8)",
                        padding: "6px 12px",
                        fontSize: "12.5px",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        width: "100%"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <Edit2 style={{ width: 12, height: 12, color: "rgba(255,255,255,0.5)" }} />
                      <span>Rename</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Wipe conversation "${conv.title}"?`)) {
                          deleteConv(conv.id);
                        }
                        setActiveMenuId(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        padding: "6px 12px",
                        fontSize: "12.5px",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        width: "100%"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <Trash2 style={{ width: 12, height: 12, color: "#ef4444" }} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};
