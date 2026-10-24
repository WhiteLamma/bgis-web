"use client";

import { useEffect, useRef, useState } from "react";

export default function HeroVideo() {
  const video = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia(
      "(min-width: 901px) and (orientation: landscape) and (prefers-reduced-motion: no-preference)"
    );
    function update() {
      setEnabled(desktop.matches);
      setReady(false);
      setPaused(false);
    }
    update();
    desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);

  async function togglePlayback() {
    if (!video.current) return;
    if (video.current.paused) {
      try {
        await video.current.play();
      } catch {
        setReady(false);
      }
    } else {
      video.current.pause();
    }
  }

  if (!enabled) return null;

  return (
    <>
      <div className="hero-video-layer" aria-hidden="true">
        <video
          ref={video}
          className={`hero-background-video${ready ? " is-ready" : ""}`}
          src="/Videos/Animate%20Hero.mp4"
          poster="/images/bg-saar-hero-v1.png"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          tabIndex={-1}
          onPlaying={() => { setReady(true); setPaused(false); }}
          onPause={() => setPaused(true)}
          onError={() => setReady(false)}
        />
      </div>
      {ready && (
        <button className="hero-video-toggle" type="button" onClick={togglePlayback}>
          <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          {paused ? "Play background" : "Pause background"}
        </button>
      )}
    </>
  );
}
