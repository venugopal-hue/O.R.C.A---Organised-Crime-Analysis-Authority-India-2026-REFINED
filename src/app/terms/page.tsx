"use client";

import LegalPageLayout, {
  Section, Para, Ul, InfoCard, Grid, AlertBox, TocEntry, LegalPageMeta,
} from "@/components/legal/LegalPageLayout";

const META: LegalPageMeta = {
  badge:           "TERMS OF USE",
  title:           "Terms of Use",
  subtitle:        "O.R.C.A Platform — Organized Crime Analysis Authority, Karnataka State Police",
  version:         "v2.1.0",
  lastUpdated:     "01 July 2026",
  approvedBy:      "DGP Office, Government of Karnataka",
  applicableSince: "01 July 2026",
  authority:       "KSP-ISD",
};

const TOC: TocEntry[] = [
  { id: "introduction",        label: "1. Introduction",                  level: 1 },
  { id: "platform-purpose",    label: "2. Platform Purpose",              level: 1 },
  { id: "authorized-users",    label: "3. Authorised Users",              level: 1 },
  { id: "acceptable-use",      label: "4. Acceptable Use",                level: 1 },
  { id: "officer-resp",        label: "5. Officer Responsibilities",      level: 1 },
  { id: "admin-resp",          label: "6. Administrator Responsibilities", level: 1 },
  { id: "system-security",     label: "7. System Security",               level: 1 },
  { id: "confidentiality",     label: "8. Confidentiality",               level: 1 },
  { id: "govt-data",           label: "9. Government Data Handling",      level: 1 },
  { id: "ai-usage",            label: "10. AI Usage",                     level: 1 },
  { id: "reports",             label: "11. Report Generation",            level: 1 },
  { id: "verification",        label: "12. Verification Services",        level: 1 },
  { id: "audit-logging",       label: "13. Audit Logging",                level: 1 },
  { id: "account-suspension",  label: "14. Account Suspension",           level: 1 },
  { id: "termination",         label: "15. Account Termination",          level: 1 },
  { id: "cybersecurity",       label: "16. Cybersecurity Policy",         level: 1 },
  { id: "legal-compliance",    label: "17. Legal Compliance",             level: 1 },
  { id: "disclaimer",          label: "18. Disclaimer",                   level: 1 },
  { id: "liability",           label: "19. Limitation of Liability",      level: 1 },
  { id: "policy-updates",      label: "20. Policy Updates",               level: 1 },
  { id: "contact",             label: "21. Contact Information",          level: 1 },
];

