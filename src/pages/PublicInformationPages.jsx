import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PublicSiteFooter, PublicSiteHeader } from "../components/PublicSiteChrome";
import { API_BASE } from "./restaurantApi";
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
      ["Can I connect my own payment gateway account?", "TexOS supports restaurant-specific merchant integration with eligible providers. Availability depends on provider onboarding, approval, configuration, and the features enabled for that restaurant."],
      ["Where do restaurant payments go?", "For supported individual merchant integrations, customer payments are processed through the restaurant's connected merchant account. Settlement is handled under that provider's merchant process and terms."],
      ["Does TexOS support UPI payments?", "UPI availability depends on the connected payment provider and the payment methods enabled for the restaurant's merchant account."],
      ["Can customers pay offline?", "Where enabled, a customer can request offline payment assistance so restaurant staff can coordinate collection. The restaurant remains responsible for confirming offline collection."],
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
    description: "How TexOS handles information for restaurant owners, customers, and restaurant operations.",
    intro: "This policy explains how TexOS handles personal information when people use the TexOS website, owner dashboard, restaurant digital menus, and related services. It is written to describe the current product at a general level; final publication requires review of actual hosting, vendors, retention practices, and applicable law.",
    sections: [
      ["1. Introduction", "TexOS provides software tools for restaurant operations. This policy distinguishes information relating to restaurant owners and their accounts from information relating to a restaurant's customers. The restaurant may independently decide what customer information it collects and how it uses that information in connection with its own business."],
      ["2. Scope of this policy", "This policy applies to TexOS-operated websites and features. It does not replace a restaurant's own privacy notice, or the privacy policies of payment providers and other third parties. Where a restaurant determines the purpose and means of processing customer information, the restaurant may have separate legal obligations."],
      ["3. Information collected from restaurant owners", "Account and onboarding information may include a person's name, email address, telephone number, login credentials or password hash, restaurant details, subscription information, and configuration data. Google account identity information may be used when an owner chooses Google sign-in. TexOS may also process staff access records and account security or audit events when those features are used."],
      ["4. Information collected from restaurant customers", "Customers can browse a supported digital menu without logging in. When placing an order, the application may collect information entered for that order, such as a customer name, mobile number, and optionally an email address. The current customer registration flow collects a name and mobile number without SMS one-time-password verification; a mobile number must not be treated as verified on that basis."],
      ["5. Technical and device information", "TexOS and its hosting or security services may process technical information needed to deliver and protect the service, such as request details, device and browser characteristics, approximate network information, error records, and timestamps. The exact logs and retention periods depend on the deployed infrastructure and must be confirmed before publication."],
      ["6. How information is used", "Information is used to provide and operate accounts, menus, orders, billing and subscription workflows, loyalty features, staff access, customer support, service security, troubleshooting, and legally required records. TexOS should use information only for purposes consistent with the relevant feature and applicable law."],
      ["7. QR codes and table identification", "A restaurant table QR code identifies the restaurant and table associated with a menu visit or order. The QR code itself does not identify a customer's personal identity. Information may become associated with an order when a customer submits personal details or uses an authenticated feature."],
      ["8. Customer authentication and sessions", "Some customer loyalty features require registration and authentication. The current application configures server-managed customer sessions for up to 60 days of inactivity; actual expiry may also depend on browser, server, and deployment behavior. Owner access tokens are stored in browser local storage by the current frontend. Customers and owners should sign out on shared devices where that option is available."],
      ["9. Loyalty program information", "When loyalty features are used, TexOS may process the customer's restaurant-scoped account identifier, points, rewards, redemption activity, and related orders. A restaurant's loyalty settings and the customer's participation are subject to the applicable restaurant terms and TexOS feature availability."],
      ["10. Payment-related information", "TexOS processes information required to initiate or track payment workflows, such as bill totals, payment status, transaction references, payment method details returned by a provider, and related timestamps. Do not send full card numbers, banking passwords, UPI PINs, or other authentication secrets to TexOS."],
      ["11. Payment service providers", "Online payments use supported third-party payment providers and restaurant-specific merchant configuration where enabled. Payment providers process transactions under their own privacy notices and terms. TexOS does not claim to store complete card or banking credentials; the precise information received from each provider depends on the integration."],
      ["12. Cookies and similar technologies", "TexOS uses browser session mechanisms needed for login, customer sessions, and service operation. The application uses server-managed sessions for some customer authentication flows. No analytics cookies are described here unless and until an analytics service is actually enabled and verified. See the Cookie Policy for more information."],
      ["13. Sharing with third parties", "Information may be shared with infrastructure and service providers that support hosting, communications, payment processing, security, or other requested features; with a restaurant where needed to fulfil its operations; or where required by law. Vendors, data locations, and contracts must be reviewed and documented before production publication."],
      ["14. Storage and security", "TexOS uses technical and organizational measures intended to protect information against unauthorized access, alteration, disclosure, or loss. No internet transmission or storage method can be represented as completely secure. This policy does not claim a certification, encryption standard, or audit that has not been independently verified."],
      ["15. Retention and deletion", "Information should be retained only as long as needed for the relevant service, legitimate operational needs, dispute handling, security, or legal obligations. Exact retention periods and deletion procedures are deployment-specific and should be confirmed by TexOS before this policy is finalized. Account holders may contact TexOS to request review or deletion, subject to legal and operational constraints."],
      ["16. Rights and consent", "Depending on applicable law and the person's relationship with TexOS, including the Digital Personal Data Protection Act, 2023 and rules in force to the extent applicable, a person may have rights to access, correct, erase, or raise a grievance about personal information, and to withdraw consent where processing relies on consent. Requests may require identity verification and may be subject to legal exceptions. A restaurant customer may also need to contact the restaurant that collected their information."],
      ["17. Children's privacy", "TexOS's restaurant operation services are not directed to children for independent account creation. Restaurants should not knowingly submit children's personal information unless permitted by applicable law and supported by appropriate safeguards and consent."],
      ["18. Data incidents", "TexOS will assess suspected personal-data incidents and take steps required by applicable law and its incident-response procedures, which may include containment, investigation, record keeping, and notifications to affected persons or authorities where required. No fixed response time is promised by this policy."],
      ["19. Policy changes", "This policy may be updated to reflect changes to TexOS, vendors, or applicable law. The revised policy will be published with an updated effective date. Material changes should be communicated through appropriate channels where required."],
      ["20. Contact and grievances", "For privacy questions or requests, use the Contact Us or Grievance Redressal page. The official contact and grievance officer details are not yet verified for publication and must be supplied before launch."],
    ],
  },
  "/terms-and-conditions": {
    title: "Terms & Conditions",
    description: "Terms governing use of TexOS restaurant software and associated services.",
    intro: "These Terms describe access to and use of TexOS. They should be reviewed by qualified Indian counsel and completed with verified business and contracting details before being treated as final legal terms.",
    sections: [
      ["1. Acceptance of Terms", "By accessing or using TexOS, you agree to these Terms and any applicable plan or feature terms. If you use TexOS for a business, you represent that you are authorized to bind that business. If you do not agree, do not use the service."],
      ["2. Definitions", "“TexOS” means the software service and its operator. “Owner” means a restaurant or its authorized account holder. “Restaurant Customer” means a person interacting with a restaurant through a TexOS-powered menu or workflow. “Provider” means a third-party payment, hosting, communication, or other service provider."],
      ["3. Eligibility", "You must be legally capable of entering into a binding agreement and comply with applicable laws. Features may have additional eligibility requirements, including payment-provider approval."],
      ["4. Account registration", "You must provide accurate account information, keep credentials confidential, and promptly notify TexOS of suspected unauthorized use. You are responsible for activity performed through your account, subject to applicable law and any security obligations of TexOS."],
      ["5. Restaurant owner responsibilities", "Owners are responsible for their restaurant information, menu accuracy, prices, taxes, availability, food safety, fulfilment, staff conduct, customer communications, and compliance with laws applicable to their business. Owners must have a lawful basis to provide customer information to TexOS and must provide any notices required to their customers."],
      ["6. Customer responsibilities", "Customers must provide accurate information when placing an order or using an account, use the service lawfully, and contact the restaurant regarding its food, service, order fulfilment, or restaurant-issued refund."],
      ["7. Subscription plans", "Subscription features, prices, term, and eligibility are presented in TexOS or a separate order confirmation. Features can vary by plan. The applicable plan terms at purchase govern, subject to mandatory law."],
      ["8. Subscription billing and renewal", "Subscription charges and renewal behavior are shown during checkout or in the applicable plan terms. Do not assume automatic renewal unless it is clearly disclosed and authorized. Taxes, payment-provider processing, failed charges, and cancellation effects will be handled under the disclosed checkout terms and applicable law."],
      ["9. Free trial", "Trial availability, duration, eligibility, and any conversion or expiry behavior are shown during sign-up. TexOS may restrict trials to eligible accounts or restaurants. No paid conversion should occur unless disclosed and authorized as required by law."],
      ["10. Suspension and termination", "TexOS may restrict or suspend access where reasonably necessary for security, legal compliance, non-payment, misuse, or material breach, subject to applicable law and notice requirements. Owners may stop using the service or cancel a subscription as described in the account or plan terms. Data retention after termination is governed by the Privacy Policy and applicable law."],
      ["11. Digital menus and QR codes", "TexOS provides tools for displaying restaurant menus and identifying restaurant tables through QR codes. Owners are responsible for ensuring menu content, prices, allergens, offers, and availability are accurate and lawful. TexOS does not guarantee uninterrupted access to a particular QR code or network."],
      ["12. Kitchen and staff access", "Owners are responsible for granting access only to authorized personnel, protecting one-time codes and access links, and revoking access when no longer needed. Staff must use access only for the authorized restaurant and permitted operational purpose."],
      ["13. Loyalty program", "Loyalty points, rewards, eligibility, earning, expiry, and redemption are subject to the restaurant's configured program and TexOS functionality. Owners are responsible for clearly communicating program terms. Points are not cash unless expressly stated by the restaurant and permitted by law."],
      ["14. Payment gateway integration", "TexOS may support integrations with eligible payment providers and restaurant-specific merchant accounts. Integration depends on provider onboarding, approval, technical availability, and accurate owner configuration. TexOS does not guarantee that a provider will approve or continue any merchant account."],
      ["15. Payment processing responsibilities", "TexOS provides payment initiation and related transaction workflows. The payment provider processes transactions and the restaurant's provider account receives settlement according to provider rules. Restaurants remain responsible for their customer transactions, fulfilment, applicable taxes, and communication about payment issues. TexOS subscription payments are separate from customer payments made to restaurants."],
      ["16. Refunds and disputes", "Subscription refunds and restaurant customer refunds are governed by the Refund & Cancellation Policy, applicable checkout disclosures, provider rules, and mandatory law. TexOS does not determine whether restaurant food or service should be refunded unless a specific feature or legal obligation applies."],
      ["17. Third-party services", "Third-party services are governed by their own terms and privacy notices. TexOS is not responsible for independent third-party services except to the extent required by law or expressly agreed."],
      ["18. Intellectual property", "TexOS and its licensors retain rights in the service, software, and branding. Owners retain responsibility for rights in content they submit and grant TexOS the limited permissions needed to host and display that content to provide the service."],
      ["19. Prohibited activities", "You must not misuse the service, interfere with its security, attempt unauthorized access, submit unlawful or infringing content, misrepresent transactions, or use TexOS in a way that violates applicable law or another person's rights."],
      ["20. Availability and maintenance", "TexOS may change, maintain, or discontinue features. The service is provided subject to operational interruptions, third-party dependencies, and network availability. No uptime commitment is made unless set out in a separate written agreement."],
      ["21. Limitation of liability", "To the extent permitted by law, TexOS is not responsible for restaurant food, service, order fulfilment, merchant settlement, or a third party's acts. Nothing in these Terms excludes liability that cannot lawfully be excluded. Any additional limitations must be reviewed and completed by counsel before publication."],
      ["22. Indemnification", "To the extent permitted by law, an Owner may be responsible for claims arising from its restaurant operations, content, unlawful use, or breach of these Terms. Any indemnity language must be reviewed by counsel and does not limit mandatory rights."],
      ["23. Changes to Terms", "TexOS may update these Terms. Updated terms will be published with an effective date. Where required, TexOS will seek renewed acceptance or provide notice before material changes take effect."],
      ["24. Governing law and jurisdiction", "These Terms are intended to be governed by the laws of India, subject to mandatory consumer protections and applicable rules on jurisdiction. The competent courts and any dispute procedure must be confirmed by TexOS's legal counsel before publication."],
      ["25. Contact information", "Use the Contact Us page for questions. TexOS's contracting entity name, registered address, and official contact details are not yet verified for publication and must be completed before launch."],
    ],
  },
  "/refund-policy": {
    title: "Refund & Cancellation Policy",
    description: "Separate guidance for TexOS subscription charges and restaurant customer payments.",
    intro: "TexOS subscription charges and payments made by restaurant customers are separate transactions. This policy explains where to direct a request and does not promise a refund where eligibility has not been established.",
    sections: [
      ["Part 1: TexOS Subscription Refunds", "Subscription requests relate to a plan purchased from TexOS, not a customer's restaurant bill."],
      ["Subscription cancellation", "Owners may request cancellation using the cancellation controls shown in their account or by contacting TexOS through a verified support channel once published. Cancellation prevents future charges only as described during purchase; it may not reverse a charge already processed."],
      ["Recurring billing and renewal", "TexOS must disclose whether a plan renews automatically and the applicable renewal terms during checkout. If a plan is manually renewed, no automatic renewal is implied. Review the purchase confirmation and account billing details."],
      ["Duplicate charges and billing errors", "If you believe a subscription charge was duplicated or incorrect, provide the relevant account, date, amount, and transaction reference through the official support channel. Do not share full payment credentials."],
      ["Refund eligibility", "Refund requests are reviewed based on the purchase terms, whether the charge was authorized or duplicated, any service or billing error, provider records, and applicable law. Submitting a request does not guarantee approval."],
      ["How to request a subscription refund", "Contact TexOS using a verified Contact Us channel and identify the restaurant account, plan, charge date, amount, and payment reference. TexOS may request reasonable information to verify the request. Official contact details must be published before this policy goes live."],
      ["Processing and access after cancellation", "If a refund is approved, processing and bank posting depend on the payment provider and financial institution; no guaranteed timeline is stated here. Access after cancellation or refund depends on the plan terms and account status."],
      ["Part 2: Restaurant Customer Payments", "Payments for food, services, and orders are made to the restaurant through its selected payment method or connected merchant account. These are not TexOS subscription payments."],
      ["Restaurant order cancellation", "Customers should contact the restaurant directly as soon as possible to request cancellation. Whether an order can be cancelled depends on the restaurant's policies, order status, preparation, and applicable law."],
      ["Restaurant-issued refunds", "The restaurant is responsible for deciding and issuing refunds for its food, services, or cancelled orders, subject to law and its disclosed policies. TexOS does not promise or automatically authorize a restaurant refund."],
      ["Payment failures and debited funds", "If a payment appears failed but funds were debited, retain the provider reference and contact the restaurant and payment provider through their official channels. Provider status reconciliation and bank posting can take time; no fixed completion period is guaranteed here."],
      ["Duplicate customer transactions", "For a suspected duplicate restaurant payment, contact the restaurant with the order and transaction references. The restaurant and its payment provider should verify settlement before arranging any correction or refund."],
      ["Roles of TexOS, restaurants, and providers", "TexOS provides payment initiation and transaction status workflows where enabled. The restaurant is responsible for its order and customer refund decision; the payment provider processes the payment and any supported refund. TexOS subscription billing is handled separately."],
    ],
  },
  "/cookie-policy": {
    title: "Cookie Policy",
    description: "How TexOS uses browser sessions and related technologies.",
    intro: "This policy describes browser storage and session technologies currently relevant to TexOS. It does not claim the use of analytics or advertising cookies that have not been verified in the application.",
    sections: [
      ["1. What cookies are", "Cookies are small values stored by a website in a browser. Related technologies can include server-managed session identifiers and browser storage."],
      ["2. Why TexOS uses them", "TexOS uses session mechanisms needed to maintain sign-in state, protect authenticated actions, and support customer and staff workflows."],
      ["3. Essential authentication cookies", "The backend uses server-managed browser sessions for some customer authentication features. These mechanisms are essential to the requested service. Cookie attributes and production domain settings should be verified against the deployed environment before launch."],
      ["4. Session management", "The customer session service configures a maximum inactive interval of approximately 60 days. Actual session lifetime may also depend on server configuration, browser behavior, and deployment. Signing out or clearing browser data can end a session."],
      ["5. Functional cookies and storage", "The frontend stores selected preferences, such as the display theme, and selected application state in browser local storage. Owner access tokens are also stored in browser local storage by the current implementation. This is browser storage rather than a cookie; users should sign out and avoid shared devices they do not trust."],
      ["6. Analytics cookies", "No analytics provider is described in this policy because no analytics integration has been verified. If TexOS adds analytics or other non-essential tracking, this policy and any required consent controls must be updated before activation."],
      ["7. Third-party cookies", "A payment or identity provider may use its own browser technologies when a customer follows a provider flow. Those technologies are governed by that provider's own disclosures."],
      ["8. Consent and preferences", "Essential session technologies are used to provide functions requested by the user. No non-essential analytics or advertising cookies should be activated without the required notice and, where applicable, consent and preference controls."],
      ["9. Browser controls", "Most browsers allow users to view, block, or remove cookies and site data. Blocking essential cookies may prevent login or other session-dependent features from working."],
      ["10. Policy updates", "This policy may change when TexOS adds or changes browser technologies. Review it periodically for updates."],
    ],
  },
  "/payment-security": {
    title: "Payment & Security",
    description: "An overview of TexOS payment workflows and verified security boundaries.",
    intro: "TexOS provides payment interfaces and transaction workflows. Payment processing and settlement are handled by the configured provider and merchant account. This page describes product behavior at a high level and does not claim a security certification or guarantee.",
    sections: [
      ["Restaurant-specific merchant accounts", "Where supported, a restaurant can configure its own eligible merchant account with a supported payment provider. Provider onboarding, approval, credential validity, and available methods are determined by that provider."],
      ["Payment initiation and settlement", "TexOS initiates supported payment flows and associates them with a restaurant bill. The connected payment provider processes the transaction; funds are settled under the provider's merchant settlement process and terms."],
      ["Payment status verification", "For supported online payment integrations, TexOS receives or retrieves provider payment status and uses it to update the related transaction and order records. Customers and owners should rely on the final status displayed by the system and provider, rather than assuming that a redirect alone proves payment."],
      ["Duplicate payment protection", "TexOS associates payment attempts with bill/session records and prevents certain concurrent or duplicate workflows. These controls reduce duplicate processing risk but cannot guarantee that a provider, bank, or network will never create a duplicate or delayed status."],
      ["Transaction references and records", "TexOS stores transaction-related identifiers and statuses needed to reconcile payment workflows, maintain receipts, and support audits. Avoid sending card numbers, UPI PINs, banking passwords, or provider secrets through support channels."],
      ["Owner notifications and reconciliation", "Supported completed payments can create transaction records and notifications for the restaurant. TexOS also maintains payment-related audit information and supports status reconciliation workflows where available."],
      ["Refunds", "Refund functionality depends on the payment method and integration. A restaurant remains responsible for deciding whether a customer order should be refunded; the provider executes supported refunds under its own procedures."],
      ["Offline payment assistance", "Where enabled, customers can request help coordinating offline collection. Restaurant staff must verify and record the actual collection. An assistance request is not itself proof that payment has been made."],
      ["Security and scope", "TexOS uses access controls and transaction validation as part of its application. Payment providers handle payment credential entry and processing according to their systems. TexOS does not claim PCI DSS certification, a particular encryption standard, or guaranteed payment security unless such a claim is independently verified and formally approved."],
      ["Subscriptions are separate", "Payments for a restaurant's TexOS subscription are separate from payments made by that restaurant's customers. Each has its own checkout, merchant/provider flow, and support path."],
    ],
  },
  "/grievance-redressal": {
    title: "Grievance Redressal",
    description: "How to raise a privacy, account, subscription, or service grievance with TexOS.",
    intro: "TexOS intends to review grievances through a clear and accountable process. The official grievance contact details below are placeholders and must be completed and verified by TexOS before this page is published as final.",
    sections: [
      ["Grievance Officer details — required before publication", "Name: [Grievance Officer Name to be confirmed]\nDesignation: [Designation to be confirmed]\nEmail: [Official grievance email to be confirmed]\nPhone: [Official grievance phone number to be confirmed]\nRegistered business address: [Registered business address to be confirmed]"],
      ["How to submit a complaint", "Provide your name, a way to contact you, the TexOS account or restaurant involved (if applicable), a clear description of the issue, relevant dates, and supporting references. Do not include passwords, full card numbers, UPI PINs, or other authentication secrets."],
      ["Privacy-related complaints", "Describe the information or processing concerned, the account or restaurant involved, and the action you are requesting. A restaurant customer may also need to raise the issue with the restaurant that collected the information."],
      ["Account and subscription complaints", "Include the account email or restaurant identifier, subscription plan, relevant charge or event date, and any transaction reference. TexOS may need to verify account authority before discussing account-specific details."],
      ["Payment-related complaints", "For a restaurant customer bill, contact the restaurant and payment provider as appropriate. For a TexOS subscription charge, contact TexOS through the verified grievance or support channel. Include only safe transaction references, never payment credentials."],
      ["Acknowledgement, review, and escalation", "TexOS will review a complaint, may request additional information, and will communicate an outcome or next steps using the contact method provided. Applicable acknowledgement or resolution periods will be followed where required by law. No additional deadline is promised here. If unresolved, the complainant may use the escalation or remedy available under applicable law."],
      ["Applicable requirements", "TexOS will handle grievances in accordance with applicable Indian law, including the Digital Personal Data Protection Act, 2023 and rules in force to the extent applicable, and relevant consumer-protection requirements. The legal applicability, role allocation, notices, and required timelines must be reviewed by qualified counsel before publication."],
    ],
  },
};

