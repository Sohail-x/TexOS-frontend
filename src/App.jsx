import './App.css';
import { useEffect, useState } from "react";
import { Routes, Route, Link, useParams, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import CustomerMenu from "./pages/CustomerMenu";
import CustomerAuthPage from "./pages/CustomerAuthPage";
import AdminPortal from "./pages/AdminPortal";
import ClientDataPage from "./pages/ClientDataPage";
import ProtectedRoute from "./pages/ProtectedRoute";
import SubscriptionPage from "./pages/SubscriptionPage";
import GoogleOnboarding from "./pages/GoogleOnboarding";
import { API_BASE } from "./pages/restaurantApi";
import KitchenStaffPortal from "./pages/KitchenStaffPortal";
import OrderApprovalPortal from "./pages/OrderApprovalPortal";
import { PublicSiteFooter, PublicSiteHeader } from "./components/PublicSiteChrome";
import {
  AboutPage,
  ContactPage,
  CookiePolicyPage,
  FaqPage,
  GrievancePage,
  HomePageMetadata,
  PaymentSecurityPage,
  PrivacyPolicyPage,
  RefundPolicyPage,
  SupportPage,
  SubscriptionPageMetadata,
  TermsPage,
} from "./pages/PublicInformationPages";

const features = [
  {
    icon: '📱',
    title: 'QR Digital Menu',
    description: 'Let customers browse your menu directly from their phones. No app installation required.'
  },
  {
    icon: '🛎️',
    title: 'Smart Ordering',
    description: 'Accept table-based, token-based and counter pickup orders from one platform.'
  },
  {
    icon: '👨‍🍳',
    title: 'Kitchen Management',
    description: 'Send orders directly to the kitchen and keep staff updated on order progress.'
  },
  {
    icon: '🧾',
    title: 'Digital Billing',
    description: 'Manage itemised bills and track payment status with ease.'
  },
  {
    icon: '📊',
    title: 'Business Analytics',
    description: 'Understand sales, orders and restaurant performance from your dashboard.'
  },
  {
    icon: '📥',
    title: 'Bulk Menu Import',
    description: 'Import menu items from Excel spreadsheets or text-based PDF menus.'
  },
  {
    icon: '🎁',
    title: 'Loyalty Program',
    description: 'Reward returning customers with loyalty points, visit-based rewards, exclusive offers and discounts.'
  },
  {
    icon: '⭐',
    title: 'Google Reviews',
    description: 'Make it easy for customers to discover your restaurant and share their experience through your Google review link.'
  },
];

const planFeatures = {
  Starter: [
      'QR digital menu',
      'Three ordering modes',
      'Basic order dashboard',
      'Digital billing',
      'Order history'
    ],
  Growth: [
      'Everything in Starter',
      'Live order status',
      'Estimated preparation time',
      'Customer reviews',
      'Waiter assistance requests',
      'Basic sales analytics'
    ],
  Premium: [
      'Everything in Growth',
      'Loyalty points and rewards',
      'Visit-based rewards',
      'Advanced analytics',
      'Customer management',
      'Offers and promotions'
    ],
};

function LandingPage() {
  const location = useLocation();
  const [plans, setPlans] = useState([]);
  const [plansError, setPlansError] = useState("");
  const expiredMessage = new URLSearchParams(location.search).get("subscription") === "expired";


useEffect(() => {
  if (!location.hash) return;

  const scrollToSection = () => {
    const sectionId = decodeURIComponent(
      location.hash.substring(1)
    );

    const section = document.getElementById(sectionId);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  requestAnimationFrame(scrollToSection);

}, [location.pathname, location.hash]);




  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/subscriptions/plans`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Subscription plans could not be loaded.");
        return response.json();
      })
      .then((data) => { if (active) setPlans(data); })
      .catch(() => { if (active) setPlansError("Subscription plans are temporarily unavailable. Please try again later."); });
    return () => { active = false; };
  }, []);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("texos-theme") || "light";
    } catch {
      return "light";
    }
  });
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("texos-theme", nextTheme);
  };

  return (
    <div className="app" data-theme={theme}>
      <HomePageMetadata />
      <PublicSiteHeader theme={theme} onToggleTheme={toggleTheme} />

      <main>
        {expiredMessage && <div role="alert" className="subscription-expired-banner">Your TexOS subscription has expired. Please choose a subscription plan to continue using TexOS.</div>}
        <section className="hero" id="home">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="status-dot"></span>THE RESTAURANT OPERATING SYSTEM
            </div>
            <h1>Run your restaurant.<br /><span>Smarter with TexOS.</span></h1>
            <p className="hero-description">
              Manage menus, orders, kitchen operations and billing from one simple platform. Built for restaurants, cafés and food businesses.
            </p>
            <div className="hero-actions" id="get-started">
              <a href="#pricing" className="button">Explore plans <span>→</span></a>
              <a href="#features" className="button button-outline">Explore features</a>
            </div>
            <div className="hero-note">
              <span>✓</span> No customer app download required <span className="note-separator">•</span>
              <span>✓</span> One platform, multiple ordering modes
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-glow"></div>
            <div className="dashboard-card">
              <div className="dashboard-top">
                <div>
                  <span className="dashboard-label">TexOS DASHBOARD</span>
                  <h3>Restaurant overview</h3>
                </div>
                <span className="live-indicator">● Live</span>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>Today's orders</span>
                  <strong>48</strong>
                  <small>Orders received</small>
                </div>
                <div className="stat-card">
                  <span>Revenue</span>
                  <strong>₹12,450</strong>
                  <small>Illustrative data</small>
                </div>
              </div>
              <div className="order-heading">
                <strong>Recent orders</strong>
                <span>View all →</span>
              </div>
              <div className="order-row">
                <div className="order-avatar">T1</div>
                <div className="order-info">
                  <strong>Order #1042</strong>
                  <span>Table 01 · 2 items</span>
                </div>
                <span className="order-status preparing">Preparing</span>
              </div>
              <div className="order-row">
                <div className="order-avatar token">#8</div>
                <div className="order-info">
                  <strong>Order #1043</strong>
                  <span>Token 08 · 3 items</span>
                </div>
                <span className="order-status ready">Ready</span>
              </div>
              <div className="order-row">
                <div className="order-avatar pickup">P</div>
                <div className="order-info">
                  <strong>Order #1044</strong>
                  <span>Counter pickup · 1 item</span>
                </div>
                <span className="order-status received">Received</span>
              </div>
              <div className="dashboard-footer">
                <span>Powered by TexOS</span>
                <span>Restaurant operations, simplified.</span>
              </div>
            </div>
            <div className="floating-tag tag-one"><span>✓</span> Orders organised</div>
            <div className="floating-tag tag-two"><span>⚡</span> Smarter operations</div>
          </div>
        </section>

        <section className="trust-strip">
          <p>ONE PLATFORM FOR EVERY FOOD BUSINESS</p>
          <div>
            <span>Restaurants</span><span>·</span>
            <span>Cafés</span><span>·</span>
            <span>Food Trucks</span><span>·</span>
            <span>Street Food</span><span>·</span>
            <span>Takeaways</span>
          </div>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="section-kicker">WHAT TEXOS DOES</span>
            <h2>Everything your restaurant needs.</h2>
            <p>Bring your daily restaurant operations together with one connected system.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <a href="#get-started">Learn more ↗</a>
              </article>
            ))}
          </div>
        </section>

        <section className="ordering-section" id="how-it-works">
          <div className="section-heading">
            <span className="section-kicker">FLEXIBLE ORDERING</span>
            <h2>Three ways to take orders.</h2>
            <p>Choose the ordering experience that fits your restaurant's business model.</p>
          </div>
          <div className="ordering-grid">
            <article className="ordering-card">
              <span className="mode-number">01</span>
              <div className="mode-icon">🪑</div>
              <h3>Table-based ordering</h3>
              <p>Customers scan a unique table QR code, place orders and receive service at their table.</p>
            </article>
            <article className="ordering-card featured-mode">
              <span className="mode-number">02</span>
              <div className="mode-icon">🎟️</div>
              <h3>Token-based ordering (Coming Soon)</h3>
              <p>Customers order using a business QR code and collect their food when their token is ready.</p>
            </article>
            <article className="ordering-card">
              <span className="mode-number">03</span>
              <div className="mode-icon">🥡</div>
              <h3>Counter pickup</h3>
              <p>Customers order online, track progress and collect their food directly from the counter.</p>
            </article>
          </div>
        </section>

        <section className="section pricing-section" id="pricing">
          <div className="section-heading">
            <span className="section-kicker">SIMPLE SUBSCRIPTIONS</span>
            <h2>Plans that grow with you.</h2>
            <p>Choose the tools your business needs. Plan details and prices are managed securely by TexOS.</p>
          </div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`price-card ${plan.trialPlan ? 'trial-plan-card' : plan.name === 'Growth' ? 'popular' : ''}`} key={plan.id}>
                {plan.trialPlan
                  ? <span className="popular-label">FREE TRIAL</span>
                  : plan.name === 'Growth' && <span className="popular-label">MOST POPULAR</span>}
                <h3>{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>
                <div className="price">
                  <span>₹</span>{Number(plan.price).toLocaleString('en-IN')}<small>/ {plan.durationDays} days</small>
                </div>
                <p className="billing-note">{plan.trialPlan ? "One free trial per restaurant." : "Manual monthly renewal"}</p>
                <Link to={`/signup?planId=${encodeURIComponent(plan.id)}`} className="button plan-button">
                  {plan.trialPlan ? "Start free trial" : "Get started"} <span>→</span>
                </Link>
                <div className="plan-divider"></div>
                <p className="included-label">WHAT'S INCLUDED</p>
                <ul>
                  {(plan.trialPlan
                    ? ['Full TexOS access for 30 days','Digital Menu QR', 'Restaurant dashboard', 'Menu and order management', 'Digital billing', 'Kitchen Staff Page', 'Order Approval Staff Page', 'No payment required to start', 'One trial per restaurant']
                    : planFeatures[plan.name] || ['Full TexOS access for 30 days', 'Digital Menu QR' , 'Restaurant dashboard', 'Menu and order management', 'Digital billing', 'Kitchen Staff Page', 'Order Approval Staff Page', 'WhatsApp & Email Support']).map((item) => (
                    <li key={item}><span>✓</span> {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          {plansError && <p className="pricing-disclaimer" role="alert">{plansError}</p>}
          {!plansError && !plans.length && <p className="pricing-disclaimer">Loading available plans…</p>}
        </section>

        <section className="cta-section">
          <span className="section-kicker">THE FUTURE OF RESTAURANT OPERATIONS</span>
          <h2>Ready to run your restaurant smarter?</h2>
          <p>Bring your menu, orders, kitchen and operations together with TexOS.</p>
          <a href="#home" className="button cta-button">Explore TexOS <span>→</span></a>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}

function CustomerMenuRoute() {
  const { qrToken } = useParams();
  return <CustomerMenu key={qrToken} />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-and-conditions" element={<TermsPage />} />
      <Route path="/refund-policy" element={<RefundPolicyPage />} />
      <Route path="/cookie-policy" element={<CookiePolicyPage />} />
      <Route path="/payment-security" element={<PaymentSecurityPage />} />
      <Route path="/grievance-redressal" element={<GrievancePage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/plans" element={<><SubscriptionPageMetadata /><SubscriptionPage /></>} />
      <Route path="/onboarding" element={<ProtectedRoute onboarding><GoogleOnboarding /></ProtectedRoute>} />
      <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/texos-admin" element={<AdminPortal />} />
      <Route path="/texos-admin/login" element={<AdminPortal />} />
      <Route path="/texos-admin/client-data/:restaurantId" element={<ClientDataPage />} />
      <Route path="/kitchen-staff" element={<KitchenStaffPortal />} />
      <Route path="/order-approval/:accessToken" element={<OrderApprovalPortal />} />
      <Route path="/order-approval" element={<OrderApprovalPortal />} />
      <Route path="/menu/:qrToken" element={<CustomerMenuRoute />} />
      <Route path="/menu/:qrToken/login" element={<CustomerAuthPage mode="login" />} />
      <Route path="/menu/:qrToken/signup" element={<CustomerAuthPage mode="signup" />} />
      <Route path="/menu/:qrToken/forgot-password" element={<CustomerAuthPage mode="forgot-password" />} />
    </Routes>
  );
}

export default App;
