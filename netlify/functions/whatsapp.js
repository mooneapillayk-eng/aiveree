// ─── AIVEREE WHATSAPP SERVICE ─────────────────────────────────────────────────
// Sends text messages OR voice notes based on user preference
// whatsapp_format: 'text' | 'voice' stored in profiles

const crypto = require('crypto');
const { supabase, corsHeaders, resolveUser, internalSecretOk, INTERNAL_HEADERS, CLAUDE_MODEL, HttpError } = require('./lib/shared');

// Verify an inbound Twilio webhook signature (HMAC-SHA1 over URL + sorted params).
// Returns false when unconfigured, so an unsigned request is never trusted.
function verifyTwilioSignature(event) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const sig = event.headers['x-twilio-signature'] || event.headers['X-Twilio-Signature'];
  if (!token || !sig) return false;
  const url = event.rawUrl || `https://${event.headers.host || ''}${event.path || ''}`;
  const params = new URLSearchParams(event.body || '');
  const sortedKeys = [...params.keys()].sort();
  let data = url;
  for (const k of sortedKeys) data += k + params.get(k);
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── SEND VIA TWILIO ──────────────────────────────────────────────────────────
async function sendTwilioMessage({ to, body, mediaUrl }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log('[WhatsApp simulated]', { to, body: body?.slice(0, 50), hasMedia: !!mediaUrl });
    return { simulated: true };
  }

  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const params = new URLSearchParams({ From: from, To: toNumber });
  if (body) params.append('Body', body);
  if (mediaUrl) params.append('MediaUrl', mediaUrl);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio error: ${JSON.stringify(data)}`);
  return data;
}

// ─── GENERATE VOICE NOTE URL ──────────────────────────────────────────────────
async function generateVoiceNoteUrl(text, userId) {
  const baseUrl = process.env.URL || 'https://aiveree.com';
  const res = await fetch(`${baseUrl}/.netlify/functions/elevenlabs-tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
    body: JSON.stringify({ text, mode: 'whatsapp', userId })
  });

  if (!res.ok) throw new Error('Voice note generation failed');
  const data = await res.json();
  return data.url;
}

// ─── GENERATE MESSAGE TEXT ────────────────────────────────────────────────────
async function generateMessage(userId, userName, messageType, context) {
  const prompts = {
    drifting: `Write a WhatsApp message from Aiveree to ${userName}. Goal: "${context.goal}". Away ${context.daysSince} days. Warm, specific, one clear action. Under 80 words. Sound human.`,
    gone_quiet: `WhatsApp from Aiveree to ${userName}. Away ${context.daysSince} days from: "${context.goal}". No guilt. One sentence on why it still matters. Under 60 words.`,
    lost: `Final check-in from Aiveree to ${userName}. Away ${context.daysSince} days. Goal: "${context.goal}". Everything saved. No pressure. Under 50 words.`,
    morning: `Morning WhatsApp briefing from Aiveree to ${userName}. Working on: "${context.goal}". ${context.priorities?.length ? `Today: ${context.priorities.slice(0,2).join(', ')}.` : ''} ${context.pendingApprovals > 0 ? `${context.pendingApprovals} item needs approval.` : ''} Energetic, calm. Under 80 words.`,
    evening: `Evening check-in from Aiveree to ${userName}. Goal: "${context.goal}". Brief reflection + one thing for tomorrow. Warm, grounded. Under 60 words.`,
    milestone: `Celebration from Aiveree to ${userName}. Completed: "${context.milestone}". Goal: "${context.goal}". Genuine warmth. Under 50 words.`,
    next_action: `Aiveree to ${userName}. One specific action they should take right now for: "${context.goal}". Reason + concrete step. Under 60 words.`,
    silent_progress: `Aiveree to ${userName}. Just surfacing something prepared quietly: "${context.output_summary}". Related to: "${context.goal}". Short, calm. Under 60 words.`
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      system: "You are Aiveree writing a personal WhatsApp message. Warm, human, specific. Never generic, never robotic. Return only the message text.",
      messages: [{ role: "user", content: prompts[messageType] || prompts.drifting }]
    })
  });

  const data = await res.json();
  return data.content?.filter(b => b.type === "text").map(b => b.text).join("").trim() || "";
}

