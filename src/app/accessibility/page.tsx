"use client";

import LegalPageLayout, {
  Section, Para, Ul, InfoCard, Grid, AlertBox, TocEntry, LegalPageMeta,
} from "@/components/legal/LegalPageLayout";

const META: LegalPageMeta = {
  badge:           "ACCESSIBILITY",
  title:           "Accessibility Statement",
  subtitle:        "O.R.C.A Platform — Organized Crime Analysis Authority, Karnataka State Police",
  version:         "v1.2.0",
  lastUpdated:     "01 July 2026",
  approvedBy:      "PIO & Compliance Cell, KSP",
  applicableSince: "01 January 2024",
  authority:       "KSP-Compliance",
};

const TOC: TocEntry[] = [
  { id: "commitment",         label: "1. Our Commitment",                level: 1 },
  { id: "standards",          label: "2. Accessibility Standards",        level: 1 },
  { id: "features",           label: "3. Accessibility Features",        level: 1 },
  { id: "screen-readers",     label: "   Screen Reader Compatibility",    level: 2 },
  { id: "keyboard-nav",       label: "   Keyboard Navigation",            level: 2 },
  { id: "reflow-contrast",    label: "   Contrast & Typography",          level: 2 },
  { id: "non-accessible",     label: "4. Non-accessible Content",         level: 1 },
  { id: "tech-specs",         label: "5. Technical Specifications",       level: 1 },
  { id: "feedback",           label: "6. Feedback & Contact",             level: 1 },
  { id: "govt-directives",    label: "7. Government Directives",          level: 1 },
];

