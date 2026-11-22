# Public pages: launch review

This note is an internal checklist, not public legal advice.

## Required business details

- Confirm the legal name of the TexOS service provider and its registered business address.
- Confirm the official support email and phone number. The contact-form delivery recipient defaults to the existing `texosservice@gmail.com` support address and can be overridden using backend `MAIL_CONTACT_TO`.
- Appoint and confirm the Grievance Officer's name, designation, official email, phone, and business address.
- Confirm the applicable subscription cancellation, renewal, and refund terms for each plan.
- Confirm data retention/deletion periods, hosting locations, subprocessors, and incident-response procedures.
- Confirm the applicable contracting entity, governing law, and jurisdiction language.

Until confirmed, the Contact Us and Grievance Redressal pages intentionally display explicit placeholders or explain that a channel is not yet available. Do not replace these with guessed details.

## Required technical and legal review

- Verify each data-flow statement in the Privacy Policy against the production configuration and vendor contracts, especially server logs, payment-provider payloads, and session/cookie attributes.
- Confirm disclosures for owner authentication tokens stored in browser local storage and server-managed customer session cookies; review the production cookie domain and security attributes.
- Have qualified Indian counsel review the Privacy Policy, Terms & Conditions, Refund & Cancellation Policy, Cookie Policy, Payment & Security, and Grievance Redressal wording for applicable data-protection, consumer-protection, e-commerce, and payment requirements.
- Confirm retention, deletion, consent, complaint acknowledgement, and grievance resolution processes before making commitments.
- The Contact Us form posts to `/api/public/contact`; the backend sends the message through the configured Gmail SMTP service. It reports success only after SMTP accepts the message. Confirm that the recipient mailbox is monitored and that production SMTP settings are valid.
- No analytics integration or analytics identifier was found. Do not enable a non-essential analytics service until the identifier, applicable consent/preferences, disclosures, and legal review are in place.

## SEO deployment configuration

- Set `VITE_SITE_URL` to the verified HTTPS production origin in the Vercel build environment. The frontend uses it for canonical URLs and emits a sitemap and robots.txt containing only public informational routes; authenticated dashboard/admin/staff and restaurant menu routes are excluded.
- No production domain was present in the project configuration during implementation, so no domain has been invented.
- Verify the generated sitemap and canonical URLs on the deployed domain before submitting the sitemap to search engines.
