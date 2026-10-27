import "./globals.css";
import { display, manrope, fraunces } from "./fonts";
import Providers from "./providers";

export const metadata = {
  title: { default: "BG-SAAR | Bhaktivedanta Gurukula", template: "%s | BG-SAAR" },
  description: "System for Attendance & Achievement Reporting — Bhaktivedanta Gurukula & International School.",
  icons: { icon: "/favicon.png" },
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
