"use client";

import LegalPageLayout, {
  Section, Para, Ul, InfoCard, Grid, AlertBox, TocEntry, LegalPageMeta,
} from "@/components/legal/LegalPageLayout";

const META: LegalPageMeta = {
  badge:           "RIGHT TO INFORMATION",
  title:           "Right to Information (RTI)",
  subtitle:        "O.R.C.A Platform — Organized Crime Analysis Authority, Karnataka State Police",
  version:         "v1.4.0",
  lastUpdated:     "01 July 2026",
  approvedBy:      "PIO, KSP — DGP Office, Government of Karnataka",
  applicableSince: "01 January 2024",
  authority:       "KSP-PIO",
};

const TOC: TocEntry[] = [
  { id: "introduction",      label: "1. Introduction",                    level: 1 },
  { id: "purpose",           label: "2. Purpose",                         level: 1 },
  { id: "pio",               label: "3. Public Information Officer",      level: 1 },
  { id: "apio",              label: "4. Asst. Public Information Officer", level: 1 },
  { id: "faa",               label: "5. First Appellate Authority",        level: 1 },
  { id: "how-to-submit",     label: "6. How to Submit RTI Requests",      level: 1 },
  { id: "available-info",    label: "7. Available Information",            level: 1 },
  { id: "documents",         label: "   Documents Available",              level: 2 },
  { id: "contact",           label: "8. Contact Information",              level: 1 },
  { id: "applicable-law",    label: "9. Applicable RTI Act",               level: 1 },
  { id: "govt-guidelines",   label: "10. Government Guidelines",           level: 1 },
  { id: "rti-forms",         label: "11. RTI Forms",                       level: 1 },
  { id: "faq",               label: "12. Frequently Asked Questions",      level: 1 },
  { id: "timelines",         label: "13. Response Timelines",              level: 1 },
  { id: "appeal",            label: "14. Appeal Process",                  level: 1 },
  { id: "notices",           label: "15. Important Notices",               level: 1 },
];

// Sub-section without id for nested rendering
function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div style={{
      borderRadius: 6, border: "1px solid #cbd5e1",
      padding: "14px 16px", marginBottom: 10,
      background: "#ffffff",
    }}>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#001f3f", margin: "0 0 6px 0" }}>Q: {q}</p>
      <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.7 }}>A: {a}</p>
    </div>
  );
}

function Timeline({ step, days, description }: { step: string; days: string; description: string }) {
  return (
    <div style={{
      display: "flex", gap: 16, alignItems: "flex-start",
      padding: "12px 14px", borderRadius: 6,
      background: "#f8fafc", border: "1px solid #cbd5e1", marginBottom: 10,
    }}>
      <div style={{
        flexShrink: 0, width: 48, height: 48, borderRadius: "50%",
        background: "#001f3f", color: "#FF9933",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: 11,
        textAlign: "center", lineHeight: 1.2,
      }}>
        {days}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#001f3f", margin: "0 0 4px 0" }}>{step}</p>
        <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6 }}>{description}</p>
      </div>
    </div>
  );
}

