export const AGENTS = {
  hype_fan: {
    id: "hype_fan",
    name: "HypeFan",
    emoji: "🧡",
    color: "#f97316", // orange-500
    bgClass: "bg-orange-500/10",
    textClass: "text-orange-500",
  },
  curious_viewer: {
    id: "curious_viewer",
    name: "CuriousViewer",
    emoji: "🤔",
    color: "#3b82f6", // blue-500
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-500",
  },
  critic: {
    id: "critic",
    name: "TheCritic",
    emoji: "🧠",
    color: "#06b6d4", // cyan-500
    bgClass: "bg-cyan-500/10",
    textClass: "text-cyan-500",
  },
  memer: {
    id: "memer",
    name: "TheMemer",
    emoji: "😂",
    color: "#eab308", // yellow-500
    bgClass: "bg-yellow-500/10",
    textClass: "text-yellow-500",
  },
  lurker: {
    id: "lurker",
    name: "TheLurker",
    emoji: "👀",
    color: "#9ca3af", // gray-400
    bgClass: "bg-gray-500/10",
    textClass: "text-gray-400",
  },
  donator: {
    id: "donator",
    name: "Donator",
    emoji: "💰",
    color: "#22c55e", // green-500
    bgClass: "bg-green-500/10",
    textClass: "text-green-500",
  },
  newbie: {
    id: "newbie",
    name: "Newbie",
    emoji: "🆕",
    color: "#a855f7", // purple-500
    bgClass: "bg-purple-500/10",
    textClass: "text-purple-500",
  },
  troll: {
    id: "troll",
    name: "TheTroll",
    emoji: "😈",
    color: "#991b1b", // red-800
    bgClass: "bg-red-900/20",
    textClass: "text-red-600",
  },
  parasocial_regular: {
    id: "parasocial_regular",
    name: "OG_Fan",
    emoji: "💜",
    color: "#c084fc", // purple-400
    bgClass: "bg-purple-400/10",
    textClass: "text-purple-400",
  },
  clipper: {
    id: "clipper",
    name: "TheClipper",
    emoji: "🎬",
    color: "#f43f5e", // rose-500
    bgClass: "bg-rose-500/10",
    textClass: "text-rose-500",
  },
  backseat_coach: {
    id: "backseat_coach",
    name: "Coach",
    emoji: "📋",
    color: "#14b8a6", // teal-500
    bgClass: "bg-teal-500/10",
    textClass: "text-teal-500",
  },
  off_topic: {
    id: "off_topic",
    name: "OffTopic",
    emoji: "🌮",
    color: "#fb923c", // orange-400
    bgClass: "bg-orange-400/10",
    textClass: "text-orange-400",
  },
  pog_farmer: {
    id: "pog_farmer",
    name: "PogFarmer",
    emoji: "🔄",
    color: "#facc15", // yellow-400
    bgClass: "bg-yellow-400/10",
    textClass: "text-yellow-400",
  },
} as const;

export type AgentId = keyof typeof AGENTS;
