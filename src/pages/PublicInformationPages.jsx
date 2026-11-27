import { useMemo, useState } from "react";
import { href, Link } from "react-router-dom";
import { PublicSiteFooter, PublicSiteHeader } from "../components/PublicSiteChrome";
import { API_BASE } from "./restaurantApi";
import { usePublicMetadata } from "./usePublicMetadata";
import "./PublicInformationPages.css";

const faqCategories = [
  {
    title: "General",
    questions: [
      ["What is TexOS?", "TexOS is a restaurant management SaaS platform designed to simplify restaurant operations through digital menus, QR-based dining, kitchen management, customer loyalty, and payment management."],
      ["How does TexOS work?", "TexOS gives restaurant owners a centralized dashboard for supported operations. Customers can scan a restaurant table QR code to view its digital menu, while authorized restaurant staff can use dedicated interfaces for supported tasks."],
      ["Do customers need to install an application?", "No. Customers can open supported restaurant digital menus in a mobile browser by scanning the restaurant's QR code."],
      ["Is TexOS compatible with mobile devices?", "TexOS provides responsive interfaces intended to work on smartphones, tablets, and desktop devices. Availability can vary by device and browser."],
      ["Is TexOS suitable for all types of restaurants?", "TexOS is designed for restaurants that want to digitize their menus and streamline supported operations. Feature availability may depend on the subscription plan."],
      ["Is customer registration mandatory to view a digital menu?", "No. Customers can browse supported digital menus without registering. Login may be needed for personalized loyalty features."],
    ],
  },
  {
    title: "Restaurant Owners",
    questions: [
      ["How can I register my restaurant on TexOS?", "Create an account and complete the restaurant registration and onboarding steps shown in TexOS. Once setup is complete, you can access features available under your subscription."],
      ["Can I manage my restaurant menu myself?", "Yes. Owners can manage supported menu categories, items, prices, descriptions, and availability through the dashboard."],
      ["How do table-specific QR codes work?", "A table QR code identifies the associated restaurant and table so the corresponding digital menu can be opened."],
      ["Can I update my menu after generating QR codes?", "Yes. Ordinary menu changes made in the owner dashboard are reflected in the digital menu; new QR codes are not normally needed for those changes."],
      ["Can I give my kitchen staff separate access?", "Yes. Owners can grant and revoke kitchen staff access through the available access management feature. Access is subject to the configured security controls."],
      ["Does TexOS support online payments right now?", "Online payment gateway integration is currently not implemented on TexOS and will be introduced in a future update. At present, restaurants settle bills directly with customers offline or through their own in-person methods."],
      ["Can customers pay offline?", "Yes. Customers can coordinate bill settlement directly with restaurant staff at the table or counter."],
      ["What subscription plans does TexOS offer?", "TexOS offers subscription plans. Current pricing, eligibility, and feature availability are shown on the Pricing page."],
      ["Can I upgrade or change my subscription plan?", "Eligible plan changes can be made using the subscription options available to the restaurant in TexOS."],
      ["What happens when my subscription expires?", "Access to subscription-restricted features may be limited until the subscription is renewed or changed. Data handling is subject to the applicable retention policy and Terms."],
      ["Can I manage my restaurant staff through TexOS?", "Owners can manage staff access using the staff management features available for their restaurant and subscription."],
      ["How can I contact TexOS support?", "Use the Contact Us page to review the available contact options. Support contact details must be published there after they have been verified by TexOS."],
    ],
  },
];