const faqSlug = "/faq";
const homeMetadata = {
  title: "TexOS – The Operating System for Modern Restaurants",
  description: "Manage restaurant menus, orders, kitchen operations, loyalty, and billing with TexOS.",
};

function usePublicMetadata(title, description, path) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const cleanupMeta = [];
    const setMeta = (selector, attribute, value) => {
      let element = document.head.querySelector(selector);
      let created = false;
      const previousContent = element?.getAttribute("content");
      if (!element) {
        element = document.createElement("meta");
        const [key, keyValue] = selector.match(/\[(name|property)="([^"]+)"\]/).slice(1);
        element.setAttribute(key, keyValue);
        document.head.appendChild(element);
        created = true;
      }
      element.setAttribute("content", value);
      return () => {
        if (created) element.remove();
        else if (previousContent === null) element.removeAttribute("content");
        else element.setAttribute("content", previousContent);
      };
    };
    cleanupMeta.push(setMeta('meta[name="description"]', "name", description));
    cleanupMeta.push(setMeta('meta[property="og:title"]', "property", title));
    cleanupMeta.push(setMeta('meta[property="og:description"]', "property", description));
    cleanupMeta.push(setMeta('meta[property="og:type"]', "property", "website"));
    const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.replace(/\/$/, "");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    let createdCanonical = false;
    const previousCanonical = canonical?.href;
    if (configuredSiteUrl) {
      const siteOrigin = new URL(configuredSiteUrl).origin;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
        createdCanonical = true;
      }
      canonical.href = `${siteOrigin}${path}`;
    }
    return () => {
      document.title = previousTitle;
      cleanupMeta.forEach((cleanup) => cleanup());
      if (createdCanonical) canonical.remove();
      else if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, [title, description, path]);
}

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

export function HomePageMetadata() {
  usePublicMetadata(homeMetadata.title, homeMetadata.description, "/");
  return null;
}

export function SubscriptionPageMetadata() {
  usePublicMetadata("Plans | TexOS", "Explore TexOS restaurant subscription plans and available features.", "/plans");
  return null;
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
      setFeedback("Thank you for contacting TexOS! We have received your message and will get back to you soon.");
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
    ["Subscription and billing", "Review current plans and account subscription information. For a charge question, keep the transaction reference available but never share payment credentials."],
    ["Payment integration", "Restaurant-specific payment integrations depend on provider eligibility, onboarding, and configuration. Contact the provider about merchant approval and settlement."],
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

