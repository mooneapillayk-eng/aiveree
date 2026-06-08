// ─── AIVEREE ELEVENLABS TTS ───────────────────────────────────────────────────
// Converts text to speech using ElevenLabs Flash v2.5
// Supports: base64 response (chat) | buffer storage (WhatsApp voice notes)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true
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
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  try {
    const { text, mode = "chat", userId } = JSON.parse(event.body || "{}");

    if (!text) {
      return {
        statusCode: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
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
