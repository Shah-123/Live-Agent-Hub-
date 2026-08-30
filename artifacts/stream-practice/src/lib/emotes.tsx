import React from "react";

export interface EmoteInfo {
  code: string;
  url: string;
  fallbackText: string;
}

export const EMOTE_MAP: Record<string, EmoteInfo> = {
  POGGERS: {
    code: "POGGERS",
    url: "https://cdn.betterttv.net/emote/58ae8407ff7b7276fb3e5526/2x.webp",
    fallbackText: "🐸🔥",
  },
  poggers: {
    code: "poggers",
    url: "https://cdn.betterttv.net/emote/58ae8407ff7b7276fb3e5526/2x.webp",
    fallbackText: "🐸🔥",
  },
  KEKW: {
    code: "KEKW",
    url: "https://cdn.betterttv.net/emote/5e9c6c187e090362f8b0d93d/2x.webp",
    fallbackText: "🤣",
  },
  kekw: {
    code: "kekw",
    url: "https://cdn.betterttv.net/emote/5e9c6c187e090362f8b0d93d/2x.webp",
    fallbackText: "🤣",
  },
  monkaS: {
    code: "monkaS",
    url: "https://cdn.betterttv.net/emote/56e9f494fff3cc5c35e5287e/2x.webp",
    fallbackText: "😰",
  },
  monkas: {
    code: "monkas",
    url: "https://cdn.betterttv.net/emote/56e9f494fff3cc5c35e5287e/2x.webp",
    fallbackText: "😰",
  },
  catJAM: {
    code: "catJAM",
    url: "https://cdn.betterttv.net/emote/5f1b0186cf6d2144653d2970/2x.webp",
    fallbackText: "🐱🎶",
  },
  catjam: {
    code: "catjam",
    url: "https://cdn.betterttv.net/emote/5f1b0186cf6d2144653d2970/2x.webp",
    fallbackText: "🐱🎶",
  },
  OMEGALUL: {
    code: "OMEGALUL",
    url: "https://cdn.betterttv.net/emote/583089f4737a8e61abb0186b/2x.webp",
    fallbackText: "😮",
  },
  omegalul: {
    code: "omegalul",
    url: "https://cdn.betterttv.net/emote/583089f4737a8e61abb0186b/2x.webp",
    fallbackText: "😮",
  },
  LUL: {
    code: "LUL",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/2.0",
    fallbackText: "😆",
  },
  lul: {
    code: "lul",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/2.0",
    fallbackText: "😆",
  },
  PogChamp: {
    code: "PogChamp",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/dark/2.0",
    fallbackText: "😲",
  },
  pogchamp: {
    code: "pogchamp",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/305954156/default/dark/2.0",
    fallbackText: "😲",
  },
  Kappa: {
    code: "Kappa",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0",
    fallbackText: "😏",
  },
  kappa: {
    code: "kappa",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0",
    fallbackText: "😏",
  },
  GIGACHAD: {
    code: "GIGACHAD",
    url: "https://cdn.betterttv.net/emote/609ab43039d5085604472175/2x.webp",
    fallbackText: "🗿",
  },
  gigachad: {
    code: "gigachad",
    url: "https://cdn.betterttv.net/emote/609ab43039d5085604472175/2x.webp",
    fallbackText: "🗿",
  },
  "5Head": {
    code: "5Head",
    url: "https://cdn.betterttv.net/emote/5d6096d24932b21d9c28bf39/2x.webp",
    fallbackText: "🧠",
  },
  Sadge: {
    code: "Sadge",
    url: "https://cdn.betterttv.net/emote/5e0fa9d40550d42106b896fb/2x.webp",
    fallbackText: "🥺",
  },
  sadge: {
    code: "sadge",
    url: "https://cdn.betterttv.net/emote/5e0fa9d40550d42106b896fb/2x.webp",
    fallbackText: "🥺",
  },
  EZ: {
    code: "EZ",
    url: "https://cdn.betterttv.net/emote/5590b223b344e2c1600d703d/2x.webp",
    fallbackText: "😎",
  },
  Clap: {
    code: "Clap",
    url: "https://cdn.betterttv.net/emote/55b6f480e73a8d991535b706/2x.webp",
    fallbackText: "👏",
  },
  widepeepoHappy: {
    code: "widepeepoHappy",
    url: "https://cdn.betterttv.net/emote/5c317ff5cf31213e4b7713f0/2x.webp",
    fallbackText: "🥰",
  },
  Copium: {
    code: "Copium",
    url: "https://cdn.betterttv.net/emote/603ca2e07d7274092b7eb257/2x.webp",
    fallbackText: "🤿",
  },
  BibleThump: {
    code: "BibleThump",
    url: "https://static-cdn.jtvnw.net/emoticons/v2/86/default/dark/2.0",
    fallbackText: "😭",
  },
};

