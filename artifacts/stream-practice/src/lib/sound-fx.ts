/**
 * Web Audio Sound Synthesizer & Web Speech TTS Engine for Live Agent Hub
 * Completely self-contained: requires zero external audio files and works offline!
 */

class SoundFXEngine {
  private audioCtx: AudioContext | null = null;
  private muted: boolean = false;
  private ttsEnabled: boolean = true;
  private listeners: Set<(muted: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      const savedMute = localStorage.getItem("stream_sound_muted");
      if (savedMute !== null) {
        this.muted = savedMute === "true";
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("stream_sound_muted", String(muted));
    }
    this.listeners.forEach((cb) => cb(this.muted));
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public subscribe(cb: (muted: boolean) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public isTtsEnabled(): boolean {
    return this.ttsEnabled;
  }

  public setTtsEnabled(enabled: boolean) {
    this.ttsEnabled = enabled;
  }

  /**
   * Play an uplifting stream donation alert chime (C5 -> E5 -> G5 -> C6 arpeggio)
   */
  public playDonationChime() {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.25 }, // C5
      { freq: 659.25, time: 0.12, dur: 0.25 }, // E5
      { freq: 783.99, time: 0.24, dur: 0.30 }, // G5
      { freq: 1046.5, time: 0.36, dur: 0.65 }, // C6 (long finish)
    ];

    const now = ctx.currentTime;

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);

      // Soft attack & exponential decay envelope
      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(0.22, now + time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);

      // Add warm subtle triangle harmonic
      const harmonicOsc = ctx.createOscillator();
      const harmonicGain = ctx.createGain();
      harmonicOsc.type = "triangle";
      harmonicOsc.frequency.setValueAtTime(freq * 2, now + time);

      harmonicGain.gain.setValueAtTime(0.001, now + time);
      harmonicGain.gain.exponentialRampToValueAtTime(0.08, now + time + 0.02);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + time + dur * 0.8);

      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(ctx.destination);

      harmonicOsc.start(now + time);
      harmonicOsc.stop(now + time + dur);
    });
  }

  /**
   * Play a subtle chat message entry pop
   */
  public playMessagePop() {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Play an energetic raid / hype fanfare
   */
  public playRaidFanfare() {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const notes = [
      { freq: 440.0, time: 0.00, dur: 0.15 }, // A4
      { freq: 554.37, time: 0.12, dur: 0.15 }, // C#5
      { freq: 659.25, time: 0.24, dur: 0.18 }, // E5
      { freq: 880.0, time: 0.38, dur: 0.50 }, // A5
    ];

    const now = ctx.currentTime;
    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(0.25, now + time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  }

  /**
   * Read out donation message using browser Web Speech Synthesis (Twitch TTS bot style)
   */
  public speakDonation(text: string) {
    if (this.muted || !this.ttsEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel(); // Stop any overlapping speech

      // Clean text: strip emoji or leading sound icon "🔊"
      let cleanText = text.replace(/^🔊\s*/, "").trim();

      // Format for realistic speech: e.g. "ShadowNinja donated 5 dollars: text"
      cleanText = cleanText.replace(/donated\s+\$(\d+)!?/i, "donated $1 dollars. ");

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05; // Slightly brisk pace
      utterance.pitch = 1.05; // Classic crisp voice pitch
      utterance.volume = 0.9;

      // Select good English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google UK English") ||
            v.name.includes("Google US") ||
            v.name.includes("Samantha") ||
            v.name.includes("David") ||
            v.name.includes("Daniel"))
      ) || voices.find((v) => v.lang.startsWith("en"));

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      // Small delay after chime before speech begins
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 500);
    } catch (err) {
      console.warn("TTS playback error:", err);
    }
  }
}

export const soundFX = new SoundFXEngine();
