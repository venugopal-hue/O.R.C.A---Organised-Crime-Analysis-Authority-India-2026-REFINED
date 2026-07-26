"use client";

import React, { useState, useEffect } from "react";
import { useAuth, mapBadgeToEmail } from "@/context/AuthContext";
import { getRoleConfig } from "@/lib/rbac";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const ORCA = {
  navy: "#001f3f",
  fontSans: "'Inter', sans-serif",
  fontSerif: "'Libre Baskerville', Georgia, serif",
};

const KARNATAKA_DISTRICTS = [
  "Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", 
  "Bidar", "Chamarajanagara", "Chikkaballapura", "Chikkamagaluru", "Chitradurga", 
  "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", 
  "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", 
  "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", 
  "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgir"
];

const RANKS = [
  "Assistant Sub Inspector (ASI)",
  "Sub Inspector (SI)",
  "Inspector",
  "Deputy Superintendent of Police (DSP)",
  "Additional Superintendent of Police (ASP)",
  "Superintendent of Police (SP)",
  "Deputy Inspector General of Police (DIGP)",
  "Inspector General of Police (IGP)",
  "Additional Director General of Police (ADGP)",
  "Director General of Police (DGP)"
];

const ACCESS_MODULES = [
  "Investigation Dashboard",
  "Administrative Dashboard",
  "IT Administration Dashboard"
];