export interface ChatBadge {
  id: string;
  name: string;
  icon: string;
  bgClass: string;
  borderClass: string;
  textColor: string;
}

export const BADGES: Record<string, ChatBadge> = {
  broadcaster: {
    id: "broadcaster",
    name: "Broadcaster",
    icon: "🎥",
    bgClass: "bg-red-600/80",
    borderClass: "border-red-500",
    textColor: "text-white",
  },
  mod: {
    id: "mod",
    name: "Moderator",
    icon: "⚔️",
    bgClass: "bg-emerald-600/80",
    borderClass: "border-emerald-500",
    textColor: "text-white",
  },
  vip: {
    id: "vip",
    name: "VIP",
    icon: "💎",
    bgClass: "bg-pink-600/80",
    borderClass: "border-pink-500",
    textColor: "text-white",
  },
  sub: {
    id: "sub",
    name: "Subscriber",
    icon: "⭐",
    bgClass: "bg-purple-600/80",
    borderClass: "border-purple-500",
    textColor: "text-white",
  },
  founder: {
    id: "founder",
    name: "1st Founder",
    icon: "🥇",
    bgClass: "bg-amber-600/80",
    borderClass: "border-amber-500",
    textColor: "text-white",
  },
  prime: {
    id: "prime",
    name: "Prime Gaming",
    icon: "👑",
    bgClass: "bg-blue-600/80",
    borderClass: "border-blue-500",
    textColor: "text-white",
  },
  hype: {
    id: "hype",
    name: "Hype Train Conductor",
    icon: "🚂",
    bgClass: "bg-orange-600/80",
    borderClass: "border-orange-500",
    textColor: "text-white",
  },
};

/**
 * Returns authentic badges for a given agent type
 */
export function getAgentBadges(agentType: string): ChatBadge[] {
  switch (agentType) {
    case "streamer":
      return [BADGES.broadcaster];
    case "parasocial_regular":
      return [BADGES.founder, BADGES.sub];
    case "critic":
      return [BADGES.vip, BADGES.sub];
    case "hype_fan":
      return [BADGES.hype, BADGES.prime];
    case "donator":
      return [BADGES.vip];
    case "backseat_coach":
      return [BADGES.mod];
    case "pog_farmer":
      return [BADGES.sub];
    case "memer":
      return [BADGES.sub];
    case "clipper":
      return [BADGES.prime];
    case "troll":
      return [BADGES.sub];
    default:
      return [];
  }
}

/**
 * Render message string with inline Twitch/BTTV emotes and styling
 */
export function renderMessageWithEmotes(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split by whitespace while preserving punctuation attached or separating words
  const words = text.split(/(\s+)/);

  return words.map((part, index) => {
    // If it's whitespace, return as is
    if (/^\s+$/.test(part)) {
      return <span key={index}>{part}</span>;
    }

    // Clean punctuation around word to check for emote
    const cleanWord = part.replace(/^[.,!?:;()]+|[.,!?:;()]+$/g, "");
    const emote = EMOTE_MAP[cleanWord];

    if (emote) {
      // Re-attach any leading or trailing punctuation if present
      const leadingMatch = part.match(/^[.,!?:;()]+/);
      const trailingMatch = part.match(/[.,!?:;()]+$/);
      const leading = leadingMatch ? leadingMatch[0] : "";
      const trailing = trailingMatch ? trailingMatch[0] : "";

      return (
        <span key={index} className="inline-flex items-center align-middle mx-0.5">
          {leading && <span>{leading}</span>}
          <img
            src={emote.url}
            alt={emote.code}
            title={emote.code}
            className="inline-block h-6 w-auto object-contain mx-0.5 align-middle select-none transition-transform hover:scale-125"
            loading="lazy"
            onError={(e) => {
              // Graceful fallback to emoji text if CDN fails
              const target = e.currentTarget;
              target.style.display = "none";
              const span = document.createElement("span");
              span.innerText = ` ${emote.fallbackText} `;
              span.title = emote.code;
              span.className = "inline-block text-base mx-0.5";
              target.parentNode?.insertBefore(span, target);
            }}
          />
          {trailing && <span>{trailing}</span>}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
