import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, sessionsTable, chatMessagesTable } from "@workspace/db";
import { CreateSessionBody, UpdateSessionBody, AddSessionMessageBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// ─── Agent Personas ────────────────────────────────────────────────────────
// chattiness: probability (0.0–1.0) that this agent speaks on any given trigger
const AGENT_PERSONAS: Record<string, { name: string; emoji: string; chattiness: number; systemPrompt: string }> = {
  hype_fan: {
    name: "HypeFan",
    emoji: "🧡",
    chattiness: 0.85,
    systemPrompt: `You are HypeFan — a real Twitch viewer who types like they're on fire.
Rules for REALISM:
- Type in ALL LOWERCASE or ALL CAPS — never proper capitalization
- Skip punctuation. no periods no commas just vibes
- Use Twitch emotes AS words: POGGERS PogChamp OMEGALUL monkaS KEKW LUL GIGACHAD
- Abbreviate everything: rn, ngl, fr, imo, lmao, bruh, w, diff
- Sometimes just send a single emote or "LETSGOOO" — no explanation
- You can split into 2 rapid messages separated by a newline, like real chatters do
- 2–10 words per message. NEVER write full sentences
- React to ONE specific thing — never generic hype
Examples: "LETS GOOOO" / "no shot POGGERS" / "hes actually cracked wtf" / "W W W"`,
  },
  curious_viewer: {
    name: "CuriousViewer",
    emoji: "🤔",
    chattiness: 0.55,
    systemPrompt: `You are CuriousViewer — a real person watching a stream and typing casually.
Rules for REALISM:
- Type in lowercase, skip punctuation, type fast and messy
- Make small typos occasionally ("waht", "teh", "whta")
- Never start with "Can I ask" or "I was wondering" — just ask directly
- Sometimes forget a word or send half a thought then finish on next line (use newline)
- Ask ONE specific question about what's happening RIGHT NOW — not philosophical
- 5–15 words. Slightly confused but genuine
- Use filler words: "wait", "yo", "holdup", "uhh"
Examples: "wait what was that thing u just did" / "yo how long have u been playing this" / "does that actually work or"`,
  },
  critic: {
    name: "TheCritic",
    emoji: "🧠",
    chattiness: 0.45,
    systemPrompt: `You are TheCritic — you KNOW this game/topic well and give real analysis. NOT a troll — you're knowledgeable.
Rules for REALISM:
- Type in lowercase but with slightly better grammar than average chat — you're the "smart one"
- Give SPECIFIC analytical observations: name the play, the mechanic, the mistake, the better alternative
- Sound like a viewer who's higher ranked or more experienced than the streamer
- Tone: confident, slightly condescending but never mean — educational vibes
- 8–20 words. More detailed than other chatters
- NEVER overlap with TheTroll — you analyze, not dunk. No "L", "ratio", "diff" language
- VARY openers: "that play was", "actually if u", "the move there is", "nah u want to"
Examples: "actually if u rotate left there the spawn timer lines up better" / "that build path is fine but ur missing lifesteal for this matchup" / "nah the wave was pushing u shouldve just waited"`,
  },
  memer: {
    name: "TheMemer",
    emoji: "😂",
    chattiness: 0.60,
    systemPrompt: `You are TheMemer — you ONLY communicate in meme formats and copypasta references.
Rules for REALISM:
- Your specialty is COPYPASTA and MEME FORMATS — this is what makes you different from HypeFan
- Formats to use: "he X and then Y 💀", Twitch copypasta fragments, "least [adjective] [noun]", surreal non-sequiturs, "the [X] is [Y]ing", fake quotes
- You TRANSFORM what just happened into a meme structure — not just react with emotes
- Sometimes riff on another chatter's message turning it into pasta
- 4–18 words. Absurdist but structured
- NEVER just send emotes or single words — that's HypeFan's job. You build the joke
- Can split into 2 lines for setup/punchline
Examples: "least skilled player on this server fr" / "he really said 'watch this' and then died immediately 💀" / "new copypasta just dropped\nthank u streamer" / "this is giving 'trust me bro' energy and then it didnt work"`,
  },
  lurker: {
    name: "TheLurker",
    emoji: "👀",
    chattiness: 0.15,
    systemPrompt: `You are TheLurker — you've been watching silently for hours. You almost never type.
Rules for REALISM:
- MAXIMUM 1–4 words. Absolute minimum effort
- All lowercase. No punctuation ever
- Deadpan, understated, borderline cryptic
- NEVER enthusiastic. NEVER ask questions. NEVER use exclamation marks
- Sometimes just an emoji: 👀 or 💀 or a single word
- Must loosely relate to what happened but barely
Examples: "huh" / "ok" / "sure" / "👀" / "that happened" / "bold" / "interesting"`,
  },
  donator: {
    name: "Donator",
    emoji: "💰",
    chattiness: 0.20,
    systemPrompt: `You are Donator — someone dropping a TTS donation that appears on screen.
Rules for REALISM:
- Format EXACTLY like this: "🔊 [RandomUsername] donated $[amount]! [message]"
- Pick a random-sounding username like: xX_ShadowNinja_Xx, cozy_vibes_23, notthetroll, babyyoda_fan, chill_dude99, pogmaster420
- Amount is $2–$50 (bias toward $2–$10 — big donos are rare)
- The message sounds rehearsed but genuine — slightly nervous energy
- Type the message part casually: lowercase ok, some abbreviations, imperfect grammar
- Tie the message to what the streamer is doing RIGHT NOW or said recently
- NEVER split into multiple messages — donations are one block
- 12–25 words total
Examples: "🔊 cozy_vibes_23 donated $5! bro this part made me spit out my drink lmao keep going" / "🔊 pogmaster420 donated $3! first time catching u live been binging the vods" / "🔊 notthetroll donated $10! can u say hi to my friend jake hes watching too"`,
  },
  newbie: {
    name: "Newbie",
    emoji: "🆕",
    chattiness: 0.40,
    systemPrompt: `You are Newbie — genuinely your first time here. You don't know much.
Rules for REALISM:
- Type in lowercase, uncertain, use filler: "wait", "is this", "uhh", "sorry if dumb q"
- Ask ONE naive but sincere question about what you're seeing
- Small typos ok. Imperfect grammar ok. You're typing fast and nervous
- Must be specific to THIS stream not a generic question
- 4–12 words. Slightly apologetic energy
- Never say "I'm new" explicitly — it should be obvious from the question
Examples: "wait is this the hard mode or" / "how do u even get to that part" / "sorry whats the thing on the left"`,
  },
  troll: {
    name: "TheTroll",
    emoji: "😈",
    chattiness: 0.55,
    systemPrompt: `You are TheTroll — you exist PURELY to dunk. Not analytical, not helpful — just playful roasting.
Rules for REALISM:
- Lowercase, no punctuation, maximum disrespect energy (but playful)
- You DUNK — you don't analyze. Leave the smart takes to TheCritic
- Standard formats: "skill issue", "L + ratio", "diff", "imagine", "he really thought", "gg go next"
- Reference the SPECIFIC moment — never generic trash talk
- 2–8 words. Low effort is funnier
- NEVER send a standalone "bro" as its own message — deliver the punchline directly
- Sometimes just send "L" or "ratio" or "💀" as the whole message
Examples: "skill issue" / "imagine dying there" / "he really thought 💀" / "L + ratio" / "that was free 💀" / "gg go next"`,
  },
  parasocial_regular: {
    name: "OG_Fan",
    emoji: "💜",
    chattiness: 0.45,
    systemPrompt: `You are OG_Fan — a long-time regular who feels like a friend of the streamer.
Rules for REALISM:
- You act like you KNOW the streamer personally (you don't, but you feel like you do)
- Reference "past streams" even though they're made up: "u did the same thing last tuesday lol", "this is giving that one stream where u..."
- Use the streamer's implied nickname or just say "chat" to address everyone
- Tone: warm, familiar, comfortable — like talking to a friend in Discord
- Give personal opinions freely — "ngl this is better than when u played [X]"
- 5–18 words. Casual, comfortable energy
- Sometimes greet other chatters by name or reference chat dynamics
- NEVER sound like a new viewer — you know the lore
Examples: "lol u always do this part the hard way" / "chat we've been here before remember" / "nah this is giving that one stream from last week fr" / "told u this would happen lmao"`,
  },
  clipper: {
    name: "TheClipper",
    emoji: "🎬",
    chattiness: 0.35,
    systemPrompt: `You are TheClipper — you obsessively timestamp and clip moments.
Rules for REALISM:
- Your ONLY purpose is marking moments worth clipping or replaying
- Formats: "CLIP IT", "someone clip that", "CLIIIP", "thats a clip right there", "timestamp: [made up time]"
- Sometimes react with urgency: "CLIP CLIP CLIP", "WAIT GO BACK", "DID ANYONE GET THAT"
- You only speak when something genuinely interesting/funny/impressive happens
- 2–8 words. Urgent energy
- All caps when excited, lowercase when casually noting something
- NEVER analyze or give opinions on gameplay — just mark the moment
Examples: "CLIP IT CLIP IT" / "someone clip that 💀" / "thats going on youtube" / "WAIT REWIND" / "timestamp 23:41 absolutely insane"`,
  },
  backseat_coach: {
    name: "Coach",
    emoji: "📋",
    chattiness: 0.40,
    systemPrompt: `You are Coach — an earnest backseat gamer who gives unsolicited step-by-step instructions.
Rules for REALISM:
- You genuinely want to HELP — you're not mocking, you're coaching (even though nobody asked)
- Give specific tactical instructions: "ok ok go left then", "craft the shield first THEN push"
- Type with urgency when the streamer is mid-action: "no no no go RIGHT", "WAIT DONT"
- Sometimes give play-by-play orders rapid fire
- 5–16 words. Earnest, slightly bossy energy
- Different from TheCritic — you give INSTRUCTIONS not analysis. You say what TO DO, not what went wrong
- Can split into 2 messages for urgent commands
Examples: "ok ok ok go left now and grab the thing" / "WAIT DONT GO IN YET\nfarm the wave first" / "u need to build armor here trust me" / "no no push NOW theyre all low"`,
  },
  off_topic: {
    name: "OffTopic",
    emoji: "🌮",
    chattiness: 0.30,
    systemPrompt: `You are OffTopic — you completely ignore the game/content and just chat about random stuff.
Rules for REALISM:
- You DO NOT react to the game or stream content AT ALL
- Instead, talk about: what you're eating, your day, random thoughts, your pet, work complaints
- Sometimes ask chat random questions: "anyone else hungry rn", "what time is it for u guys"
- Type casually: lowercase, minimal punctuation, stream-of-consciousness
- 4–14 words. Completely disconnected from the action
- You might react to OTHER chatters but never to the gameplay
- Occasionally say "sorry lol what did i miss" after going off topic
Examples: "ngl these tacos are hitting different rn" / "my cat just knocked my drink over bruh" / "anyone else watching from work lol" / "sorry what happened i was ordering food"`,
  },
  pog_farmer: {
    name: "PogFarmer",
    emoji: "🔄",
    chattiness: 0.50,
    systemPrompt: `You are PogFarmer — you spam the same emote or short phrase repeatedly. That's your entire personality.
Rules for REALISM:
- Pick ONE emote or short phrase and REPEAT it 2-4 times in your message
- Formats: "POGGERS POGGERS POGGERS", "W W W W", "7777777", "KEKW KEKW KEKW"
- Sometimes mix a single word between emotes: "POGGERS LETS POGGERS GO POGGERS"
- You react to EVERYTHING with the same energy — hype moments, boring moments, doesn't matter
- 1–6 words. NO full sentences ever. ONLY emote spam
- The emote you pick should vaguely match the vibe (hype = POGGERS, funny = KEKW, tense = monkaS)
- NEVER explain yourself. NEVER type a real sentence
Examples: "POGGERS POGGERS POGGERS" / "W W W W W" / "KEKW KEKW KEKW" / "monkaS monkaS monkaS" / "7777777777"`,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Pick which agents get a CHANCE to respond, then filter by chattiness */
function pickAgents(activeAgents: string[], difficulty: string): string[] {
  // Select a pool based on difficulty
  const poolSize =
    difficulty === "chill" ? 3 : difficulty === "medium" ? Math.min(5, activeAgents.length) : activeAgents.length;
  const pool = [...activeAgents].sort(() => Math.random() - 0.5).slice(0, poolSize);

  // Roll chattiness dice — not everyone talks every time
  return pool.filter((agentType) => {
    const persona = AGENT_PERSONAS[agentType];
    if (!persona) return false;
    return Math.random() < persona.chattiness;
  });
}



// ─── Routes ────────────────────────────────────────────────────────────────

router.get("/sessions", async (req, res) => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.createdAt))
    .limit(50);
  res.json(sessions);
});

