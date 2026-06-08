// ElevenLabs Scribe v2 speech-to-text proxy
exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  try {
    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
    const contentType = event.headers["content-type"] || "audio/webm";
    const formData = new FormData();
    const blob = new Blob([body], { type: contentType });
    formData.append("file", blob, "audio.webm");
    formData.append("model_id", "scribe_v1");
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
      body: formData
    });
    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: err }) };
    }
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text || "" })
    };
  } catch (err) {
    console.error("STT error:", err);
    return { statusCode: 500, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "STT failed" }) };
  }
};
