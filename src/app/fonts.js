import { Archivo_Black } from "next/font/google";
import localFont from "next/font/local";

// Stand-in for Sans Uber: heavy, tight sans for the title.
export const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo-black" });

// The same font files used by the native app's login screen.
export const manrope = localFont({
  src: [
    { path: "../assets/fonts/Manrope_400Regular.ttf", weight: "400" },
    { path: "../assets/fonts/Manrope_500Medium.ttf", weight: "500" },
    { path: "../assets/fonts/Manrope_600SemiBold.ttf", weight: "600" },
    { path: "../assets/fonts/Manrope_700Bold.ttf", weight: "700" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

export const fraunces = localFont({
  src: "../assets/fonts/Fraunces_700Bold.ttf",
  weight: "700",
  variable: "--font-fraunces",
  display: "swap",
});
