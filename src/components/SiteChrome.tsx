import Link from "next/link";
import type { Settings } from "@/lib/settings";
import { CartLink } from "./CartLink";
import { NewsletterForm } from "./NewsletterForm";
import { Wordmark } from "./brand/Wordmark";
import { Branch } from "./brand/Botanical";

export function SiteHeader({ settings }: { settings: Settings }) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {settings.announcement ? <div className="announcement">{settings.announcement}</div> : null}
      <header className="site-header">
        <div className="wrap">
          <Link href="/" className="wordmark" aria-label="Experience Coffee, home">
            <Wordmark size="sm" />
          </Link>
          <nav className="site-nav" aria-label="Main">
            <Link href="/shop">Shop</Link>
            <Link href="/#subscribe">Subscribe</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/account">Account</Link>
            <CartLink />
          </nav>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ settings }: { settings: Settings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <Branch className="footer-branch" />
      <div className="wrap">
        <div className="footer-brand">
          <Wordmark size="md" tone="cream" />
          <p>Specialty coffee, roasted light in Lyndhurst, New Jersey.</p>
        </div>
        <div className="footer-grid">
          <div className="footer-newsletter">
            <h2>New lots, first</h2>
            <p>We email when a new coffee lands or a small lot is about to sell out. A couple of times a month at most.</p>
            <NewsletterForm source="footer" />
          </div>
          <div>
            <h2>Visit</h2>
            <p>
              Pickup at {settings.pickupAddress}
              <br />
              {settings.phone ? (
                <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>{settings.phone}</a>
              ) : null}
              <br />
              <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
            </p>
          </div>
          <div>
            <h2>Info</h2>
            <ul>
              <li>
                <Link href="/policies/delivery">Delivery and pickup</Link>
              </li>
              <li>
                <Link href="/policies/refunds">Refunds</Link>
              </li>
              <li>
                <Link href="/policies/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/policies/terms">Terms</Link>
              </li>
              {settings.instagramUrl ? (
                <li>
                  <a href={settings.instagramUrl} rel="me noopener">
                    Instagram
                  </a>
                </li>
              ) : null}
              {settings.tiktokUrl ? (
                <li>
                  <a href={settings.tiktokUrl} rel="me noopener">
                    TikTok
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <p className="footer-fine">
          © {year} {settings.businessName}. Roasted in Lyndhurst, New Jersey.
        </p>
      </div>
    </footer>
  );
}
