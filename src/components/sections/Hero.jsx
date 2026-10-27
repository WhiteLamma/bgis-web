import Image from "next/image";
import Link from "@/components/transition/TransitionLink";
import BlurText from "@/components/ui/BlurText";
import WarpText from "@/components/ui/WarpText/WarpText";
import HeroVideo from "./HeroVideo";

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-artwork" aria-hidden="true">
        <picture>
          <source media="(max-width: 900px), (max-aspect-ratio: 1/1)" srcSet="/images/bg-saar-hero-mobile-v1.webp" />
          <Image src="/images/bg-saar-hero-v1.png" alt="" fill priority sizes="100vw" />
        </picture>
      </div>
      <HeroVideo />
      <div className="hero-crest">
        <Image src="/images/app-login-logo.png" alt="Bhaktivedanta Gurukula & International School crest" width={1024} height={862} priority />
      </div>
      <div className="hero-copy">
        <p className="hero-school">Bhaktivedanta Gurukula &amp; International School</p>
        <h1 id="hero-title" className="hero-title">
          <WarpText
            text="BG-SAAR"
            className="hero-title-warp"
            warpStrength={0.08}
            warpScale={1.7}
            speed={0.55}
            lens="bulge"
            pointerInfluence={0.42}
            pointerStrength={0.38}
            refraction={0.018}
            chromatic={0.35}
            idleDrift={0.2}
            ripple
            clickRipple
            intro
            fontSize="clamp(82px, min(13.5vw, 24svh), 260px)"
            fontWeight={400}
            fontFamily="var(--font-archivo-black), Arial, sans-serif"
            letterSpacing="-0.055em"
            lineHeight={0.9}
          />
        </h1>
        <BlurText
          className="hero-full-form hero-blur-text"
          text="System for Attendance & Achievement Reporting"
          animateBy="words"
          direction="top"
          delay={65}
          stepDuration={0.35}
          blur={6}
          distance={12}
        />
      </div>
      <div className="hero-actions">
        <p className="hero-welcome">Your school day starts here.</p>
        <Link className="dashboard-link" href="/login">
          <span>Login to Dashboard</span>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
            <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className="hero-help">Use your school-provided login details.</p>
      </div>
    </section>
  );
}
