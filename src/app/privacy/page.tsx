"use client";

import LegalPageLayout, {
  Section, Para, Ul, InfoCard, Grid, AlertBox, TocEntry, LegalPageMeta,
} from "@/components/legal/LegalPageLayout";

const META: LegalPageMeta = {
  badge:           "PRIVACY POLICY",
  title:           "Privacy Policy",
  subtitle:        "O.R.C.A Platform — Organized Crime Analysis Authority, Karnataka State Police",
  version:         "v2.1.0",
  lastUpdated:     "01 July 2026",
  approvedBy:      "DGP Office, Government of Karnataka",
  applicableSince: "01 July 2026",
  authority:       "KSP-ISD",
};

const TOC: TocEntry[] = [
  { id: "introduction",          label: "1. Introduction",                    level: 1 },
  { id: "purpose",               label: "2. Purpose of ORCA",                 level: 1 },
  { id: "information-collected", label: "3. Information Collected",           level: 1 },
  { id: "reg-info",              label: "   Officer Registration",            level: 2 },
  { id: "auth-data",             label: "   Authentication Data",             level: 2 },
  { id: "usage-logs",            label: "   Usage & Audit Logs",              level: 2 },
  { id: "ai-data",               label: "   AI Conversation Data",            level: 2 },
  { id: "how-used",              label: "4. How Information Is Used",         level: 1 },
  { id: "data-protection",       label: "5. Data Protection",                 level: 1 },
  { id: "data-retention",        label: "6. Data Retention",                  level: 1 },
  { id: "data-sharing",          label: "7. Data Sharing",                    level: 1 },
  { id: "officer-responsibilities", label: "8. Officer Responsibilities",     level: 1 },
  { id: "privacy-rights",        label: "9. Privacy Rights",                  level: 1 },
  { id: "policy-updates",        label: "10. Policy Updates",                 level: 1 },
  { id: "contact",               label: "11. Contact Information",            level: 1 },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout meta={META} toc={TOC}>

      <Section id="introduction" title="1. Introduction">
        <AlertBox type="important">
          This Privacy Policy governs the collection, storage, processing, and use of personal and operational data within the O.R.C.A platform. Access to this platform is restricted to authorised Karnataka State Police personnel only.
        </AlertBox>
        <Para>
          The O.R.C.A (Organized Crime Analysis Authority) platform is an internal intelligence and crime analysis system operated by the Internal Security Division (ISD) of the Karnataka State Police (KSP) under the authority of the Director General &amp; Inspector General of Police, Karnataka.
        </Para>
        <Para>
          This policy describes what information is collected when you use the O.R.C.A platform, how that information is used, and the protections in place to safeguard it. All authorised users of the platform are required to read, understand, and comply with this policy.
        </Para>
        <Para>
          This Privacy Policy is issued in accordance with the Information Technology Act, 2000 (as amended), the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and applicable Government of Karnataka data governance directives.
        </Para>
      </Section>

      <Section id="purpose" title="2. Purpose of O.R.C.A">
        <Para>
          O.R.C.A is a restricted-access, government-operated digital platform designed to support the operational functions of the Karnataka State Police. Its core purposes include:
        </Para>
        <Ul items={[
          "Centralised crime intelligence analysis and case management",
          "Secure processing and storage of First Information Reports (FIRs) and supporting evidence",
          "AI-assisted forensic investigation support for authorised investigators",
          "Geospatial crime mapping and district-level threat heatmap generation",
          "Criminal network and suspect relationship visualisation",
          "Official document verification, authentication, and audit",
          "State-wide administrative management of police officer credentials and access rights",
          "Generation and secure distribution of classified intelligence bulletins and operational reports",
        ]} />
        <Para>
          All data collected through the platform is used solely for the above law enforcement and administrative purposes. No data is used for commercial purposes or shared with private entities.
        </Para>
      </Section>

      <Section id="information-collected" title="3. Information Collected">
        <Para>
          O.R.C.A collects several categories of information from registered officers and through platform operations. All data collection is limited to what is necessary for legitimate operational functions.
        </Para>

        <Section id="reg-info" title="3.1 Officer Registration Information" level={2}>
          <Para>When an officer registers for access to the platform, the following personal and service information is collected:</Para>
          <Grid>
            <InfoCard label="FULL NAME" value="First and last name as per service records" />
            <InfoCard label="BADGE / SERVICE ID" value="Unique Karnataka Police badge or service identifier" />
            <InfoCard label="RANK" value="Current official rank in the Karnataka State Police" />
            <InfoCard label="DISTRICT" value="Assigned operational district" />
            <InfoCard label="STATION" value="Assigned police station or unit" />
            <InfoCard label="DIVISION / UNIT" value="Department or operational division" />
            <InfoCard label="EMAIL ADDRESS" value="Official government or KSP-issued email address" />
            <InfoCard label="MOBILE NUMBER" value="Registered official contact number" />
            <InfoCard label="SECURITY CLEARANCE" value="ISD clearance level assigned at onboarding" />
          </Grid>
        </Section>

        <Section id="auth-data" title="3.2 Authentication Data" level={2}>
          <Para>
            To authenticate and authorise access, the platform collects and processes:
          </Para>
          <Ul items={[
            "Encrypted login credentials (badge ID and password hash — passwords are never stored in plain text)",
            "Firebase Authentication tokens for active session management",
            "Login timestamps, session durations, and session termination events",
            "IP address and device metadata at each login event for security verification",
            "Multi-factor authentication records where applicable",
            "Failed login attempt logs for brute-force protection and security auditing",
          ]} />
        </Section>

        <Section id="usage-logs" title="3.3 Usage Logs, Audit Logs & System Analytics" level={2}>
          <Para>
            The platform maintains comprehensive, tamper-evident audit logs for all officer activity. This is a legal and operational requirement for a law enforcement intelligence system and cannot be opted out of. Logs capture:
          </Para>
          <Ul items={[
            "Module access events (dashboard, FIR analytics, heatmap, suspect networks, reports, admin)",
            "Case file access, creation, modification, and deletion events",
            "Document verification requests and outcomes",
            "Intelligence bulletin publication and retrieval events",
            "Administrative actions (officer approvals, rejections, permission modifications)",
            "Report generation requests and download events",
            "Search queries within the platform",
            "Session start and end timestamps with duration",
          ]} />
        </Section>

        <Section id="ai-data" title="3.4 AI Conversation Data & Generated Reports" level={2}>
          <Para>
            The O.R.C.A AI Assistant (powered by Google Gemini under a government API agreement) processes and temporarily stores conversation context:
          </Para>
          <Ul items={[
            "Text queries and prompts submitted to the AI assistant by authorised officers",
            "AI-generated investigative analysis, summaries, and recommendations",
            "Uploaded document extracts submitted for AI-assisted forensic review",
            "Conversation history maintained within a secure session for continuity of analysis",
            "AI conversation data is cleared at session termination and is not permanently stored beyond the audit log entry",
            "Generated intelligence reports and exported court exhibits are stored in the secure report repository",
            "Verification history for all documents processed through the platform",
          ]} />
          <AlertBox type="note">
            AI conversation data is never used to train third-party AI models. All AI processing occurs under government data processing agreements in compliance with applicable data protection law.
          </AlertBox>
        </Section>
      </Section>

      <Section id="how-used" title="4. How Information Is Used">
        <Para>Information collected through O.R.C.A is used exclusively for the following purposes:</Para>
        <Ul items={[
          "Authentication — Verifying the identity of officers attempting to access the platform and maintaining secure, role-appropriate session management",
          "Security — Detecting unauthorised access attempts, monitoring for insider threats, and enforcing role-based access controls across all modules",
          "Audit Trails — Maintaining complete, legally admissible records of all officer actions on the platform for compliance, accountability, and investigation purposes",
          "Report Generation — Compiling operational intelligence reports, FIR case summaries, court exhibits, and official bulletins based on data entered by authorised investigators",
          "System Administration — Managing officer accounts, access permissions, security clearance levels, and district assignments by authorised administrators",
          "AI Assistance — Providing investigative analysis support, FIR content extraction, suspect relationship mapping, and forensic timeline reconstruction for active investigations",
          "Verification Services — Processing government document authenticity verification requests and returning verified status records",
          "Operational Intelligence — Generating geospatial crime heatmaps, criminal network graphs, and statistical analysis for operational planning by district and state command",
        ]} />
      </Section>

      <Section id="data-protection" title="5. Data Protection">
        <Para>The O.R.C.A platform implements multiple layers of technical and administrative security controls:</Para>

        <Section title="5.1 Encryption" level={2} id="encryption">
          <Ul items={[
            "All data in transit is encrypted using TLS 1.3 (minimum TLS 1.2 enforced)",
            "All data at rest is encrypted using AES-256 encryption within the Firebase secure cloud infrastructure",
            "All officer passwords are hashed using industry-standard bcrypt before storage — plain text passwords are never stored",
            "Session tokens are signed, expiring, and validated server-side on every request",
            "Cryptographic signing is applied to all generated court exhibits and official report exports",
          ]} />
        </Section>

        <Section title="5.2 Role-Based Access Control (RBAC)" level={2} id="rbac">
          <Ul items={[
            "Access to each module is strictly controlled by the officer's assigned rank, clearance level, and permission set",
            "Permission sets are configured by authorised administrators and reviewed periodically",
            "Officers cannot access case data, reports, or intelligence outside their authorised scope",
            "Administrative functions are isolated and accessible only to officers with verified administrator clearance",
            "All permission changes are logged and audited",
          ]} />
        </Section>

        <Section title="5.3 Secure Authentication" level={2} id="secure-auth">
          <Ul items={[
            "Firebase Authentication with server-side token validation for all API requests",
            "Session timeout enforced after a configurable period of inactivity",
            "Automatic session termination and audit log entry on officer logout",
            "Brute-force protection: accounts are locked after repeated failed login attempts",
            "All login events are audited including timestamp, IP address, and device information",
          ]} />
        </Section>

        <Section title="5.4 Infrastructure Security" level={2} id="infra-security">
          <Ul items={[
            "Platform hosted on Google Firebase Cloud Infrastructure under a Government of India-approved cloud service agreement",
            "Network-level firewall rules restrict access to KSP-approved IP ranges",
            "Regular security audits conducted by the ISD Technology Cell",
            "Automated intrusion detection and alerting integrated into the platform monitoring",
            "All system changes are version-controlled and require authorised administrator review",
          ]} />
        </Section>
      </Section>

      <Section id="data-retention" title="6. Data Retention">
        <Para>Data retained on the O.R.C.A platform follows the Government of Karnataka's official records retention schedules and applicable law enforcement data retention requirements:</Para>
        <Grid>
          <InfoCard label="ACTIVE OFFICER RECORDS" value="Duration of service plus 7 years post-separation" accent />
          <InfoCard label="AUDIT LOGS" value="Minimum 7 years (permanent for sensitive access events)" accent />
          <InfoCard label="CASE FILES & FIR DATA" value="As per Karnataka Police Manual, minimum 10 years for serious offences" accent />
          <InfoCard label="AI CONVERSATION LOGS" value="Session only — cleared at logout, audit entry retained for 3 years" accent />
          <InfoCard label="INTELLIGENCE REPORTS" value="5 years active, archival classification thereafter" accent />
          <InfoCard label="VERIFICATION RECORDS" value="3 years for standard documents, 10 years for criminal evidence" accent />
          <InfoCard label="LOGIN & SESSION LOGS" value="3 years minimum" accent />
        </Grid>
        <Para>
          Data retained beyond its operational lifecycle is archived in a classified state. Access to archived data requires a formal request to the ISD Records Cell with appropriate authorisation.
        </Para>
      </Section>

      <Section id="data-sharing" title="7. Data Sharing">
        <Para>
          O.R.C.A data is shared only on a strict need-to-know basis and only with entities that have a legal and operational mandate to receive such information:
        </Para>
        <Ul items={[
          "Government Authorities — State and Central Government agencies including the Ministry of Home Affairs, National Crime Records Bureau (NCRB), and the Intelligence Bureau, as required by law or formal intelligence sharing protocols",
          "Internal Departments — Authorised Karnataka State Police departments including SCRB, CID, Cyber Crime Cell, and district commands, based on officer permissions",
          "Law Enforcement — Other state police forces and central law enforcement agencies (CBI, NIA, NCB) under formal request protocols and applicable data sharing agreements",
          "Legal Compliance — Courts, prosecution departments, and judicial authorities when evidence or records are required under legal process (court order, summons, or statutory mandate)",
          "Auditors — Government-appointed internal and external auditors reviewing platform compliance with data protection and cybersecurity standards",
        ]} />
        <AlertBox type="warning">
          O.R.C.A data is NEVER shared with private companies, commercial entities, research institutions, media organisations, or foreign governments except under extraordinary legal compulsion via formal government-to-government legal assistance treaties.
        </AlertBox>
      </Section>

      <Section id="officer-responsibilities" title="8. Officer Responsibilities">
        <Para>Every authorised user of the O.R.C.A platform is personally responsible for:</Para>
        <Ul items={[
          "Maintaining the confidentiality of login credentials — credentials must never be shared with any other person",
          "Logging out of all sessions at the end of each working shift and when leaving a workstation unattended",
          "Immediately reporting any suspected unauthorised access, credential compromise, or data breach to the ISD Help Desk",
          "Using platform data exclusively for official law enforcement purposes and not for personal, political, or commercial use",
          "Not downloading, copying, or exporting classified data to personal devices or storage media",
          "Complying with all applicable data protection laws, the Official Secrets Act, and Karnataka Police standing orders regarding information handling",
          "Not discussing or disclosing platform data in unsecured channels including personal messaging applications, personal email, or social media",
        ]} />
        <AlertBox type="important">
          Violation of these responsibilities may result in disciplinary action under the Karnataka Police Act, criminal prosecution under the Information Technology Act, 2000, and/or prosecution under the Official Secrets Act, 1923.
        </AlertBox>
      </Section>

      <Section id="privacy-rights" title="9. Privacy Rights">
        <Para>
          Authorised officers have the following rights with respect to their personal information held on the platform:
        </Para>
        <Ul items={[
          "Right to Access — Officers may request a summary of personal and service information held about them by submitting a written request to the ISD Registrar",
          "Right to Correction — Officers may request correction of inaccurate personal details (name, rank, station, contact information) through the platform administrator",
          "Right to Deletion — Upon separation from service, officers may request deletion of personal identifying information subject to mandatory legal retention requirements",
          "Right to Audit Log Review — Officers have the right to request a review of their own platform activity audit logs for specified periods",
          "Right to Data Portability — Officers may request an export of their personal profile data in a machine-readable format upon separation from service",
        ]} />
        <Para>
          All privacy rights requests must be submitted in writing to the ISD Registrar. Requests will be acknowledged within 5 working days and resolved within 30 working days, or as per applicable RTI timelines.
        </Para>
      </Section>

      <Section id="policy-updates" title="10. Policy Updates">
        <Para>
          This Privacy Policy is reviewed and updated annually, or whenever there is a material change in platform functionality, applicable law, or government data governance directives. The version number and last updated date at the top of this document reflect the current authorised version.
        </Para>
        <Para>
          All authorised users will be notified of significant policy changes via the platform notification system and the official ISD communications channel. Continued use of the platform after the effective date of an updated policy constitutes acceptance of the revised terms.
        </Para>
        <Para>
          Historical versions of this policy are maintained in the ISD Records Repository and are available upon formal request.
        </Para>
      </Section>

      <Section id="contact" title="11. Contact Information">
        <Para>For questions, requests, or concerns relating to this Privacy Policy, data protection, or your personal information held on the O.R.C.A platform, contact:</Para>
        <Grid>
          <InfoCard label="DATA PROTECTION OFFICER" value="DSP (Technology), ISD Cell, Karnataka State Police" accent />
          <InfoCard label="EMAIL" value="isd.dataprotection@ksp.gov.in" accent />
          <InfoCard label="PHONE" value="+91-80-2294-3000 (Ext. 402)" accent />
          <InfoCard label="ADDRESS" value="ISD Technology Cell, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001" accent />
          <InfoCard label="OFFICE HOURS" value="Monday to Friday, 10:00 AM – 5:00 PM IST" accent />
          <InfoCard label="RTI OFFICER" value="See RTI page for Public Information Officer details" accent />
        </Grid>
      </Section>

    </LegalPageLayout>
  );
}