const legalPages = {
  "/privacy-policy": {
    title: "Privacy Policy",
    description: "How TexOS handles personal data in accordance with India's DPDP Act, 2023 and IT Act, 2000.",
    intro: "This Privacy Policy explains how TexOS collects, uses, stores, and protects personal data when restaurant owners, staff, and diners use the TexOS website, owner dashboard, and digital menu services. This policy is structured in alignment with the Information Technology Act, 2000 (and rules thereunder) and the Digital Personal Data Protection Act, 2023 (DPDP Act) read with the DPDP Rules, 2025.",
    sections: [
      [
        "1. Roles: Data Fiduciary and Data Processor",
        "For account, onboarding, and platform-level data of restaurant owners and website visitors, TexOS acts as a Data Fiduciary under the DPDP Act, 2023.\nWhen a restaurant uses TexOS to manage its digital menus, customer orders, or loyalty programs, the restaurant acts as the primary Data Fiduciary for its diners' personal data, and TexOS acts as a Data Processor processing that data strictly on the restaurant's instructions.",
      ],
      [
        "2. Itemized Personal Data Collected",
        "Restaurant Owners & Staff: Full name, email address, phone number, password hash, Google account identity (when using Google Sign-In), restaurant business details, tax/billing preferences, staff access grants (kitchen and order-approval access), and subscription plan records.\nRestaurant Customers (Diners): Customers can browse digital menus without registering. When placing an order or joining a restaurant's loyalty program, TexOS may collect the customer's name, mobile number, optional email address, table/order details, and loyalty points or redemption history. Note: Current customer registration collects name and mobile number without SMS OTP verification; restaurants should not treat unverified numbers as KYC-verified.\nSupport & Contact Enquiries: Name, email address, subject, category, and message submitted through the Contact Us form (routed via Brevo email delivery).",
      ],
      [
        "3. Purpose of Processing & Consent",
        "Personal data is processed strictly for specified, lawful purposes: creating and securing owner/staff accounts, displaying QR-based digital menus, managing kitchen and order workflows, operating restaurant loyalty programs, responding to support/grievance requests, preventing fraud/abuse, and complying with Indian statutory obligations.\nWhere processing relies on consent, you have the right to withdraw consent at any time using the contact or grievance channels below. Withdrawal of consent does not affect the lawfulness of processing carried out prior to withdrawal.",
      ],
      [
        "4. Technical, Session, and Device Information",
        "TexOS processes essential technical data such as request timestamps, IP/rate-limiting metadata, error logs, browser type, and session identifiers to keep the platform secure and operational.\nCustomer authentication and order tracking use server-managed HTTP sessions (configured with a 60-day inactivity timeout and HttpOnly cookies), while owner, staff, and admin portals use token-based browser storage (localStorage / sessionStorage). See our Cookie Policy for full details.",
      ],
      [
        "5. Payment Information Status",
        "Online payment gateway processing is currently not implemented on TexOS and is planned for a future release.\nAt this stage, TexOS does not collect, process, or store credit/debit card numbers, UPI PINs, bank account credentials, or online payment gateway transactions. Any bill settlement between a customer and a restaurant occurs directly offline/in-person at the restaurant.",
      ],
      [
        "6. Sharing and Disclosure of Information",
        "TexOS does not sell personal data. Information is shared only with: (a) the respective restaurant when a customer places an order or participates in that restaurant's loyalty program; (b) essential infrastructure and email-delivery subprocessors (such as cloud hosting, database, and Brevo email services) bound by confidentiality and security obligations; or (c) government, law enforcement, or regulatory authorities when legally required under Indian law.",
      ],
      [
        "7. Data Retention & Deletion Schedule",
        "In accordance with Section 8(7) of the DPDP Act, 2023, personal data is erased once the specified purpose is fulfilled or consent is withdrawn, unless retention is mandated by Indian law. Where no statutory period is prescribed, TexOS follows standard production retention practices:\n• User Registration & Account Records (Post-Deletion/Cancellation): Retained for 180 days following account cancellation or deletion under Rule 3(1)(h) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, after which identifiers are purged or anonymized.\n• Invoices, Bills, Tax & Accounting Records: Retained for 8 financial years from the end of the relevant financial year under Section 128(5) of the Companies Act, 2013 and applicable Income-tax laws, and at least 72 months from the GST annual return due date under Section 36 of the CGST Act, 2017 (where applicable).\n• Active Restaurant Owner & Staff Accounts: Retained for the duration of the active account; erased or anonymized within 30 days of a verified deletion request (subject to the 180-day statutory hold and tax retention rules).\n• Customer Order & Loyalty Records: Retained while the customer actively participates in the restaurant's loyalty program or for restaurant operations; inactive records are purged or anonymized after 24 months of inactivity or upon a verified erasure request (standard production practice).\n• Security, Authentication & Rate-Limit Logs: Retained for 90 to 180 days for security monitoring and incident investigation, then automatically rotated/purged (standard production practice).\n• Customer Session Cookies: Automatically expire after 60 days of inactivity (as configured in the backend session service).\n• Password Reset Tokens & Temporary Staff Access Codes: Expire automatically within minutes/hours upon expiry or single use (standard production practice).\n• Contact & Grievance Records: Retained for up to 3 years after resolution to align with the Limitation Act, 1963 for dispute/audit traceability (standard production practice).",
      ],
      [
        "8. Security Safeguards & Breach Notification",
        "TexOS implements reasonable security practices and procedures under Section 43A of the IT Act, 2000 and Section 8(5) of the DPDP Act, 2023, including encrypted transport (HTTPS), hashed passwords, role-based access controls, and rate limiting.\nIn the event of a personal data breach, TexOS will follow its incident-response procedures and notify the Data Protection Board of India and affected individuals within statutory timelines (including the 72-hour reporting framework under the DPDP Rules, 2025) where required by law.",
      ],
      [
        "9. Rights of Data Principals (DPDP Act, 2023)",
        "Subject to applicable Indian law, you have the right to: (a) obtain a summary of your personal data being processed and processing activities; (b) request correction, completion, or updating of inaccurate personal data; (c) request erasure of personal data no longer necessary for the stated purpose; (d) withdraw consent; (e) nominate another individual to exercise your rights in the event of death or incapacity; and (f) seek grievance redressal.\nTo exercise these rights, please contact our Grievance Officer. Diners may also contact the specific restaurant directly for restaurant-managed order or loyalty data.",
      ],
      [
        "10. Children's Privacy",
        "TexOS is a B2B restaurant operations platform and is not intended for independent account creation by individuals under 18 years of age. We do not knowingly process children's personal data without verifiable parental consent as required under Section 9 of the DPDP Act, 2023, nor do we engage in tracking or targeted advertising directed at children.",
      ],
      [
        "11. Policy Updates & Grievance Contact",
        "We may update this Privacy Policy to reflect product updates (such as future payment gateway integrations) or legal changes. Material changes will be notified with an updated effective date.\nFor privacy requests or complaints, please reach out via our Grievance Redressal page or email texosservice@gmail.com.",
      ],
    ],
  },
  "/terms-and-conditions": {
    title: "Terms & Conditions",
    description: "Terms governing access to and use of the TexOS restaurant management platform under Indian law.",
    intro: "These Terms & Conditions constitute an electronic record under the Information Technology Act, 2000 and govern your access to and use of TexOS. By creating an account or using TexOS, you agree to be bound by these Terms.",
    sections: [
      [
        "1. Definitions & Scope",
        "“TexOS” refers to the restaurant management SaaS platform and its operator. “Owner” refers to a restaurant entity or its authorized representative using TexOS. “Staff” refers to kitchen or order-approval personnel authorized by an Owner. “Customer” or “Diner” refers to an end user viewing a digital menu or placing an order at a participating restaurant.",
      ],
      [
        "2. Eligibility & Account Security",
        "You must be competent to contract under the Indian Contract Act, 1872 (at least 18 years old) to register as a restaurant Owner. You are responsible for maintaining the confidentiality of your login credentials, JWT sessions, and staff access codes, and for immediately notifying TexOS of any unauthorized access.",
      ],
      [
        "3. Restaurant Owner Responsibilities",
        "Owners are solely responsible for: (a) accuracy of menu items, descriptions, allergen disclosures, pricing, and applicable GST/taxes; (b) food quality, hygiene, FSSAI compliance, and order fulfilment; (c) lawful collection and notice obligations when collecting diner details for orders or loyalty programs; and (d) granting and revoking staff access responsibly.",
      ],
      [
        "4. Customer Responsibilities",
        "Customers agree to provide accurate contact information when placing orders or using loyalty features, and to use digital menus lawfully. Because TexOS provides software tools to restaurants, any issues relating to food quality, preparation time, order modifications, or offline billing must be addressed directly with the restaurant.",
      ],
      [
        "5. Subscriptions & Payment Integration Status",
        "TexOS offers software plans for restaurant operations. Please note that online payment processing (both for automated subscription checkouts and customer online bill payments) is currently not implemented on TexOS and will be introduced in a future update.\nUntil online payment gateways are formally launched, any plan activation, trial access, or restaurant customer billing is managed without automated online payment processing through TexOS. Updated checkout, pricing, and gateway terms will be published before paid online transactions are enabled.",
      ],
      [
        "6. Acceptable Use & Prohibited Conduct",
        "In compliance with Rule 3(1)(b) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, users must not host, upload, transmit, or share any content that is unlawful, defamatory, obscene, infringing on intellectual property, deceptive, harmful to minors, or threatens the security or integrity of TexOS.",
      ],
      [
        "7. Intellectual Property",
        "All rights, title, and interest in the TexOS software, UI, branding, and codebase belong to TexOS. Owners retain ownership of their restaurant logos, menu data, and content, and grant TexOS a limited, non-exclusive license to host and display such content to operate the service.",
      ],
      [
        "8. Service Availability, Suspension & Termination",
        "TexOS may perform scheduled maintenance or update features without prior notice. TexOS reserves the right to suspend or terminate accounts that violate these Terms, pose security risks, or remain inactive, subject to applicable Indian law. Post-termination data handling is governed by our Privacy Policy.",
      ],
      [
        "9. Limitation of Liability",
        "To the maximum extent permitted under Indian law, TexOS is not liable for indirect, incidental, or consequential damages, or for restaurant food safety, order fulfilment, or offline payment disputes between restaurants and diners. Nothing in these Terms excludes liability that cannot be excluded under mandatory Indian law.",
      ],
      [
        "10. Governing Law, Jurisdiction & Grievances",
        "These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the competent courts in India where TexOS's registered office is located. For complaints or legal notices, refer to our Grievance Redressal page.",
      ],
    ],
  },
  "/refund-policy": {
    title: "Refund & Cancellation Policy",
    description: "Clear guidance on cancellations and refunds while online payments are not yet active on TexOS.",
    intro: "TexOS aims to maintain transparent cancellation and refund practices in line with the Consumer Protection Act, 2019 and Indian e-commerce standards.",
    sections: [
      [
        "1. Current Payment Status",
        "Online payment functionality is not yet implemented on TexOS and is planned for a future update.\nBecause no automated online payments are currently processed through the platform for either TexOS subscriptions or restaurant customer orders, no online charges are collected by TexOS at this time.",
      ],
      [
        "2. TexOS Subscription Cancellations",
        "Restaurant Owners may request plan cancellation or account deactivation at any time through their account settings or by writing to texosservice@gmail.com.\nOnce online subscription billing is introduced in a future update, complete cancellation windows, auto-renewal disclosures, and refund timelines (typically 5–7 business days to the original payment method upon approval) will be published here prior to launch.",
      ],
      [
        "3. Restaurant Order Cancellations & Refunds",
        "Orders placed via a restaurant's QR digital menu are fulfilled and settled directly by that restaurant.\nCustomers wishing to cancel or modify an order—or requesting a refund for an offline/in-person payment—must contact the restaurant staff directly. Each restaurant determines order cancellation and refund eligibility based on food preparation status and its own store policy.",
      ],
      [
        "4. Future Online Payments",
        "When TexOS enables third-party payment gateway integrations in a future release, this policy will be updated with dedicated workflows for failed/debited transactions, duplicate charges, and gateway settlement timelines.",
      ],
    ],
  },
  "/cookie-policy": {
    title: "Cookie Policy",
    description: "How TexOS uses essential cookies and browser storage for authentication and preferences.",
    intro: "This Cookie Policy explains the cookies and browser storage mechanisms currently used by TexOS. TexOS does not currently use third-party advertising or analytics tracking cookies.",
    sections: [
      [
        "1. What Are Cookies & Browser Storage?",
        "Cookies are small text files stored on your browser by a website. Alongside cookies, modern web apps use browser storage (localStorage and sessionStorage) to keep you signed in and remember interface preferences.",
      ],
      [
        "2. Strictly Necessary Authentication Cookies",
        "TexOS uses a server-managed HTTP session cookie (JSESSIONID / HttpSession) for customer menu sessions, order tracking, and loyalty authentication. This cookie is marked HttpOnly and configured with a maximum inactivity interval of 60 days. Because it is strictly necessary to provide the service you request, the platform cannot maintain customer order/loyalty sessions if it is blocked.",
      ],
      [
        "3. Essential Browser Storage (localStorage & sessionStorage)",
        "• Owner Portal (localStorage): Stores authentication JWT (`texos-token`), active restaurant selection, and profile metadata so owners stay logged in across page reloads.\n• Customer Menu (localStorage): Stores saved favorite items (`texos_fav_*`) and cached customer profile info (`texos_customer_*`) per restaurant QR.\n• Staff & Admin Portals (sessionStorage): Stores temporary session tokens for Kitchen Staff, Order Approval Staff, and TexOS Admin portals, which clear when the browser tab/session closes.\n• Theme Preference (localStorage): Stores light/dark mode selection (`texos-theme`).",
      ],
      [
        "4. Analytics, Marketing & Third-Party Cookies",
        "TexOS does not currently integrate Google Analytics, Meta Pixel, or advertising cookies. If you use Google Sign-In, Google may set its own authentication cookies governed by Google's Privacy Policy. If TexOS introduces non-essential analytics cookies in the future, we will update this policy and request explicit opt-in consent under the DPDP Act, 2023 before activating them.",
      ],
      [
        "5. Managing Your Browser Controls",
        "You can view, clear, or block cookies and site storage anytime through your browser settings. Please note that clearing site data or blocking essential cookies will log you out and may prevent order tracking or dashboard access. Always sign out when using shared or public devices.",
      ],
    ],
  },
  "/payment-security": {
    title: "Payment & Security",
    description: "Current payment implementation status and platform security practices at TexOS.",
    intro: "We believe in complete transparency regarding what is currently live on TexOS and what is planned for upcoming releases.",
    sections: [
      [
        "1. Online Payments Coming Soon (Not Yet Implemented)",
        "Online payment processing is currently not implemented on TexOS. We are actively building and testing secure payment workflows and plan to introduce online payment gateway support in a future update.\nAt present, TexOS does not process online card, net-banking, wallet, or UPI transactions, and does not collect or store any sensitive payment instrument credentials.",
      ],
      [
        "2. Current Billing & Offline Settlement",
        "Restaurants can use TexOS to generate digital orders, itemized bills, and invoices. Any payment for customer food orders is currently settled directly between the customer and the restaurant using the restaurant's own offline or in-person payment methods.",
      ],
      [
        "3. Planned Security Standards for Future Payments",
        "When online payments are launched in a future update, TexOS intends to integrate only with RBI-compliant, PCI-DSS certified Indian payment aggregators/gateways using tokenized checkout flows—ensuring that raw card numbers, CVVs, banking passwords, or UPI PINs never touch TexOS servers.",
      ],
      [
        "4. Current Platform Security Measures",
        "Even prior to online payment activation, TexOS protects user and restaurant data using HTTPS/TLS encryption in transit, BCrypt/secure password hashing, JWT and HttpOnly session authentication, role-based access controls for kitchen/approval staff, and API rate limiting.",
      ],
      [
        "5. Safe Communication Reminder",
        "Never share passwords, OTPs, card numbers, CVVs, or UPI PINs with anyone claiming to represent TexOS, or in support/contact forms.",
      ],
    ],
  },
  "/grievance-redressal": {
    title: "Grievance Redressal",
    description: "Dedicated mechanism to address privacy, account, and platform grievances under Indian law.",
    intro: "In compliance with the Information Technology Act, 2000, the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Digital Personal Data Protection Act, 2023, TexOS provides a structured Grievance Redressal mechanism.",
    sections: [
      [
        "1. Grievance Officer Details",
        "Name: Md Sohail\nDesignation: Grievance Officer, TexOS\nEmail: texosservice@gmail.com\nPhone: [Official Support/Grievance Phone Number — +91 9749384032 (WhatsApp Only)",
      ],
      [
        "2. Statutory Resolution Timelines",
        "• Acknowledgment: Every formal grievance submitted to our Grievance Officer will be acknowledged within 24 hours of receipt (as required under Rule 3(2) of the IT Rules, 2021).\n• Resolution: TexOS will review and dispose of the grievance within 15 days from the date of receipt (or within any shorter timeline prescribed under the DPDP Act, 2023 and Rules).",
      ],
      [
        "3. How to Submit a Grievance",
        "Send an email to texosservice@gmail.com with the subject line “Grievance – [Your Issue]” or submit via our Contact Us page. Please include:\n• Your full name and contact details (email/phone).\n• The restaurant name or account ID involved (if applicable).\n• A clear description of the grievance, relevant dates, and any supporting screenshots or references.\nPlease do not include passwords, OTPs, or financial credentials.",
      ],
      [
        "4. Scope of Grievances",
        "You may raise grievances regarding: (a) personal data access, correction, erasure, or consent withdrawal under the DPDP Act, 2023; (b) unauthorized account access or unlawful content; and (c) subscription or platform service issues.\nNote on Payments & Restaurant Orders: As online payments are not yet implemented on TexOS, payment settlement or food-quality disputes relating to an offline restaurant bill should be raised directly with the concerned restaurant.",
      ],
      [
        "5. Escalation",
        "If you are not satisfied with the resolution provided by our Grievance Officer, or if your data-protection grievance remains unresolved, you may escalate the matter to the Data Protection Board of India (once operational under the DPDP Act, 2023) or pursue remedies available under applicable Indian law.",
      ],
    ],
  },
};