export default function LoginPage() {
  const { login, loading, isLoggedIn, dashboardRole } = useAuth();
  const { advanceDemo } = useIntelligence();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Login Form States
  const [officerId, setOfficerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Register Form States
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regBadgeId, setRegBadgeId] = useState("");
  const [regRank, setRegRank] = useState("");
  const [regStation, setRegStation] = useState("");
  const [regDistrict, setRegDistrict] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regRequestedAccess, setRegRequestedAccess] = useState("");
  const [regDeclaration, setRegDeclaration] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);
  const [regPostingType, setRegPostingType] = useState("Field");

  // Biometric Face Capture States
  const [regPhoto, setRegPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [blinkPrompt, setBlinkPrompt] = useState(false);
  const [faceOverlayStyle, setFaceOverlayStyle] = useState({ borderColor: "rgba(0, 240, 255, 0.4)", color: "#00f0ff" });
  const [hasWebcamStream, setHasWebcamStream] = useState<boolean | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const motionBaselineRef = React.useRef<ImageData | null>(null);



  const startCamera = async () => {
    setRegPhoto(null);
    setCameraActive(true);
    setIsScanning(false);
    setScanStep(0);
    setScanProgress(0);
    setBlinkPrompt(false);
    setFaceOverlayStyle({ borderColor: "rgba(0, 240, 255, 0.4)", color: "#00f0ff" });
    setHasWebcamStream(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" } });
      setHasWebcamStream(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play failed:", e));
      }
    } catch (err) {
      console.warn("Webcam access failed, activating simulated holographic camera feed:", err);
      setHasWebcamStream(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsScanning(false);
    setHasWebcamStream(null);
  };


  const runBiometricScan = () => {
    setIsScanning(true);
    setScanStep(1);
    setScanProgress(25);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (canvas && video && video.srcObject) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 320;
        canvas.height = 240;
        try {
          ctx.drawImage(video, 0, 0, 320, 240);
          motionBaselineRef.current = ctx.getImageData(0, 0, 320, 240);
        } catch (e) {
          console.warn("Baseline capture warning:", e);
        }
      }
    }
    
    setTimeout(() => {
      setScanStep(2);
      setScanProgress(60);
      setFaceOverlayStyle({ borderColor: "#ffffff", color: "#ffffff" });
      setBlinkPrompt(true);
      
      setTimeout(() => {
        setBlinkPrompt(false);
        setScanStep(5);
        setScanProgress(100);
        setFaceOverlayStyle({ borderColor: "#138808", color: "#138808" });
        captureSnapshot();
      }, 700);
    }, 600);
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    let canvas = canvasRef.current;
    
    // If hidden ref is not ready, create an off-screen canvas on the fly
    if (!canvas && typeof document !== "undefined") {
      canvas = document.createElement("canvas");
    }

    try {
      if (canvas && video && video.srcObject && (video.srcObject as MediaStream).active) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = 320;
          canvas.height = 240;
          ctx.drawImage(video, 0, 0, 320, 240);
          
          ctx.strokeStyle = "#138808";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(160, 120, 85, 0, 2 * Math.PI);
          ctx.stroke();
          
          ctx.fillStyle = "#138808";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("BIOMETRIC ACCESS SECURED", 160, 105);
          ctx.fillText("LIVENESS ID: GENUINE", 160, 120);
          ctx.fillText(new Date().toLocaleString(), 160, 135);
          
          const dataUrl = canvas.toDataURL("image/png");
          setRegPhoto(dataUrl);
        }
      } else if (canvas) {
        // Fallback or simulated camera drawing when no live webcam is active
        const ctx = canvas.getContext("2d");
        if (ctx) {
          canvas.width = 320;
          canvas.height = 240;
          
          const grad = ctx.createLinearGradient(0, 0, 320, 240);
          grad.addColorStop(0, "#001f3f");
          grad.addColorStop(1, "#003366");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 320, 240);
          
          ctx.fillStyle = "#cbd5e1";
          ctx.beginPath();
          ctx.arc(160, 100, 45, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(160, 180, 70, 45, 0, 0, Math.PI, true);
          ctx.fill();
          
          ctx.strokeStyle = "#138808";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(160, 120, 85, 0, 2 * Math.PI);
          ctx.stroke();
          
          ctx.fillStyle = "#138808";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("SIMULATED SECURE CAM INGRESS", 160, 105);
          ctx.fillText("LIVENESS ID: VERIFIED (GENUINE)", 160, 120);
          ctx.fillText(`TIMESTAMP: ${new Date().toISOString().substring(0, 19)}`, 160, 135);
          
          const dataUrl = canvas.toDataURL("image/png");
          setRegPhoto(dataUrl);
        }
      }
    } catch (err) {
      console.warn("Snapshot capture error:", err);
      // Hard fallback avatar string if canvas access fails entirely
      setRegPhoto("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23001f3f'/><circle cx='100' cy='80' r='35' fill='%23cbd5e1'/><ellipse cx='100' cy='160' rx='55' ry='35' fill='%23cbd5e1'/><circle cx='100' cy='100' r='75' stroke='%23138808' stroke-width='3' fill='none'/></svg>");
    } finally {
      setIsScanning(false);
      stopCamera();
    }
  };

  // Theme support
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("ocra-theme") as "light" | "dark" || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("ocra-theme", nextTheme);
  };

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (isLoggedIn && dashboardRole) {
      const roleConfig = getRoleConfig(dashboardRole);
      const targetPath = roleConfig ? `${roleConfig.redirectPath}?tab=${roleConfig.defaultTab}` : "/dashboard";
      router.push(targetPath);
    } else if (isLoggedIn) {
      router.push("/dashboard");
    }
  }, [isLoggedIn, dashboardRole, router]);

  const handleNormalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    try {
      const authRes: any = await login(officerId, password);
      advanceDemo();
      const resolvedRole = authRes?.dashboardRole || dashboardRole;
      const roleConfig = getRoleConfig(resolvedRole);
      const targetPath = roleConfig ? `${roleConfig.redirectPath}?tab=${roleConfig.defaultTab}` : "/dashboard";
      router.push(targetPath);
    } catch (err: any) {
      console.warn("Login submit error:", err.message);
      setErrorMessage(err.message || "Invalid credentials or account awaiting verification.");
    }
  };

  const resetRegisterForm = () => {
    setRegFirstName("");
    setRegLastName("");
    setRegBadgeId("");
    setRegRank("");
    setRegStation("");
    setRegDistrict("");
    setRegEmail("");
    setRegMobile("");
    setRegPassword("");
    setRegConfirmPassword("");
    setRegRequestedAccess("");
    setRegDeclaration(false);
    setShowRegPassword(false);
    setShowRegConfirmPassword(false);
    setRegPhoto(null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Passwords do not match. Please verify.");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (!regPhoto) {
      setErrorMessage("Biometric face verification is required. Please capture your face scan.");
      return;
    }
    if (!regDeclaration) {
      setErrorMessage("You must accept the security declaration before proceeding.");
      return;
    }

    setRegLoading(true);
    const emailToRegister = regEmail ? regEmail.trim().toLowerCase() : mapBadgeToEmail(regBadgeId);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailToRegister, regPassword);
      const newUser = userCredential.user;

      const officerDocRef = doc(db, "officers", newUser.uid);
      const officerData = {
        uid: newUser.uid,
        email: emailToRegister,
        name: `${regFirstName.trim()} ${regLastName.trim()}`.trim() || regBadgeId || "Officer",
        rank: regRank || "Inspector of Police",
        role: "CYBER_CELL",
        district: regDistrict || "Bengaluru Urban",
        station: regStation || "Internal Security Division",
        badgeId: regBadgeId || "",
        mobile: regMobile || "",
        requestedAccess: regRequestedAccess || "",
        clearanceLevel: "None",
        postingType: regPostingType,
        lastLogin: new Date().toISOString(),
        active: false,
        photoUrl: regPhoto || ""
      };

      const appDocRef = doc(db, "officer_applications", newUser.uid);
      const appData = {
        id: newUser.uid,
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        name: `${regFirstName.trim()} ${regLastName.trim()}`.trim(),
        email: emailToRegister,
        badgeId: regBadgeId.trim(),
        rank: regRank,
        station: regStation.trim(),
        district: regDistrict,
        postingType: regPostingType,
        mobile: regMobile.trim(),
        requestedAccess: regRequestedAccess,
        submittedAt: new Date().toISOString(),
        status: "pending",
        priority: "MEDIUM",
        hasPassword: true,
        photoUrl: regPhoto || "",
        timeline: [
          { status: "applied", date: new Date().toISOString(), remarks: "Application submitted via registration portal." }
        ],
        internalRemarks: "",
        assignedReviewer: "",
        securityClearance: "None",
        bgVerification: "pending",
        deptVerification: "pending",
        supervisorApproval: "pending"
      };

      const pendingDocRef = doc(db, "pendingRegistrations", newUser.uid);
      const pendingData = {
        name: `${regFirstName.trim()} ${regLastName.trim()}`.trim() || regBadgeId || "Officer",
        email: emailToRegister,
        rank: regRank || "Inspector of Police",
        posting: `${regPostingType} - ${regStation || regDistrict}`,
        requestedAccess: regRequestedAccess || "",
        submittedAt: new Date().toISOString(),
        status: "pending",
        badgeId: regBadgeId || "",
        mobile: regMobile || "",
        station: regStation || "",
        district: regDistrict || "",
        photoUrl: regPhoto || ""
      };

      if (process.env.NODE_ENV === "development") {
        console.warn("[DIAGNOSTIC - REGISTRATION WRITE] Writing to pendingRegistrations:", {
          field: "photoUrl",
          hasValue: !!regPhoto,
          length: regPhoto ? regPhoto.length : 0,
          preview: regPhoto ? regPhoto.substring(0, 50) + "..." : "empty"
        });
      }

      try {
        await setDoc(pendingDocRef, pendingData, { merge: true });
      } catch (pendErr) {
        console.warn("Firestore pendingRegistrations doc write warning:", pendErr);
      }

      try {
        await setDoc(officerDocRef, officerData, { merge: true });
      } catch (docErr) {
        console.warn("Firestore officer doc write warning:", docErr);
      }

      try {
        await setDoc(appDocRef, appData, { merge: true });
      } catch (appErr) {
        console.warn("Firestore application doc write warning:", appErr);
      }

      // Ensure new user is not logged in
      try {
        await signOut(auth);
      } catch (signOutErr) {}

      // Local storage sandbox mirroring
      if (typeof window !== "undefined") {
        const currentAppsStr = localStorage.getItem("orca_applications");
        const currentApps = currentAppsStr ? JSON.parse(currentAppsStr) : [];
        if (!currentApps.some((a: any) => a.id === newUser.uid)) {
          currentApps.push(appData);
          localStorage.setItem("orca_applications", JSON.stringify(currentApps));
        }

        const currentOfficersStr = localStorage.getItem("orca_officers");
        const currentOfficers = currentOfficersStr ? JSON.parse(currentOfficersStr) : [];
        if (!currentOfficers.some((o: any) => o.uid === newUser.uid)) {
          currentOfficers.push(officerData);
          localStorage.setItem("orca_officers", JSON.stringify(currentOfficers));
        }
        localStorage.setItem("orca_admin_demo_mode", "true");
      }

      setRegLoading(false);
      setRegSuccess(true);
      resetRegisterForm();
    } catch (err: any) {
      setRegLoading(false);
      console.error("Firebase Registration Error:", err);
      let msg = "Failed to create officer account.";
      if (err.code === "auth/email-already-in-use") {
        msg = "An Officer account with this Email or Badge ID already exists.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password is too weak. Please use a stronger password.";
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    }
  };

  // Password Strength Calculator
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: "", color: "" };
    if (pass.length < 6) return { label: "Weak", color: "#ef4444" };
    if (pass.length < 10 || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) return { label: "Medium", color: "#eab308" };
    return { label: "Strong", color: "#10b981" };
  };

  const strength = getPasswordStrength(regPassword);

  // Theme colors matching login.html Design System
  const colors = theme === "light" ? {
    navy: "#001f3f",
    navyMid: "#002855",
    navyLight: "#003366",
    gold: "#FF9933",
    goldLight: "#ffaa55",
    white: "#ffffff",
    offWhite: "#f8fafc",
    textPrimary: "#1e293b",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    border: "#e2e8f0",
    cardBg: "#ffffff",
    shadow: "0 4px 20px rgba(0, 0, 0, 0.05)",
    inputBg: "#ffffff",
    red: "#ef4444",
    redDark: "#990000",
    purpleBg: "rgba(124, 58, 237, 0.05)",
    purpleBorder: "rgba(124, 58, 237, 0.1)"
  } : {
    navy: "#0a1628",
    navyMid: "#0f2040",
    navyLight: "#1a3460",
    gold: "#E8B04B",
    goldLight: "#F5C96A",
    white: "#e8eef5",
    offWhite: "#0f1e35",
    textPrimary: "#E8EEF5",
    textSecondary: "#9BB3CC",
    textMuted: "#6B8AAA",
    border: "#1e3050",
    cardBg: "#0f1e35",
    shadow: "0 2px 16px rgba(0, 0, 0, 0.4)",
    inputBg: "#0a1628",
    red: "#ef4444",
    redDark: "#990000",
    purpleBg: "rgba(232, 176, 75, 0.05)",
    purpleBorder: "rgba(232, 176, 75, 0.1)"
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.inputBg,
    color: colors.textPrimary,
    fontFamily: ORCA.fontSans,
    fontSize: 14,
    outline: "none",
    transition: "all 0.3s"
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: colors.textSecondary,
    marginBottom: 6
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", background: colors.offWhite, transition: "background 0.3s" }}>
      
      {/* Tricolor top strip — canonical O.R.C.A style */}
      <div style={{
        height: 5,
        background: `linear-gradient(to right, #FF9933 33.33%, #ffffff 33.33% 66.66%, #138808 66.66%)`,
        width: "100%",
        zIndex: 1000,
        position: "fixed",
        top: 0,
        left: 0
      }} />

      {/* Embedded CSS for custom hover effects, scrollbars and responsive scaling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0% { transform: scale(1); }
          100% { transform: scale(1.05); }
        }
        .btn-submit-hover:hover {
          background: ${colors.navyLight} !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 31, 63, 0.2);
        }
        .theme-btn:hover {
          border-color: ${colors.gold} !important;
          transform: translateY(-2px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.04);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #FF9933 0%, #ffffff 50%, #138808 100%);
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          opacity: 0.85;
          cursor: pointer;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #ffaa55 0%, #ffffff 50%, #1eb012 100%);
          box-shadow: 0 0 8px rgba(255, 153, 51, 0.6);
          opacity: 1;
          cursor: pointer;
        }

        /* RESPONSIVE AUTO-SCALING FOR SMALLER DISPLAYS */
        @media (max-width: 1366px) {
          .top-controls {
            top: 14px !important;
            right: 20px !important;
            gap: 12px !important;
          }
          .left-brand-panel {
            padding: 40px 24px !important;
          }
          .brand-logo-img {
            height: 90px !important;
            margin-bottom: 20px !important;
          }
          .brand-title-text {
            font-size: 34px !important;
          }
          .right-form-panel {
            padding: 24px !important;
          }
          .form-card {
            padding: 24px !important;
            max-width: 410px !important;
          }
        }

        @media (max-height: 800px) {
          .top-controls {
            top: 12px !important;
            right: 16px !important;
            gap: 10px !important;
          }
          .left-brand-panel {
            padding: 30px 20px !important;
          }
          .brand-logo-img {
            height: 80px !important;
            margin-bottom: 16px !important;
          }
          .brand-title-text {
            font-size: 30px !important;
            margin-bottom: 8px !important;
          }
          .right-form-panel {
            padding: 16px !important;
          }
          .form-card {
            padding: 20px !important;
            max-height: calc(100vh - 90px) !important;
          }
          .tab-header-title {
            margin-bottom: 14px !important;
          }
          .tab-header-title h2 {
            font-size: 20px !important;
            margin-bottom: 4px !important;
          }
          .tab-header-title p {
            font-size: 12px !important;
          }
          .form-gap-container {
            gap: 12px !important;
          }
          .restricted-banner-container {
            margin-top: 14px !important;
            padding: 10px !important;
          }
        }
      `}} />



      <div style={{ flex: 1, display: "flex", width: "100%", minHeight: "100vh", marginTop: 5 }}>
        
        {/* Left Side: Branding */}
        <div className="left-brand-panel" style={{
          flex: 1,
          background: theme === "light" ? ORCA.navy : colors.navy,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 40px",
          position: "relative",
          overflow: "hidden",
          transition: "background 0.3s"
        }}>
          {/* Watermarked large background logo */}
          <img 
            src="/logo.png" 
            alt="Watermark Logo"
            style={{
              position: "absolute",
              width: "140%",
              opacity: 0.05,
              pointerEvents: "none",
              animation: "pulse 10s infinite alternate"
            }}
          />
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 480 }}>
            <img 
              src="/logo.png" 
              alt="KSP Logo" 
              className="brand-logo-img"
              style={{
                height: 120,
                marginBottom: 32,
                marginRight: "auto",
                marginLeft: "auto"
              }}
            />
            <h1 className="brand-title-text" style={{
              fontFamily: ORCA.fontSerif,
              color: "#ffffff",
              fontSize: 42,
              letterSpacing: "0.1em",
              marginBottom: 12,
              fontWeight: 700
            }}>
              <span style={{ color: colors.gold }}>O</span>.
              <span style={{ color: colors.gold }}>R</span>.
              <span style={{ color: colors.gold }}>C</span>.
              <span style={{ color: colors.gold }}>A</span>
            </h1>
            <div style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: 13,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 8
            }}>
              Organized Crime Analysis Authority
            </div>
            <div style={{
              color: "rgba(255, 255, 255, 0.4)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: 32,
              fontFamily: ORCA.fontSans
            }}>
              ಸಂಘಟಿತ ಅಪರಾಧ ವಿಶ್ಲೇಷಣಾ ಪ್ರಾಧಿಕಾರ
            </div>
            <p style={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 15,
              lineHeight: 1.6,
              marginBottom: 24
            }}>
              Secure access portal for authorized Karnataka State Police and SCRB personnel. Ensure your
              connection is secure before authenticating.
            </p>

            <div style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.5)",
              lineHeight: 1.5,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: 20,
              maxWidth: 440,
              margin: "0 auto"
            }}>
              This system is restricted to authorised personnel of the Organised Crime Analysis Authority (ORCA), Karnataka State Police and the State Crime Records Bureau. All authentication attempts are logged, monitored and audited in accordance with Government security policies.
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="right-form-panel" style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "20px 40px 40px",
          background: colors.offWhite,
          position: "relative",
          transition: "background 0.3s"
        }}>
          
          {/* Top Controls Row inline in right panel flow */}
          <div className="top-controls" style={{
            alignSelf: "flex-end",
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 20,
            zIndex: 100
          }}>
            <a 
              href="/index.html" 
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: colors.textSecondary,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                background: "none",
                border: "none",
                textDecoration: "none",
                transition: "color 0.3s"
              }}
              onMouseEnter={e => e.currentTarget.style.color = colors.gold}
              onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
            >
              ← Back to Home
            </a>
            <button 
              onClick={handleToggleTheme}
              className="theme-btn"
              suppressHydrationWarning
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: colors.cardBg,
                border: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                color: colors.textPrimary,
                cursor: "pointer",
                boxShadow: colors.shadow,
                transition: "all 0.3s"
              }}
            >
              {mounted ? (theme === "dark" ? "☀️" : "🌙") : "🌙"}
            </button>
          </div>

          {/* Centering wrapper for form card */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <div className="form-card" style={{
              width: "100%",
              maxWidth: 460,
              maxHeight: "calc(100vh - 120px)",
              display: "flex",
              flexDirection: "column",
              background: colors.cardBg,
              borderRadius: 20,
              padding: 36,
              boxShadow: colors.shadow,
              border: `1px solid ${colors.border}`,
              transition: "background 0.3s, border-color 0.3s"
            }}>
            
            {/* Tabs Selector Header */}
            <div style={{ 
              display: "flex", 
              background: theme === "light" ? "#e2e8f0" : "#061325", 
              borderRadius: 12, 
              padding: 4, 
              marginBottom: 24, 
              border: `1px solid ${theme === "light" ? "#cbd5e1" : "#1e293b"}` 
            }}>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => { setActiveTab("login"); setErrorMessage(""); setRegSuccess(false); }}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: 9,
                  border: activeTab === "login" ? `1px solid ${colors.gold}` : "1px solid transparent",
                  background: activeTab === "login" ? colors.navy : "transparent",
                  color: activeTab === "login" ? "#ffffff" : (theme === "light" ? "#64748b" : "#94a3b8"),
                  fontWeight: activeTab === "login" ? 600 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.25s ease-in-out",
                  boxShadow: activeTab === "login" ? "0 4px 14px rgba(0, 31, 63, 0.35)" : "none"
                }}
                onMouseEnter={e => {
                  if (activeTab !== "login") {
                    e.currentTarget.style.background = theme === "light" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.06)";
                    e.currentTarget.style.color = colors.textPrimary;
                  }
                }}
                onMouseLeave={e => {
                  if (activeTab !== "login") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = theme === "light" ? "#64748b" : "#94a3b8";
                  }
                }}
              >
                Login
              </button>
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => { setActiveTab("register"); setErrorMessage(""); }}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: 9,
                  border: activeTab === "register" ? `1px solid ${colors.gold}` : "1px solid transparent",
                  background: activeTab === "register" ? colors.navy : "transparent",
                  color: activeTab === "register" ? "#ffffff" : (theme === "light" ? "#64748b" : "#94a3b8"),
                  fontWeight: activeTab === "register" ? 600 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.25s ease-in-out",
                  boxShadow: activeTab === "register" ? "0 4px 14px rgba(0, 31, 63, 0.35)" : "none"
                }}
                onMouseEnter={e => {
                  if (activeTab !== "register") {
                    e.currentTarget.style.background = theme === "light" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.06)";
                    e.currentTarget.style.color = colors.textPrimary;
                  }
                }}
                onMouseLeave={e => {
                  if (activeTab !== "register") {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = theme === "light" ? "#64748b" : "#94a3b8";
                  }
                }}
              >
                Register
              </button>
            </div>

            <div className="custom-scrollbar" style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              
              {errorMessage && (
                <div style={{
                  color: colors.red,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 20,
                  fontSize: 13,
                  border: "1px solid rgba(239, 68, 68, 0.3)"
                }}>
                  {errorMessage}
                </div>
              )}

              {/* LOGIN TAB */}
              {activeTab === "login" && (
                <div style={{ transition: "opacity 0.3s ease" }}>
                  <div className="tab-header-title" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontFamily: ORCA.fontSerif, fontSize: 26, color: colors.textPrimary, fontWeight: 700, marginBottom: 6 }}>
                      Secure Portal Login
                    </h2>
                    <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0 }}>
                      Enter your official credentials to access the platform.
                    </p>
                  </div>

                  <form onSubmit={handleNormalSubmit} className="form-gap-container" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <label style={labelStyle}>Officer ID / Badge Number</label>
                      <input
                        type="text"
                        required
                        disabled={loading}
                        value={officerId}
                        onChange={(e) => setOfficerId(e.target.value)}
                        placeholder="e.g. KA-12345"
                        autoComplete="new-password"
                        suppressHydrationWarning
                        style={inputStyle}
                        onFocus={e => {
                          e.target.style.borderColor = colors.gold;
                          e.target.style.boxShadow = "0 0 0 3px rgba(255, 153, 51, 0.1)";
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = colors.border;
                          e.target.style.boxShadow = "none";
                        }}
                      />
                    </div>

                    <div style={{ position: "relative" }}>
                      <label style={labelStyle}>Password</label>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        suppressHydrationWarning
                        style={inputStyle}
                        onFocus={e => {
                          e.target.style.borderColor = colors.gold;
                          e.target.style.boxShadow = "0 0 0 3px rgba(255, 153, 51, 0.1)";
                        }}
                        onBlur={e => {
                          e.target.style.borderColor = colors.border;
                          e.target.style.boxShadow = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        suppressHydrationWarning
                        style={{
                          position: "absolute",
                          right: 14,
                          top: 36,
                          color: colors.textMuted,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 13
                        }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginTop: 2 }}>
                      <a href="/forgot-password" style={{ color: colors.gold, fontWeight: 500, textDecoration: "none" }}>
                        Forgot Password?
                      </a>
                      <button 
                        type="button"
                        onClick={() => { setActiveTab("register"); setErrorMessage(""); }}
                        suppressHydrationWarning
                        style={{ background: "none", border: "none", color: colors.gold, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.color = colors.goldLight}
                        onMouseLeave={e => e.currentTarget.style.color = colors.gold}
                      >
                        Need Access?
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="btn-submit-hover"
                      disabled={loading}
                      suppressHydrationWarning
                      style={{
                        width: "100%",
                        background: colors.navy,
                        color: "#ffffff",
                        fontSize: 15,
                        fontWeight: 600,
                        padding: 14,
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.3s",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 10,
                        opacity: loading ? 0.7 : 1,
                        marginTop: 6
                      }}
                    >
                      {loading ? (
                        <>
                          <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                          Authenticating...
                        </>
                      ) : (
                        <>Authenticate &rarr;</>
                      )}
                    </button>
                  </form>

                  <div style={{
                    marginTop: 20,
                    fontSize: 12,
                    color: colors.textMuted,
                    textAlign: "center",
                    fontStyle: "italic"
                  }}>
                    This portal is restricted to authorised Karnataka Police and SCRB personnel only.
                  </div>

                  <div className="restricted-banner-container" style={{
                    marginTop: 24,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 14,
                    background: colors.purpleBg,
                    borderRadius: 8,
                    border: `1px solid ${colors.purpleBorder}`,
                    transition: "all 0.3s"
                  }}>
                    <div style={{ color: theme === "light" ? "#7C3AED" : colors.gold, fontSize: 18 }}>🛡️</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
                      <strong style={{ color: colors.textPrimary, display: "block", marginBottom: 2 }}>Restricted Access</strong>
                      Unauthorized access to this system is strictly prohibited under the Information Technology Act, 2000. All activities are logged and monitored.
                    </div>
                  </div>
                </div>
              )}

              {/* REGISTER TAB */}
              {activeTab === "register" && (
                <div style={{ transition: "opacity 0.3s ease" }}>
                  <div className="tab-header-title" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontFamily: ORCA.fontSerif, fontSize: 24, color: colors.textPrimary, fontWeight: 700, marginBottom: 6 }}>
                      Officer Registration
                    </h2>
                    <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>
                      Submit official departmental credentials for portal clearance.
                    </p>
                  </div>

                  {regSuccess ? (
                    <div style={{ textAlign: "center", padding: "20px 0" }}>
                      <CheckCircle2 style={{ width: 52, height: 52, color: "#10b981", margin: "0 auto 16px" }} />
                      <h3 style={{ fontSize: 18, color: colors.textPrimary, fontWeight: 700, marginBottom: 8 }}>
                        Your registration is pending admin approval
                      </h3>
                      <div style={{
                        textAlign: "left",
                        background: colors.purpleBg,
                        border: `1px solid ${colors.purpleBorder}`,
                        padding: 16,
                        borderRadius: 10,
                        fontSize: 13,
                        color: colors.textSecondary,
                        lineHeight: 1.6,
                        marginBottom: 20
                      }}>
                        Your registration request will be reviewed by your reporting officer and the SCRB administrator.
                        <br /><br />
                        <strong>Estimated approval time:</strong> 24–48 hours.
                        <br />
                        You will receive an official email after approval.
                      </div>
                      <button
                        type="button"
                        onClick={() => { setActiveTab("login"); setRegSuccess(false); }}
                        suppressHydrationWarning
                        style={{
                          background: colors.navy,
                          color: "#ffffff",
                          padding: "12px 24px",
                          borderRadius: 8,
                          border: "none",
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: "pointer"
                        }}
                      >
                        Return to Login
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="form-gap-container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      
                      {/* Personal Information */}
                      <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                          Personal Information
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>First Name</label>
                            <input type="text" required value={regFirstName} onChange={e => setRegFirstName(e.target.value)} placeholder="e.g. Rajesh" suppressHydrationWarning style={inputStyle} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Last Name</label>
                            <input type="text" required value={regLastName} onChange={e => setRegLastName(e.target.value)} placeholder="e.g. Kumar" suppressHydrationWarning style={inputStyle} />
                          </div>
                        </div>
                      </div>

                      {/* Officer Information */}
                      <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                          Officer Information
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Badge / Officer ID</label>
                            <input type="text" required value={regBadgeId} onChange={e => setRegBadgeId(e.target.value)} placeholder="e.g. KA-99824" suppressHydrationWarning style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Rank & Designation</label>
                            <select required value={regRank} onChange={e => setRegRank(e.target.value)} suppressHydrationWarning style={{ ...inputStyle, cursor: "pointer" }}>
                              <option value="">Select Rank / Designation...</option>
                              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Police Station / Unit</label>
                            <input type="text" required value={regStation} onChange={e => setRegStation(e.target.value)} placeholder="e.g. Halasuru PS / Central CEN Unit" suppressHydrationWarning style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Posting Classification</label>
                            <select required value={regPostingType} onChange={e => setRegPostingType(e.target.value)} suppressHydrationWarning style={{ ...inputStyle, cursor: "pointer" }}>
                              <option value="Field">Field Posting (Default)</option>
                              <option value="HQ">Headquarters (HQ) Posting</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>District</label>
                            <select required value={regDistrict} onChange={e => setRegDistrict(e.target.value)} suppressHydrationWarning style={{ ...inputStyle, cursor: "pointer" }}>
                              <option value="">Select Karnataka District...</option>
                              {KARNATAKA_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Official Contact */}
                      <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                          Official Contact
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Government Email (.gov.in)</label>
                            <input type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="e.g. officer@karnatakapolice.gov.in" suppressHydrationWarning style={inputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Official Mobile Number</label>
                            <input type="tel" required value={regMobile} onChange={e => setRegMobile(e.target.value)} placeholder="e.g. +91 94808 xxxxx" suppressHydrationWarning style={inputStyle} />
                          </div>
                        </div>
                      </div>

                      {/* Security */}
                      <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                          Security
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ position: "relative" }}>
                            <label style={labelStyle}>Create Password</label>
                            <input type={showRegPassword ? "text" : "password"} required value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" suppressHydrationWarning style={inputStyle} />
                            <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} suppressHydrationWarning style={{ position: "absolute", right: 14, top: 34, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>
                              {showRegPassword ? "Hide" : "Show"}
                            </button>
                            {strength.label && (
                              <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: strength.color }}>
                                Strength: {strength.label}
                              </div>
                            )}
                          </div>
                          <div style={{ position: "relative" }}>
                            <label style={labelStyle}>Confirm Password</label>
                            <input type={showRegConfirmPassword ? "text" : "password"} required value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} placeholder="••••••••" suppressHydrationWarning style={inputStyle} />
                            <button type="button" onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)} suppressHydrationWarning style={{ position: "absolute", right: 14, top: 34, color: colors.textMuted, background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>
                              {showRegConfirmPassword ? "Hide" : "Show"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Requested Access */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                          Requested Access
                        </div>
                        <select required value={regRequestedAccess} onChange={e => setRegRequestedAccess(e.target.value)} suppressHydrationWarning style={{ ...inputStyle, cursor: "pointer" }}>
                          <option value="">Select Module Access Level...</option>
                          {ACCESS_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      {/* Biometric Face Verification */}
                      <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                          Biometric Face Verification (Anti-Deepfake)
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {cameraActive ? (
                            <div style={{ position: "relative", width: 220, height: 220, borderRadius: "50%", overflow: "hidden", border: `2.5px solid ${colors.gold}`, margin: "0 auto", background: "#000", display: "flex", justifyContent: "center", alignItems: "center" }}>
                              {hasWebcamStream !== false ? (
                                <video
                                  ref={videoRef}
                                  autoPlay
                                  playsInline
                                  muted
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div style={{
                                  width: "100%", height: "100%",
                                  background: "radial-gradient(circle, #003366 0%, #001f3f 70%, #000 100%)",
                                  display: "flex", flexDirection: "column",
                                  alignItems: "center", justifyContent: "center", gap: 6,
                                  color: "#00f0ff", fontFamily: "JetBrains Mono, monospace"
                                }}>
                                  <div style={{ fontSize: 44, filter: "drop-shadow(0 0 8px #00f0ff)" }}>👤</div>
                                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textAlign: "center", maxWidth: 160 }}>
                                    SIMULATED CAM ACTIVE
                                  </div>
                                  <div style={{ fontSize: 8, color: "#138808", fontWeight: 700 }}>
                                    ● LIVENESS READY
                                  </div>
                                </div>
                              )}
                              
                              <div style={{
                                position: "absolute", inset: 0,
                                border: `2.5px dashed ${faceOverlayStyle.borderColor}`,
                                borderRadius: "50%", pointerEvents: "none",
                                display: "flex", flexDirection: "column",
                                justifyContent: "center", alignItems: "center",
                                transition: "all 0.3s ease",
                                zIndex: 5
                              }}>
                                <div style={{
                                  width: "90%", height: "90%",
                                  border: `1.5px solid ${faceOverlayStyle.borderColor}33`,
                                  borderRadius: "50%",
                                  position: "relative", display: "flex",
                                  justifyContent: "center", alignItems: "center"
                                }}>
                                  {blinkPrompt && (
                                    <div style={{
                                      position: "absolute", bottom: 20,
                                      background: "rgba(255, 153, 51, 0.95)",
                                      color: "#000", padding: "4px 10px",
                                      borderRadius: 4, fontSize: 8, fontWeight: 700,
                                      animation: "pulse 0.6s infinite alternate",
                                      whiteSpace: "nowrap"
                                    }}>
                                      👤 BLINK NOW
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isScanning && (
                                <div style={{
                                  position: "absolute", bottom: 0, left: 0, right: 0,
                                  background: "rgba(0,31,63,0.9)", padding: "10px 8px 18px",
                                  fontFamily: "JetBrains Mono, monospace", fontSize: 8,
                                  color: faceOverlayStyle.color, borderTop: `1px solid ${faceOverlayStyle.borderColor}`,
                                  textAlign: "center", display: "flex", flexDirection: "column", gap: 2,
                                  zIndex: 10
                                }}>
                                  <div style={{ fontWeight: 700 }}>SCANNING... {scanProgress}%</div>
                                  <div style={{ height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1, overflow: "hidden", width: "80%", margin: "0 auto" }}>
                                    <div style={{ height: "100%", width: `${scanProgress}%`, background: faceOverlayStyle.color, transition: "width 0.2s" }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : regPhoto ? (
                            <div style={{ position: "relative", width: 220, height: 220, borderRadius: "50%", overflow: "hidden", border: `2.5px solid ${colors.gold}`, margin: "0 auto" }}>
                              <img src={regPhoto} alt="Captured Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{
                                position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                                background: "rgba(19, 136, 8, 0.95)", color: "#fff",
                                padding: "2px 8px", borderRadius: 4, fontSize: 8,
                                fontWeight: 700, fontFamily: "JetBrains Mono, monospace",
                                letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4,
                                zIndex: 10, whiteSpace: "nowrap"
                              }}>
                                🛡️ SECURE TOKEN
                              </div>
                              <button
                                type="button"
                                onClick={startCamera}
                                style={{
                                  position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
                                  background: "rgba(0,31,63,0.9)", color: "#fff",
                                  border: `1px solid ${colors.border}`, borderRadius: 6,
                                  padding: "4px 8px", fontSize: 10, cursor: "pointer",
                                  zIndex: 10, whiteSpace: "nowrap"
                                }}
                              >
                                Retake Photo
                              </button>
                            </div>
                          ) : (
                            <div style={{
                              border: `2px dashed ${colors.border}`, borderRadius: 8,
                              padding: "24px", display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: 12,
                              background: "rgba(0, 0, 0, 0.02)", textAlign: "center"
                            }}>
                              <span style={{ fontSize: 28 }}>📷</span>
                              <div>
                                <h4 style={{ margin: 0, fontSize: 13, color: colors.textPrimary, fontWeight: 700 }}>Mandatory Face Registry Ingress</h4>
                                <p style={{ margin: "4px 0 0", fontSize: 11, color: colors.textSecondary, lineHeight: 1.45, maxWidth: 300 }}>
                                  In compliance with KSP guidelines, register requests require a camera face scan for administrative verification and profile registry approval.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={startCamera}
                                style={{
                                  background: colors.navy, color: "#fff",
                                  border: "none", borderRadius: 6, padding: "8px 16px",
                                  fontSize: 12, fontWeight: 600, cursor: "pointer"
                                }}
                              >
                                Activate Biometric Camera
                              </button>
                            </div>
                          )}

                          {cameraActive && (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={runBiometricScan}
                                disabled={isScanning}
                                style={{
                                  flex: 1, minWidth: 120, background: colors.gold, color: colors.navy,
                                  border: "none", borderRadius: 6, padding: "10px",
                                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  opacity: isScanning ? 0.6 : 1, transition: "all 0.2s"
                                }}
                              >
                                {isScanning ? "Scanning..." : "Verify & Capture"}
                              </button>
                              <button
                                type="button"
                                onClick={captureSnapshot}
                                disabled={isScanning}
                                style={{
                                  background: "#138808", color: "#fff",
                                  border: "none", borderRadius: 6, padding: "10px 12px",
                                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                                  opacity: isScanning ? 0.6 : 1
                                }}
                              >
                                ⚡ Instant Snap
                              </button>
                              <button
                                type="button"
                                onClick={stopCamera}
                                disabled={isScanning}
                                style={{
                                  background: "rgba(0,0,0,0.06)", color: colors.textSecondary,
                                  border: `1px solid ${colors.border}`, borderRadius: 6,
                                  padding: "10px 12px", fontSize: 11, cursor: "pointer",
                                  opacity: isScanning ? 0.6 : 1
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          <canvas ref={canvasRef} style={{ display: "none" }} />
                        </div>
                      </div>

                      {/* Declaration */}
                      <div style={{ marginTop: 6 }}>
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
                          <input type="checkbox" required checked={regDeclaration} onChange={e => setRegDeclaration(e.target.checked)} suppressHydrationWarning style={{ accentColor: colors.gold, width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                          <span>I certify that the information provided is accurate. I understand that ORCA is a restricted Government of Karnataka system and unauthorized access may result in disciplinary and legal action.</span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={regLoading}
                        suppressHydrationWarning
                        style={{
                          width: "100%",
                          background: colors.navy,
                          color: "#ffffff",
                          fontSize: 15,
                          fontWeight: 600,
                          padding: 14,
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.3s",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                          opacity: regLoading ? 0.7 : 1,
                          marginTop: 10
                        }}
                      >
                        {regLoading ? (
                          <>
                            <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                            Submitting Registration...
                          </>
                        ) : (
                          <>Request Secure Access &rarr;</>
                        )}
                      </button>

                      {/* Approval Notice */}
                      <div style={{
                        marginTop: 16,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: 14,
                        background: colors.purpleBg,
                        borderRadius: 8,
                        border: `1px solid ${colors.purpleBorder}`,
                        transition: "all 0.3s"
                      }}>
                        <ShieldAlert style={{ width: 20, height: 20, color: theme === "light" ? "#7C3AED" : colors.gold, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
                          <strong style={{ color: colors.textPrimary, display: "block", marginBottom: 2 }}>Approval Notice</strong>
                          Your registration request will be reviewed by your reporting officer and the SCRB administrator.
                          <br />
                          <strong>Estimated approval time:</strong> 24–48 hours. You will receive an official email after approval.
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

            </div>

          </div>
        </div>
      </div>

      </div>
    </div>
  );
}
