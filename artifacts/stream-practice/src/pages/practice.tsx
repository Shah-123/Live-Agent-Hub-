import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Square,
  MonitorOff,
  Activity,
  Clock,
  ChevronDown,
  Send,
  Volume2,
  VolumeX,
  Copy,
  ExternalLink,
  Sparkles,
  Flame,
  Zap,
  Check,
  Radio,
} from "lucide-react";
import { useGetSession, useUpdateSession } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { AGENTS } from "@/lib/agents";
import { ChatMessage } from "@workspace/api-client-react/generated/api.schemas";
import { toast } from "@/hooks/use-toast";
import { useRealtimeVoice } from "../hooks/use-realtime-voice";
import { renderMessageWithEmotes, getAgentBadges } from "@/lib/emotes";
import { soundFX } from "@/lib/sound-fx";

type AgentId = keyof typeof AGENTS;

// Speech Recognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Capture a JPEG frame from a <video> element as base64
function captureVideoFrame(video: HTMLVideoElement | null): string | null {
  if (!video || !video.srcObject || video.videoWidth === 0) return null;
  try {
    const canvas = document.createElement("canvas");
    // Scale down for faster upload — 640px wide is plenty for vision analysis
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // quality 0.7 keeps it small
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1] ?? null;
  } catch {
    return null;
  }
}

// ─── Frame-difference detector ──────────────────────────────────────────────
// Compares a tiny thumbnail of the current frame against the previous one.
// Returns true if the screen has changed meaningfully (> threshold).
const DIFF_CANVAS_SIZE = 64; // very small thumbnail for fast pixel comparison
const DIFF_THRESHOLD = 0.04; // 4% pixel change = "something happened"
let _prevPixels: Uint8ClampedArray | null = null;

function hasScreenChanged(video: HTMLVideoElement | null): boolean {
  if (!video || !video.srcObject || video.videoWidth === 0) return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = DIFF_CANVAS_SIZE;
    canvas.height = DIFF_CANVAS_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(video, 0, 0, DIFF_CANVAS_SIZE, DIFF_CANVAS_SIZE);
    const { data: currentPixels } = ctx.getImageData(0, 0, DIFF_CANVAS_SIZE, DIFF_CANVAS_SIZE);

    if (!_prevPixels) {
      _prevPixels = new Uint8ClampedArray(currentPixels);
      return true; // first frame → treat as "changed"
    }

    // Count pixels that differ by more than a small per-channel tolerance
    const totalPixels = DIFF_CANVAS_SIZE * DIFF_CANVAS_SIZE;
    let changedPixels = 0;
    for (let i = 0; i < currentPixels.length; i += 4) {
      const dr = Math.abs(currentPixels[i] - _prevPixels[i]);
      const dg = Math.abs(currentPixels[i + 1] - _prevPixels[i + 1]);
      const db = Math.abs(currentPixels[i + 2] - _prevPixels[i + 2]);
      if (dr + dg + db > 60) changedPixels++;
    }

    _prevPixels = new Uint8ClampedArray(currentPixels);
    return changedPixels / totalPixels > DIFF_THRESHOLD;
  } catch {
    return false;
  }
}

