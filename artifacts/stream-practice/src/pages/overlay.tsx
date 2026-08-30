import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import type { ChatMessage } from "@workspace/api-client-react/generated/api.schemas";
import { AGENTS, AgentId } from "@/lib/agents";
import { renderMessageWithEmotes, getAgentBadges } from "@/lib/emotes";
import { soundFX } from "@/lib/sound-fx";
import { Volume2, VolumeX, Eye, Sparkles } from "lucide-react";

export default function StreamOverlay() {
  const params = useParams();
  const sessionId = parseInt(params.id || "0", 10);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeDonation, setActiveDonation] = useState<{ content: string; id: number } | null>(null);
  const [isMuted, setIsMuted] = useState(soundFX.isMuted());
  const [autoFade, setAutoFade] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [textSize, setTextSize] = useState<"sm" | "base" | "lg">("base");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const donationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to mute changes
  useEffect(() => {
    return soundFX.subscribe(setIsMuted);
  }, []);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (seenIdsRef.current.has(msg.id)) return;
    seenIdsRef.current.add(msg.id);

    setMessages((prev) => [...prev.slice(-40), msg]);

    // Play subtle entry pop for regular messages
    soundFX.playMessagePop();

    // Check for donation alert
    if (msg.agentType === "donator" || msg.content?.startsWith("🔊")) {
      if (donationTimeoutRef.current) clearTimeout(donationTimeoutRef.current);
      setActiveDonation({ content: msg.content, id: Date.now() });

      // Play alert chime and TTS
      soundFX.playDonationChime();
      soundFX.speakDonation(msg.content);

      donationTimeoutRef.current = setTimeout(() => {
        setActiveDonation(null);
      }, 7000);
    }

    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  // Poll for messages in overlay mode
  useEffect(() => {
    if (!sessionId) return;

    const fetchMessages = async () => {
      try {
        const data = await customFetch<ChatMessage[]>(`/api/sessions/${sessionId}/messages`);
        if (Array.isArray(data)) {
          data.forEach((msg) => {
            if (!seenIdsRef.current.has(msg.id)) {
              handleNewMessage(msg);
            }
          });
        }
      } catch (err) {
        console.error("Overlay message fetch error:", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1200);
    return () => clearInterval(interval);
  }, [sessionId, handleNewMessage]);

  return (
    <div
      className="w-screen h-screen bg-transparent overflow-hidden font-sans relative select-none p-6 flex flex-col justify-between"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Top Banner: Donation Alert */}
      <div className="w-full flex justify-center pointer-events-none">
        {activeDonation && (
          <div
            key={activeDonation.id}
            className="animate-fly-in max-w-xl w-full"
          >
            <div className="relative px-6 py-4 rounded-2xl border-2 border-green-400/90 bg-gradient-to-r from-emerald-950/95 via-green-900/95 to-teal-950/95 backdrop-blur-xl shadow-[0_0_50px_rgba(34,197,94,0.6)] text-center">
              <div className="text-green-300 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-green-400 animate-spin" />
                Stream Donation Alert
              </div>
              <div className="text-white text-xl font-bold drop-shadow-md leading-relaxed">
                {renderMessageWithEmotes(activeDonation.content)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Area: Stream Chat & Controls */}
      <div className="flex items-end justify-between w-full">
        {/* Left / Bottom Chat Box (OBS Transparent Style) */}
        <div className="w-96 max-h-[500px] flex flex-col pointer-events-none">
          <div
            ref={chatContainerRef}
            className="overflow-y-auto space-y-2.5 p-2 chat-scrollbar"
            style={{
              maskImage: "linear-gradient(to bottom, transparent, black 15%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent, black 15%)",
            }}
          >
            {messages.map((msg, i) => {
              const isStreamer = msg.agentType === "streamer";
              const agent = isStreamer ? null : (AGENTS[msg.agentType as AgentId] ?? AGENTS.lurker);
              const badges = getAgentBadges(msg.agentType);

              return (
                <div
                  key={msg.id ?? i}
                  className={`leading-relaxed px-3 py-2 rounded-xl backdrop-blur-md transition-all duration-300 ${
                    isStreamer
                      ? "bg-purple-950/80 border border-purple-500/40 shadow-[0_4px_20px_rgba(124,58,237,0.3)] ml-4"
                      : "bg-black/65 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                  } ${
                    textSize === "sm" ? "text-xs" : textSize === "lg" ? "text-base" : "text-sm"
                  } ${autoFade ? "animate-fade-out" : ""}`}
                  style={{
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  {/* Badges */}
                  <div className="inline-flex items-center gap-1 mr-1.5 align-middle">
                    {badges.map((b) => (
                      <span
                        key={b.id}
                        title={b.name}
                        className={`inline-flex items-center justify-center text-[10px] px-1 py-0.2 rounded border ${b.bgClass} ${b.borderClass} ${b.textColor} font-bold select-none`}
                      >
                        {b.icon}
                      </span>
                    ))}
                  </div>

                  {/* Username */}
                  <span
                    className="font-extrabold mr-1.5 inline-block"
                    style={{
                      color: isStreamer ? "#a855f7" : agent?.color ?? "#ffffff",
                    }}
                  >
                    {isStreamer ? "You" : agent?.name ?? msg.agentName}:
                  </span>

                  {/* Message content with emotes */}
                  <span className="text-white/95 font-medium">
                    {renderMessageWithEmotes(msg.content)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hover Controls (Hidden in clean OBS capture unless hovered) */}
        <div
          className={`transition-opacity duration-200 pointer-events-auto bg-black/80 backdrop-blur-md border border-white/15 rounded-xl p-3 flex items-center gap-3 text-white text-xs ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
            OBS Overlay Controls
          </span>

          <button
            onClick={() => soundFX.toggleMute()}
            className={`p-1.5 rounded-lg border transition-colors ${
              isMuted
                ? "bg-red-500/20 border-red-500/40 text-red-400"
                : "bg-green-500/20 border-green-500/40 text-green-400"
            }`}
            title={isMuted ? "Unmute Audio Alerts" : "Mute Audio Alerts"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setAutoFade(!autoFade)}
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold ${
              autoFade
                ? "bg-primary/30 border-primary text-primary-foreground"
                : "bg-white/5 border-white/10 text-muted-foreground"
            }`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            {autoFade ? "Fade: ON" : "Fade: OFF"}
          </button>

          <div className="flex gap-1 border border-white/10 rounded-lg p-0.5 bg-white/5">
            {(["sm", "base", "lg"] as const).map((size) => (
              <button
                key={size}
                onClick={() => setTextSize(size)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  textSize === size ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