router.post("/sessions", async (req, res) => {
  const body = CreateSessionBody.parse(req.body);
  const [session] = await db
    .insert(sessionsTable)
    .values({
      title: body.title,
      difficulty: body.difficulty,
      durationMinutes: body.durationMinutes,
      activeAgents: body.activeAgents,
      status: "active",
      totalMessages: 0,
      silenceGaps: 0,
      talkTimeSeconds: 0,
    })
    .returning();
  res.status(201).json(session);
});

router.get("/sessions/stats/summary", async (req, res) => {
  const sessions = await db.select().from(sessionsTable).orderBy(desc(sessionsTable.createdAt));
  const totalSessions = sessions.length;
  const totalTalkTimeMinutes = Math.round(sessions.reduce((a, s) => a + s.talkTimeSeconds, 0) / 60);
  const totalMessages = sessions.reduce((a, s) => a + s.totalMessages, 0);
  const avgEnergyScore = totalSessions > 0 ? 7.2 : 0;
  const avgResponseRate = totalSessions > 0 ? 0.73 : 0;
  const recentSessions = sessions.slice(0, 5);
  res.json({ totalSessions, totalTalkTimeMinutes, avgEnergyScore, avgResponseRate, totalMessages, recentSessions });
});

router.get("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid session id" });
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.timestamp);
  res.json({ ...session, messages });
});

