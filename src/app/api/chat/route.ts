import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    // Authenticated check bypassed to allow universal access as requested

    const { prompt, history, moduleContext, activeCaseId, speechLanguage } = await req.json();
    
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    
    // Choose API based on availability
    const useNvidia = !!nvidiaKey;
    const apiKey = useNvidia ? nvidiaKey : groqKey;
    
    if (!apiKey) {
      return NextResponse.json({ error: "No API Key configured on the server. Please check environment variables." }, { status: 500 });
    }

    const apiUrl = useNvidia 
      ? "https://integrate.api.nvidia.com/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

    const modelName = useNvidia
      ? "meta/llama-3.1-8b-instruct"
      : "llama-3.1-8b-instant";

    let systemPrompt = `You are O.R.C.A AI Core, an advanced AI intelligence assistant for the Karnataka State Police and Internal Security Division (ISD).
You assist investigating officers with criminal intelligence analysis, FIR forensic breakdowns, syndicate tracking, ANPR vehicle telemetry, and legal directives.
When the user greets you or speaks casually (e.g. "hi", "hello", "say hi", "yo"), respond warmly, naturally, and concisely.
CRITICAL: Never ask for security clearance levels (such as ISD-1 to ISD-5) or act like a robotic gatekeeper. Be helpful, direct, and conversational at all times.`;

    if (speechLanguage === "hi-IN") {
      systemPrompt += `\nCRITICAL LANGUAGE MANDATE: The user has selected Hindi (हिन्दी). You MUST write your ENTIRE response in Hindi using Devanagari script (हिंदी).`;
    } else if (speechLanguage === "kn-IN") {
      systemPrompt += `\nCRITICAL LANGUAGE MANDATE: The user has selected Kannada (ಕನ್ನಡ). You MUST write your ENTIRE response in Kannada using Kannada script (ಕನ್ನಡ).`;
    }

    if (moduleContext) {
      systemPrompt += `\nCURRENT PAGE CONTEXT: The investigating officer is currently viewing the "${moduleContext}" module. Answer questions in relation to this section when appropriate.`;
    }
    if (activeCaseId) {
      systemPrompt += `\nACTIVE CASE ID REFERENCE: The active case file loaded in context is "${activeCaseId}". If the officer asks to summarize, analyze or audit the active case or FIR, you should speak in reference to this ID.`;
    }

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-6).map((msg: any) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      })),
      { role: "user", content: prompt }
    ];

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messagesPayload,
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!aiResponse.ok) {
      const errData = await aiResponse.json();
      throw new Error(errData.error?.message || `API call failed with status ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const replyText = aiData.choices[0]?.message?.content || "ORCA AI Core processed your query.";

    return NextResponse.json({ success: true, text: replyText });
  } catch (error: any) {
    console.error("[O.R.C.A AI Chat Route Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to generate AI response." }, { status: 500 });
  }
}
