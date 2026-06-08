// ─── DATA INGESTION PIPELINE ──────────────────────────────────────────────────
// Scheduled function that pulls open UK datasets into Supabase
// Run weekly via netlify.toml schedule
// Sources: ONS, Land Registry, GOV.UK, Companies House bulk data

const { supabase, corsHeaders } = require('./lib/shared');

// ─── DATA SOURCES ─────────────────────────────────────────────────────────────
const SOURCES = {

  // ONS Annual Survey of Hours and Earnings — salary by occupation and region
  ons_salary: {
    url: "https://api.ons.gov.uk/v1/datasets/ASHE/timeseries/KAB9/data",
    table: "data_salary",
    description: "UK salary data by occupation and region",
    ttl_days: 30
  },

  // Land Registry Price Paid — property transactions
  land_registry: {
    url: "http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-monthly-update-new-version.csv",
    table: "data_property_transactions",
    description: "UK property transaction data",
    ttl_days: 30
  },

  // GOV.UK search API — latest guidance and policy updates
  govuk_housing: {
    url: "https://www.gov.uk/api/search.json?filter_topics[]=housing&order=-public_timestamp&count=50",
    table: "data_govuk_guidance",
    description: "Latest GOV.UK housing guidance",
    ttl_days: 1
  },

  govuk_employment: {
    url: "https://www.gov.uk/api/search.json?filter_topics[]=employment&order=-public_timestamp&count=50",
    table: "data_govuk_guidance",
    description: "Latest GOV.UK employment guidance",
    ttl_days: 1
  },

  govuk_benefits: {
    url: "https://www.gov.uk/api/search.json?filter_topics[]=benefits-credits&order=-public_timestamp&count=50",
    table: "data_govuk_guidance",
    description: "Latest GOV.UK benefits guidance",
    ttl_days: 1
  },

  govuk_business: {
    url: "https://www.gov.uk/api/search.json?filter_topics[]=business-enterprise&order=-public_timestamp&count=50",
    table: "data_govuk_guidance",
    description: "Latest GOV.UK business guidance",
    ttl_days: 1
  },

  // Bank of England base rate
  boe_rate: {
    url: "https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp?Travel=NIxRSxSUx&FromSeries=1&ToSeries=50&DAT=RNG&FD=1&FM=Jan&FY=2024&TD=1&TM=Jan&TY=2026&VFD=Y&html.x=66&html.y=26&C=BLP&Filter=N",
    table: "data_interest_rates",
    description: "Bank of England base rate history",
    ttl_days: 7
  },
};

// ─── FETCH WITH TIMEOUT ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'User-Agent': 'aiveree.com data-pipeline hello@aiveree.com', ...(options.headers || {}) }
    });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── PROCESS GOV.UK GUIDANCE ──────────────────────────────────────────────────