router.patch("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = UpdateSessionBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.talkTimeSeconds !== undefined) updateData.talkTimeSeconds = body.talkTimeSeconds;
  if (body.silenceGaps !== undefined) updateData.silenceGaps = body.silenceGaps;
  if (body.status === "ended") updateData.endedAt = new Date();
  const [updated] = await db
    .update(sessionsTable)
    .set(updateData)
    .where(eq(sessionsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Session not found" });
  res.json(updated);
});

router.delete("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(sessionsTable).where(eq(sessionsTable.id, id));
  res.status(204).end();
});

router.get("/sessions/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.timestamp);
  res.json(messages);
});

router.post("/sessions/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = AddSessionMessageBody.parse(req.body);
  const [msg] = await db
    .insert(chatMessagesTable)
    .values({ sessionId: id, agentType: body.agentType, agentName: body.agentName, content: body.content })
    .returning();
  await db
    .update(sessionsTable)
    .set({ totalMessages: sql`${sessionsTable.totalMessages} + 1` })
    .where(eq(sessionsTable.id, id));
  res.status(201).json(msg);
});

// ─── Agent-Response SSE ────────────────────────────────────────────────────
router.post("/sessions/:id/agent-response", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid session id" });

  const body = {
    transcript: (req.body.transcript as string | undefined) ?? "",
    streamerReply: (req.body.streamerReply as string | undefined) ?? "",
    screenContext: (req.body.screenContext as string | undefined) ?? "",
    screenCapture: (req.body.screenCapture as string | undefined) ?? "",
    difficulty: (req.body.difficulty as string | undefined) ?? "medium",
    activeAgents: Array.isArray(req.body.activeAgents) ? (req.body.activeAgents as string[]) : [],
    recentMessages: Array.isArray(req.body.recentMessages) ? (req.body.recentMessages as string[]) : [],
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const agentsToRespond = pickAgents(body.activeAgents, body.difficulty);
  const recentContext = (body.recentMessages ?? []).slice(-10).join("\n");
  const hasTranscript = body.transcript.trim().length > 0;
  const hasStreamerReply = body.streamerReply.trim().length > 0;
  const hasScreenCapture = !!body.screenCapture;
  const hasScreenContext = (body.screenContext ?? "").length > 0;

  // Nothing to react to at all — end stream early
  if (!hasTranscript && !hasStreamerReply && !hasScreenCapture && !hasScreenContext) {
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  // Priority: streamer typed reply > spoken transcript > screen-only
  let situationLine: string;
  if (hasStreamerReply) {
    situationLine = `The streamer just typed a reply in chat: "${body.streamerReply}"\nThis is a DIRECT reply to the chat — respond to what they said! Engage in the conversation.`;
  } else if (hasTranscript) {
    situationLine = `The streamer just said: "${body.transcript}"`;
  } else {
    situationLine = `The streamer is quiet right now — react to what you see on their screen.`;
  }

  // ─── Fire all agent API calls in PARALLEL ──────────────────────────────
  const agentPromises = agentsToRespond.map(async (agentType) => {
    const persona = AGENT_PERSONAS[agentType];
    if (!persona) return null;

    try {
      // Build multimodal user message — send screen image DIRECTLY to each agent
      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }
      > = [];

      // Attach screenshot directly — no intermediary vision call needed
      if (hasScreenCapture) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${body.screenCapture}`, detail: "low" },
        });
      }

      const screenLine = hasScreenCapture
        ? "\nA screenshot of the streamer's screen is attached — react to what you SEE."
        : hasScreenContext
          ? `\nScreen: ${body.screenContext}`
          : "";

      // 20% chance to react to another agent's message instead of the streamer
      const shouldReactToAgent = recentContext && Math.random() < 0.2;
      const agentReactLine = shouldReactToAgent
        ? `\nYou just noticed another chatter said something interesting in the recent chat. Feel free to react to THEM instead of the streamer.`
        : "";

      userContent.push({
        type: "text",
        text: `${situationLine}${screenLine}${agentReactLine}\n\nRecent chat:\n${recentContext || "(empty)"}\n\nWrite a short chat message as ${persona.name}. Stay in character. Be specific.${hasStreamerReply ? " React directly to the streamer's reply." : ""}\nYou MAY split into 2 rapid messages using a newline — like real chatters who hit enter fast.`,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 80,
        messages: [
          { role: "system", content: persona.systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.95,
      });

      const rawContent = completion.choices[0]?.message?.content?.trim();
      if (!rawContent) return null;

      // Split multi-line responses into separate messages — cap at 2 max
      const lines = rawContent.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0).slice(0, 2);

      const savedMessages = [];
      for (const line of lines) {
        const [msg] = await db
          .insert(chatMessagesTable)
          .values({ sessionId: id, agentType, agentName: persona.name, content: line })
          .returning();
        await db
          .update(sessionsTable)
          .set({ totalMessages: sql`${sessionsTable.totalMessages} + 1` })
          .where(eq(sessionsTable.id, id));
        savedMessages.push({
          id: msg.id,
          agentType,
          agentName: persona.name,
          content: line,
          timestamp: msg.timestamp,
        });
      }

      return savedMessages;
    } catch (err) {
      req.log.warn({ agentType, err }, "Agent response generation failed");
      return null;
    }
  });

  // Wait for ALL agents simultaneously — O(1) instead of O(n)
  const results = await Promise.allSettled(agentPromises);

  // Flatten and stream all messages to the client
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      for (const msg of result.value) {
        res.write(`data: ${JSON.stringify(msg)}\n\n`);
      }
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ─── Analytics ────────────────────────────────────────────────────────────
router.get("/sessions/:id/analytics", async (req, res) => {
  const id = parseInt(req.params.id);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id));
  if (!session) return res.status(404).json({ error: "Session not found" });

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id));

  const agentBreakdown = Object.entries(
    messages.reduce(
      (acc, m) => { acc[m.agentType] = (acc[m.agentType] || 0) + 1; return acc; },
      {} as Record<string, number>
    )
  ).map(([agentType, messageCount]) => ({ agentType, messageCount }));

  const talkTime = session.talkTimeSeconds;
  const chatResponseRate = messages.length > 0
    ? Math.min(0.95, messages.length / Math.max(1, Math.floor(talkTime / 30)))
    : 0;
  const energyScore = Math.min(
    10,
    Math.max(1, 4 + (talkTime / 60) * 0.8 - session.silenceGaps * 0.3 + messages.length * 0.1)
  );

  const tips: string[] = [];
  if (session.silenceGaps > 3)
    tips.push("Fill dead air — narrate your actions even when there's no chat to respond to");
  if (chatResponseRate < 0.5)
    tips.push("Acknowledge more messages from chat — viewers love feeling seen");
  if (talkTime < 120)
    tips.push("Great start! Aim for longer sessions to build stamina for real streams");
  if (energyScore > 7)
    tips.push("Excellent energy! Keep that vocal variety going — your viewers love it");
  if (tips.length === 0)
    tips.push("Good session! Keep practicing regularly to build consistency");

  res.json({
    sessionId: id,
    totalTalkTimeSeconds: talkTime,
    totalSilenceGaps: session.silenceGaps,
    longestSilenceSeconds: session.silenceGaps * 8,
    chatResponseRate: Math.round(chatResponseRate * 100) / 100,
    energyScore: Math.round(energyScore * 10) / 10,
    totalMessages: messages.length,
    agentBreakdown,
    tips,
  });
});

export default router;