export default function AccessibilityPage() {
  return (
    <LegalPageLayout meta={META} toc={TOC}>

      <Section id="commitment" title="1. Our Commitment">
        <AlertBox type="note">
          This Accessibility Statement applies to all modules, pages, and interactive features of the O.R.C.A platform. We are committed to ensuring our internal systems are usable by all police personnel, regardless of physical ability or assistive technology needs.
        </AlertBox>
        <Para>
          The Organized Crime Analysis Authority (O.R.C.A) of the Karnataka State Police (KSP) is dedicated to designing digital tools that are accessible, inclusive, and user-friendly. We believe that technology should empower every officer to perform their operational duties efficiently and without barriers.
        </Para>
        <Para>
          We are actively working to align the platform with international accessibility guidelines and national web accessibility directives to ensure a seamless experience for all users, including officers with visual, auditory, motor, or cognitive impairments.
        </Para>
      </Section>

      <Section id="standards" title="2. Accessibility Standards">
        <Para>
          The O.R.C.A platform has been developed with reference to the following accessibility standards:
        </Para>
        <Ul items={[
          "Web Content Accessibility Guidelines (WCAG) 2.1 Level AA conformance standards.",
          "Guidelines for Indian Government Websites (GIGW) established by the National Informatics Centre (NIC).",
          "Section 508 of the US Rehabilitation Act standards for electronic information systems.",
          "Rights of Persons with Disabilities Act, 2016 (Indian statutory accessibility mandates).",
        ]} />
        <Para>
          Our development lifecycle incorporates automated accessibility scanning, keyboard-only testing cycles, and reviews using screen readers to monitor compliance continuously.
        </Para>
      </Section>

      <Section id="features" title="3. Accessibility Features">
        <Para>
          The platform incorporates several built-in design adaptations to facilitate ease of use for officers using assistive technology:
        </Para>

        <Section id="screen-readers" title="3.1 Screen Reader Compatibility" level={2}>
          <Para>
            The O.R.C.A user interface is optimized for common screen reading software:
          </Para>
          <Ul items={[
            "Semantic HTML5 markers (main, nav, section, article, header, footer) are used throughout.",
            "WAI-ARIA roles, states, and properties describe complex dynamic elements (tabs, modals, alerts).",
            "Alternative text ('alt' descriptions) is provided for all essential informational images, badges, and icons.",
            "Form controls are associated with clear labels and error messages for linear screen-reader navigation.",
          ]} />
        </Section>

        <Section id="keyboard-nav" title="3.2 Keyboard Navigation" level={2}>
          <Para>
            All critical workflows on the platform are accessible using a standard keyboard alone:
          </Para>
          <Ul items={[
            "Logical tab order guides focus naturally through sections, tables, and form inputs.",
            "A clearly visible focus indicator highlights the active element as you navigate.",
            "Keyboard shortcuts and focus bypass links are supported to jump directly to primary content blocks.",
            "Interactive components like dialog boxes, dropdowns, and sidebar menus respond to Escape, Space, and Arrow keys.",
          ]} />
        </Section>

        <Section id="reflow-contrast" title="3.3 Contrast & Typography" level={2}>
          <Para>
            Visual layouts are designed with contrast and text-scaling flexibility:
          </Para>
          <Ul items={[
            "Text and background colors meet minimum WCAG contrast ratios of 4.5:1 for standard text and 3:1 for large text.",
            "Flexible page layouts support zoom and text-resizing up to 200% without loss of content structure or side-scrolling overlap.",
            "System warnings, alerts, and badges use distinct typography and layout cues, ensuring information is never communicated solely by color.",
            "Clean sans-serif fonts ('Inter') are utilized for body copy to enhance readability for low-vision and dyslexic users.",
          ]} />
        </Section>
      </Section>

      <Section id="non-accessible" title="4. Non-accessible Content">
        <Para>
          Despite our efforts, some advanced modules rely on complex visualizations that present inherent accessibility challenges:
        </Para>
        <Ul items={[
          "Geospatial Heatmaps — District threat and crime maps use complex color shading and density plots that may be difficult to interpret visually. Alternative text summaries and tabular reports are provided as accessible options.",
          "Suspect Relationship Networks — Dynamic node-link analysis diagrams represent complex networks. Standard structured data lists are provided as an accessible alternative view.",
          "High-Frequency Telemetry Charts — Real-time performance and log charts present continuous visual updates. Tabular exports (CSV/Excel) are available for all chart data.",
        ]} />
        <AlertBox type="warning">
          If you encounter any specific operational block while using these visualization tools, please request the equivalent text report from the compliance cell or use the platform's export feature to view data in standard tabular formats.
        </AlertBox>
      </Section>

      <Section id="tech-specs" title="5. Technical Specifications">
        <Para>
          Accessibility features of the O.R.C.A platform rely on the following baseline browser technologies to support assistive software:
        </Para>
        <Grid>
          <InfoCard label="HTML & CSS" value="HTML5 structure & CSS3 responsive flex/grid layouts" />
          <InfoCard label="ARIA SUITE" value="WAI-ARIA 1.1 accessibility tags" />
          <InfoCard label="JAVASCRIPT" value="React/Next.js dynamic rendering & keyboard handlers" />
          <InfoCard label="SUPPORTED BROWSERS" value="Google Chrome (latest), Microsoft Edge (latest), Mozilla Firefox (latest)" />
          <InfoCard label="COMPATIBLE SCREEN READERS" value="NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS)" />
          <InfoCard label="MINIMUM RESOLUTION" value="1024×768 pixels with zoom support" />
        </Grid>
      </Section>

      <Section id="feedback" title="6. Feedback & Contact">
        <Para>
          We welcome your feedback on the accessibility of the O.R.C.A platform. If you encounter any accessibility barriers, please contact our Compliance Officer:
        </Para>
        <Grid>
          <InfoCard label="ACCESSIBILITY OFFICER" value="DSP (Compliance Cell), ISD, Karnataka State Police" accent />
          <InfoCard label="EMAIL" value="isd.compliance@ksp.gov.in" accent />
          <InfoCard label="PHONE" value="+91-80-2294-3000 (Ext. 408)" accent />
          <InfoCard label="POSTAL ADDRESS" value="Compliance Cell, Police Headquarters, Nrupathunga Road, Bengaluru – 560 001" accent />
          <InfoCard label="OFFICE HOURS" value="Monday to Friday, 10:00 AM – 5:00 PM IST" accent />
          <InfoCard label="RESPONSE TIMELINE" value="Grievances are acknowledged within 3 working days and addressed within 15 working days" accent />
        </Grid>
      </Section>

      <Section id="govt-directives" title="7. Government Directives">
        <Para>
          This Accessibility Statement is aligned with the following government frameworks:
        </Para>
        <Grid>
          <InfoCard label="NATIONAL MANDATE" value="Guidelines for Indian Government Websites (GIGW) v2.0" />
          <InfoCard label="LEGISLATION" value="Rights of Persons with Disabilities Act, 2016" />
          <InfoCard label="CERTIFICATION" value="Evaluated in accordance with GIGW Checklist requirements" />
          <InfoCard label="MONITORING" value="Annual accessibility compliance review by KSP ISD" />
        </Grid>
      </Section>

    </LegalPageLayout>
  );
}
