import { Link, useLocation } from "react-router-dom";

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
        <Link to={homeLink("#features")}>Features</Link>
        <Link to={homeLink("#how-it-works")}>How it works</Link>
        <Link to={homeLink("#pricing")}>Pricing</Link>
        {isHome
          ? <a href="https://mail.google.com/mail/?view=cm&fs=1&to=texosservice%40gmail.com" target="_blank" rel="noreferrer" aria-label="Need help? Email TexOS support">Need Help?</a>
          : <Link to="/support">Need Help?</Link>}
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
            <p className="made-by">Made with <span>❤</span> by Md Sohail.</p>
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
        <span>Built for better restaurant operations.</span>
      </div>
    </footer>
  );
}
