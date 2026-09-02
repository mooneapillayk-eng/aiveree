// ─── AIVEREE ELEVENLABS TTS ───────────────────────────────────────────────────
// Converts text to speech using ElevenLabs Flash v2.5
// Supports: base64 response (chat) | buffer storage (WhatsApp voice notes)

const { corsHeaders, getOptionalUser, internalSecretOk, rateLimit } = require('./lib/shared');

async function generateSpeech(text) {
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/→/g, "")
    .replace(/\n\n/g, ". ")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, 600);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: clean,
        // Multilingual v2 is ElevenLabs' warmest, most natural-sounding model —
        // noticeably less "robotic" than the turbo/flash low-latency models.
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          // Lower stability = more natural, human intonation (less monotone/robotic).
          stability: 0.4,
          similarity_boost: 0.85,
          style: 0.4, // a touch of expressiveness so she sounds alive, not flat
          use_speaker_boost: true,
          speed: 1.0 // natural conversational pace (0.9 was dragging)
        }
      })
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error ${res.status}: ${err}`);
  }

  return await res.arrayBuffer();
}

async function storeVoiceNote(audioBuffer, userId) {
  // Upload to Supabase Storage and return public URL
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const filename = `${userId}/${Date.now()}.mp3`;
  const buffer = Buffer.from(audioBuffer);

  const { data, error } = await supabase.storage
    .from('voice-notes')
    .upload(filename, buffer, {
      contentType: 'audio/mpeg',
      cacheControl: '86400', // 24 hour cache
      upsert: false
    });

  if (error) throw new Error(`Storage error: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('voice-notes')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  try {
    const { text, mode = "chat" } = JSON.parse(event.body || "{}");

    // Auth: chat playback requires a logged-in user; whatsapp mode is internal.
    const internal = internalSecretOk(event);
    const user = internal ? null : await getOptionalUser(event);
    if (!internal && !user) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required" }) };
    }
    // userId for storage paths comes from the authenticated identity, not the body.
    const userId = internal ? (JSON.parse(event.body || "{}").userId) : user.id;

    // Rate limit this paid upstream per identity.
    const rlKey = `tts:${userId || 'internal'}`;
    if (!internal && !(await rateLimit(rlKey, 30, 60 * 1000))) {
      return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: "Too many requests" }) };
    }

    if (!text) {
      return {
        statusCode: 400,
        headers: CORS,
        body: JSON.stringify({ error: "text required" })
      };
    }

    const audioBuffer = await generateSpeech(text);

    // Mode: "chat" → return base64 for in-browser playback
    if (mode === "chat") {
      const base64 = Buffer.from(audioBuffer).toString("base64");
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, mimeType: "audio/mpeg" })
      };
    }

    // Mode: "whatsapp" → store in Supabase, return public URL
    if (mode === "whatsapp") {
      if (!userId) {
        return {
          statusCode: 400,
          headers: { ...CORS, "Content-Type": "application/json" },
          body: JSON.stringify({ error: "userId required for whatsapp mode" })
        };
      }

      const publicUrl = await storeVoiceNote(audioBuffer, userId);
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ url: publicUrl, mimeType: "audio/mpeg" })
      };
    }

    return {
      statusCode: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Unknown mode: ${mode}. Use 'chat' or 'whatsapp'` })
    };

  } catch (err) {
    console.error("TTS error:", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "TTS failed", detail: err.message })
    };
  }
};