export default function PracticeSession() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const sessionId = parseInt(params.id || "0", 10);

  const { data: session, isLoading } = useGetSession(sessionId, {
    query: { 
      enabled: !!sessionId,
      queryKey: ["session", sessionId],
    },
  });
  const updateSession = useUpdateSession();

  const [isMicActive, setIsMicActive] = useState(false);
  const [isScreenShared, setIsScreenShared] = useState(false);
  // Displayed messages (after stagger delay)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sessionTime, setSessionTime] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  // Sound & Overlay State
  const [isMuted, setIsMuted] = useState(soundFX.isMuted());
  const [copiedOverlay, setCopiedOverlay] = useState(false);
  // Donation popup state
  const [activeDonation, setActiveDonation] = useState<{ content: string; id: number } | null>(null);
  const donationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Queue of pending messages waiting to be revealed
  const pendingQueueRef = useRef<ChatMessage[]>([]);
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAutoScrollRef = useRef(true);

  // Subscribe to audio mute changes
  useEffect(() => {
    return soundFX.subscribe(setIsMuted);
  }, []);

  // Realtime Voice Hook
  const { isConnected: isRealtimeConnected, isReady: isRealtimeReady, connect: connectRealtime, disconnect: disconnectRealtime } = useRealtimeVoice();
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const transcriptBufferRef = useRef<string>("");
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenWatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMicActiveRef = useRef(false);
  const isScreenSharedRef = useRef(false);
  // Cooldown: don't trigger agents again until previous batch is done
  const agentCooldownRef = useRef(false);

  // ─── Scroll handling ──────────────────────────────────────────────────────
  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    // Are we near the bottom? (within 80px)
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAutoScrollRef.current = atBottom;
    if (atBottom) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }
    isAutoScrollRef.current = true;
    setUnreadCount(0);
  }, []);

  // ─── Bursty display ticker ─────────────────────────────────────────────
  // Mimics real chat: rapid bursts of 2-3 messages, then natural pauses
  const burstCountRef = useRef(0);                     // msgs shown in current burst
  const burstSizeRef = useRef(0);                      // target size of current burst

  const startDisplayTicker = useCallback(() => {
    if (displayIntervalRef.current) return; // already running

    const tick = () => {
      if (pendingQueueRef.current.length === 0) {
        // Nothing pending — stop ticker and release cooldown
        displayIntervalRef.current = null;
        agentCooldownRef.current = false;
        burstCountRef.current = 0;
        return;
      }

      const next = pendingQueueRef.current.shift()!;
      setMessages((prev) => [...prev, next]);
      burstCountRef.current++;

      // Auto-scroll only if user hasn't scrolled up
      if (isAutoScrollRef.current) {
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 50);
      } else {
        setUnreadCount((c) => c + 1);
      }

      // Determine delay for next message — bursty pattern
      let delay: number;
      if (burstCountRef.current === 0) {
        // Start a new burst: pick how many msgs come rapidly
        burstSizeRef.current = 1 + Math.floor(Math.random() * 3); // 1-3 msgs per burst
      }

      if (burstCountRef.current < burstSizeRef.current) {
        // Within a burst — rapid fire (100-400ms)
        delay = 100 + Math.random() * 300;
      } else {
        // Burst finished — natural pause before next burst (2-6s)
        delay = 2000 + Math.random() * 4000;
        burstCountRef.current = 0;
      }

      // Schedule next tick with variable delay
      displayIntervalRef.current = setTimeout(tick, delay) as unknown as ReturnType<typeof setInterval>;
    };

    // Start first tick quickly
    displayIntervalRef.current = setTimeout(tick, 200 + Math.random() * 500) as unknown as ReturnType<typeof setInterval>;
  }, []);

  // ─── Enqueue a message for staggered display ──────────────────────────────
  const enqueueMessage = useCallback(
    (msg: ChatMessage) => {
      pendingQueueRef.current.push(msg);
      startDisplayTicker();

      // Trigger donation popup & audio if it's a donation message
      if (msg.agentType === "donator" || msg.content?.startsWith("🔊")) {
        if (donationTimeoutRef.current) clearTimeout(donationTimeoutRef.current);
        setActiveDonation({ content: msg.content, id: Date.now() });

        // Play chime & speak TTS
        soundFX.playDonationChime();
        soundFX.speakDonation(msg.content);

        donationTimeoutRef.current = setTimeout(() => {
          setActiveDonation(null);
        }, 7000);
      } else {
        // Subtle message entry sound
        soundFX.playMessagePop();
      }
    },
    [startDisplayTicker]
  );

  // ─── Quick Simulation Helpers ───────────────────────────────────────────
  const simulateDonation = useCallback(
    (amount = 5) => {
      const donors = ["xX_ShadowNinja_Xx", "cozy_vibes_23", "pogmaster420", "cyber_samurai", "luna_sky", "turbo_gamer"];
      const donor = donors[Math.floor(Math.random() * donors.length)];
      const msgs = [
        "bro this stream is legendary keep it up!!",
        "first time catching you live, loving the vibes",
        "can u say hi to my friend jake hes watching too",
        "clutch this round or i want my money back lmao",
        "huge fan from canada!! POGGERS",
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      const content = `🔊 ${donor} donated $${amount}! ${msg}`;
      enqueueMessage({
        id: Date.now() + Math.random(),
        sessionId,
        agentType: "donator",
        agentName: "Donator",
        content,
        timestamp: new Date().toISOString(),
      });
      toast({ title: "💰 Donation Alert Triggered", description: `$${amount} donation simulated with TTS voice!` });
    },
    [sessionId, enqueueMessage]
  );

  const simulateHypeWave = useCallback(() => {
    const hypeMessages = [
      { type: "hype_fan", name: "HypeFan", text: "LETS GOOO POGGERS" },
      { type: "pog_farmer", name: "PogFarmer", text: "POGGERS POGGERS POGGERS" },
      { type: "memer", name: "TheMemer", text: "he is actually him fr 💀 KEKW" },
      { type: "clipper", name: "TheClipper", text: "CLIP IT CLIP IT" },
      { type: "critic", name: "TheCritic", text: "ok that play was actually 5Head" },
    ];
    soundFX.playRaidFanfare();
    hypeMessages.forEach((h, idx) => {
      setTimeout(() => {
        enqueueMessage({
          id: Date.now() + Math.random() + idx,
          sessionId,
          agentType: h.type,
          agentName: h.name,
          content: h.text,
          timestamp: new Date().toISOString(),
        });
      }, idx * 250);
    });
    toast({ title: "🔥 Hype Wave Triggered", description: "5 rapid chatter reactions incoming!" });
  }, [sessionId, enqueueMessage]);

  const copyOverlayUrl = useCallback(() => {
    const url = `${window.location.origin}/session/${sessionId}/overlay`;
    navigator.clipboard.writeText(url);
    setCopiedOverlay(true);
    toast({ title: "OBS Overlay URL Copied!", description: "Paste as Browser Source into OBS Studio / Streamlabs." });
    setTimeout(() => setCopiedOverlay(false), 2500);
  }, [sessionId]);

  const openOverlayPopup = useCallback(() => {
    const url = `${window.location.origin}/session/${sessionId}/overlay`;
    window.open(url, "StreamOverlay", "width=480,height=750,menubar=no,toolbar=no,location=no,status=no");
  }, [sessionId]);

  // ─── Load initial messages on mount ───────────────────────────────────────
  useEffect(() => {
    if (sessionId) {
      customFetch<ChatMessage[]>(`/api/sessions/${sessionId}/messages`)
        .then((data) => {
          if (Array.isArray(data)) {
            setMessages(data);
            setTimeout(() => {
              if (chatContainerRef.current)
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }, 50);
          }
        })
        .catch(console.error);
    }
  }, [sessionId]);

  // ─── Session Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (session?.status === "active") {
      timerIntervalRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [session?.status]);

  // Keep screen share ref in sync with state
  useEffect(() => {
    isScreenSharedRef.current = isScreenShared;
  }, [isScreenShared]);

  // ─── Agent response trigger ────────────────────────────────────────────────
  const triggerAgentResponse = useCallback(
    async (finalTranscript: string, screenOnly = false) => {
      if (!session) return;
      // If not a screen-only trigger, require some transcript text
      if (!screenOnly && !finalTranscript.trim()) return;
      if (agentCooldownRef.current) return; // wait for previous batch
      agentCooldownRef.current = true;

      // Capture screen frame if screen is shared
      const screenCapture = captureVideoFrame(videoRef.current);

      // Collect recent message content for context
      const recentMessages = messages
        .slice(-12)
        .map((m) => `${m.agentName}: ${m.content}`);

      try {
        const response = await fetch(`/api/sessions/${sessionId}/agent-response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: finalTranscript,
            screenCapture: screenCapture ?? undefined,
            screenContext: isScreenShared && !screenCapture
              ? "User is sharing their screen"
              : undefined,
            difficulty: session.difficulty,
            activeAgents: session.activeAgents,
            recentMessages,
          }),
        });

        if (!response.ok) {
          agentCooldownRef.current = false;
          throw new Error("Network error");
        }
        if (!response.body) {
          agentCooldownRef.current = false;
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            try {
              const eventData = JSON.parse(dataStr);
              if (eventData.done) {
                // All agent messages received — let the ticker drain them naturally
                return;
              }
              if (eventData.agentType && eventData.content) {
                const newMessage: ChatMessage = {
                  id: eventData.id ?? Date.now() + Math.random(),
                  sessionId,
                  agentType: eventData.agentType,
                  agentName: eventData.agentName,
                  content: eventData.content,
                  timestamp: eventData.timestamp ?? new Date().toISOString(),
                };
                enqueueMessage(newMessage);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (error) {
        console.error("Error triggering agents:", error);
        agentCooldownRef.current = false;
      }
    },
    [sessionId, session, isScreenShared, messages, enqueueMessage]
  );

  // ─── Streamer reply-to-chat ─────────────────────────────────────────────
  const sendStreamerReply = useCallback(
    async (text: string) => {
      if (!text.trim() || !session || isSendingReply) return;
      setIsSendingReply(true);

      // Show the streamer's message in chat immediately
      const streamerMsg: ChatMessage = {
        id: Date.now() + Math.random(),
        sessionId,
        agentType: "streamer",
        agentName: "You",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, streamerMsg]);
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);

      // Collect recent messages for context
      const recentMessages = messages
        .slice(-12)
        .map((m) => `${m.agentName}: ${m.content}`);
      // Add the streamer's own reply to context
      recentMessages.push(`You (streamer): ${text.trim()}`);

      const screenCapture = captureVideoFrame(videoRef.current);

      try {
        const response = await fetch(`/api/sessions/${sessionId}/agent-response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamerReply: text.trim(),
            transcript: "",
            screenCapture: screenCapture ?? undefined,
            difficulty: session.difficulty,
            activeAgents: session.activeAgents,
            recentMessages,
          }),
        });

        if (!response.ok || !response.body) {
          setIsSendingReply(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            try {
              const eventData = JSON.parse(dataStr);
              if (eventData.done) {
                setIsSendingReply(false);
                return;
              }
              if (eventData.agentType && eventData.content) {
                const newMessage: ChatMessage = {
                  id: eventData.id ?? Date.now() + Math.random(),
                  sessionId,
                  agentType: eventData.agentType,
                  agentName: eventData.agentName,
                  content: eventData.content,
                  timestamp: eventData.timestamp ?? new Date().toISOString(),
                };
                enqueueMessage(newMessage);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } catch (error) {
        console.error("Error sending streamer reply:", error);
      }
      setIsSendingReply(false);
    },
    [sessionId, session, messages, enqueueMessage, isSendingReply]
  );

  // ─── Mic setup ────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (isMicActiveRef.current) {
      if (isRealtimeEnabled) {
        disconnectRealtime();
      } else {
        recognitionRef.current?.stop();
      }
      setIsMicActive(false);
      isMicActiveRef.current = false;
      setLiveTranscript("");
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    } else {
      if (isRealtimeEnabled) {
        connectRealtime();
        setIsMicActive(true);
        isMicActiveRef.current = true;
        return;
      }

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        toast({
          title: "Not supported",
          description: "Speech recognition is not supported in this browser. Try Chrome.",
          variant: "destructive",
        });
        return;
      }

      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsMicActive(true);
        isMicActiveRef.current = true;
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        setLiveTranscript(interimTranscript || finalTranscript);

        if (finalTranscript) {
          transcriptBufferRef.current += " " + finalTranscript;
          triggerAgentResponse(transcriptBufferRef.current.trim());
          transcriptBufferRef.current = "";
        } else {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (interimTranscript.trim()) {
              triggerAgentResponse(interimTranscript.trim());
              transcriptBufferRef.current = "";
              setLiveTranscript("");
            }
          }, 2500);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== "no-speech") {
          setIsMicActive(false);
          isMicActiveRef.current = false;
        }
      };

      recognition.onend = () => {
        // Auto-restart continuous listening
        if (isMicActiveRef.current) {
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (e) {
        console.error("Could not start recognition", e);
      }
    }
  }, [triggerAgentResponse]);

  // ─── Screen-watch: fire agents from screen alone when user is quiet ────────
  const startScreenWatcher = useCallback(() => {
    if (screenWatchIntervalRef.current) return;
    // Check every 6 seconds; only fire if screen actually changed
    screenWatchIntervalRef.current = setInterval(() => {
      if (!isScreenSharedRef.current) return;
      // Only trigger if no speech is happening and agents are free
      if (agentCooldownRef.current) return;
      // Detect meaningful screen change to avoid spamming agents on a static screen
      if (hasScreenChanged(videoRef.current)) {
        console.log("[ScreenWatcher] Screen change detected — triggering agents");
        triggerAgentResponse("", true); // empty transcript, screen-only flag
      }
    }, 6000);
  }, [triggerAgentResponse]);

  const stopScreenWatcher = useCallback(() => {
    if (screenWatchIntervalRef.current) {
      clearInterval(screenWatchIntervalRef.current);
      screenWatchIntervalRef.current = null;
    }
  }, []);

  // ─── Screen share ─────────────────────────────────────────────────────────
  const toggleScreenShare = async () => {
    if (isScreenShared) {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsScreenShared(false);
      stopScreenWatcher();
      _prevPixels = null; // reset frame diff state
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, frameRate: 60 },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsScreenShared(true);
        startScreenWatcher();
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenShared(false);
          if (videoRef.current) videoRef.current.srcObject = null;
          stopScreenWatcher();
          _prevPixels = null; // reset frame diff state
        };
      } catch {
        toast({ title: "Error", description: "Could not share screen.", variant: "destructive" });
      }
    }
  };

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopScreenWatcher();
      if (displayIntervalRef.current) clearTimeout(displayIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
    };
  }, [stopScreenWatcher]);

  // ─── End session ──────────────────────────────────────────────────────────
  const endSession = () => {
    if (isMicActiveRef.current) toggleMic();
    stopScreenWatcher();
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    updateSession.mutate(
      { id: sessionId, data: { status: "ended", talkTimeSeconds: sessionTime } },
      { onSuccess: () => setLocation(`/session/${sessionId}/analytics`) }
    );
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (isLoading || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-white">
        Loading arena...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                session.status === "active" ? "bg-red-500 animate-pulse" : "bg-muted"
              }`}
            />
            <span className="font-bold text-white tracking-wider uppercase text-sm">Live Rehearsal</span>
          </div>
          <div className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
            {session.difficulty}
          </div>
          {isScreenShared && (
            <div className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 hidden sm:block">
              Screen Active
            </div>
          )}

          {/* Quick Simulation Bar */}
          <div className="hidden lg:flex items-center gap-1.5 ml-2 border-l border-border pl-3">
            <button
              onClick={() => simulateDonation(5)}
              className="px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Trigger a simulated $5 donation with TTS alert"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Test Dono
            </button>
            <button
              onClick={simulateHypeWave}
              className="px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Trigger a 5-message chat hype wave"
            >
              <Flame className="w-3.5 h-3.5" />
              Hype Wave
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Audio Alert Toggle */}
          <button
            onClick={() => soundFX.toggleMute()}
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isMuted
                ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                : "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25"
            }`}
            title={isMuted ? "Click to unmute stream sound alerts & TTS" : "Click to mute stream sound alerts & TTS"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? "Muted" : "Alerts ON"}</span>
          </button>

          {/* OBS Overlay Menu */}
          <div className="flex items-center gap-1">
            <button
              onClick={copyOverlayUrl}
              className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy transparent browser source URL for OBS Studio"
            >
              {copiedOverlay ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
              <span>{copiedOverlay ? "Copied!" : "OBS Overlay"}</span>
            </button>
            <button
              onClick={openOverlayPopup}
              className="p-1 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-white transition-colors cursor-pointer"
              title="Open OBS Overlay in a separate popup window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isRealtimeEnabled ? (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${isRealtimeConnected ? "text-green-400" : "text-yellow-500"}`}>
                <Activity className={`w-3.5 h-3.5 ${isRealtimeConnected ? "animate-pulse" : ""}`} />
                {isRealtimeConnected ? (isRealtimeReady ? "Realtime Active" : "Connecting...") : "Relay Disconnected"}
              </div>
            ) : isMicActive ? (
              <div className="flex items-center gap-1.5 text-green-400 text-xs font-medium">
                <Activity className="w-3.5 h-3.5 animate-pulse" /> Listening
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                <MicOff className="w-3.5 h-3.5" /> Mic Off
              </div>
            )}
          </div>

          <div className="text-lg font-mono font-bold text-white bg-background px-2.5 py-0.5 rounded border border-border flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {formatTime(sessionTime)}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Screen Preview */}
        <div className="flex-1 flex flex-col bg-background p-4 relative">
          <div className="flex-1 rounded-lg border-2 border-border bg-card flex flex-col items-center justify-center overflow-hidden relative shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${isScreenShared ? "block" : "hidden"}`}
            />
            {!isScreenShared && (
              <div className="text-center text-muted-foreground flex flex-col items-center">
                <MonitorOff className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-medium text-lg text-white">No Screen Shared</p>
                <p className="text-sm mt-1 max-w-xs">
                  Share your screen so agents can react to what you're playing or doing
                </p>
              </div>
            )}
          </div>

          {/* Donation Alert Popup */}
          {activeDonation && (
            <div
              key={activeDonation.id}
              className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none z-20 animate-fly-in max-w-lg w-full px-4"
            >
              <div className="relative px-6 py-4 rounded-2xl border-2 border-green-400/80 bg-gradient-to-r from-emerald-950/95 via-green-900/95 to-teal-950/95 backdrop-blur-xl shadow-[0_0_50px_rgba(34,197,94,0.5)] text-center">
                <div className="text-green-300 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 mb-1">
                  <Sparkles className="w-4 h-4 text-green-400 animate-spin" />
                  💰 New Stream Donation!
                </div>
                <div className="text-white text-lg font-bold leading-snug drop-shadow-md">
                  {renderMessageWithEmotes(activeDonation.content)}
                </div>
              </div>
            </div>
          )}

          {/* Live Transcript Overlay */}
          {liveTranscript && (
            <div className="absolute bottom-8 left-8 right-8 pointer-events-none">
              <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-4 text-white text-lg font-medium shadow-xl mx-auto max-w-3xl text-center">
                "{liveTranscript}"
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat Panel */}
        <div className="w-80 md:w-96 border-l border-border bg-card flex flex-col shrink-0">
          <div className="p-3 border-b border-border bg-background/50 text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
            <span>Stream Chat</span>
            <span className="flex items-center gap-1">
              {pendingQueueRef.current.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
              )}
              {messages.length} msgs
            </span>
          </div>

          <div className="relative flex-1">
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="absolute inset-0 overflow-y-auto p-4 space-y-2.5 chat-scrollbar"
            >
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm italic mt-10">
                  Waiting for messages... Start your mic or click Quick Tests to start chat.
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isStreamer = msg.agentType === "streamer";
                  const agent = isStreamer ? null : (AGENTS[msg.agentType as AgentId] ?? AGENTS.lurker);
                  const badges = getAgentBadges(msg.agentType);

                  return (
                    <div
                      key={msg.id ?? i}
                      className={`text-sm leading-relaxed break-words ${
                        isStreamer
                          ? "bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 ml-3 shadow-[0_0_12px_rgba(124,58,237,0.1)]"
                          : "hover:bg-white/[0.02] rounded px-1.5 py-0.5 transition-colors"
                      }`}
                      style={{
                        animation: "fadeSlideIn 0.3s ease-out forwards",
                      }}
                    >
                      {/* Chatter Badges */}
                      <div className="inline-flex items-center gap-1 mr-1.5 align-middle select-none">
                        {badges.map((b) => (
                          <span
                            key={b.id}
                            title={b.name}
                            className={`inline-flex items-center justify-center text-[10px] px-1 py-0.2 rounded border ${b.bgClass} ${b.borderClass} ${b.textColor} font-bold`}
                          >
                            {b.icon}
                          </span>
                        ))}
                      </div>

                      {isStreamer ? (
                        <>
                          <span className="font-extrabold mr-1.5 text-primary">You:</span>
                          <span className="text-white">{renderMessageWithEmotes(msg.content)}</span>
                        </>
                      ) : (
                        <>
                          <span
                            className="font-extrabold mr-1.5 inline-block"
                            style={{ color: agent!.color }}
                          >
                            {agent!.name}:
                          </span>
                          <span className="text-white/90">
                            {renderMessageWithEmotes(msg.content)}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Scroll-to-bottom indicator */}
            {!isAutoScrollRef.current && unreadCount > 0 && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/90 hover:bg-primary text-white text-xs font-bold shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 cursor-pointer z-10"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                {unreadCount} new message{unreadCount > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Chat Input */}
          {session?.status === "active" && (
            <div className="p-3 border-t border-border bg-background/50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    sendStreamerReply(chatInput);
                    setChatInput("");
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Reply to chat..."
                  disabled={isSendingReply}
                  className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isSendingReply}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-all flex items-center gap-1.5 text-sm font-bold"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Type a reply — agents will react to your message
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Toolbar */}
      <footer className="h-20 border-t border-border bg-card flex items-center justify-center gap-4 shrink-0 relative z-10">
        <Button
          variant={isMicActive ? "default" : "outline"}
          size="lg"
          onClick={toggleMic}
          className={`w-16 h-16 rounded-full p-0 flex items-center justify-center transition-all duration-300 ${
            isMicActive
              ? isRealtimeEnabled 
                ? "bg-green-600 hover:bg-green-700 text-white border-0 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                : "bg-primary hover:bg-primary/90 text-white border-0 shadow-[0_0_20px_rgba(124,58,237,0.6)]"
              : "bg-background hover:bg-muted text-muted-foreground"
          }`}
          title={isMicActive ? "Mute Mic" : "Unmute Mic"}
        >
          {isMicActive ? <Mic className="h-6 w-6 animate-pulse" /> : <MicOff className="h-6 w-6" />}
        </Button>

        <Button
          variant={isRealtimeEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (isMicActive) toggleMic(); // Turn off current mic before switching
            setIsRealtimeEnabled(!isRealtimeEnabled);
          }}
          className={`absolute -top-12 left-1/2 -translate-x-1/2 gap-2 h-9 px-4 rounded-full border border-white/10 ${
            isRealtimeEnabled ? "bg-green-900/40 text-green-400" : "bg-black/60 text-muted-foreground"
          }`}
        >
          <Activity className={`w-3.5 h-3.5 ${isRealtimeEnabled ? "animate-pulse" : ""}`} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            {isRealtimeEnabled ? "OpenAI Realtime: ON" : "Standard Engine"}
          </span>
        </Button>

        <Button
          variant={isScreenShared ? "default" : "outline"}
          size="lg"
          onClick={toggleScreenShare}
          className={`w-16 h-16 rounded-full p-0 flex items-center justify-center ${
            isScreenShared
              ? "bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
              : "bg-background hover:bg-muted text-muted-foreground"
          }`}
          title={isScreenShared ? "Stop Sharing" : "Share Screen"}
        >
          {isScreenShared ? <Square className="h-6 w-6" /> : <MonitorUp className="h-6 w-6" />}
        </Button>

        <div className="w-px h-10 bg-border mx-4" />

        <Button
          variant="destructive"
          size="lg"
          onClick={endSession}
          className="font-bold uppercase tracking-widest px-8 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
        >
          <PhoneOff className="mr-2 h-5 w-5" />
          End Session
        </Button>
      </footer>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
