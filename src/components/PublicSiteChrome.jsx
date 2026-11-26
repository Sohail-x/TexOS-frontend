import { Link, useLocation } from "react-router-dom";
import "./PublicSiteChrome.css";

const footerGroups = [
  {
    title: "Company",
    links: [
      ["About Us", "/about"],
      ["Contact Us", "/contact"],
      ["FAQ", "/faq"],
      ["Help & Support", "/support"],
      ["Kitchen Staff Access", "/kitchen-staff"],
      ["Order Approval Staff", "/order-approval"],
      ["TexOS Admin", "/texos-admin"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy Policy", "/privacy-policy"],
      ["Terms & Conditions", "/terms-and-conditions"],
      ["Refund & Cancellation Policy", "/refund-policy"],
      ["Cookie Policy", "/cookie-policy"],
    ],
  },
  {
    title: "Payments",
    links: [["Payment & Security", "/payment-security"]],
  },
  {
    title: "Support",
    links: [["Grievance Redressal", "/grievance-redressal"]],
  },
];

export function PublicSiteHeader({ theme, onToggleTheme }) {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  const homeLink = (hash) => (isHome ? hash : `/${hash}`);

  return (
    <header className="navbar">
      <Link className="brand" to="/" aria-label="TexOS home">
        <span className="brand-icon">T</span>
        <span>Tex<span className="brand-highlight">OS</span></span>
      </Link>
      
<nav className="nav-links" aria-label="Main navigation">
  {["Features", "How it works", "Pricing"].map((label, index) => {
    const hashes = ["#features", "#how-it-works", "#pricing"];
    const hash = hashes[index];

    return isHome ? (
      <a href={hash} key={hash}>{label}</a>
    ) : (
      <Link to={`/${hash}`} key={hash}>{label}</Link>
    );
  })}

  {isHome ? (
    <a href={`${import.meta.env.VITE_CUSTOMER_BASE_URL.replace(/\/+$/, "")}/contact`}>
      Need Help?
    </a>
  ) : (
    <Link to="/contact">Need Help?</Link>
  )}
</nav>

      <div className="nav-actions">
        <button
          type="button"
          className="theme-toggle theme-icon-button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <Link className="theme-toggle login-link" to="/login">Log in</Link>
        <Link className="button button-small" to="/signup">
          Get started <span>↗</span>
        </Link>
      </div>
    </header>
  );
}

export function PublicSiteFooter() {
  return (
    <footer className="footer footer-expanded">
      <div className="footer-main">
        <div className="footer-brand-block">
          <Link className="brand footer-brand" to="/">
            <span className="brand-icon">T</span>
            <span>Tex<span className="brand-highlight">OS</span></span>
          </Link>
          <p>One Platform. Every Restaurant Operation.</p>
            <p className="made-by">Made with <span>❤</span> by Md Faiyaz.</p>
            <p className="made-by">My/Our Email <span>:</span> texosservice@gmail.com</p>
        </div>
        <div className="footer-groups">
          {footerGroups.map((group) => (
            <nav className="footer-group" aria-label={group.title} key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, path]) => (
                <Link to={path} key={path}>{label}</Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} TexOS. All rights reserved.</span>
          <div className="footer-social-icons">
            <a href="https://www.instagram.com/texos.co/" target="_blank" rel="noopener noreferrer"> 
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
              </svg>
            </a>
          </div>
        <span>Built for better restaurant operations.</span>
      </div>
    </footer>
  );
}
