"use client";

import React, { useEffect } from "react";
import { useIntelligence } from "@/context/IntelligenceContext";
import DashboardPage from "@/app/dashboard/page";

export default function AIChatbotPage() {
  const { setActiveTab } = useIntelligence();

  useEffect(() => {
    setActiveTab("chatbot");
  }, [setActiveTab]);

  return <DashboardPage />;
}
