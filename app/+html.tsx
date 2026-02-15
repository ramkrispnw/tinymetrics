import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Root HTML layout for the web version.
 * Adds PWA meta tags, mobile viewport, and web app manifest link.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Mobile viewport */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* PWA / Mobile Web App meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TinyMetrics" />
        <meta name="application-name" content="TinyMetrics" />
        <meta name="theme-color" content="#6C63FF" />
        <meta name="description" content="Track your baby's feeds, sleep, diapers, and more with AI-powered insights." />

        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* Web manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Prevent text size adjustment on orientation change */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
                overscroll-behavior: none;
                -webkit-overflow-scrolling: touch;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
              }
              body {
                position: fixed;
                width: 100%;
                height: 100%;
                overflow: hidden;
              }
              #root {
                width: 100%;
                height: 100%;
                overflow: auto;
                -webkit-overflow-scrolling: touch;
              }
            `,
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