const faqSlug = "/faq";
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("texos-theme") || "light";
    } catch {
      return "light";
    }
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("texos-theme", next);
    } catch {
      // Theme selection still works for the current page if storage is unavailable.
    }
  };
  return [theme, toggleTheme];
}

function PublicLayout({ children }) {
  const [theme, toggleTheme] = useTheme();
  return (
    <div className="app public-app" data-theme={theme}>
      <PublicSiteHeader theme={theme} onToggleTheme={toggleTheme} />
      {children}
      <PublicSiteFooter />
    </div>
  );
}

function PageIntro({ eyebrow = "TEXOS", title, description }) {
  return (
    <header className="public-page-heading">
      <p className="public-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}

function BackHome() {
  return <Link className="public-back-home" to="/">← Back to Home</Link>;
}

export function AboutPage() {
  usePublicMetadata("About Us | TexOS", "Meet TexOS, the operating system for modern restaurants.", "/about");
  return (
    <PublicLayout>
      <main className="public-page">
        <PageIntro eyebrow="ABOUT TEXOS" title="The Operating System for Modern Restaurants." description="One platform to bring everyday restaurant operations together." />
        <div className="public-content-card about-content">
          <h2>Our purpose</h2>
          <p>Restaurants bring people together, but running one involves many moving parts. TexOS is being built to make those day-to-day operations easier to manage with practical digital tools in one place.</p>
          <h2>Our vision</h2>
          <p>We envision a future where restaurants of every scale can use thoughtful technology to serve customers, coordinate teams, and make informed operational decisions.</p>
          <h2>Our mission</h2>
          <p>Our mission is to help restaurants bring menus, ordering, kitchen workflows, billing, and customer engagement into a connected experience—while keeping restaurant owners in control of their operations and customer relationships.</p>
          <h2>Our product philosophy</h2>
          <p>TexOS focuses on useful workflows, clear information, and accessible interfaces. Customers can use supported digital menus in a browser, while owners and authorized staff use dedicated tools for their work. Feature availability depends on the product configuration and subscription.</p>
          <p className="public-callout">TexOS – The Operating System for Modern Restaurants.</p>
        </div>
        <BackHome />
      </main>
    </PublicLayout>
  );
}

export function FaqPage() {
  usePublicMetadata("FAQ | TexOS", "Answers to common questions about TexOS for restaurant owners and customers.", faqSlug);
  const [query, setQuery] = useState("");
  const [openQuestion, setOpenQuestion] = useState("");
  const filteredCategories = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return faqCategories;
    return faqCategories.map((category) => ({
      ...category,
      questions: category.questions.filter(([question, answer]) =>
        `${question} ${answer}`.toLowerCase().includes(term)),
    })).filter((category) => category.questions.length > 0);
  }, [query]);
  return (
    <PublicLayout>
      <main className="public-page">
        <PageIntro title="Frequently Asked Questions" description="Find answers about using TexOS and its restaurant features." />
        <label className="faq-search">
          <span>Search questions and answers</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search FAQs…" />
        </label>
        {filteredCategories.length === 0 ? <p className="public-empty-state">No matching questions. Try a different search.</p>
          : <div className="faq-categories">
            {filteredCategories.map((category) => (
              <section className="faq-category" key={category.title} aria-labelledby={`faq-${category.title}`}>
                <h2 id={`faq-${category.title}`}>{category.title}</h2>
                <div className="faq-list">
                  {category.questions.map(([question, answer]) => {
                    const id = `${category.title}-${question}`;
                    const expanded = openQuestion === id;
                    return (
                      <article className="faq-item" key={question}>
                        <h3>
                          <button type="button" aria-expanded={expanded} aria-controls={`answer-${id}`} onClick={() => setOpenQuestion(expanded ? "" : id)}>
                            <span>{question}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
                          </button>
                        </h3>
                        {expanded && <p id={`answer-${id}`} className="faq-answer">{answer}</p>}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>}
        <BackHome />
      </main>
    </PublicLayout>
  );
}

const contactCategories = [
  "Sales & Business Enquiries",
  "Restaurant Onboarding",
  "Technical Support",
  "Subscription & Billing",
  "Payment Related",
  "General Enquiries",
];

export function ContactPage() {
  usePublicMetadata("Contact Us | TexOS", "Contact TexOS for sales, onboarding, technical support, billing, and general enquiries.", "/contact");
  const [feedback, setFeedback] = useState("");
  const [feedbackState, setFeedbackState] = useState("");
  const [sending, setSending] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setFeedback("");
    setFeedbackState("");
    setSending(true);
    try {
      const response = await fetch(`${API_BASE}/api/public/contact`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || result.detail || "Your message could not be delivered. Please try again later.");
      }
      setFeedback("Thank you for contacting TexOS! We have received your message and will get back to you soon." || result.message);
      setFeedbackState("success");
      form.reset();
    } catch (error) {
      setFeedback(error.message || "Your message could not be delivered. Please try again later.");
      setFeedbackState("error");
    } finally {
      setSending(false);
    }
  };
  return (
    <PublicLayout>
      <main className="public-page">
        <PageIntro title="Contact TexOS" description="Choose a query category and tell us how we can help." />
        <form className="public-content-card contact-form" onSubmit={handleSubmit}>
          <p className="public-callout">Your enquiry will be emailed to TexOS support. Please do not include passwords, full card details, UPI PINs, or other payment authentication credentials.</p>
          <div className="contact-fields">
            <label>Full Name<input name="name" autoComplete="name" maxLength="100" required /></label>
            <label>Email Address<input name="email" type="email" autoComplete="email" maxLength="150" required /></label>
            <label>Subject<input name="subject" maxLength="150" required /></label>
            <label>Query Category<select name="category" required defaultValue=""><option value="" disabled>Select a category</option>{contactCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="contact-message">Message<textarea name="message" rows="6" maxLength="5000" required /></label>
          </div>
          <button className="button" type="submit" disabled={sending}>{sending ? "Sending…" : "Send message"}</button>
          {feedback && <p className="contact-feedback" data-state={feedbackState} role={feedbackState === "success" ? "status" : "alert"}>{feedback}</p>}
        </form>
        <BackHome />
      </main>
    </PublicLayout>
  );
}

function LegalPage({ path }) {
  const page = legalPages[path];
  usePublicMetadata(`${page.title} | TexOS`, page.description, path);
  return (
    <PublicLayout>
      <main className="public-page public-legal-page">
        <PageIntro eyebrow="TEXOS POLICIES" title={page.title} description={page.description} />
        <p className="public-legal-intro">{page.intro}</p>
        <div className="legal-layout">
          <nav className="legal-toc" aria-label={`${page.title} contents`}>
            <strong>On this page</strong>
            {page.sections.map(([heading], index) => <a href={`#legal-section-${index}`} key={heading}>{heading}</a>)}
          </nav>
          <article className="public-content-card legal-document">
            {page.sections.map(([heading, text], index) => (
              <section id={`legal-section-${index}`} key={heading}>
                <h2>{heading}</h2>
                {text.split("\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </section>
            ))}
          </article>
        </div>
        <BackHome />
      </main>
    </PublicLayout>
  );
}

export function PrivacyPolicyPage() { return <LegalPage path="/privacy-policy" />; }
export function TermsPage() { return <LegalPage path="/terms-and-conditions" />; }
export function RefundPolicyPage() { return <LegalPage path="/refund-policy" />; }
export function CookiePolicyPage() { return <LegalPage path="/cookie-policy" />; }
export function PaymentSecurityPage() { return <LegalPage path="/payment-security" />; }
export function GrievancePage() { return <LegalPage path="/grievance-redressal" />; }

export function SupportPage() {
  usePublicMetadata("Help & Support | TexOS", "Find help with TexOS accounts, restaurant setup, menus, QR codes, staff access, subscriptions, and payments.", "/support");
  const topics = [
    ["Account help", "Review account access and sign-in options. Do not share passwords or authentication codes with anyone."],
    ["Restaurant onboarding", "Follow the onboarding steps in TexOS and make sure restaurant details and owner contact information are accurate."],
    ["Menu management", "Use the owner dashboard to manage supported menu categories, items, prices, descriptions, and availability."],
    ["QR code assistance", "Each active table QR code points customers to the restaurant and table menu configured in TexOS. Check that the table is active and the code is displayed clearly."],
    ["Kitchen staff access", "Owners can use the dashboard staff-access settings to grant or revoke kitchen staff access. Share access codes only with authorized staff."],
    // ["Subscription and billing", "Review current plans and account subscription information. For a charge question, keep the transaction reference available but never share payment credentials."],
    // ["Payment integration", "Restaurant-specific payment integrations depend on provider eligibility, onboarding, and configuration. Contact the provider about merchant approval and settlement."],
    ["Subscription and billing", "Review current plans and account details in your dashboard. Online payment gateway billing is not yet active and will be added in a future update."],
    ["Payment integration", "Online payment gateway integration is currently not implemented on TexOS and is planned for a future release. Restaurants currently handle customer payments directly offline."],
  ];
  return (
    <PublicLayout>
      <main className="public-page">
        <PageIntro title="Help & Support" description="Guidance for getting started and using supported TexOS features." />
        <div className="support-grid">
          {topics.map(([title, text]) => <section className="public-content-card support-card" key={title}><h2>{title}</h2><p>{text}</p></section>)}
        </div>
        <div className="public-support-actions"><Link className="button" to="/faq">Browse FAQs</Link><Link className="button button-outline" to="/contact">Contact Us</Link></div>
        <BackHome />
      </main>
    </PublicLayout>
  );
}