export default function TermsOfUsePage() {
  return (
    <LegalPageLayout meta={META} toc={TOC}>

      <Section id="introduction" title="1. Introduction">
        <AlertBox type="important">
          These Terms of Use constitute a binding agreement between the authorised officer and the Government of Karnataka / Karnataka State Police with respect to access and use of the O.R.C.A platform. Accessing the platform signifies full acceptance of these terms.
        </AlertBox>
        <Para>
          The O.R.C.A (Organized Crime Analysis Authority) platform is a restricted, government-operated internal intelligence and law enforcement management system. These Terms of Use govern the rights, obligations, and conduct of all individuals who access or use the platform.
        </Para>
        <Para>
          These terms are issued by the Internal Security Division (ISD) of the Karnataka State Police (KSP) under the authority of the Director General &amp; Inspector General of Police, Karnataka, and are subject to revision at the discretion of the competent authority.
        </Para>
        <Para>
          These Terms of Use should be read in conjunction with the O.R.C.A Privacy Policy and any supplementary standing orders issued by the ISD from time to time. In the event of a conflict between these Terms and a subsequent ISD Standing Order, the Standing Order shall prevail.
        </Para>
      </Section>

      <Section id="platform-purpose" title="2. Platform Purpose">
        <Para>
          O.R.C.A is developed and maintained exclusively for the following official law enforcement purposes:
        </Para>
        <Ul items={[
          "Operational crime intelligence collection, analysis, and dissemination within Karnataka State Police",
          "Centralised management of First Information Reports (FIRs), case files, and associated investigative data",
          "AI-assisted forensic investigation support for authorised investigators and analysts",
          "Geospatial crime mapping and district-level threat assessment for operational planning",
          "Criminal network analysis and suspect relationship mapping for investigative use",
          "Official government document authentication and verification",
          "State-wide management of officer credentials, access rights, and security clearances",
          "Generation and secure distribution of classified intelligence bulletins, operational reports, and court exhibits",
          "Administrative management of the Karnataka State Police internal systems",
        ]} />
        <Para>
          Any use of the platform beyond these stated purposes is prohibited and may result in disciplinary action and/or criminal prosecution.
        </Para>
      </Section>

      <Section id="authorized-users" title="3. Authorised Users">
        <Para>Access to the O.R.C.A platform is strictly limited to:</Para>
        <Ul items={[
          "Serving officers of the Karnataka State Police who have been formally registered and approved through the platform's officer onboarding process",
          "Officers of Central Police Organisations (CBI, NIA, NCB, IB) with a formal deputation or liaison arrangement with Karnataka State Police and explicit ISD approval",
          "Civilian staff and analysts employed by Karnataka State Police in an official capacity who have been granted access by an authorised administrator",
          "ISD Technology Cell staff responsible for platform maintenance, under a separate elevated-privilege access tier",
        ]} />
        <AlertBox type="warning">
          Granting or facilitating access to the platform for any person who is not an authorised user is a serious disciplinary offence and may constitute a criminal offence under the Information Technology Act, 2000 and the Official Secrets Act, 1923.
        </AlertBox>
        <Para>
          All authorised user accounts must be linked to an officer's official service record. Accounts for officers who are suspended, terminated, retired, or transferred out of Karnataka State Police will be suspended or deactivated by the platform administrator.
        </Para>
      </Section>

      <Section id="acceptable-use" title="4. Acceptable Use">
        <Para>Authorised users may use the platform only for the following purposes:</Para>
        <Ul items={[
          "Accessing case data, intelligence, and reports directly relevant to their assigned operational duties and within their authorised access tier",
          "Submitting queries to the AI assistant for legitimate investigative analysis purposes",
          "Generating official reports and intelligence bulletins in their authorised capacity",
          "Processing document verification requests within their authorised scope",
          "Performing administrative functions strictly within their granted administrative permissions",
        ]} />
        <Para>The following uses are expressly prohibited:</Para>
        <Ul items={[
          "Accessing, downloading, or copying data beyond the scope of your official operational duties",
          "Using the platform for personal, political, commercial, religious, or any non-law enforcement purpose",
          "Sharing case data, intelligence, reports, or any platform content with unauthorised persons through any medium",
          "Attempting to access modules, data, or functions beyond your authorised permission level",
          "Using AI assistant functionality for personal queries unrelated to official law enforcement duties",
          "Uploading or processing documents or data that are not legitimately related to an active investigation or official administrative task",
          "Using the platform to harass, defame, or collect information about individuals for personal reasons",
          "Conducting any form of penetration testing, vulnerability assessment, or technical manipulation of the platform without explicit written ISD authorisation",
        ]} />
      </Section>

      <Section id="officer-resp" title="5. Officer Responsibilities">
        <Para>Every authorised officer using the O.R.C.A platform is personally responsible for:</Para>
        <Ul items={[
          "Maintaining strict confidentiality of login credentials — badge ID and password must not be shared under any circumstances",
          "Securing workstations when stepping away, including locking the screen and logging out at end of shift",
          "Reporting any suspicious platform behaviour, potential security incidents, or suspected credential compromise immediately to the ISD Help Desk",
          "Ensuring all data entered into the platform is accurate, relevant, and obtained through lawful means",
          "Complying with all applicable laws, standing orders, and directives relating to information handling and data protection",
          "Cooperating fully with any audit, investigation, or review of platform activity conducted by authorised ISD personnel",
          "Not retaining cached or downloaded copies of classified platform data on personal devices or unsecured storage media",
          "Promptly notifying the platform administrator of any changes to service status, rank, station, or district assignment",
        ]} />
      </Section>

      <Section id="admin-resp" title="6. Administrator Responsibilities">
        <Para>Officers granted administrator-level access to the O.R.C.A platform carry additional responsibilities:</Para>
        <Ul items={[
          "Approving officer registration applications only after verification of credentials against official service records",
          "Assigning permissions strictly in accordance with the officer's rank, role, and operational requirements — the principle of least privilege must be applied",
          "Promptly deactivating or suspending accounts of officers who are suspended, retired, transferred, or otherwise no longer authorised",
          "Reviewing audit logs regularly for anomalous activity and escalating any security concerns to the ISD Security Cell",
          "Never granting permissions or clearances beyond what is justified by the officer's role and operational need",
          "Maintaining accurate records of all administrative actions taken and the justification for each",
          "Ensuring that no officer account is created or activated without the required documentation and authorisation chain",
        ]} />
        <AlertBox type="important">
          Administrator access is a position of significant trust. Misuse of administrator privileges is treated as a serious disciplinary matter and may result in criminal prosecution in addition to departmental action.
        </AlertBox>
      </Section>

      <Section id="system-security" title="7. System Security">
        <Para>
          The O.R.C.A platform implements comprehensive technical security controls to protect government and law enforcement data. All users are required to cooperate with these controls and not attempt to circumvent them:
        </Para>
        <Ul items={[
          "Role-Based Access Control (RBAC) is enforced at every API endpoint — users cannot access data outside their assigned permission scope",
          "All sessions are subject to automatic timeout after a period of inactivity defined by ISD security policy",
          "Repeated failed login attempts trigger automatic account lockout to prevent brute-force attacks",
          "All platform communications are encrypted in transit using TLS 1.3 or higher",
          "All data stored on the platform is encrypted at rest using AES-256",
          "The platform uses cryptographic signing for official documents and court exhibits to ensure non-repudiation",
          "Network access may be restricted to KSP-approved IP address ranges at the discretion of the ISD Technology Cell",
        ]} />
      </Section>

      <Section id="confidentiality" title="8. Confidentiality">
        <Para>
          All data accessible through the O.R.C.A platform is classified as either Restricted, Confidential, or Secret in accordance with the Government of India's classification scheme, unless explicitly marked otherwise. All authorised users are bound by the following confidentiality obligations:
        </Para>
        <Ul items={[
          "All data accessed, downloaded, or generated through the platform must be treated as classified and handled accordingly",
          "Classified information must not be discussed in unsecured environments including public spaces, personal devices, personal messaging applications, or personal email",
          "Printed reports and documents must be stored securely and disposed of through approved secure destruction methods",
          "Officers who are transferred, retired, or separated from service remain bound by their confidentiality obligations with respect to all platform data they accessed during their service",
        ]} />
        <Para>
          Violation of confidentiality obligations may constitute an offence under the Official Secrets Act, 1923, and relevant provisions of the Information Technology Act, 2000.
        </Para>
      </Section>

      <Section id="govt-data" title="9. Government Data Handling">
        <Para>
          The O.R.C.A platform handles sensitive government and law enforcement data. Users are required to adhere to the Government of India's data governance framework, including:
        </Para>
        <Ul items={[
          "National Data Governance Framework Policy (NDGFP) — data must be used for the stated purpose only and within the authorised scope",
          "Karnataka Open Data Policy — government data is handled with appropriate access controls and not publicly disclosed",
          "Ministry of Home Affairs Cybersecurity Guidelines for Law Enforcement Agencies",
          "NCRB Data Sharing Protocols — data shared with NCRB or other state systems follows the prescribed interoperability and security standards",
          "All government data processing activities are logged and auditable as per the Government's records management requirements",
        ]} />
      </Section>

      <Section id="ai-usage" title="10. AI Usage">
        <Para>
          The O.R.C.A platform includes an integrated AI assistant (O.R.C.A Intelligence Agent) for investigative analysis support. The following terms govern its use:
        </Para>
        <Ul items={[
          "The AI assistant must be used exclusively for official investigative analysis, case summarisation, forensic timeline assistance, and other operational law enforcement tasks",
          "AI-generated analysis, recommendations, and summaries are investigative aids only — they do not constitute legal evidence, official findings, or admissible determinations",
          "Officers must independently verify all AI-generated information before acting upon it or incorporating it into an official report",
          "Submitting personal, private, or non-operational queries to the AI assistant is prohibited",
          "Do not submit to the AI assistant any information that exceeds your authorised access level",
          "AI conversation data is not permanently retained but is subject to session audit logging",
          "The AI system is not infallible — officers bear full professional responsibility for the accuracy and legality of all actions taken based on AI-generated output",
        ]} />
        <AlertBox type="note">
          AI outputs are tools to assist trained law enforcement professionals — they do not replace human judgement, legal review, or official investigative process.
        </AlertBox>
      </Section>

      <Section id="reports" title="11. Report Generation">
        <Para>
          The platform's report generation functions allow authorised officers to create official intelligence reports, case summaries, FIR extracts, and court exhibits. The following rules apply:
        </Para>
        <Ul items={[
          "Reports may only be generated within the scope of the officer's authorised access level",
          "All generated reports are logged with the generating officer's credentials, timestamp, and content hash",
          "Official reports bear cryptographic signatures and watermarks to ensure authenticity and non-repudiation",
          "Reports classified as Confidential or Secret must be distributed only through authorised encrypted channels",
          "Printed or downloaded reports must be treated as classified documents and handled accordingly",
          "Reports must not be edited, forged, or altered after generation — the platform's cryptographic controls will detect tampering",
          "Court exhibits generated by the platform are certified as true extracts from the O.R.C.A secure repository and are subject to judicial notice",
        ]} />
      </Section>

      <Section id="verification" title="12. Verification Services">
        <Para>
          The Document Verification module allows authorised officers to verify the authenticity of government documents submitted for examination. Terms governing this service:
        </Para>
        <Ul items={[
          "Document verification may only be conducted for documents that are legitimately relevant to an active investigation or official administrative process",
          "Results of document verification are official records and must be logged and stored in the case file",
          "Verification results must not be shared with any unauthorised party",
          "Officers must not attempt to submit documents for verification for personal purposes or on behalf of any private party",
          "The platform's verification systems connect to authorised government registries — verification results are advisory and do not replace official judicial determination",
        ]} />
      </Section>

      <Section id="audit-logging" title="13. Audit Logging">
        <Para>
          All activity on the O.R.C.A platform is automatically and comprehensively logged. Officers acknowledge and accept the following:
        </Para>
        <Ul items={[
          "Every login, logout, module access, data query, report generation, document verification, and administrative action is recorded in the platform audit log",
          "Audit logs are tamper-evident and maintained for a minimum of 7 years",
          "Audit logs may be reviewed by authorised ISD supervisors, administrators, and internal/external auditors at any time",
          "Audit logs are admissible as evidence in departmental disciplinary proceedings and criminal prosecutions",
          "There is no expectation of privacy with respect to actions taken on the O.R.C.A platform — all activity is monitored",
          "Attempts to circumvent, modify, or delete audit logs are treated as serious criminal offences",
        ]} />
        <AlertBox type="warning">
          Your activity on this platform is fully monitored and logged. Any misuse will be detected and may be used as evidence in disciplinary and criminal proceedings.
        </AlertBox>
      </Section>

      <Section id="account-suspension" title="14. Account Suspension">
        <Para>A user account may be suspended (temporarily deactivated) by an authorised administrator in the following circumstances:</Para>
        <Ul items={[
          "Officer is placed under departmental suspension or inquiry",
          "Suspected compromise of credentials or suspected unauthorised account use",
          "Detection of anomalous or suspicious platform activity associated with the account",
          "Officer is on extended leave and the account presents a security risk",
          "Officer's security clearance is under review or has been temporarily withdrawn",
          "Repeated violation of these Terms of Use",
        ]} />
        <Para>
          A suspended officer will be unable to access the platform and will be notified through official channels. Account suspension does not automatically constitute a finding of misconduct. Suspended accounts may be reinstated by an authorised administrator upon resolution of the relevant matter.
        </Para>
      </Section>

      <Section id="termination" title="15. Account Termination">
        <Para>A user account will be permanently terminated in the following circumstances:</Para>
        <Ul items={[
          "Officer retires, resigns, or is dismissed from Karnataka State Police service",
          "Officer is convicted of a criminal offence rendering them ineligible for continued access",
          "Officer is permanently transferred to a position that does not require access to the O.R.C.A platform",
          "Confirmed serious misuse of the platform, including data exfiltration, unauthorised access, or fraud",
          "ISD determination that the account poses an unacceptable security risk",
        ]} />
        <Para>
          Terminated accounts are deactivated and their access tokens invalidated immediately. Account data is retained as per the data retention schedule for audit and legal purposes. The officer's access cannot be restored after termination without a fresh application and full vetting process.
        </Para>
      </Section>

      <Section id="cybersecurity" title="16. Cybersecurity Policy">
        <Para>
          In accordance with the Ministry of Home Affairs Cybersecurity Policy for Law Enforcement Agencies and the National Cyber Security Policy, all O.R.C.A users are bound by the following:
        </Para>
        <Ul items={[
          "Users must not use personal devices (personal laptops, mobile phones, USB drives) to access or store platform data unless explicitly authorised by ISD",
          "Users must not connect to the platform through unsecured or public Wi-Fi networks",
          "Users must keep their workstations updated with the latest approved security patches",
          "Users must not install or execute unauthorised software on workstations used to access the platform",
          "Users must report all cybersecurity incidents, including phishing attempts, malware, and suspected data breaches, to the ISD Help Desk within 2 hours of discovery",
          "Users must not attempt to access any O.R.C.A API endpoint, database, or infrastructure component directly — all access must be through the authorised web interface",
          "Sharing of session tokens, API keys, or authentication credentials is strictly prohibited",
        ]} />
      </Section>

      <Section id="legal-compliance" title="17. Legal Compliance">
        <Para>Use of the O.R.C.A platform is governed by and must comply with the following legislation and regulations:</Para>
        <Grid>
          <InfoCard label="INFORMATION TECHNOLOGY ACT" value="Information Technology Act, 2000 (as amended by the IT Amendment Act, 2008)" />
          <InfoCard label="IT RULES 2011" value="IT (Reasonable Security Practices and Procedures) Rules, 2011" />
          <InfoCard label="OFFICIAL SECRETS ACT" value="Official Secrets Act, 1923 — all platform data is official government information" />
          <InfoCard label="KARNATAKA POLICE ACT" value="Karnataka Police Act, 1963 — officer conduct standards apply to platform use" />
          <InfoCard label="DIGITAL DATA PROTECTION" value="Digital Personal Data Protection Act, 2023 (applicable provisions)" />
          <InfoCard label="CRPC / BNSS" value="Bharatiya Nagarik Suraksha Sanhita, 2023 — evidentiary standards for digital records" />
        </Grid>
      </Section>

      <Section id="disclaimer" title="18. Disclaimer">
        <Para>
          The O.R.C.A platform is provided in its current operational state by the Karnataka State Police. While every effort is made to ensure the accuracy, reliability, and security of the platform:
        </Para>
        <Ul items={[
          "The Government of Karnataka and Karnataka State Police do not warrant that the platform will be uninterrupted, error-free, or completely secure at all times",
          "AI-generated analysis and recommendations are provided as investigative aids only and must not be treated as authoritative findings",
          "Intelligence data on the platform reflects the best available information at the time of entry and may be subject to change as investigations progress",
          "The platform is not a substitute for proper investigative process, legal advice, or judicial determination",
          "Data accuracy depends on the integrity of information entered by authorised users — the platform cannot guarantee the accuracy of user-entered data",
        ]} />
      </Section>

      <Section id="liability" title="19. Limitation of Liability">
        <Para>
          The Government of Karnataka, Karnataka State Police, and all officers and employees involved in the development and operation of the O.R.C.A platform shall not be liable for:
        </Para>
        <Ul items={[
          "Any direct, indirect, incidental, or consequential loss arising from the use of, or inability to use, the platform",
          "Errors or omissions in platform data that arise from information entered by authorised users",
          "Temporary service outages or interruptions due to maintenance, infrastructure issues, or security measures",
          "Inaccuracies in AI-generated analysis that an officer relied upon without independent verification",
          "Actions taken by officers based on their use of platform data that were inconsistent with their authorised mandate",
        ]} />
        <Para>
          This limitation of liability does not extend to acts of negligence or wilful misconduct by government officials, which are subject to applicable laws and departmental accountability mechanisms.
        </Para>
      </Section>

      <Section id="policy-updates" title="20. Policy Updates">
        <Para>
          These Terms of Use are reviewed and updated periodically by the ISD under the authority of the Director General &amp; Inspector General of Police, Karnataka. Changes may be made to reflect changes in platform functionality, applicable law, or government policy.
        </Para>
        <Para>
          Authorised users will be notified of material changes through the platform notification system and official ISD communications. Continued use of the platform following the effective date of any revision constitutes acceptance of the updated Terms.
        </Para>
        <Para>
          The version number and last updated date displayed at the top of this document indicate the current authorised version. All historical versions are maintained in the ISD Records Repository.
        </Para>
      </Section>

      <Section id="contact" title="21. Contact Information">
        <Para>For questions or concerns relating to these Terms of Use, or to report a violation, contact:</Para>
        <Grid>
          <InfoCard label="ISD HELP DESK" value="+91-80-2294-3000 (24×7 Security Line)" accent />
          <InfoCard label="EMAIL" value="isd.helpdesk@ksp.gov.in" accent />
          <InfoCard label="COMPLIANCE OFFICER" value="DSP (Legal & Compliance), ISD, Karnataka State Police" accent />
          <InfoCard label="ADDRESS" value="ISD Cell, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001" accent />
          <InfoCard label="MISUSE REPORTING" value="isd.security@ksp.gov.in (confidential)" accent />
          <InfoCard label="RTI QUERIES" value="See RTI page for Public Information Officer details" accent />
        </Grid>
      </Section>

    </LegalPageLayout>
  );
}

