"use client";

import Script from "next/script";

/** Cloudflare Turnstile widget; the token is posted automatically as "cf-turnstile-response". */
export function Turnstile({ siteKey }: { siteKey: string }) {
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" />
    </>
  );
}
