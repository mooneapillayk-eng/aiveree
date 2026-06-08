// ─── DATA QUERY FUNCTION ──────────────────────────────────────────────────────
// Agents use this to query ingested datasets before falling back to web search
// Returns structured data that agents can reference in their responses

const { supabase, corsHeaders } = require('./lib/shared');

exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  try {
    const { query_type, params } = JSON.parse(event.body || "{}");

    switch (query_type) {

      // Salary data for Priya and Chloe
      case 'salary': {
        const { data } = await supabase
          .from('data_salary')
          .select('*')
          .order('fetched_at', { ascending: false })
          .limit(20);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: data || [], source: 'ONS ASHE' }) };
      }

      // Property price data for Nova's team
      case 'property_hpi': {
        const { region } = params || {};
        let query = supabase.from('data_property_hpi').select('*').order('fetched_at', { ascending: false });
        if (region) query = query.eq('region', region);
        const { data } = await query.limit(12);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: data || [], source: 'Land Registry HPI' }) };
      }

      // GOV.UK guidance for Ada, Eve, Amir
      case 'govuk_guidance': {
        const { topic, search } = params || {};
        let query = supabase.from('data_govuk_guidance').select('*').order('published_at', { ascending: false });
        if (topic) query = query.eq('topic', topic);
        if (search) query = query.ilike('title', `%${search}%`);
        const { data } = await query.limit(10);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: data || [], source: 'GOV.UK' }) };
      }

      // Latest guidance updates — for proactive alerts
      case 'recent_updates': {
        const { topic } = params || {};
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        let query = supabase.from('data_govuk_guidance').select('*')
          .gte('published_at', yesterday)
          .order('published_at', { ascending: false });
        if (topic) query = query.eq('topic', topic);
        const { data } = await query.limit(5);
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ data: data || [], source: 'GOV.UK' }) };
      }

      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown query_type: ${query_type}` }) };
    }
  } catch (err) {
    console.error('data-query error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Query failed' }) };
  }
};
