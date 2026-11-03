"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The parts of the Web Speech API used here (not in TypeScript's DOM types in every version). */
type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it for this site in your browser's settings to use voice.",
  "service-not-allowed": "Your browser doesn't allow voice input here.",
  "no-speech": "I didn't hear anything. Try again a little closer to the microphone.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
};

type Props = {
  disabled?: boolean;
  onStart: () => void;
  onText: (text: string) => void; // the words so far (interim results included)
  onError: (message: string) => void;
};

/**
 * Speak a question instead of typing it. Uses the browser's built-in speech recognition, which asks
 * for microphone permission the first time. The text lands in the box for you to check before sending.
 */
export default function VoiceButton({ disabled, onStart, onText, onError }: Props) {
  // The server can't know, so it assumes support; the browser corrects it after hydration.
  const supported = useSyncExternalStore(() => () => {}, () => recognitionCtor() !== null, () => true);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => () => rec.current?.abort(), []);

  const toggle = () => {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onText(`${finalText}${interim}`.trim());
    };
    r.onerror = (e) => {
      if (e.error !== "aborted") onError(ERRORS[e.error] ?? "Voice input stopped unexpectedly. Please try again.");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    onStart();
    rec.current = r;
    setListening(true);
    r.start();
  };

  const label = !supported
    ? "Voice input isn't available in this browser"
    : listening
      ? "Stop listening"
      : "Speak your question (your browser's speech service turns it into text)";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || !supported}
      aria-label={label}
      aria-pressed={listening}
      title={label}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
        listening ? "listening bg-accent text-on-accent" : "btn-ghost text-muted"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
