import Image from "next/image";
import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-artwork" aria-hidden="true">
        <picture>
          <source media="(max-width: 900px)" srcSet="/images/app-login-bg.png" />
          <Image src="/images/bg-saar-login-desktop-v2.webp" alt="" fill priority sizes="100vw" />
        </picture>
      </div>
      <Link className="back-home" href="/">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="m12 5-7 7 7 7M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Back to home</span>
      </Link>
      <div className="login-column">
        <Image className="login-logo" src="/images/app-login-logo.png" alt="Bhaktivedanta Gurukula and International School crest" width={257} height={220} priority />
        <h1 className="login-brand">BG-SAAR</h1>
        <p className="login-school">Bhaktivedanta Gurukula &amp; International School</p>
        <LoginForm />
      </div>
    </main>
  );
}