async function ingestGovUKGuidance(source, key) {
  try {
    const res = await fetchWithTimeout(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const records = (data.results || []).map(r => ({
      title: r.title,
      description: r.description,
      url: `https://www.gov.uk${r.link}`,
      topic: key.replace('govuk_', ''),
      format: r.format,
      published_at: r.public_timestamp,
      fetched_at: new Date().toISOString()
    }));

    if (records.length > 0) {
      const { error } = await supabase
        .from('data_govuk_guidance')
        .upsert(records, { onConflict: 'url', ignoreDuplicates: false });
      if (error) throw error;
    }

    return { source: key, records: records.length, status: 'success' };
  } catch (err) {
    console.error(`GOV.UK ${key} error:`, err.message);
    return { source: key, records: 0, status: 'error', error: err.message };
  }
}

// ─── PROCESS ONS SALARY DATA ──────────────────────────────────────────────────
async function ingestONSSalary() {
  try {
    // ONS API for median earnings by occupation
    const occupations = [
      { code: 'KAB9', label: 'All employees - median gross weekly earnings' },
      { code: 'K54D', label: 'Full-time employees - median gross weekly earnings' },
    ];

    const records = [];
    for (const occ of occupations) {
      try {
        const res = await fetchWithTimeout(
          `https://api.ons.gov.uk/v1/datasets/ASHE/timeseries/${occ.code}/data`
        );
        if (!res.ok) continue;
        const data = await res.json();
        const latest = data.years?.[data.years.length - 1];
        if (latest) {
          records.push({
            category: occ.label,
            code: occ.code,
            year: latest.year,
            value: parseFloat(latest.value),
            unit: 'GBP weekly',
            source: 'ONS ASHE',
            fetched_at: new Date().toISOString()
          });
        }
      } catch { continue; }
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from('data_salary')
        .upsert(records, { onConflict: 'code', ignoreDuplicates: false });
      if (error) throw error;
    }

    return { source: 'ons_salary', records: records.length, status: 'success' };
  } catch (err) {
    console.error('ONS salary error:', err.message);
    return { source: 'ons_salary', records: 0, status: 'error', error: err.message };
  }
}

// ─── PROCESS LAND REGISTRY ────────────────────────────────────────────────────
async function ingestLandRegistrySummary() {
  try {
    // Use Land Registry HPI API for summary stats (full CSV is too large)
    const res = await fetchWithTimeout(
      'https://landregistry.data.gov.uk/data/ukhpi/region/england/month/2024-01.json'
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const records = [{
      region: 'england',
      period: '2024-01',
      average_price: data.result?.primaryTopic?.averagePrice,
      price_change_annual: data.result?.primaryTopic?.percentageAnnualChange,
      sales_volume: data.result?.primaryTopic?.salesVolume,
      fetched_at: new Date().toISOString()
    }];

    const { error } = await supabase
      .from('data_property_hpi')
      .upsert(records, { onConflict: 'region', ignoreDuplicates: false });
    if (error) throw error;

    return { source: 'land_registry', records: records.length, status: 'success' };
  } catch (err) {
    console.error('Land Registry error:', err.message);
    return { source: 'land_registry', records: 0, status: 'error', error: err.message };
  }
}

// ─── LOG INGESTION RUN ────────────────────────────────────────────────────────
async function logRun(results) {
  try {
    await supabase.from('data_ingestion_log').insert({
      run_at: new Date().toISOString(),
      results: JSON.stringify(results),
      total_records: results.reduce((sum, r) => sum + (r.records || 0), 0),
      success_count: results.filter(r => r.status === 'success').length,
      error_count: results.filter(r => r.status === 'error').length
    });
  } catch {}
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const CORS = corsHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  // Scheduled invocations have no httpMethod. Any manual HTTP trigger (GET or POST)
  // must present the admin key — otherwise this expensive pipeline is publicly runnable.
  if (event.httpMethod) {
    const body = JSON.parse(event.body || "{}");
    if (!process.env.ADMIN_KEY || body.admin_key !== process.env.ADMIN_KEY) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorised" }) };
    }
  }

  console.log("Starting data ingestion pipeline...");
  const results = [];

  // Run all ingestion tasks in parallel where possible
  const [salaryResult, landResult, ...govukResults] = await Promise.allSettled([
    ingestONSSalary(),
    ingestLandRegistrySummary(),
    ingestGovUKGuidance(SOURCES.govuk_housing, 'govuk_housing'),
    ingestGovUKGuidance(SOURCES.govuk_employment, 'govuk_employment'),
    ingestGovUKGuidance(SOURCES.govuk_benefits, 'govuk_benefits'),
    ingestGovUKGuidance(SOURCES.govuk_business, 'govuk_business'),
  ]);

  results.push(
    salaryResult.status === 'fulfilled' ? salaryResult.value : { source: 'ons_salary', status: 'error' },
    landResult.status === 'fulfilled' ? landResult.value : { source: 'land_registry', status: 'error' },
    ...govukResults.map(r => r.status === 'fulfilled' ? r.value : { status: 'error' })
  );

  await logRun(results);

  console.log("Pipeline complete:", results);
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      message: "Data ingestion complete",
      results,
      total_records: results.reduce((s, r) => s + (r.records || 0), 0)
    })
  };
};