export default function RTIPage() {
  return (
    <LegalPageLayout meta={META} toc={TOC}>

      <Section id="introduction" title="1. Introduction">
        <AlertBox type="note">
          The Right to Information Act, 2005 mandates public authorities to maintain records in a manner that facilitates easy access to information. This page provides all information required by citizens and authorised parties to exercise their RTI rights with respect to the O.R.C.A platform and Karnataka State Police ISD activities.
        </AlertBox>
        <Para>
          The Right to Information Act, 2005 (RTI Act) is a landmark piece of Indian legislation that empowers citizens to access information held by public authorities. Karnataka State Police, as a public authority under the Act, is required to provide information to citizens who submit valid RTI applications, subject to exemptions provided under Section 8 of the RTI Act.
        </Para>
        <Para>
          The O.R.C.A (Organized Crime Analysis Authority) platform is an internal law enforcement tool operated by the Karnataka State Police Internal Security Division. Information pertaining to the administration of this platform — including policies, procedures, expenditure, and non-sensitive administrative data — is accessible to citizens via the RTI process, subject to applicable exemptions.
        </Para>
        <Para>
          Information that is exempt from disclosure under the RTI Act includes, but is not limited to, information that would prejudice national security, law enforcement operations, the safety of informants, ongoing investigations, or individual privacy rights.
        </Para>
      </Section>

      <Section id="purpose" title="2. Purpose">
        <Para>This RTI page has been created to:</Para>
        <Ul items={[
          "Provide citizens and authorised parties with clear guidance on how to submit RTI requests to Karnataka State Police with respect to the O.R.C.A platform and ISD operations",
          "Identify the designated Public Information Officer (PIO), Assistant PIO, and First Appellate Authority for RTI matters",
          "List categories of information available for disclosure under the RTI Act",
          "Explain the process for appealing RTI decisions",
          "Provide response timelines as mandated by the RTI Act",
          "Facilitate proactive disclosure of non-sensitive administrative information in accordance with Section 4 of the RTI Act",
        ]} />
      </Section>

      <Section id="pio" title="3. Public Information Officer (PIO)">
        <Para>
          The designated Public Information Officer for RTI requests relating to the O.R.C.A platform and Karnataka State Police Internal Security Division is:
        </Para>
        <Grid>
          <InfoCard label="DESIGNATION" value="Deputy Superintendent of Police (Technology & Records), ISD" accent />
          <InfoCard label="DEPARTMENT" value="Internal Security Division, Karnataka State Police" accent />
          <InfoCard label="EMAIL" value="rti.pio@ksp.gov.in" accent />
          <InfoCard label="PHONE" value="+91-80-2294-3012" accent />
          <InfoCard label="OFFICE ADDRESS" value="ISD Block, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001" accent />
          <InfoCard label="OFFICE TIMINGS" value="Monday to Friday, 10:00 AM – 5:00 PM IST (except public holidays)" accent />
        </Grid>
        <Para>
          The PIO is responsible for receiving RTI applications, providing information within the statutory time limit, and communicating decisions (including partial or full denial with reasons) to the applicant.
        </Para>
      </Section>

      <Section id="apio" title="4. Assistant Public Information Officer (APIO)">
        <Para>
          RTI applications may also be submitted to the designated Assistant Public Information Officer, who will forward them to the PIO:
        </Para>
        <Grid>
          <InfoCard label="DESIGNATION" value="Inspector of Police (Records & Compliance), ISD" accent />
          <InfoCard label="EMAIL" value="rti.apio@ksp.gov.in" accent />
          <InfoCard label="PHONE" value="+91-80-2294-3014" accent />
          <InfoCard label="OFFICE ADDRESS" value="ISD Block, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001" accent />
          <InfoCard label="OFFICE TIMINGS" value="Monday to Friday, 10:00 AM – 5:00 PM IST (except public holidays)" accent />
        </Grid>
        <Para>
          Applications submitted to the APIO will be forwarded to the PIO within 5 working days of receipt. The RTI timeline begins from the date of receipt by the APIO.
        </Para>
      </Section>

      <Section id="faa" title="5. First Appellate Authority (FAA)">
        <Para>
          If an applicant is dissatisfied with the PIO's decision or does not receive a response within the statutory time limit, they may appeal to the First Appellate Authority:
        </Para>
        <Grid>
          <InfoCard label="DESIGNATION" value="Superintendent of Police (ISD), Karnataka State Police" accent />
          <InfoCard label="EMAIL" value="rti.appeal@ksp.gov.in" accent />
          <InfoCard label="PHONE" value="+91-80-2294-3010" accent />
          <InfoCard label="OFFICE ADDRESS" value="ISD Block, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001" accent />
          <InfoCard label="APPEAL WINDOW" value="Within 30 days of receiving the PIO's decision (or its absence)" accent />
          <InfoCard label="DECISION TIMELINE" value="Within 30 days of receiving the appeal (extendable to 45 days)" accent />
        </Grid>
      </Section>

      <Section id="how-to-submit" title="6. How to Submit RTI Requests">
        <Para>
          RTI applications may be submitted to Karnataka State Police ISD through the following channels:
        </Para>

        <Section title="6.1 Online Submission" level={2} id="online-submit">
          <Ul items={[
            "Visit the Karnataka Government RTI Online Portal at: rtionline.karnataka.gov.in",
            "Register or log in with your Aadhaar-linked credentials",
            "Select 'Karnataka State Police' as the public authority and 'ISD — O.R.C.A Platform' as the sub-department",
            "Complete the application form with your full name, contact details, and a clear description of the information requested",
            "Pay the prescribed RTI fee of ₹10 online via net banking, UPI, or debit/credit card",
            "Submit and retain the unique RTI Application Number for tracking",
          ]} />
        </Section>

        <Section title="6.2 Offline (Written) Submission" level={2} id="offline-submit">
          <Ul items={[
            "Write or type a clear application addressed to the Public Information Officer, ISD, Karnataka State Police",
            "Include your full name, address, contact number, and email address",
            "Clearly describe the specific information you are requesting — vague or overly broad requests may be returned for clarification",
            "Attach a Demand Draft or Indian Postal Order (IPO) for ₹10 drawn in favour of 'Karnataka State Police'",
            "Send by registered post or submit in person at the ISD Block, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001",
            "Obtain a receipt with a date-stamped acknowledgement for in-person submissions",
          ]} />
        </Section>

        <Section title="6.3 Fee Waiver" level={2} id="fee-waiver">
          <Para>
            The following applicants are exempt from the RTI application fee:
          </Para>
          <Ul items={[
            "Citizens Below Poverty Line (BPL) — attach a copy of BPL certificate issued by a competent authority",
            "Persons with disabilities — attach supporting documentation",
            "Applications relating to the applicant's own personal information are also subject to the standard fee unless waived by the PIO",
          ]} />
        </Section>

        <AlertBox type="note">
          Applications relating to third-party personal information, ongoing criminal investigations, intelligence sources, national security, or information exempt under Section 8 of the RTI Act may be denied. The PIO will provide written reasons for any denial or partial disclosure.
        </AlertBox>
      </Section>

      <Section id="available-info" title="7. Available Information">
        <Para>
          Karnataka State Police proactively discloses the following categories of administrative information relating to the O.R.C.A platform under Section 4(1)(b) of the RTI Act:
        </Para>
        <Ul items={[
          "General information about the purpose, scope, and operational functions of the O.R.C.A platform",
          "Policies and procedures governing officer access and the security framework (non-sensitive portions)",
          "Administrative budgetary allocations for the O.R.C.A platform (annual summary, not line-item classified expenditure)",
          "Organisational chart of the ISD Technology Cell (excluding names of officers in sensitive roles)",
          "Number of registered officers by district (aggregate, anonymised)",
          "Annual system availability and uptime statistics",
          "RTI-related decisions and orders (redacted as required for privacy and security)",
          "Procurement information for non-sensitive hardware and software components (in accordance with government procurement transparency requirements)",
        ]} />

        <Section id="documents" title="7.1 Documents Available on Request" level={2}>
          <Para>The following categories of documents may be requested via RTI, subject to exemptions:</Para>
          <Grid>
            <InfoCard label="PLATFORM POLICY DOCUMENTS" value="Privacy Policy, Terms of Use, RTI Policy (non-sensitive versions)" />
            <InfoCard label="ANNUAL REPORTS" value="ISD Technology Cell Annual Activity Report (administrative portions)" />
            <InfoCard label="GRIEVANCE RECORDS" value="RTI application and response records (your own applications only)" />
            <InfoCard label="AUDIT REPORTS" value="Non-sensitive portions of annual technology audit reports" />
            <InfoCard label="EXPENDITURE SUMMARIES" value="Aggregated platform expenditure summaries (per financial year)" />
            <InfoCard label="OFFICER STATISTICS" value="Aggregate officer registration and access statistics (non-personally-identifiable)" />
          </Grid>
          <AlertBox type="warning">
            The following are specifically exempt from RTI disclosure under Section 8 of the RTI Act: individual officer records, case data, investigation details, intelligence reports, informant information, suspect data, AI conversation records, and any data whose disclosure would endanger the safety of officers or compromise ongoing investigations.
          </AlertBox>
        </Section>
      </Section>

      <Section id="contact" title="8. Contact Information">
        <Para>All RTI-related enquiries, submissions, and appeals must be addressed to the following contacts:</Para>
        <Grid>
          <InfoCard label="PIO (MAIN)" value="DSP (Technology & Records), ISD — rti.pio@ksp.gov.in" accent />
          <InfoCard label="APIO (SUBMISSIONS)" value="Inspector (Records), ISD — rti.apio@ksp.gov.in" accent />
          <InfoCard label="FAA (APPEALS)" value="SP (ISD) — rti.appeal@ksp.gov.in" accent />
          <InfoCard label="HELPLINE" value="+91-80-2294-3012 (PIO Direct)" accent />
          <InfoCard label="POSTAL ADDRESS" value="ISD Block, Police HQ, Nrupathunga Road, Bengaluru – 560 001, Karnataka, India" accent />
          <InfoCard label="OFFICE TIMINGS" value="Monday–Friday, 10:00 AM – 5:00 PM IST (Government holidays excluded)" accent />
        </Grid>
      </Section>

      <Section id="applicable-law" title="9. Applicable RTI Act">
        <Para>RTI requests to Karnataka State Police are governed by:</Para>
        <Grid>
          <InfoCard label="PRIMARY LEGISLATION" value="Right to Information Act, 2005 (Central Act No. 22 of 2005)" />
          <InfoCard label="STATE RULES" value="Karnataka Right to Information Rules, 2005" />
          <InfoCard label="NODAL MINISTRY" value="Ministry of Personnel, Public Grievances and Pensions, Government of India" />
          <InfoCard label="STATE NODAL BODY" value="Karnataka Information Commission (KIC)" />
          <InfoCard label="KIC ADDRESS" value="Karnataka Information Commission, M.S. Building, Bengaluru – 560 001" />
          <InfoCard label="KIC WEBSITE" value="kic.karnataka.gov.in" />
        </Grid>
        <Para>
          The RTI Act guarantees every citizen of India the right to access information held by public authorities. However, certain categories of information are exempted from disclosure under Section 8 of the Act, including information that affects national security, sovereignty, strategic interests, law enforcement operations, and individual privacy.
        </Para>
        <Para>
          Information held by Karnataka State Police and the ISD in connection with its law enforcement functions is subject to several Section 8 exemptions. The PIO will assess each application on its merits and provide written reasons for any denial or partial disclosure.
        </Para>
      </Section>

      <Section id="govt-guidelines" title="10. Government Guidelines">
        <Para>
          Karnataka State Police's RTI compliance is governed by the following government directives and guidelines:
        </Para>
        <Ul items={[
          "Department of Personnel and Training (DoPT) Guidelines on Implementation of RTI Act, 2005",
          "Karnataka Information Commission — Standard Operating Procedures for Public Authorities",
          "Ministry of Home Affairs Circular on RTI Handling by Law Enforcement Agencies (MHA/RTI/2019/01)",
          "Government of Karnataka e-Governance Department: Digital RTI Implementation Guidelines",
          "CIC (Central Information Commission) Decision Guidelines applicable to central and state public authorities",
          "Section 4(1)(b) compliance — Proactive disclosure of 17 categories of institutional information",
          "Annual RTI Return submission to Karnataka Information Commission as mandated by Rule 12 of Karnataka RTI Rules, 2005",
        ]} />
      </Section>

      <Section id="rti-forms" title="11. RTI Forms & Downloads">
        <Para>
          The following RTI-related forms and resources are available for download. Click the relevant link to download from the official Karnataka Government portal.
        </Para>
        <Grid>
          <InfoCard label="FORM A — RTI APPLICATION" value="Standard RTI Application Form (English & Kannada)" />
          <InfoCard label="FORM B — APPEAL FORM" value="First Appeal Form to the First Appellate Authority" />
          <InfoCard label="FORM C — SECOND APPEAL" value="Second Appeal / Complaint Form to Karnataka Information Commission" />
          <InfoCard label="FEE GUIDE" value="RTI Fee Structure and Payment Instructions" />
          <InfoCard label="BPL EXEMPTION" value="BPL Fee Waiver Application and Required Documents" />
          <InfoCard label="SAMPLE REQUEST" value="Sample RTI Application for Reference" />
        </Grid>
        <AlertBox type="note">
          Online RTI submission is available through the Karnataka Government RTI Portal (rtionline.karnataka.gov.in). Digital submission is the fastest and most trackable method. Physical forms are available at the ISD Block reception and all district Superintendent of Police offices during working hours.
        </AlertBox>
        <Para>
          <strong>Note:</strong> A dedicated digital download portal for RTI forms is planned for integration into this page in the next platform release. Until then, forms are available at the ISD Block reception and at rtionline.karnataka.gov.in.
        </Para>
      </Section>

      <Section id="faq" title="12. Frequently Asked Questions">
        <FAQ
          q="Can I request individual officer records through RTI?"
          a="No. Individual officer records, including personnel files, service records, disciplinary history, and contact details of serving officers in sensitive positions, are exempt from RTI disclosure under Section 8(1)(j) of the RTI Act (privacy of individuals) and MHA guidelines for law enforcement personnel."
        />
        <FAQ
          q="Can I request case file data or FIR details through RTI?"
          a="FIR information is available at the police station level as required by the Supreme Court's directions. However, detailed case investigation data, intelligence gathered, informant details, and ongoing investigation files are exempt under Section 8(1)(h) (impeding investigation) and Section 8(1)(g) (endangering safety of sources)."
        />
        <FAQ
          q="Can I access the AI system's conversation logs through RTI?"
          a="AI conversation data is cleared at session end and is not permanently retained as a searchable record. Session-level audit log entries (which record that an AI session occurred, the officer, and timestamps — not the content of conversations) may be accessible for your own account records."
        />
        <FAQ
          q="I am a Karnataka police officer. Can I request my own platform audit logs?"
          a="Yes. Officers may request a summary of their own platform activity audit logs through the Data Protection Officer (see Privacy Policy) or via a formal RTI application. Your own records are accessible subject to the applicable data retention period."
        />
        <FAQ
          q="What happens if the PIO does not respond within 30 days?"
          a="If no response is received within 30 days (or 48 hours for life and liberty matters), the request is deemed refused. You may then file a First Appeal with the First Appellate Authority within 30 days, or directly complain to the Karnataka Information Commission."
        />
        <FAQ
          q="Can I submit an RTI request in Kannada?"
          a="Yes. RTI applications may be submitted in Kannada or English. If submitted in any other language, the applicant must provide an English or Kannada translation. The PIO's response will be in Kannada or English."
        />
        <FAQ
          q="Is there a fee for RTI applications?"
          a="The standard RTI application fee is ₹10 (ten rupees), payable as a Demand Draft, Indian Postal Order, or online through the Karnataka Government RTI portal. BPL cardholders are exempt from the fee with proof of BPL status."
        />
        <FAQ
          q="How can I track my RTI application status?"
          a="Applications submitted through the Karnataka Government RTI Portal (rtionline.karnataka.gov.in) can be tracked online using your application number. For postal applications, contact the APIO at rti.apio@ksp.gov.in with your application date and subject for status enquiries."
        />
      </Section>

      <Section id="timelines" title="13. Response Timelines">
        <Para>
          The following timelines are mandated by the RTI Act, 2005 and applicable to all RTI requests to Karnataka State Police:
        </Para>
        <Timeline
          step="Application Receipt Acknowledgement"
          days="Day 1"
          description="Receipt of RTI application by PIO or APIO. A written or electronic acknowledgement with application reference number is issued."
        />
        <Timeline
          step="Standard Response Deadline"
          days="30 Days"
          description="The PIO must provide the requested information, or communicate denial (with reasons), within 30 days of receipt of the application."
        />
        <Timeline
          step="Life & Liberty Matters"
          days="48 Hrs"
          description="Where the requested information concerns the life or liberty of a person, the PIO must respond within 48 hours of receiving the application."
        />
        <Timeline
          step="Third-Party Information"
          days="40 Days"
          description="Where the application requests information that concerns a third party (another individual), the PIO may take up to 40 days to respond after giving the third party an opportunity to be heard."
        />
        <Timeline
          step="First Appeal Decision"
          days="30–45 Days"
          description="The First Appellate Authority must decide the appeal within 30 days of receipt, extendable to 45 days with written reasons."
        />
        <Timeline
          step="Second Appeal / KIC Complaint"
          days="As per KIC"
          description="Second appeals to the Karnataka Information Commission are decided within 90 days of receipt (extendable). KIC hearings are conducted in Bengaluru."
        />
        <AlertBox type="warning">
          Failure by the PIO to provide information within the statutory deadline is deemed a deemed refusal and entitles the applicant to file a First Appeal immediately. Persistent non-compliance may attract penalty proceedings before the Karnataka Information Commission.
        </AlertBox>
      </Section>

      <Section id="appeal" title="14. Appeal Process">
        <Para>
          If you are dissatisfied with the PIO's response, or if no response is received within the statutory time limit, you have the right to appeal through the following process:
        </Para>

        <Section title="14.1 First Appeal" level={2} id="first-appeal">
          <Ul items={[
            "File a written First Appeal to the First Appellate Authority (SP-ISD) within 30 days of receiving the PIO's decision (or the expiry of the 30-day response period)",
            "Address the appeal to: SP (ISD), Karnataka State Police, ISD Block, Police HQ, Nrupathunga Road, Bengaluru – 560 001",
            "Email: rti.appeal@ksp.gov.in",
            "The appeal must state your RTI application number, the PIO's decision (or non-response), and the grounds for appeal",
            "Attach a copy of your original application and the PIO's response (if any)",
            "No fee is payable for First Appeals",
            "The FAA will issue a decision within 30 days (extendable to 45 days)",
          ]} />
        </Section>

        <Section title="14.2 Second Appeal to Karnataka Information Commission" level={2} id="second-appeal">
          <Ul items={[
            "If you are dissatisfied with the FAA's decision, or if the FAA does not respond within the statutory period, you may file a Second Appeal with the Karnataka Information Commission (KIC)",
            "The Second Appeal must be filed within 90 days of the FAA's decision (or the expiry of the FAA's response period)",
            "Karnataka Information Commission, M.S. Building, Dr. Ambedkar Veedhi, Bengaluru – 560 001",
            "Website: kic.karnataka.gov.in | Helpline: 1800-425-0501",
            "The KIC may award compensation and impose penalties on erring PIOs for non-compliance",
          ]} />
        </Section>

        <Section title="14.3 CIC (Central Information Commission)" level={2} id="cic">
          <Para>
            Since Karnataka State Police is a state public authority, appeals beyond the KIC level may in certain circumstances be taken to the High Court of Karnataka through a writ petition challenging the KIC's decision. RTI-related disputes are not within the jurisdiction of the Central Information Commission (CIC) for state authorities.
          </Para>
        </Section>
      </Section>

      <Section id="notices" title="15. Important Notices">
        <AlertBox type="important">
          <strong>Security Exemption Notice:</strong> A significant portion of the information held by the ISD in connection with the O.R.C.A platform relates to active law enforcement operations, criminal intelligence, informant networks, and ongoing investigations. Such information is exempt from RTI disclosure under Section 8(1)(a), (b), (g), and (h) of the RTI Act. The PIO will provide written reasons for any claim of exemption.
        </AlertBox>

        <AlertBox type="warning">
          <strong>Misuse of RTI:</strong> RTI is a citizen's right, not a tool for fishing for intelligence or law enforcement operational data. Applications that seek to extract information about ongoing investigations, the identity of police informants, or details of intelligence operations will be declined and may be referred to appropriate authorities if they appear designed to obstruct justice or endanger officers.
        </AlertBox>

        <AlertBox type="note">
          <strong>Proactive Disclosure:</strong> In accordance with Section 4(1)(b) of the RTI Act, Karnataka State Police publishes an annual handbook of suo-motu disclosed information on the KSP website (ksp.gov.in). Citizens are encouraged to review the proactive disclosure before filing an RTI application, as the information may already be publicly available.
        </AlertBox>

        <Para>
          <strong>Annual RTI Statistics (FY 2025–26):</strong>
        </Para>
        <Grid>
          <InfoCard label="APPLICATIONS RECEIVED" value="187" accent />
          <InfoCard label="FULLY DISCLOSED" value="94" accent />
          <InfoCard label="PARTIALLY DISCLOSED" value="41" accent />
          <InfoCard label="EXEMPTED / DENIED" value="38" accent />
          <InfoCard label="PENDING (AS OF MARCH 2026)" value="14" accent />
          <InfoCard label="FIRST APPEALS RECEIVED" value="23" accent />
        </Grid>
      </Section>

    </LegalPageLayout>
  );
}

