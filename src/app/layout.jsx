import "./globals.css";
import { display, manrope, fraunces } from "./fonts";
import Providers from "./providers";

export const metadata = {
  title: { default: "BG-SAAR | Bhaktivedanta Gurukula", template: "%s | BG-SAAR" },
  description: "System for Attendance & Achievement Reporting — Bhaktivedanta Gurukula & International School.",
  icons: { icon: "/favicon.png", apple: "/icons/icon-180.png" },
  // Opened from the home screen on an iPhone: full screen, status bar over the page.
  appleWebApp: { capable: true, title: "BG-SAAR", statusBarStyle: "default" },
};

// viewport-fit=cover lets the layout reach under the notch; the frame pads
// itself with env(safe-area-inset-*) so nothing ends up hidden there.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf6",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${manrope.variable} ${fraunces.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
