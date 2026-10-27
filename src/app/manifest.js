/**
 * Web app manifest, so staff can "Add to Home screen" and open BG-SAAR like
 * the phone app: full screen, the school's crest as its icon, straight into
 * the dashboard.
 */
export default function manifest() {
  return {
    name: "BG-SAAR · Bhaktivedanta Gurukula",
    short_name: "BG-SAAR",
    description: "Attendance and student safety for Bhaktivedanta Gurukula & International School.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf6",
    theme_color: "#fbfaf6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