// ─── SEND TO USER (text or voice note) ───────────────────────────────────────
async function sendToUser({ userId, userName, whatsappNumber, whatsappFormat, messageText, messageType }) {
  let twilioResult;

  if (whatsappFormat === 'voice') {
    try {
      // Generate voice note and send as audio
      const voiceUrl = await generateVoiceNoteUrl(messageText, userId);
      // Send a brief caption with the voice note
      const caption = messageType === 'morning' ? '🌅 Your morning briefing' :
                      messageType === 'milestone' ? '🎉 ' :
                      messageType === 'next_action' ? '⚡ Your next move' :
                      messageType === 'silent_progress' ? '✨ Something I prepared' : '';

      twilioResult = await sendTwilioMessage({
        to: whatsappNumber,
        body: caption || undefined,
        mediaUrl: voiceUrl
      });
    } catch (err) {
      console.error('Voice note failed, falling back to text:', err.message);
      // Graceful fallback to text
      twilioResult = await sendTwilioMessage({ to: whatsappNumber, body: messageText });
    }
  } else {
    twilioResult = await sendTwilioMessage({ to: whatsappNumber, body: messageText });
  }

  // Log communication
  await supabase.from('communications').insert({
    user_id: userId,
    channel: 'whatsapp',
    direction: 'outbound',
    role: 'aiveree',
    content: messageText,
    content_type: whatsappFormat === 'voice' ? 'voice' : 'text',
    status: 'sent',
    sent_at: new Date().toISOString(),
    metadata: { message_type: messageType, format: whatsappFormat }
  });

  // Fire event
  await supabase.from('events').insert({
    event_type: 'whatsapp.sent',
    user_id: userId,
    payload: {
      message_type: messageType,
      format: whatsappFormat,
      preview: messageText.slice(0, 80)
    }
  });

  return twilioResult;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  // Twilio inbound webhook — only act on a verified signature.
  if (event.httpMethod === "POST" && event.headers['x-twilio-signature']) {
    if (!verifyTwilioSignature(event)) {
      return { statusCode: 403, headers: { "Content-Type": "text/xml" }, body: '<Response></Response>' };
    }
    try {
      const body = new URLSearchParams(event.body);
      const from = body.get('From')?.replace('whatsapp:', '');
      const message = body.get('Body');

      if (from && message) {
        const { data: profile } = await supabase.from('profiles')
          .select('id, name').eq('whatsapp_number', from).single();

        if (profile) {
          await supabase.from('communications').insert({
            user_id: profile.id, channel: 'whatsapp', direction: 'inbound',
            role: 'user', content: message, status: 'delivered',
            delivered_at: new Date().toISOString()
          });
          await supabase.from('events').insert({
            event_type: 'whatsapp.replied', user_id: profile.id,
            payload: { message: message.slice(0, 200) }, source: 'whatsapp'
          });
        }
      }
    } catch (err) { console.error('Webhook error:', err); }
    return { statusCode: 200, headers: { "Content-Type": "text/xml" }, body: '<Response></Response>' };
  }

  try {
    const { action, ...params } = JSON.parse(event.body || "{}");

    // Sending WhatsApp messages is privileged. System-wide sweeps are internal-only;
    // per-user sends require the acting user's token (or an internal call).
    if (action === 'proactive_check') {
      if (!internalSecretOk(event)) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Forbidden" }) };
      }
    } else {
      const { userId } = await resolveUser(event, params);
      if (!userId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };
      params.user_id = userId;
    }

    switch (action) {

      // Send a single message (text or voice note based on user preference)
      case 'send': {
        const { user_id, message, message_type = 'manual' } = params;
        if (!user_id || !message) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id and message required" }) };
        }

        const { data: profile } = await supabase.from('profiles')
          .select('whatsapp_number, whatsapp_format, name').eq('id', user_id).single();

        if (!profile?.whatsapp_number) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No WhatsApp number for user" }) };
        }

        const result = await sendToUser({
          userId: user_id,
          userName: profile.name || 'there',
          whatsappNumber: profile.whatsapp_number,
          whatsappFormat: profile.whatsapp_format || 'text',
          messageText: message,
          messageType: message_type
        });

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent: true, format: profile.whatsapp_format || 'text', result }) };
      }

      // Daily proactive check
      case 'proactive_check': {
        const results = [];
        const { data: users } = await supabase.from('profiles')
          .select('id, name, whatsapp_number, whatsapp_format, last_active_at')
          .not('whatsapp_number', 'is', null)
          .limit(200);

        for (const user of users || []) {
          try {
            const daysSince = Math.floor((Date.now() - new Date(user.last_active_at).getTime()) / 86400000);
            let messageType = null;
            if (daysSince >= 21) messageType = 'lost';
            else if (daysSince >= 8) messageType = 'gone_quiet';
            else if (daysSince >= 3) messageType = 'drifting';
            if (!messageType) { results.push({ user_id: user.id, action: 'skipped_active' }); continue; }

            // Check frequency cap — max once per 3 days
            const { data: recentMsg } = await supabase.from('communications')
              .select('id').eq('user_id', user.id).eq('channel', 'whatsapp').eq('direction', 'outbound')
              .gte('sent_at', new Date(Date.now() - 3 * 86400000).toISOString())
              .limit(1).single();
            if (recentMsg) { results.push({ user_id: user.id, action: 'skipped_frequency_cap' }); continue; }

            const { data: goal } = await supabase.from('goals')
              .select('title').eq('user_id', user.id).eq('status', 'active')
              .order('created_at', { ascending: false }).limit(1).single();

            const messageText = await generateMessage(user.id, user.name || 'there', messageType, {
              goal: goal?.title || 'your goal', daysSince
            });

            if (messageText) {
              await sendToUser({
                userId: user.id, userName: user.name || 'there',
                whatsappNumber: user.whatsapp_number,
                whatsappFormat: user.whatsapp_format || 'text',
                messageText, messageType
              });
              results.push({ user_id: user.id, action: 'sent', message_type: messageType, format: user.whatsapp_format || 'text' });
            }
          } catch (err) {
            results.push({ user_id: user.id, action: 'error', error: err.message });
          }
        }

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ results, total: results.length }) };
      }

      // Send morning briefing
      case 'morning_briefing': {
        const { user_id } = params;
        if (!user_id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id required" }) };

        const { data: profile } = await supabase.from('profiles')
          .select('name, whatsapp_number, whatsapp_format').eq('id', user_id).single();
        const { data: goal } = await supabase.from('goals')
          .select('title').eq('user_id', user_id).eq('status', 'active')
          .order('created_at', { ascending: false }).limit(1).single();
        const { data: pendingApprovals } = await supabase.from('approvals')
          .select('id').eq('user_id', user_id).eq('status', 'pending');

        const messageText = await generateMessage(user_id, profile?.name || 'there', 'morning', {
          goal: goal?.title || 'your goal',
          pendingApprovals: pendingApprovals?.length || 0,
          priorities: []
        });

        if (!profile?.whatsapp_number) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "No WhatsApp number" }) };
        }

        await sendToUser({
          userId: user_id, userName: profile.name || 'there',
          whatsappNumber: profile.whatsapp_number,
          whatsappFormat: profile.whatsapp_format || 'text',
          messageText, messageType: 'morning'
        });

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent: true, message: messageText }) };
      }

      // Send next best action
      case 'next_action': {
        const { user_id, action_text } = params;
        if (!user_id || !action_text) {
          return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "user_id and action_text required" }) };
        }

        const { data: profile } = await supabase.from('profiles')
          .select('name, whatsapp_number, whatsapp_format').eq('id', user_id).single();
        const { data: goal } = await supabase.from('goals')
          .select('title').eq('user_id', user_id).eq('status', 'active')
          .order('created_at', { ascending: false }).limit(1).single();

        const messageText = await generateMessage(user_id, profile?.name || 'there', 'next_action', {
          goal: goal?.title || 'your goal', action: action_text
        });

        if (!profile?.whatsapp_number) {
          return { statusCode: 200, headers: CORS, body: JSON.stringify({ message: messageText, note: 'No WhatsApp number — message not sent' }) };
        }

        await sendToUser({
          userId: user_id, userName: profile.name || 'there',
          whatsappNumber: profile.whatsapp_number,
          whatsappFormat: profile.whatsapp_format || 'text',
          messageText, messageType: 'next_action'
        });

        return { statusCode: 200, headers: CORS, body: JSON.stringify({ sent: true, message: messageText }) };
      }

      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
    }
  } catch (err) {
    if (err instanceof HttpError) return { statusCode: err.status, headers: CORS, body: JSON.stringify({ error: err.message }) };
    console.error('WhatsApp error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'WhatsApp service failed', detail: err.message }) };
  }
};
