import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  SendOpenaiVoiceMessageBody,
  GenerateOpenaiImageBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { voiceChatStream, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();

router.get("/conversations", async (req, res) => {
  const conversations = await db.select().from(conversationsTable);
  res.json(conversations);
});

router.post("/conversations", async (req, res) => {
  const body = CreateOpenaiConversationBody.parse(req.body);
  const [conv] = await db.insert(conversationsTable).values({ title: body.title }).returning();
  res.status(201).json(conv);
});

router.get("/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
  res.json({ ...conv, messages: msgs });
});

router.delete("/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  res.status(204).end();
});

router.get("/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = SendOpenaiMessageBody.parse(req.body);
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Conversation not found" });

  const existing = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id));
  await db.insert(messagesTable).values({ conversationId: id, role: "user", content: body.content });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chatMessages = [
    ...existing.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: body.content },
  ];

  let fullResponse = "";
  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/conversations/:id/voice-messages", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = SendOpenaiVoiceMessageBody.parse(req.body);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const audioBuffer = Buffer.from(body.audio, "base64");
  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
  const stream = await voiceChatStream(buffer, "alloy", format);

  let assistantTranscript = "";
  let userTranscript = "";

  for await (const event of stream) {
    if (event.type === "transcript") {
      assistantTranscript += event.data;
    }
    if (event.type === "user_transcript") {
      userTranscript += event.data;
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  await db.insert(messagesTable).values([
    { conversationId: id, role: "user", content: userTranscript || "[voice message]" },
    { conversationId: id, role: "assistant", content: assistantTranscript },
  ]);

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/generate-image", async (req, res) => {
  const body = GenerateOpenaiImageBody.parse(req.body);
  const buffer = await generateImageBuffer(body.prompt, (body.size as "1024x1024" | "512x512" | "256x256") ?? "1024x1024");
  res.json({ b64_json: buffer.toString("base64") });
});

export default router;
