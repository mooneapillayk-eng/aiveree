import { useState, useEffect, useRef } from "react";

const store = {
  async get(k) { try { const r=await window.storage.get(k); return r?JSON.parse(r.value):null; } catch { return null; } },
  async set(k,v) { try { await window.storage.set(k,JSON.stringify(v)); } catch {} }
};

const AI_PRODUCTS = [
  { id:1,  name:"ChatGPT",        company:"OpenAI",           category:"Writing",      logo:"🤖", tagline:"World's most widely used AI assistant",           description:"",                                                                     bestFor:["Writers","Students","Developers","Businesses"],         pricing:{free:"Free tier (GPT-3.5 + limited GPT-4o)", paid:"$20/mo Plus · $25/user/mo Team"},   freeLimit:"Unlimited GPT-3.5; limited GPT-4o daily",            link:"https://chat.openai.com",             tags:["text","assistant","coding","analysis"],                   popularity:98, trending:true,  newThis:false, weeklyGrowth:"+2.1%", useCases:[] },
  { id:2,  name:"Claude",         company:"Anthropic",        category:"Writing",      logo:"⚡", tagline:"Thoughtful, long-context AI for deep work",           description:"",                                                       bestFor:["Researchers","Legal Teams","Writers","Analysts"],       pricing:{free:"Free tier available",                  paid:"$20/mo Pro · $25/user/mo Team"},     freeLimit:"Daily message limits with Claude Sonnet",             link:"https://claude.ai",                   tags:["text","research","documents","analysis"],                 popularity:89, trending:true,  newThis:false, weeklyGrowth:"+4.3%", useCases:[] },
  { id:3,  name:"Gemini",         company:"Google",           category:"Writing",      logo:"♊", tagline:"Google's multimodal AI across Workspace",              description:"",                                                                         bestFor:["Google Workspace Users","Students","Enterprises"],      pricing:{free:"Free via Google account",              paid:"$20/mo Advanced"},                   freeLimit:"Generous free tier with Gemini Flash",                link:"https://gemini.google.com",           tags:["text","multimodal","google","workspace"],                 popularity:85, trending:true,  newThis:false, weeklyGrowth:"+3.7%", useCases:[] },
  { id:4,  name:"Midjourney",     company:"Midjourney Inc.",  category:"Image",        logo:"🎨", tagline:"AI image generation that feels like art direction",    description:"",                                                    bestFor:["Designers","Marketers","Architects","Game Devs"],       pricing:{free:"No free plan currently",               paid:"From $10/mo Basic (200 images)"},    freeLimit:"No current free plan",                                link:"https://midjourney.com",              tags:["image","design","creative","art"],                        popularity:91, trending:true,  newThis:false, weeklyGrowth:"+1.2%", useCases:[] },
  { id:5,  name:"DALL·E 3",       company:"OpenAI",           category:"Image",        logo:"🖼️", tagline:"Precise image generation inside ChatGPT",             description:"",                                                                 bestFor:["Marketers","Content Creators","Product Teams"],         pricing:{free:"Via ChatGPT free (limited)",           paid:"Included in ChatGPT Plus $20/mo"},   freeLimit:"Limited images on free ChatGPT",                      link:"https://openai.com/dall-e-3",         tags:["image","design","creative"],                              popularity:80, trending:false, newThis:false, weeklyGrowth:"+0.5%", useCases:[] },
  { id:6,  name:"GitHub Copilot", company:"GitHub/Microsoft", category:"Code",         logo:"💻", tagline:"Your AI pair programmer in the IDE",                   description:"",                                                                          bestFor:["Developers","DevOps","Tech Students"],                  pricing:{free:"Free for students & open source",      paid:"$10/mo · $19/user/mo Business"},    freeLimit:"Free for verified students and open source maintainers", link:"https://github.com/features/copilot", tags:["code","developer","autocomplete"],                       popularity:87, trending:false, newThis:false, weeklyGrowth:"+1.8%", useCases:[] },
  { id:7,  name:"Cursor",         company:"Anysphere",        category:"Code",         logo:"🖱️", tagline:"The AI-first code editor",                            description:"",                                                                 bestFor:["Developers","Solo Founders","Freelancers"],             pricing:{free:"Free Hobby plan",                      paid:"$20/mo Pro"},                        freeLimit:"2 weeks Pro trial, then limited free tier",           link:"https://cursor.com",                  tags:["code","developer","editor"],                              popularity:82, trending:true,  newThis:false, weeklyGrowth:"+5.6%", useCases:[] },
  { id:8,  name:"ElevenLabs",     company:"ElevenLabs",       category:"Audio",        logo:"🎙️", tagline:"Human-quality AI voice generation",                   description:"",                                                                      bestFor:["Podcasters","Publishers","Game Studios","Educators"],   pricing:{free:"Free: 10,000 chars/mo",                paid:"From $5/mo Starter"},                freeLimit:"10,000 characters (~10 mins audio) per month",        link:"https://elevenlabs.io",               tags:["audio","voice","podcast","tts"],                          popularity:82, trending:true,  newThis:true,  weeklyGrowth:"+7.2%", useCases:[] },
  { id:9,  name:"Runway ML",      company:"Runway",           category:"Video",        logo:"🎬", tagline:"AI video generation and editing suite",                description:"",                                                          bestFor:["Video Editors","Filmmakers","Marketers"],               pricing:{free:"Free: 125 credits",                    paid:"From $15/mo Standard"},              freeLimit:"125 one-time credits (~25 seconds of video)",         link:"https://runwayml.com",                tags:["video","creative","film","generation"],                   popularity:74, trending:false, newThis:false, weeklyGrowth:"+2.4%", useCases:[] },
  { id:10, name:"Sora",           company:"OpenAI",           category:"Video",        logo:"🌊", tagline:"Cinematic text-to-video by OpenAI",                    description:"",                                                               bestFor:["Filmmakers","Advertisers","Game Designers","Educators"], pricing:{free:"Included in Plus ($20/mo)",            paid:"ChatGPT Pro $200/mo for priority"},  freeLimit:"Limited generations on Plus; watermarked output",     link:"https://sora.com",                    tags:["video","film","generation","cinematic"],                  popularity:88, trending:true,  newThis:true,  weeklyGrowth:"+9.1%", useCases:[] },
  { id:11, name:"Perplexity AI",  company:"Perplexity",       category:"Research",     logo:"🔍", tagline:"The cited, real-time AI answer engine",                description:"",                                                                    bestFor:["Researchers","Journalists","Analysts","Students"],      pricing:{free:"Free with limited Pro searches",       paid:"$20/mo Pro"},                        freeLimit:"Unlimited standard; 5 Pro searches/day free",         link:"https://perplexity.ai",               tags:["research","search","citations","web"],                    popularity:78, trending:true,  newThis:false, weeklyGrowth:"+3.3%", useCases:[] },
  { id:12, name:"Notion AI",      company:"Notion",           category:"Productivity", logo:"📝", tagline:"AI built directly into your workspace",               description:"",                                                                            bestFor:["Teams","Project Managers","Students","Freelancers"],    pricing:{free:"20 free AI responses",                 paid:"$10/user/mo AI add-on"},             freeLimit:"20 AI responses, then requires paid add-on",          link:"https://notion.so/product/ai",        tags:["productivity","notes","workspace","teams"],               popularity:71, trending:false, newThis:false, weeklyGrowth:"+1.1%", useCases:[] },
  { id:13, name:"Synthesia",      company:"Synthesia",        category:"Video",        logo:"🧑‍💼", tagline:"AI avatar videos without cameras",                  description:"",                                                         bestFor:["L&D Teams","HR","Marketers","Sales"],                   pricing:{free:"Free: 3 mins/mo",                      paid:"From $29/mo Starter"},               freeLimit:"3 minutes of video per month",                        link:"https://synthesia.io",                tags:["video","avatar","training","corporate"],                  popularity:69, trending:false, newThis:false, weeklyGrowth:"+0.9%", useCases:[] },
  { id:14, name:"Otter.ai",       company:"Otter.ai",         category:"Productivity", logo:"🦦", tagline:"Real-time AI meeting transcription",                   description:"",                                                                 bestFor:["Remote Teams","Journalists","Sales Reps","Students"],   pricing:{free:"Free: 300 mins/mo",                    paid:"From $17/mo Pro"},                   freeLimit:"300 minutes of transcription per month",              link:"https://otter.ai",                    tags:["productivity","meetings","transcription","audio"],        popularity:64, trending:false, newThis:false, weeklyGrowth:"+0.7%", useCases:[] },
  { id:15, name:"Lovable",        company:"Lovable",          category:"Code",         logo:"💜", tagline:"Build full-stack apps by chatting",                    description:"",                                                                      bestFor:["Non-Technical Founders","Entrepreneurs","Designers"],   pricing:{free:"Free starter plan",                    paid:"From $20/mo"},                       freeLimit:"Limited projects and messages on free tier",          link:"https://lovable.dev",                 tags:["code","no-code","app","builder"],                         popularity:76, trending:true,  newThis:true,  weeklyGrowth:"+11.4%", useCases:[] },
  { id:16, name:"Make",           company:"Make",             category:"Productivity", logo:"⚙️", tagline:"Visual AI workflow automation",                        description:"",                                                               bestFor:["Operations Teams","Freelancers","Agencies","Founders"], pricing:{free:"Free: 1,000 ops/mo",                   paid:"From $9/mo Core"},                   freeLimit:"1,000 operations per month free",                     link:"https://make.com",                    tags:["automation","workflow","no-code","integration"],          popularity:72, trending:false, newThis:false, weeklyGrowth:"+2.0%", useCases:[] },
  { id:17, name:"Bolt.new",       company:"StackBlitz",       category:"Code",         logo:"🔩", tagline:"Full-stack AI app builder in the browser",             description:"",                                                      bestFor:["Entrepreneurs","Designers","Rapid Prototypers"],        pricing:{free:"Free tier with daily credits",         paid:"From $20/mo Pro"},                   freeLimit:"Limited daily tokens on free plan",                   link:"https://bolt.new",                    tags:["code","no-code","app","builder","deploy"],                popularity:79, trending:true,  newThis:true,  weeklyGrowth:"+13.2%", useCases:[] },
  { id:18, name:"Descript",       company:"Descript",         category:"Audio",        logo:"✂️", tagline:"Edit audio and video like a document",                description:"",                                              bestFor:["Podcasters","Video Creators","Marketers","Journalists"], pricing:{free:"Free: 1 hour transcription/mo",       paid:"From $24/mo Creator"},               freeLimit:"1 hour transcription and basic editing free monthly", link:"https://descript.com",                tags:["audio","video","podcast","editing","transcription"],      popularity:68, trending:false, newThis:false, weeklyGrowth:"+1.5%", useCases:[] },
  { id:19, name:"Canva AI",       company:"Canva",            category:"Image",        logo:"🎭", tagline:"AI design tools built for everyone",                   description:"",                                               bestFor:["Non-Designers","Marketers","Small Businesses","Teachers"], pricing:{free:"Generous free plan",                paid:"$15/mo Pro"},                         freeLimit:"Most AI tools on free; some premium features gated",  link:"https://canva.com",                   tags:["image","design","presentation","no-code"],               popularity:84, trending:false, newThis:false, weeklyGrowth:"+2.8%", useCases:[] },
  { id:20, name:"Zapier AI",      company:"Zapier",           category:"Productivity", logo:"🔗", tagline:"AI-powered automation for 6,000+ apps",                description:"",                                                               bestFor:["Business Owners","Operations","Sales Teams","Marketers"], pricing:{free:"Free: 100 tasks/mo",                  paid:"From $20/mo Starter"},               freeLimit:"100 automated tasks per month on free plan",          link:"https://zapier.com",                  tags:["automation","workflow","integration","no-code"],          popularity:75, trending:false, newThis:false, weeklyGrowth:"+1.9%", useCases:[] },

  // ── WRITING AI ──────────────────────────────────────────────────────────────
  { id:21, name:"DeepSeek",       company:"DeepSeek AI",      category:"Writing",      logo:"🐋", tagline:"Open-source reasoning AI rivalling GPT-4",             description:"",                                         bestFor:["Developers","Researchers","Businesses","Students"],     pricing:{free:"Free via chat.deepseek.com",           paid:"API from $0.14/M tokens"},           freeLimit:"Generous free tier on web app",                       link:"https://chat.deepseek.com",           tags:["text","reasoning","open-source","coding"],                popularity:88, trending:true,  newThis:true,  weeklyGrowth:"+18.4%",useCases:[] },
  { id:22, name:"Grok",           company:"xAI",              category:"Writing",      logo:"🤖", tagline:"Elon Musk's real-time AI with X integration",           description:"",                            bestFor:["Social Media Managers","Journalists","Researchers"],    pricing:{free:"Basic via X free account",             paid:"X Premium $8/mo"},                   freeLimit:"Limited free access via X account",                   link:"https://grok.x.ai",                  tags:["text","real-time","social","news"],                       popularity:76, trending:true,  newThis:false, weeklyGrowth:"+6.2%", useCases:[] },
  { id:23, name:"Mistral",        company:"Mistral AI",       category:"Writing",      logo:"🌪️", tagline:"Europe's leading open-source AI model",                description:"",                   bestFor:["Developers","Enterprises","Privacy-Conscious Teams"],   pricing:{free:"Free via La Plateforme",               paid:"API from $0.25/M tokens"},           freeLimit:"Free API tier available",                             link:"https://mistral.ai",                  tags:["text","open-source","privacy","enterprise"],             popularity:72, trending:true,  newThis:false, weeklyGrowth:"+5.1%", useCases:[] },
  { id:24, name:"Jasper",         company:"Jasper AI",        category:"Writing",      logo:"✍️", tagline:"AI writing platform built for marketing teams",          description:"",                                      bestFor:["Marketing Teams","Content Agencies","Brand Managers"],  pricing:{free:"7-day free trial",                    paid:"From $49/mo Creator"},               freeLimit:"7-day trial only",                                    link:"https://jasper.ai",                   tags:["writing","marketing","brand","content"],                  popularity:73, trending:false, newThis:false, weeklyGrowth:"+1.4%", useCases:[] },
  { id:25, name:"Copy.ai",        company:"Copy.ai",          category:"Writing",      logo:"📋", tagline:"AI that writes sales and marketing copy",               description:"",                                    bestFor:["Sales Teams","Copywriters","Marketers","Startups"],     pricing:{free:"Free: 2,000 words/mo",                paid:"From $49/mo Pro"},                   freeLimit:"2,000 words per month on free plan",                  link:"https://copy.ai",                     tags:["writing","copywriting","marketing","sales"],              popularity:68, trending:false, newThis:false, weeklyGrowth:"+0.8%", useCases:[] },
  { id:26, name:"Grammarly",      company:"Grammarly",        category:"Writing",      logo:"📗", tagline:"AI writing assistant for clarity and tone",              description:"",                       bestFor:["Writers","Professionals","Students","Non-Native Speakers"], pricing:{free:"Free basic plan",                    paid:"$12/mo Premium · $15/user/mo Business"}, freeLimit:"Basic grammar and spelling on free plan",             link:"https://grammarly.com",               tags:["writing","grammar","editing","productivity"],             popularity:84, trending:false, newThis:false, weeklyGrowth:"+1.6%", useCases:[] },
  { id:27, name:"Writesonic",     company:"Writesonic",       category:"Writing",      logo:"🔊", tagline:"AI writer with SEO and web search built in",             description:"",                                        bestFor:["SEO Teams","Bloggers","Content Marketers","Agencies"],  pricing:{free:"Free: 10,000 words/mo",               paid:"From $16/mo Individual"},            freeLimit:"10,000 words per month free",                         link:"https://writesonic.com",              tags:["writing","seo","content","search"],                       popularity:65, trending:false, newThis:false, weeklyGrowth:"+1.1%", useCases:[] },

  // ── IMAGE AI ────────────────────────────────────────────────────────────────
  { id:28, name:"Adobe Firefly",  company:"Adobe",            category:"Image",        logo:"🔥", tagline:"AI image generation built into Creative Cloud",          description:"",bestFor:["Designers","Photographers","Marketing Teams","Agencies"],pricing:{free:"Free: 25 credits/mo",                 paid:"Included in CC plans from $59.99/mo"},freeLimit:"25 generative credits per month",                     link:"https://firefly.adobe.com",           tags:["image","design","adobe","commercial"],                   popularity:79, trending:true,  newThis:false, weeklyGrowth:"+3.8%", useCases:[] },
  { id:29, name:"Stable Diffusion",company:"Stability AI",   category:"Image",        logo:"🎭", tagline:"Open-source image generation you control completely",    description:"",               bestFor:["Developers","Artists","Researchers","Game Studios"],    pricing:{free:"Free (self-hosted)",                  paid:"API from $0.04/image"},              freeLimit:"Unlimited if self-hosted",                            link:"https://stability.ai",                tags:["image","open-source","local","fine-tuning"],             popularity:76, trending:false, newThis:false, weeklyGrowth:"+1.3%", useCases:[] },
  { id:30, name:"Leonardo AI",    company:"Leonardo.ai",     category:"Image",        logo:"🎨", tagline:"Professional image generation for game and media assets", description:"",                 bestFor:["Game Developers","Concept Artists","Studios","Designers"],pricing:{free:"Free: 150 credits/day",               paid:"From $10/mo Apprentice"},            freeLimit:"150 tokens per day on free plan",                     link:"https://leonardo.ai",                 tags:["image","game","character","creative"],                   popularity:71, trending:true,  newThis:false, weeklyGrowth:"+4.1%", useCases:[] },
  { id:31, name:"Ideogram",       company:"Ideogram",        category:"Image",        logo:"💬", tagline:"AI image generation that actually renders text correctly",  description:"",                   bestFor:["Designers","Marketers","Social Media Creators"],        pricing:{free:"Free: 10 slow generations/day",       paid:"From $7/mo Basic"},                 freeLimit:"10 free slow generations per day",                    link:"https://ideogram.ai",                 tags:["image","text","design","social"],                        popularity:67, trending:true,  newThis:true,  weeklyGrowth:"+8.3%", useCases:[] },
  { id:32, name:"Flux",           company:"Black Forest Labs", category:"Image",       logo:"⚡", tagline:"The fastest and sharpest open image model",               description:"",  bestFor:["Photographers","Developers","Agencies","Content Creators"], pricing:{free:"Via partner platforms",              paid:"API ~$0.003/image on Fal.ai"},       freeLimit:"Free trials via partner platforms",                   link:"https://blackforestlabs.ai",          tags:["image","photorealism","open-source","api"],              popularity:74, trending:true,  newThis:true,  weeklyGrowth:"+11.6%",useCases:[] },

  // ── VIDEO AI ────────────────────────────────────────────────────────────────
  { id:33, name:"HeyGen",         company:"HeyGen",           category:"Video",        logo:"👤", tagline:"AI video avatars and instant video translation",          description:"",      bestFor:["Marketing Teams","L&D","Sales","International Brands"],  pricing:{free:"Free: 1 min/mo",                      paid:"From $29/mo Creator"},               freeLimit:"1 minute of video per month",                         link:"https://heygen.com",                  tags:["video","avatar","translation","corporate"],              popularity:73, trending:true,  newThis:false, weeklyGrowth:"+5.4%", useCases:[] },
  { id:34, name:"Kling AI",       company:"Kuaishou",         category:"Video",        logo:"🎥", tagline:"Cinematic AI video with physics-accurate motion",          description:"",              bestFor:["Filmmakers","Content Creators","Advertisers","Studios"],pricing:{free:"Free: 66 credits/day",                paid:"From $8.99/mo Standard"},            freeLimit:"66 credits per day on free plan",                     link:"https://klingai.com",                 tags:["video","cinematic","generation","motion"],               popularity:70, trending:true,  newThis:true,  weeklyGrowth:"+12.1%",useCases:[] },
  { id:35, name:"Pika",           company:"Pika Labs",        category:"Video",        logo:"⚡", tagline:"Turn images and text into fluid video clips",             description:"",                        bestFor:["Content Creators","Social Media Teams","Marketers"],    pricing:{free:"Free: 150 credits/mo",                paid:"From $8/mo Basic"},                 freeLimit:"150 credits per month",                               link:"https://pika.art",                    tags:["video","generation","social","motion"],                  popularity:67, trending:true,  newThis:false, weeklyGrowth:"+6.8%", useCases:[] },
  { id:36, name:"Luma Dream Machine",company:"Luma AI",       category:"Video",        logo:"🌙", tagline:"Photorealistic video generation from text or image",       description:"",               bestFor:["Filmmakers","Product Marketers","Agencies","Creators"], pricing:{free:"Free: 30 generations/mo",             paid:"From $29.99/mo Plus"},               freeLimit:"30 free generations per month",                       link:"https://lumalabs.ai/dream-machine",    tags:["video","photorealism","generation","cinematic"],         popularity:68, trending:true,  newThis:true,  weeklyGrowth:"+9.4%", useCases:[] },

  // ── CODE AI ─────────────────────────────────────────────────────────────────
  { id:37, name:"v0 by Vercel",   company:"Vercel",           category:"Code",         logo:"▲", tagline:"Generate production UI from a text prompt",               description:"",           bestFor:["Frontend Developers","Designers","Founders","Agencies"],pricing:{free:"Free: 200 credits/mo",                paid:"From $20/mo Pro"},                   freeLimit:"200 monthly credits on free plan",                    link:"https://v0.dev",                      tags:["code","ui","react","frontend"],                          popularity:78, trending:true,  newThis:true,  weeklyGrowth:"+14.3%",useCases:[] },
  { id:38, name:"Replit",         company:"Replit",           category:"Code",         logo:"🔄", tagline:"Build and deploy apps in the browser with AI",             description:"",                    bestFor:["Beginners","Students","Founders","Educators"],          pricing:{free:"Free Starter plan",                   paid:"From $25/mo Core"},                 freeLimit:"Limited compute on free plan",                        link:"https://replit.com",                  tags:["code","no-code","deploy","browser"],                     popularity:72, trending:true,  newThis:false, weeklyGrowth:"+4.7%", useCases:[] },
  { id:39, name:"Windsurf",       company:"Codeium",          category:"Code",         logo:"🏄", tagline:"The agentic AI IDE that writes and runs code for you",     description:"",                               bestFor:["Developers","Engineering Teams","Solo Founders"],       pricing:{free:"Free plan available",                 paid:"$15/mo Pro"},                        freeLimit:"Limited AI actions on free plan",                     link:"https://codeium.com/windsurf",        tags:["code","ide","agentic","developer"],                      popularity:74, trending:true,  newThis:true,  weeklyGrowth:"+8.9%", useCases:[] },
  { id:40, name:"Claude Code",    company:"Anthropic",        category:"Code",         logo:"💻", tagline:"Agentic coding in your terminal",                         description:"", bestFor:["Developers","Engineering Teams","DevOps"],              pricing:{free:"API usage-based",                     paid:"API from $3/M input tokens"},        freeLimit:"No free tier — API usage billed",                     link:"https://claude.ai/code",              tags:["code","agentic","terminal","developer"],                 popularity:76, trending:true,  newThis:true,  weeklyGrowth:"+10.2%",useCases:[] },
  { id:41, name:"Tabnine",        company:"Tabnine",          category:"Code",         logo:"🔮", tagline:"AI code completion trained on your own codebase",         description:"",               bestFor:["Enterprise Developers","Privacy-Conscious Teams","Agencies"], pricing:{free:"Free Basic plan",                  paid:"$12/mo Pro · $39/user/mo Enterprise"}, freeLimit:"Basic completions on free plan",                     link:"https://tabnine.com",                 tags:["code","autocomplete","privacy","enterprise"],            popularity:64, trending:false, newThis:false, weeklyGrowth:"+0.9%", useCases:[] },

  // ── AUDIO AI ────────────────────────────────────────────────────────────────
  { id:42, name:"Suno",           company:"Suno",             category:"Audio",        logo:"🎵", tagline:"Generate full songs with vocals from a text prompt",      description:"",                      bestFor:["Content Creators","Musicians","Marketers","Educators"], pricing:{free:"Free: 50 credits/day",                paid:"From $8/mo Pro (2,500 credits)"},    freeLimit:"50 credits (~10 songs) per day",                      link:"https://suno.com",                    tags:["audio","music","generation","vocals"],                   popularity:79, trending:true,  newThis:true,  weeklyGrowth:"+12.4%",useCases:[] },
  { id:43, name:"Udio",           company:"Udio",             category:"Audio",        logo:"🎶", tagline:"Professional-quality AI music generation",                description:"",        bestFor:["Musicians","Producers","Film Composers","Podcasters"],  pricing:{free:"Free: 1,200 credits/mo",              paid:"From $10/mo Standard"},              freeLimit:"1,200 credits (~100 tracks) per month",               link:"https://udio.com",                    tags:["audio","music","production","generation"],               popularity:71, trending:true,  newThis:true,  weeklyGrowth:"+9.7%", useCases:[] },
  { id:44, name:"Whisper",        company:"OpenAI",           category:"Audio",        logo:"🎤", tagline:"Open-source speech-to-text with near-human accuracy",     description:"",                  bestFor:["Developers","Journalists","Researchers","Accessibility"], pricing:{free:"Free (open-source)",                 paid:"API $0.006/min via OpenAI"},         freeLimit:"Unlimited if self-hosted",                            link:"https://openai.com/research/whisper", tags:["audio","transcription","speech","open-source"],          popularity:75, trending:false, newThis:false, weeklyGrowth:"+2.1%", useCases:[] },
  { id:45, name:"Murf AI",        company:"Murf",             category:"Audio",        logo:"🔈", tagline:"Studio-quality AI voiceovers for any content",            description:"",               bestFor:["E-Learning Creators","Video Producers","Marketers"],    pricing:{free:"Free: 10 mins/mo",                    paid:"From $29/mo Creator"},               freeLimit:"10 minutes of voiceover per month",                   link:"https://murf.ai",                     tags:["audio","voiceover","tts","e-learning"],                  popularity:63, trending:false, newThis:false, weeklyGrowth:"+1.2%", useCases:[] },

  // ── RESEARCH AI ─────────────────────────────────────────────────────────────
  { id:46, name:"Consensus",      company:"Consensus",        category:"Research",     logo:"📚", tagline:"AI search engine for scientific research papers",         description:"",                   bestFor:["Researchers","Students","Doctors","Journalists"],       pricing:{free:"Free: 20 searches/mo",                paid:"$8.99/mo Premium"},                 freeLimit:"20 searches per month",                               link:"https://consensus.app",               tags:["research","science","papers","citations"],               popularity:66, trending:true,  newThis:false, weeklyGrowth:"+4.2%", useCases:[] },
  { id:47, name:"Elicit",         company:"Elicit",           category:"Research",     logo:"🔬", tagline:"AI research assistant that reads papers for you",         description:"",                          bestFor:["Academics","Policy Researchers","Scientists","Students"],pricing:{free:"Free: 5,000 credits/mo",               paid:"From $10/mo Plus"},                 freeLimit:"5,000 credits per month on free plan",                link:"https://elicit.com",                  tags:["research","papers","analysis","science"],                popularity:62, trending:false, newThis:false, weeklyGrowth:"+2.8%", useCases:[] },
  { id:48, name:"ChatPDF",        company:"ChatPDF",          category:"Research",     logo:"📄", tagline:"Chat with any PDF document using AI",                     description:"",                  bestFor:["Students","Lawyers","Researchers","Business Analysts"], pricing:{free:"Free: 3 PDFs/day · 50 pages each",    paid:"From $5/mo Plus"},                  freeLimit:"3 PDFs per day up to 50 pages each",                  link:"https://chatpdf.com",                 tags:["research","pdf","documents","analysis"],                 popularity:69, trending:false, newThis:false, weeklyGrowth:"+1.7%", useCases:[] },
  { id:49, name:"NotebookLM",     company:"Google",           category:"Research",     logo:"📒", tagline:"AI research assistant grounded in your own sources",      description:"",             bestFor:["Researchers","Students","Journalists","Knowledge Workers"], pricing:{free:"Free via Google account",            paid:"Included in Google One AI Premium"},freeLimit:"Generous free tier with Google account",               link:"https://notebooklm.google.com",       tags:["research","documents","notes","audio"],                  popularity:74, trending:true,  newThis:false, weeklyGrowth:"+6.1%", useCases:[] },

  // ── PRODUCTIVITY AI ─────────────────────────────────────────────────────────
  { id:51, name:"Microsoft Copilot",company:"Microsoft",      category:"Productivity", logo:"🪟", tagline:"AI across the entire Microsoft 365 suite",               description:"",             bestFor:["Office Workers","Enterprises","Teams","Managers"],      pricing:{free:"Free via Bing · Edge browser",        paid:"$30/user/mo M365 Copilot"},         freeLimit:"Limited free via Bing and Edge",                      link:"https://copilot.microsoft.com",       tags:["productivity","office","enterprise","microsoft"],        popularity:83, trending:true,  newThis:false, weeklyGrowth:"+4.5%", useCases:[] },
  { id:52, name:"Slack AI",        company:"Salesforce",      category:"Productivity", logo:"💬", tagline:"AI summaries and search across your Slack workspace",     description:"",                         bestFor:["Remote Teams","Project Managers","Enterprises"],        pricing:{free:"No free AI tier",                    paid:"$10/user/mo add-on on Pro+"},        freeLimit:"No free AI tier — requires paid Slack plan",          link:"https://slack.com/intl/en-gb/ai",     tags:["productivity","collaboration","teams","search"],         popularity:71, trending:false, newThis:false, weeklyGrowth:"+2.2%", useCases:[] },
  { id:53, name:"ClickUp AI",      company:"ClickUp",         category:"Productivity", logo:"✅", tagline:"AI project management and task automation",               description:"",        bestFor:["Project Managers","Teams","Operations","Agencies"],     pricing:{free:"Included in paid plans",              paid:"$7/user/mo Business (AI included)"},freeLimit:"Limited in free plan",                               link:"https://clickup.com/ai",              tags:["productivity","project-management","automation","teams"],popularity:68, trending:false, newThis:false, weeklyGrowth:"+1.8%", useCases:[] },
  { id:54, name:"n8n",             company:"n8n GmbH",        category:"Productivity", logo:"⚡", tagline:"Open-source AI workflow automation you can self-host",    description:"",         bestFor:["Developers","DevOps","Privacy-Conscious Teams","Agencies"], pricing:{free:"Free (self-hosted)",                 paid:"From $20/mo Cloud Starter"},        freeLimit:"Unlimited if self-hosted",                            link:"https://n8n.io",                      tags:["automation","workflow","open-source","self-hosted"],     popularity:66, trending:true,  newThis:false, weeklyGrowth:"+5.3%", useCases:[] },
  { id:55, name:"Gamma",           company:"Gamma",           category:"Productivity", logo:"📊", tagline:"AI that builds presentations and documents in seconds",   description:"",               bestFor:["Consultants","Founders","Marketers","Students"],        pricing:{free:"Free: 400 AI credits",                paid:"From $8/mo Plus"},                  freeLimit:"400 one-time credits on free plan",                   link:"https://gamma.app",                   tags:["productivity","presentations","design","documents"],     popularity:72, trending:true,  newThis:false, weeklyGrowth:"+5.7%", useCases:[] },
  { id:56, name:"Fireflies.ai",    company:"Fireflies.ai",    category:"Productivity", logo:"🔥", tagline:"AI notetaker for every meeting across every platform",    description:"",bestFor:["Sales Teams","Remote Teams","Recruiters","Consultants"], pricing:{free:"Free: 800 mins storage",              paid:"From $10/mo Pro"},                  freeLimit:"800 minutes of transcription storage",                link:"https://fireflies.ai",                tags:["productivity","meetings","transcription","sales"],       popularity:67, trending:false, newThis:false, weeklyGrowth:"+1.6%", useCases:[] },

  // ── WRITING AI (additional) ──────────────────────────────────────────────────
  { id:58, name:"Pi",              company:"Inflection AI",   category:"Writing",      logo:"🥧", tagline:"A kind, supportive AI built for real conversation",       description:"", bestFor:["Individuals","Students","Anyone Wanting AI to Talk With"], pricing:{free:"Free",                                  paid:"Free for now"},                     freeLimit:"Unlimited free access",                               link:"https://pi.ai",                       tags:["text","conversation","personal","emotional"],            popularity:65, trending:false, newThis:false, weeklyGrowth:"+1.8%", useCases:[] },
  { id:59, name:"Character.ai",   company:"Character.ai",    category:"Writing",      logo:"🎭", tagline:"Chat with AI characters — real and fictional",            description:"", bestFor:["Students","Creatives","Entertainment","Language Learners"], pricing:{free:"Free with ads",                      paid:"$9.99/mo c.ai+"},                   freeLimit:"Unlimited chats on free plan",                        link:"https://character.ai",                tags:["text","characters","entertainment","creative"],          popularity:80, trending:true,  newThis:false, weeklyGrowth:"+3.1%", useCases:[] },
  { id:60, name:"Gemma",          company:"Google DeepMind",  category:"Writing",      logo:"💎", tagline:"Google's open lightweight AI model for developers",       description:"", bestFor:["Developers","Researchers","Students","Privacy Teams"],  pricing:{free:"Free open-source",                    paid:"Cloud hosting via Google"},          freeLimit:"Fully free and open-source",                          link:"https://ai.google.dev/gemma",         tags:["text","open-source","lightweight","developer"],          popularity:68, trending:true,  newThis:false, weeklyGrowth:"+6.4%", useCases:[] },
  { id:61, name:"LLaMA",          company:"Meta AI",          category:"Writing",      logo:"🦙", tagline:"Meta's powerful open-source AI model",                    description:"", bestFor:["Developers","Researchers","Enterprises","Privacy-Focused Teams"], pricing:{free:"Free open-source",               paid:"Cloud hosting varies"},              freeLimit:"Fully free — download and run locally",               link:"https://llama.meta.com",              tags:["text","open-source","self-hosted","developer"],          popularity:78, trending:true,  newThis:false, weeklyGrowth:"+8.2%", useCases:[] },
  { id:62, name:"Cohere",         company:"Cohere",           category:"Writing",      logo:"🔵", tagline:"Enterprise AI built for business applications",            description:"", bestFor:["Enterprises","Developers","Data Teams","Legal and Finance"], pricing:{free:"Free trial available",              paid:"Usage-based API pricing"},           freeLimit:"Free trial with limited credits",                     link:"https://cohere.com",                  tags:["text","enterprise","api","search"],                      popularity:66, trending:false, newThis:false, weeklyGrowth:"+2.9%", useCases:[] },

  // ── IMAGE AI (additional) ─────────────────────────────────────────────────────
  { id:63, name:"Krea AI",        company:"Krea",             category:"Image",        logo:"✨", tagline:"Real-time AI image generation as you paint",              description:"", bestFor:["Artists","Designers","Content Creators","Illustrators"], pricing:{free:"Free basic plan",                   paid:"From $10/mo Basic"},                freeLimit:"Limited generations on free plan",                    link:"https://krea.ai",                     tags:["image","real-time","creative","painting"],               popularity:69, trending:true,  newThis:true,  weeklyGrowth:"+9.8%", useCases:[] },
  { id:64, name:"Magnific AI",    company:"Magnific",         category:"Image",        logo:"🔍", tagline:"AI upscaling that adds extraordinary detail",              description:"", bestFor:["Photographers","Print Designers","Retouchers","Studios"], pricing:{free:"Free trial (3 images)",              paid:"From $39/mo Pro"},                  freeLimit:"3 free trial upscales",                               link:"https://magnific.ai",                 tags:["image","upscaling","enhancement","photography"],         popularity:71, trending:true,  newThis:false, weeklyGrowth:"+5.2%", useCases:[] },
  { id:65, name:"Runway Gen-3",   company:"Runway",           category:"Image",        logo:"🎨", tagline:"State of the art image generation from Runway",            description:"", bestFor:["Filmmakers","Advertisers","Creative Directors","Studios"], pricing:{free:"Free: 125 credits",                 paid:"From $15/mo Standard"},             freeLimit:"125 one-time credits shared with video",              link:"https://runwayml.com",                tags:["image","photorealism","professional","creative"],         popularity:72, trending:true,  newThis:true,  weeklyGrowth:"+7.3%", useCases:[] },
  { id:66, name:"Freepik AI",     company:"Freepik",          category:"Image",        logo:"🖌️", tagline:"AI image generation with built-in commercial licensing",   description:"", bestFor:["Marketers","Small Businesses","Designers","Freelancers"], pricing:{free:"Free: limited generations",         paid:"Included in Freepik Premium $29/mo"},freeLimit:"Limited free generations monthly",                    link:"https://freepik.com/ai",              tags:["image","commercial","licensed","design"],                popularity:67, trending:false, newThis:false, weeklyGrowth:"+2.1%", useCases:[] },

  // ── VIDEO AI (additional) ─────────────────────────────────────────────────────
  { id:67, name:"Invideo AI",     company:"InVideo",          category:"Video",        logo:"🎞️", tagline:"Turn a text prompt into a polished video with voiceover",  description:"", bestFor:["Content Creators","Marketers","Educators","Small Businesses"], pricing:{free:"Free: watermarked exports",        paid:"From $20/mo Plus"},                 freeLimit:"Free plan with watermark",                            link:"https://invideo.io",                  tags:["video","text-to-video","marketing","voiceover"],         popularity:71, trending:true,  newThis:false, weeklyGrowth:"+6.4%", useCases:[] },
  { id:68, name:"Captions.ai",   company:"Captions",         category:"Video",        logo:"💬", tagline:"Auto captions, editing and AI video creation for creators",description:"", bestFor:["Social Media Creators","Podcasters","Course Creators","Businesses"], pricing:{free:"Free basic plan",             paid:"From $9.99/mo Pro"},                freeLimit:"Limited exports on free plan",                        link:"https://captions.ai",                 tags:["video","captions","editing","social"],                   popularity:73, trending:true,  newThis:true,  weeklyGrowth:"+10.1%",useCases:[] },
  { id:69, name:"Pictory",        company:"Pictory AI",       category:"Video",        logo:"🖼️", tagline:"Turn blog posts and scripts into shareable videos",        description:"", bestFor:["Content Marketers","Bloggers","Agencies","Course Creators"], pricing:{free:"Free trial: 3 videos",           paid:"From $19/mo Starter"},               freeLimit:"3 free trial videos",                                 link:"https://pictory.ai",                  tags:["video","content","repurposing","marketing"],             popularity:65, trending:false, newThis:false, weeklyGrowth:"+2.3%", useCases:[] },
  { id:70, name:"Veed.io",        company:"Veed",             category:"Video",        logo:"✂️", tagline:"Online video editor with built-in AI tools",               description:"", bestFor:["Content Creators","Small Businesses","HR Teams","Educators"], pricing:{free:"Free with watermark",            paid:"From $18/mo Plus"},                 freeLimit:"Free plan with Veed watermark",                       link:"https://veed.io",                     tags:["video","editing","subtitles","browser"],                 popularity:70, trending:true,  newThis:false, weeklyGrowth:"+4.5%", useCases:[] },
  { id:71, name:"OpusClip",       company:"Opus AI",          category:"Video",        logo:"✂️", tagline:"AI that finds the best clips from your long videos",       description:"", bestFor:["YouTubers","Podcasters","Course Creators","Content Teams"], pricing:{free:"Free: 60 mins/mo",               paid:"From $15/mo Starter"},               freeLimit:"60 minutes of processing per month",                  link:"https://opus.pro",                    tags:["video","repurposing","clips","social"],                  popularity:74, trending:true,  newThis:false, weeklyGrowth:"+8.6%", useCases:[] },

  // ── CODE AI (additional) ──────────────────────────────────────────────────────
  { id:72, name:"Devin AI",       company:"Cognition Labs",   category:"Code",         logo:"🤖", tagline:"The first fully autonomous AI software engineer",         description:"", bestFor:["Engineering Teams","CTOs","Startups","Enterprises"],    pricing:{free:"No free plan",                        paid:"$500/mo Teams"},                    freeLimit:"No free tier",                                        link:"https://cognition.ai",                tags:["code","autonomous","agentic","engineering"],             popularity:77, trending:true,  newThis:true,  weeklyGrowth:"+12.8%",useCases:[] },
  { id:73, name:"Gumloop",        company:"Gumloop",          category:"Code",         logo:"⚡", tagline:"Build AI agents and automations without coding",           description:"", bestFor:["Operators","Marketing Teams","Sales Teams","Non-Developers"], pricing:{free:"Free plan available",             paid:"From $37/mo Starter"},               freeLimit:"Limited automations on free plan",                    link:"https://gumloop.com",                 tags:["automation","no-code","agents","workflow"],              popularity:69, trending:true,  newThis:true,  weeklyGrowth:"+14.1%",useCases:[] },
  { id:74, name:"Framer AI",      company:"Framer",           category:"Code",         logo:"🎯", tagline:"Build and publish AI websites without code",              description:"", bestFor:["Designers","Startups","Freelancers","Agencies"],        pricing:{free:"Free plan (Framer subdomain)",        paid:"From $10/mo Mini"},                 freeLimit:"Free plan on framer.site subdomain",                  link:"https://framer.com",                  tags:["code","website","no-code","design"],                     popularity:76, trending:true,  newThis:false, weeklyGrowth:"+7.8%", useCases:[] },
  { id:75, name:"Bubble",         company:"Bubble",           category:"Code",         logo:"🫧", tagline:"Build full web apps without writing code",                 description:"", bestFor:["Entrepreneurs","Product Managers","Startups","Operators"], pricing:{free:"Free plan available",             paid:"From $29/mo Starter"},               freeLimit:"Free plan with Bubble subdomain",                     link:"https://bubble.io",                   tags:["no-code","app","web","database"],                        popularity:72, trending:false, newThis:false, weeklyGrowth:"+3.2%", useCases:[] },

  // ── DESIGN AI (new category) ──────────────────────────────────────────────────
  { id:76, name:"Figma AI",       company:"Figma",            category:"Design",       logo:"🎨", tagline:"AI design tools built into the world's leading design platform", description:"", bestFor:["UI/UX Designers","Product Teams","Developers","Agencies"], pricing:{free:"Free Starter plan (3 projects)",   paid:"From $15/mo Professional"},         freeLimit:"3 projects on free plan — unlimited viewers",         link:"https://figma.com",                   tags:["design","ui","collaboration","prototype"],               popularity:89, trending:true,  newThis:false, weeklyGrowth:"+4.1%", useCases:[] },
  { id:77, name:"Uizard",         company:"Uizard",           category:"Design",       logo:"🖊️", tagline:"Turn sketches and text into app wireframes instantly",     description:"", bestFor:["Product Managers","Founders","Non-Designers","UX Teams"],pricing:{free:"Free: 3 projects",                   paid:"From $12/mo Pro"},                  freeLimit:"3 projects and 10 screens on free plan",              link:"https://uizard.io",                   tags:["design","wireframe","prototype","no-code"],              popularity:67, trending:false, newThis:false, weeklyGrowth:"+2.4%", useCases:[] },
  { id:78, name:"Locofy.ai",      company:"Locofy",           category:"Design",       logo:"🚀", tagline:"Turn Figma designs into production-ready frontend code",   description:"", bestFor:["Frontend Developers","Design Teams","Agencies","Startups"],pricing:{free:"Free plan available",              paid:"From $12/mo Basic"},                freeLimit:"Limited exports on free plan",                        link:"https://locofy.ai",                   tags:["design","code","figma","frontend"],                      popularity:64, trending:true,  newThis:false, weeklyGrowth:"+5.9%", useCases:[] },
  { id:80, name:"Visily",         company:"Visily",           category:"Design",       logo:"👁️", tagline:"AI wireframing tool for teams and non-designers",          description:"", bestFor:["Product Teams","Startups","Non-Designers","Consultants"], pricing:{free:"Free plan available",             paid:"From $14/editor/mo Pro"},           freeLimit:"Generous free plan for individuals",                  link:"https://visily.ai",                   tags:["design","wireframe","prototype","teams"],                popularity:62, trending:false, newThis:false, weeklyGrowth:"+2.8%", useCases:[] },
  { id:81, name:"Framer AI Sites",company:"Framer",           category:"Design",       logo:"🌐", tagline:"Generate entire websites from a text description",         description:"", bestFor:["Entrepreneurs","Freelancers","Small Businesses","Marketers"],pricing:{free:"Free on framer.site",             paid:"From $10/mo Mini"},                 freeLimit:"Free hosting on Framer subdomain",                    link:"https://framer.com",                  tags:["design","website","no-code","ai-generated"],             popularity:71, trending:true,  newThis:false, weeklyGrowth:"+6.3%", useCases:[] },

  // ── AGENTS & AUTOMATION AI (new category) ────────────────────────────────────
  { id:82, name:"Lindy AI",       company:"Lindy",            category:"Agents",       logo:"🤝", tagline:"Build AI agents that run your business workflows",        description:"", bestFor:["Business Owners","Operations Teams","Sales Teams","Customer Support"], pricing:{free:"Free: 400 tasks/mo",           paid:"From $49.99/mo Pro"},               freeLimit:"400 monthly tasks on free plan",                      link:"https://lindy.ai",                    tags:["agents","automation","no-code","business"],              popularity:73, trending:true,  newThis:true,  weeklyGrowth:"+12.3%",useCases:[] },
  { id:83, name:"Relevance AI",   company:"Relevance AI",     category:"Agents",       logo:"🔗", tagline:"Build, test and deploy AI agents for your business",       description:"", bestFor:["Marketing Teams","Operations","Sales","Agencies"],      pricing:{free:"Free plan available",                 paid:"From $19/mo Team"},                 freeLimit:"Limited agents and tasks on free plan",               link:"https://relevanceai.com",             tags:["agents","automation","research","business"],             popularity:65, trending:true,  newThis:true,  weeklyGrowth:"+10.7%",useCases:[] },
  { id:84, name:"Gumloop",        company:"Gumloop",          category:"Agents",       logo:"⚡", tagline:"Visual AI automation builder for everyone",               description:"", bestFor:["Operators","Marketing","Non-Developers","Startups"],    pricing:{free:"Free plan available",                 paid:"From $37/mo Starter"},               freeLimit:"Limited automations on free plan",                    link:"https://gumloop.com",                 tags:["agents","automation","no-code","workflow"],              popularity:67, trending:true,  newThis:true,  weeklyGrowth:"+14.1%",useCases:[] },
  { id:85, name:"Relay.app",      company:"Relay",            category:"Agents",       logo:"🔁", tagline:"Simple AI workflow automation with a low learning curve",  description:"", bestFor:["Small Teams","Operators","Non-Technical Users","Founders"], pricing:{free:"Free plan available",            paid:"From $27/mo Pro"},                  freeLimit:"Generous free plan for individuals",                  link:"https://relay.app",                   tags:["automation","workflow","no-code","simple"],              popularity:62, trending:true,  newThis:true,  weeklyGrowth:"+8.4%", useCases:[] },
  { id:86, name:"CrewAI",         company:"CrewAI",           category:"Agents",       logo:"👥", tagline:"Build multi-agent AI systems that work as a team",        description:"", bestFor:["Developers","Engineering Teams","AI Researchers","Startups"], pricing:{free:"Free open-source",             paid:"Enterprise plans available"},        freeLimit:"Fully free and open-source",                          link:"https://crewai.com",                  tags:["agents","multi-agent","developer","open-source"],        popularity:70, trending:true,  newThis:false, weeklyGrowth:"+9.6%", useCases:[] },

  // ── SALES & MARKETING AI (new category) ──────────────────────────────────────
  { id:87, name:"HubSpot AI",     company:"HubSpot",          category:"Marketing",    logo:"🧡", tagline:"AI across your entire CRM, marketing, and sales stack",   description:"", bestFor:["Sales Teams","Marketing Teams","Customer Success","SMBs"], pricing:{free:"Free CRM with limited AI",         paid:"From $15/mo Starter"},               freeLimit:"Free CRM with basic AI features",                     link:"https://hubspot.com",                 tags:["marketing","crm","sales","email"],                       popularity:82, trending:true,  newThis:false, weeklyGrowth:"+3.8%", useCases:[] },
  { id:88, name:"Apollo.io",      company:"Apollo",           category:"Marketing",    logo:"🚀", tagline:"AI-powered sales intelligence and outreach platform",      description:"", bestFor:["Sales Teams","SDRs","Revenue Teams","B2B Marketers"],   pricing:{free:"Free plan available",                 paid:"From $49/mo Basic"},                freeLimit:"Limited credits on free plan",                        link:"https://apollo.io",                   tags:["sales","marketing","outreach","leads"],                  popularity:76, trending:true,  newThis:false, weeklyGrowth:"+5.1%", useCases:[] },
  { id:89, name:"Surfer SEO",     company:"Surfer",           category:"Marketing",    logo:"🏄", tagline:"AI content optimisation that actually ranks on Google",    description:"", bestFor:["SEO Teams","Content Marketers","Bloggers","Agencies"],  pricing:{free:"Free Chrome extension",               paid:"From $99/mo Essential"},            freeLimit:"Free Chrome extension for basic insights",            link:"https://surferseo.com",               tags:["seo","content","marketing","writing"],                   popularity:74, trending:false, newThis:false, weeklyGrowth:"+2.7%", useCases:[] },
  { id:90, name:"AdCreative.ai",  company:"AdCreative",       category:"Marketing",    logo:"📢", tagline:"Generate high-converting ad creatives with AI",           description:"", bestFor:["Digital Marketers","Ecommerce Brands","Agencies","SMBs"], pricing:{free:"Free 7-day trial",                  paid:"From $21/mo Starter"},               freeLimit:"7-day free trial",                                    link:"https://adcreative.ai",               tags:["marketing","advertising","creative","social"],           popularity:68, trending:true,  newThis:false, weeklyGrowth:"+4.2%", useCases:[] },
  { id:91, name:"Jasper Campaigns",company:"Jasper AI",       category:"Marketing",    logo:"✍️", tagline:"End-to-end AI marketing campaigns from a single brief",   description:"", bestFor:["Marketing Directors","Brand Managers","Content Teams","CMOs"], pricing:{free:"7-day free trial",              paid:"From $49/mo Creator"},               freeLimit:"7-day trial only",                                    link:"https://jasper.ai/campaigns",         tags:["marketing","content","brand","campaigns"],               popularity:70, trending:false, newThis:false, weeklyGrowth:"+1.8%", useCases:[] },

  // ── CUSTOMER SERVICE AI (new category) ───────────────────────────────────────
  { id:92, name:"Intercom AI",    company:"Intercom",         category:"Customer Service", logo:"💬", tagline:"AI-first customer service with a human fallback",     description:"", bestFor:["SaaS Companies","Ecommerce","Support Teams","Enterprises"], pricing:{free:"14-day free trial",             paid:"From $39/mo Essential"},             freeLimit:"14-day free trial",                                   link:"https://intercom.com",                tags:["customer-service","support","chatbot","ai-agent"],       popularity:80, trending:true,  newThis:false, weeklyGrowth:"+4.6%", useCases:[] },
  { id:93, name:"Zendesk AI",     company:"Zendesk",          category:"Customer Service", logo:"🎫", tagline:"AI that makes every support agent faster and smarter",  description:"", bestFor:["Support Teams","Enterprise","Ecommerce","Telecoms"],    pricing:{free:"Free trial available",                paid:"From $55/agent/mo Suite Team"},     freeLimit:"14-day free trial",                                   link:"https://zendesk.com",                 tags:["customer-service","support","enterprise","ticketing"],   popularity:78, trending:false, newThis:false, weeklyGrowth:"+2.1%", useCases:[] },
  { id:94, name:"Freshdesk AI",   company:"Freshworks",       category:"Customer Service", logo:"🌊", tagline:"AI-powered helpdesk for growing businesses",            description:"", bestFor:["SMBs","Growing Teams","E-commerce","Tech Startups"],    pricing:{free:"Free plan: up to 10 agents",          paid:"From $15/agent/mo Growth"},         freeLimit:"Free for up to 10 agents",                            link:"https://freshdesk.com",               tags:["customer-service","helpdesk","sme","support"],           popularity:70, trending:false, newThis:false, weeklyGrowth:"+1.6%", useCases:[] },

  // ── EDUCATION AI (new category) ───────────────────────────────────────────────
  { id:95, name:"Khan Academy Khanmigo",company:"Khan Academy",category:"Education",  logo:"📚", tagline:"AI tutor for every student — free, patient, always available", description:"", bestFor:["Students","Teachers","Parents","Self-Learners"],        pricing:{free:"Free for students in the US",        paid:"$4/mo for teachers and adults"},    freeLimit:"Free for K-12 students in the US",                    link:"https://khanmigo.ai",                 tags:["education","tutoring","students","learning"],            popularity:74, trending:true,  newThis:false, weeklyGrowth:"+5.3%", useCases:[] },
  { id:96, name:"Duolingo Max",   company:"Duolingo",         category:"Education",    logo:"🦉", tagline:"AI-powered language learning with real conversation practice", description:"", bestFor:["Language Learners","Travellers","Students","Professionals"],pricing:{free:"Free Duolingo app",                paid:"Duolingo Max $29.99/mo"},           freeLimit:"Core app free; Max features require subscription",   link:"https://duolingo.com",                tags:["education","language","learning","ai-conversation"],     popularity:85, trending:true,  newThis:false, weeklyGrowth:"+3.9%", useCases:[] },
  { id:97, name:"Coursera AI Coach",company:"Coursera",       category:"Education",    logo:"🎓", tagline:"Personalised AI learning coach from the world's top universities", description:"", bestFor:["Professionals","Career Changers","Lifelong Learners","Students"], pricing:{free:"Free audit access to courses",    paid:"From $49/mo Coursera Plus"},        freeLimit:"Audit most courses for free; certificates require payment", link:"https://coursera.org",           tags:["education","courses","career","learning"],               popularity:76, trending:false, newThis:false, weeklyGrowth:"+2.4%", useCases:[] },
  { id:98, name:"Photomath",      company:"Photomath",        category:"Education",    logo:"📐", tagline:"Point your camera at any maths problem — get a step-by-step solution", description:"", bestFor:["Students","Parents","Teachers","Anyone Studying Maths"], pricing:{free:"Free with basic explanations",       paid:"$9.99/mo Plus for animated steps"},freeLimit:"Basic solving free; detailed explanations require Plus", link:"https://photomath.com",           tags:["education","maths","students","camera"],                 popularity:79, trending:false, newThis:false, weeklyGrowth:"+1.9%", useCases:[] },

  // ── HEALTH & WELLNESS AI (new category) ──────────────────────────────────────
  { id:99, name:"Whoop AI",       company:"Whoop",            category:"Health",       logo:"💪", tagline:"AI health coach based on your real body data",            description:"", bestFor:["Athletes","Fitness Enthusiasts","High Performers","Health-Conscious"],pricing:{free:"No free plan",                paid:"From $30/mo membership"},           freeLimit:"No free plan — requires Whoop hardware",              link:"https://whoop.com",                   tags:["health","fitness","wearable","coaching"],                popularity:71, trending:true,  newThis:false, weeklyGrowth:"+3.4%", useCases:[] },
  { id:100,name:"Ada Health",     company:"Ada Health",       category:"Health",       logo:"🏥", tagline:"AI symptom checker trusted by millions worldwide",         description:"", bestFor:["General Public","Patients","Carers","Healthcare Providers"], pricing:{free:"Free consumer app",              paid:"Enterprise plans for health systems"}, freeLimit:"Free for individuals",                                link:"https://ada.com",                     tags:["health","symptoms","medical","consumer"],                popularity:68, trending:false, newThis:false, weeklyGrowth:"+2.2%", useCases:[] },

  // ── FINANCE AI (new category) ─────────────────────────────────────────────────
  { id:101,name:"Cleo",           company:"Cleo",             category:"Finance",      logo:"💸", tagline:"The AI money app that actually talks to you",              description:"", bestFor:["Young Professionals","Students","Anyone Wanting to Budget","Millennials"],pricing:{free:"Free basic plan",           paid:"$5.99/mo Cleo Plus"},               freeLimit:"Core budgeting and chat free",                        link:"https://web.meetcleo.com",            tags:["finance","budgeting","personal","chat"],                 popularity:72, trending:true,  newThis:false, weeklyGrowth:"+4.8%", useCases:[] },
  { id:102,name:"Domo AI",        company:"Domo",             category:"Finance",      logo:"📊", tagline:"Business intelligence with AI built in",                  description:"", bestFor:["Finance Teams","Executives","Operations","Business Analysts"],pricing:{free:"Free trial available",          paid:"Custom enterprise pricing"},        freeLimit:"Free trial — pricing on request",                    link:"https://domo.com",                    tags:["finance","data","analytics","business-intelligence"],    popularity:65, trending:false, newThis:false, weeklyGrowth:"+1.7%", useCases:[] },

  // ── LEGAL AI (new category) ───────────────────────────────────────────────────
  { id:103,name:"Harvey AI",      company:"Harvey",           category:"Legal",        logo:"⚖️", tagline:"AI for legal research, drafting and contract analysis",    description:"", bestFor:["Law Firms","In-House Legal","Legal Operations","Associates"], pricing:{free:"No free plan",               paid:"Enterprise pricing only"},          freeLimit:"No free plan — enterprise only",                     link:"https://harvey.ai",                   tags:["legal","contracts","research","enterprise"],             popularity:72, trending:true,  newThis:true,  weeklyGrowth:"+11.4%",useCases:[] },
];

const CATEGORIES = ["All","Writing","Image","Video","Code","Audio","Research","Productivity","Design","Agents","Marketing","Customer Service","Education","Health","Finance","Legal"];
const TOP20_IDS = [1,4,2,76,10,21,6,3,96,19,26,51,7,8,87,5,59,92,17,42]; // fallback static list

const WEEKLY_NEWS = [
  { date:"24 Mar", title:"OpenAI launches GPT-5 preview to Plus subscribers", tag:"Launch", color:"#00e5ff" },
  { date:"22 Mar", title:"Anthropic raises $2.5B in new funding round", tag:"Funding", color:"#00ff88" },
  { date:"21 Mar", title:"Bolt.new surpasses 1M active developers", tag:"Milestone", color:"#ffd700" },
  { date:"20 Mar", title:"ElevenLabs adds real-time voice cloning in 32 languages", tag:"Feature", color:"#7c3aed" },
  { date:"19 Mar", title:"EU AI Act enforcement begins for high-risk AI systems", tag:"Regulation", color:"#ffa500" },
  { date:"18 Mar", title:"Lovable introduces team collaboration features", tag:"Feature", color:"#7c3aed" },
  { date:"17 Mar", title:"Sora now available to all ChatGPT Plus users globally", tag:"Launch", color:"#00e5ff" },
];

const CATALOG_STR = AI_PRODUCTS.map(p=>`${p.name}(${p.category}): ${p.tagline}. Free:${p.pricing.free}. Paid:${p.pricing.paid}. Best for:${p.bestFor.join(",")}`).join(" | ");

const IDEA_PROMPT = `You are Aiveree, a warm and encouraging innovation guide. You help everyday people turn ideas into real plans using AI tools.

CONVERSATION STYLE:
- Write like a friendly, knowledgeable friend — not a consultant report
- Keep each response SHORT (3-5 sentences max) until the user has shared their full idea
- Ask ONE focused question per message to learn more
- Use natural language, not bullet lists or headers in early messages
- Only switch to structured output (roadmap etc) when you have enough to work with

After you understand the idea well (usually 3-4 exchanges), give a warm structured summary:
💡 Here's your idea refined: [1-2 sentences]
🎯 Feasibility: [X/10 with honest 1-line reason]
🛠️ Tools I'd recommend: [2-4 tools, each on its own line with a simple reason]
🗺️ Your first 3 steps: [numbered, specific, actionable]

Catalog: ${CATALOG_STR}
Always be warm, honest, and encouraging. Celebrate ambition. Be realistic about complexity. Never dump everything at once.`;

const ADVISOR_PROMPT = `You are Aiveree, a friendly AI tool guide. You help everyday people find the right AI tools — explained in plain English, no jargon.

CONVERSATION STYLE:
- Write like a helpful friend, not a Wikipedia article
- Keep responses SHORT and conversational — 2-4 sentences, then ask a follow-up
- Ask ONE question per message to understand their situation better
- Never dump a list of 10 tools — recommend 1-3 with genuine reasons
- Use "you" language, be specific, be warm

When you have enough context, recommend tools with:
- Tool name in bold
- One honest sentence on why it fits them specifically
- Whether there's a free plan
- One specific thing they can do with it today

Catalog: ${CATALOG_STR}
Always be warm, direct, and specific. No walls of text. Make it feel like a real conversation.`;

const cmpPrompt = (a,b) => `You are an AI tool comparison expert on Aiveree. Compare honestly.
A: ${a.name} — ${a.description} Free:${a.pricing.free} Paid:${a.pricing.paid}
B: ${b.name} — ${b.description} Free:${b.pricing.free} Paid:${b.pricing.paid}
Format exactly:
**⚡ Quick Verdict:** [one honest sentence]
**${a.name} wins when:** [2-3 bullet points]
**${b.name} wins when:** [2-3 bullet points]
**💰 Value for Money:** [honest pricing comparison]
**🎯 Aiveree's Pick:** [definitive recommendation]
Be direct. No fence-sitting.`;

const REPORT_PROMPT = `You are the lead analyst at Aiveree, an AI tool intelligence platform. Write a compelling monthly trends report for March 2026.
Structure:
**📊 Executive Summary** [3-4 sentences on the defining narrative]
**🚀 The Big Story** [the single most important AI development this month and why it matters]
**📈 Category Breakdown** [for Writing AI, Image AI, Video AI, Code AI, Audio AI — one paragraph each]
**💡 Under the Radar** [2-3 tools or trends not getting enough attention]
**🔮 What's Coming** [3 specific predictions for the next 30 days]
**💼 For Businesses** [practical advice on what to adopt now vs wait on]
Write with authority and genuine insight. No generic filler.`;

const SCAN_PROMPT = `You are an AI tool researcher for Aiveree. Surface 5 NEW AI tools not in our catalog.
Catalog already has: ${AI_PRODUCTS.map(p=>p.name).join(", ")}
Find tools that are active in 2025/2026, genuinely useful, across different categories.
For each output EXACTLY:
---
NAME: [name]
COMPANY: [company]
CATEGORY: [Writing/Image/Video/Code/Audio/Research/Productivity]
LOGO: [single emoji]
TAGLINE: [one short sentence]
DESCRIPTION: [2 sentences max]
FREE: [free plan info or No free plan]
PAID: [pricing]
LINK: [URL]
BESTFOR: [role1,role2,role3]
---`;

const ONBOARDING_PROMPT = `You're Aiveree, meeting someone for the first time. Think of this as a real conversation — you're genuinely curious about this person and what's going on in their life.

Write like you're texting a friend, not presenting a keynote. Short. Warm. Real. No bullet points, no headers, no corporate language. Just talk.

Here's how the conversation should flow — but don't force it, let it breathe:

First, you've already asked what they're working toward. When they answer, respond with genuine interest — pick up on something specific they said, reflect it back in your own words, then ask what's making it difficult or what's getting in the way. Don't just say "that's great!" — actually engage with what they told you.

When they share what's hard, acknowledge it honestly. Don't be falsely positive. If something sounds tough, say it sounds tough. Then ask something that helps you understand their situation better — maybe their background, how long they've been at it, or what they've tried so far.

After 3 or 4 exchanges where you genuinely understand their situation, wrap it up. Something like "OK I've got a proper picture of where you're at now. Let me show you what I can actually help with." Make it feel like you're rolling up your sleeves, not closing a ticket.

When you're ready to wrap up, add this marker on its own line at the very end of your message: [ONBOARDING_COMPLETE]

Key things:
- Every response should be 2 to 3 sentences. No essays.
- Use their name once they give it.
- Match their energy. If they're casual, be casual. If they're detailed, go deeper.
- Never mention "AI tools" or "the platform" or what Aiveree does yet. This conversation is about them.
- Sound like a person who genuinely gives a damn, because you do.`;

async function claude(msgs, sys, useSearch=false) {
  const body={model:"claude-sonnet-4-20250514",max_tokens:1500,system:sys,messages:msgs};
  if(useSearch) body.tools=[{type:"web_search_20250305",name:"web_search"}];
  const r=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json();
  return d.text||d.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"Something went wrong — please try again.";
}

function MD({text}) {
  if(!text) return null;
  // Split into paragraphs on double newlines, render each separately
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return <div>{paragraphs.map((para,pi)=>(
    <p key={pi} style={{margin:0,marginBottom:pi<paragraphs.length-1?12:0,lineHeight:1.75}}>
      {para.split(/(\*\*[^*\n]+\*\*)/g).map((p,i)=>
        p.startsWith("**")&&p.endsWith("**")
          ?<strong key={i} style={{color:"#7c3aed"}}>{p.slice(2,-2)}</strong>
          :p.split(/\n/).map((line,li,arr)=><span key={`${i}-${li}`}>{line}{li<arr.length-1&&<br/>}</span>)
      )}
    </p>
  ))}</div>;
}

function useIsMobile() {
  const [m,setM]=useState(window.innerWidth<768);
  useEffect(()=>{const h=()=>setM(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return m;
}

function Chat({sys,init,onSave,compact,prefill,onPrefillUsed,onCredit}) {
  const [msgs,setMsgs]=useState([{role:"assistant",content:init}]);
  const [inp,setInp]=useState("");
  const [busy,setBusy]=useState(false);
  const [saved,setSaved]=useState(false);
  const [listening,setListening]=useState(false);
  const ref=useRef(null);
  const inputRef=useRef(null);

  // Handle prefill from inspiration buttons
  useEffect(()=>{
    if(prefill){
      setInp(prefill);
      inputRef.current?.focus();
      onPrefillUsed?.();
    }
  },[prefill]);

  useEffect(()=>ref.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  const send=async(overrideText)=>{
    const text=(overrideText||inp).trim();
    if(!text||busy)return;
    // Check credit before sending
    if(onCredit) {
      const allowed = await onCredit();
      if(!allowed) return;
    }
    const um={role:"user",content:text};
    const next=[...msgs,um];
    setMsgs(next);setInp("");setBusy(true);
    try {
      const res=await fetch("/.netlify/functions/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),system:sys})
      });
      const data=await res.json();
      const reply=data.content?.[0]?.text||data.response||"Sorry, I couldn't get a response right now. Please try again.";
      setMsgs([...next,{role:"assistant",content:reply}]);
    } catch(e) {
      setMsgs([...next,{role:"assistant",content:"Sorry, something went wrong. Please check your connection and try again."}]);
    }
    setBusy(false);
  };

  // Voice input using Web Speech API
  const startVoice=()=>{
    if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){
      alert("Voice input isn't supported in your browser. Try Chrome.");return;
    }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const recognition=new SR();
    recognition.lang="en-GB";
    recognition.interimResults=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>setListening(true);
    recognition.onend=()=>setListening(false);
    recognition.onresult=(e)=>{
      const transcript=e.results[0][0].transcript;
      setInp(transcript);
      // Auto-send after brief pause
      setTimeout(()=>send(transcript),300);
    };
    recognition.onerror=()=>setListening(false);
    recognition.start();
  };

  const doSave=()=>{if(onSave){onSave(msgs);setSaved(true);setTimeout(()=>setSaved(false),2500);}};

  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:compact?300:420}}>
      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingBottom:12,maxHeight:compact?260:400}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
            {m.role==="assistant"&&(
              <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0}}>Ai</div>
            )}
            <div style={{maxWidth:"80%",background:m.role==="user"?"rgba(124,58,237,0.08)":"#ffffff",border:m.role==="user"?"1px solid rgba(167,139,250,0.2)":"1px solid rgba(0,0,0,0.08)",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"11px 15px",fontSize:15,lineHeight:1.7,color:"#1a1523",boxShadow:m.role==="assistant"?"0 1px 6px rgba(0,0,0,0.05)":"none"}}>
              {m.role==="assistant"?<MD text={m.content}/>:m.content}
            </div>
          </div>
        ))}
        {busy&&(
          <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",flexShrink:0}}>Ai</div>
            <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"18px 18px 18px 4px",padding:"14px 16px",display:"flex",gap:5}}>
              {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#c084fc",animation:`pulse 1.2s ease ${i*.25}s infinite`}}/>)}
            </div>
          </div>
        )}
        <div ref={ref}/>
      </div>

      {/* Input bar */}
      <div style={{paddingTop:12,borderTop:"1px solid rgba(0,0,0,0.07)"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input
            ref={inputRef}
            value={inp}
            onChange={e=>setInp(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
            placeholder="Type your message…"
            style={{flex:1,background:"#f9f7f4",border:"1px solid rgba(0,0,0,0.1)",borderRadius:12,padding:"11px 14px",color:"#1a1523",fontSize:15,outline:"none",transition:"border .15s"}}
            onFocus={e=>e.target.style.borderColor="rgba(124,58,237,0.4)"}
            onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.1)"}
          />
          {/* Voice input button */}
          <button onClick={startVoice} title="Speak to Aiveree" style={{background:listening?"rgba(239,68,68,0.1)":"rgba(124,58,237,0.08)",border:`1px solid ${listening?"rgba(239,68,68,0.3)":"rgba(124,58,237,0.2)"}`,borderRadius:12,padding:"11px 13px",cursor:"pointer",fontSize:16,transition:"all .15s",animation:listening?"pulse 1s infinite":"none"}}>
            {listening?"🔴":"🎙️"}
          </button>
          {onSave&&<button onClick={doSave} style={{background:saved?"rgba(16,185,129,0.08)":"rgba(0,0,0,0.04)",border:`1px solid ${saved?"rgba(16,185,129,0.3)":"rgba(0,0,0,0.1)"}`,borderRadius:12,padding:"11px 13px",color:saved?"#047857":"#6b6478",cursor:"pointer",fontSize:15,fontWeight:600}}>
            {saved?"✓":"💾"}
          </button>}
          <button onClick={()=>send()} disabled={busy||!inp.trim()} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:12,padding:"11px 20px",color:"#ffffff",fontWeight:700,cursor:busy||!inp.trim()?"not-allowed":"pointer",fontSize:15,opacity:busy||!inp.trim()?0.6:1,transition:"opacity .15s"}}>
            Send
          </button>
        </div>
        <div style={{fontSize:15,color:"#8a8396",marginTop:6,textAlign:"center"}}>Press Enter to send · 🎙️ to speak</div>
      </div>
    </div>
  );
}

// ─── ONBOARDING CHAT ──────────────────────────────────────────────────────────
function OnboardingChat({onComplete, session, onCredit}) {
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Hey! I'm Aiveree. I'd love to understand what's going on in your world before I start throwing suggestions at you. So — what are you working on right now, or what's the thing taking up most of your headspace?"}]);
  const [inp,setInp]=useState("");
  const [busy,setBusy]=useState(false);
  const [complete,setComplete]=useState(false);
  const [saving,setSaving]=useState(false);
  const ref=useRef(null);
  const inputRef=useRef(null);
  const mobile=useIsMobile();

  useEffect(()=>ref.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  const send=async(overrideText)=>{
    const text=(overrideText||inp).trim();
    if(!text||busy)return;
    if(onCredit) { const allowed=await onCredit(); if(!allowed) return; }
    const um={role:"user",content:text};
    const next=[...msgs,um];
    setMsgs(next);setInp("");setBusy(true);
    try {
      const res=await fetch("/.netlify/functions/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:next.map(m=>({role:m.role,content:m.content})),system:ONBOARDING_PROMPT})
      });
      const data=await res.json();
      let reply=data.content?.[0]?.text||data.response||"Sorry, something went wrong. Let's try again.";
      
      // Check if onboarding is complete
      if(reply.includes("[ONBOARDING_COMPLETE]")) {
        reply=reply.replace("[ONBOARDING_COMPLETE]","").trim();
        setComplete(true);
        const finalMsgs=[...next,{role:"assistant",content:reply}];
        setMsgs(finalMsgs);
        setBusy(false);
        
        // Extract profile data from conversation
        const userMessages = finalMsgs.filter(m=>m.role==="user").map(m=>m.content).join(" ");
        const convo = finalMsgs.map(m=>({role:m.role,content:m.content}));
        
        // Try to extract name and goal from the conversation
        const conversationData = { goal: "", name: "", summary: "" };
        // Simple extraction: first user message is likely their goal
        const firstUserMsg = finalMsgs.find(m=>m.role==="user");
        if(firstUserMsg) conversationData.goal = firstUserMsg.content;
        // Look for name patterns in user messages
        const nameMatch = userMessages.match(/(?:I'm |my name is |I am |call me )(\w+)/i);
        if(nameMatch) conversationData.name = nameMatch[1];
        // Use the last assistant message as a summary prompt
        conversationData.summary = `Working toward: ${conversationData.goal.slice(0,120)}`;
        
        // Save to Supabase if signed in
        setSaving(true);
        if(session?.token) {
          try {
            const res = await apiCall("/.netlify/functions/intelligence",{action:"summarise",conversation:convo},session.token);
            if(res.profile) {
              conversationData.name = res.profile.name || conversationData.name;
              conversationData.goal = res.profile.goal || conversationData.goal;
              conversationData.summary = res.profile.profile_summary || conversationData.summary;
            }
          } catch {}
        }
        setSaving(false);
        setTimeout(()=>onComplete?.(conversationData),2000);
        return;
      }
      setMsgs([...next,{role:"assistant",content:reply}]);
    } catch {
      setMsgs([...next,{role:"assistant",content:"Sorry, something went wrong. Please try again."}]);
    }
    setBusy(false);
  };

  return (
    <div style={{maxWidth:640,margin:"0 auto",padding:mobile?"20px 16px":"60px 20px"}}>
      {/* Aiveree mark */}
      <div style={{textAlign:"center",marginBottom:mobile?28:44}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <span style={{color:"#fff",fontSize:22,fontWeight:900,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Ai</span>
        </div>
        <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,letterSpacing:-1.5,marginBottom:8,color:"#1a1523"}}>
          Welcome to <span style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Aiveree</span>
        </h1>
        <p style={{color:"#6b6478",fontSize:15,lineHeight:1.7,maxWidth:400,margin:"0 auto"}}>
          Just a quick chat so I know where you're coming from.
        </p>
      </div>

      {/* Chat messages */}
      <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:20,padding:mobile?16:24,boxShadow:"0 4px 32px rgba(0,0,0,0.06)",marginBottom:16}}>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16,maxHeight:mobile?320:420,overflowY:"auto"}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
              {m.role==="assistant"&&(
                <div style={{width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0}}>Ai</div>
              )}
              <div style={{maxWidth:"80%",background:m.role==="user"?"rgba(124,58,237,0.06)":"#ffffff",border:m.role==="user"?"1px solid rgba(167,139,250,0.2)":"1px solid rgba(0,0,0,0.08)",borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"12px 16px",fontSize:15,lineHeight:1.7,color:"#1a1523",boxShadow:m.role==="assistant"?"0 1px 6px rgba(0,0,0,0.04)":"none"}}>
                <MD text={m.content}/>
              </div>
            </div>
          ))}
          {busy&&(
            <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
              <div style={{width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#fff",flexShrink:0}}>Ai</div>
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"18px 18px 18px 4px",padding:"14px 16px",display:"flex",gap:5}}>
                {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#c084fc",animation:`pulse 1.2s ease ${i*.25}s infinite`}}/>)}
              </div>
            </div>
          )}
          {complete&&(
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{fontSize:24,marginBottom:8}}>{saving?"⏳":"✨"}</div>
              <div style={{color:"#7c3aed",fontWeight:700,fontSize:15}}>{saving?"Building your profile...":"All set! Taking you home..."}</div>
            </div>
          )}
          <div ref={ref}/>
        </div>

        {/* Input */}
        {!complete&&(
          <div style={{borderTop:"1px solid rgba(0,0,0,0.06)",paddingTop:12}}>
            <div style={{display:"flex",gap:8}}>
              <input
                ref={inputRef}
                value={inp}
                onChange={e=>setInp(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
                placeholder="Type your answer…"
                style={{flex:1,background:"#f9f7f4",border:"1px solid rgba(0,0,0,0.1)",borderRadius:12,padding:"12px 14px",color:"#1a1523",fontSize:15,outline:"none",transition:"border .15s"}}
                onFocus={e=>e.target.style.borderColor="rgba(124,58,237,0.4)"}
                onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.1)"}
                autoFocus
              />
              <button onClick={send} disabled={busy||!inp.trim()} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:12,padding:"12px 22px",color:"#ffffff",fontWeight:700,cursor:busy||!inp.trim()?"not-allowed":"pointer",fontSize:15,opacity:busy||!inp.trim()?0.6:1}}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion chips — only show before first user message */}
      {!complete&&msgs.length<=1&&(
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,color:"#8a8396",textTransform:"uppercase",letterSpacing:1,marginBottom:10,textAlign:"center"}}>Or pick one to get started</div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:8}}>
            {[
              {emoji:"💼",text:"I want to find a better job that pays what I'm worth"},
              {emoji:"🏪",text:"I'm starting a small business and don't know where to begin"},
              {emoji:"📚",text:"I'm studying and need help staying on top of everything"},
              {emoji:"💰",text:"I want to get my finances sorted and stop wasting money"},
              {emoji:"🏠",text:"I'm dealing with a housing issue and need to know my rights"},
              {emoji:"🚀",text:"I have a side project idea and want to make it real"},
            ].map(s=>(
              <button key={s.text} onClick={()=>send(s.text)} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:12,padding:"12px 14px",fontSize:14,color:"#3d3649",cursor:"pointer",textAlign:"left",lineHeight:1.6,display:"flex",gap:10,alignItems:"flex-start",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(124,58,237,0.3)";e.currentTarget.style.background="rgba(124,58,237,0.03)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,0.07)";e.currentTarget.style.background="#ffffff";}}>
                <span style={{fontSize:18,flexShrink:0}}>{s.emoji}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skip option */}
      {!complete&&msgs.length<=2&&(
        <div style={{textAlign:"center"}}>
          <button onClick={()=>onComplete?.()} style={{background:"none",border:"none",color:"#8a8396",fontSize:14,cursor:"pointer",padding:"8px 16px",textDecoration:"underline",textUnderlineOffset:3}}>
            Skip for now and explore
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CREWS (AGENTS) ───────────────────────────────────────────────────────────
const CREWS = [
  {id:"planner",emoji:"📋",name:"Planner",desc:"Breaks your goal into milestones, timelines, and step by step action plans",prompt:"Break down the user's goal into a detailed plan. Create 5-6 specific milestones with timelines. For each milestone, list 2-3 concrete tasks. Be specific to their situation, not generic. Use web search to find real resources, templates, or tools they'll need at each stage. Format clearly with milestone numbers and tasks."},
  {id:"researcher",emoji:"🔍",name:"Researcher",desc:"Finds competitors, market data, industry insights, and everything you need to know",prompt:"Research the user's goal area thoroughly using web search. Find: real competitors or similar businesses/projects, market size or demand data, key trends in 2026, potential challenges specific to their field, and 3-5 useful resources (articles, communities, tools). Be specific with real data, real names, real numbers."},
  {id:"builder",emoji:"📄",name:"Builder",desc:"Drafts business plans, proposals, CVs, cover letters, and any document you need",prompt:"Based on the user's goal, create a comprehensive document. If they're starting a business: draft a lean business plan (problem, solution, target market, revenue model, first 90 days). If job seeking: draft a tailored CV summary and cover letter template. If studying: create a study plan. Make it specific to their situation. Use web search to reference real market data where relevant."},
  {id:"finder",emoji:"💼",name:"Finder",desc:"Finds jobs, grants, funding, partnerships, and real opportunities right now",prompt:"Search the web and find REAL, CURRENT opportunities for this user. Find: relevant job listings with links, applicable grants or funding (UK focused), potential partnerships or collaborations, free resources and communities they should join. Be specific — real names, real URLs, real deadlines. At least 5 concrete opportunities."},
  {id:"strategist",emoji:"📊",name:"Strategist",desc:"Competitive analysis, pricing, positioning, and how to stand out",prompt:"Provide strategic analysis for the user's goal using web search. Cover: how others in their space are positioning themselves, pricing strategies if relevant, what gaps exist that they could fill, 3 specific things that would differentiate them, and one honest risk they should be aware of. Use real examples from real companies or people."},
  {id:"coach",emoji:"🎓",name:"Coach",desc:"Identifies skill gaps, finds courses, and builds a personalised learning path",prompt:"Analyse the user's goal against their current experience level. Identify 3-5 specific skill gaps. For each gap, find a REAL free or affordable course (Coursera, FutureLearn, YouTube, Udemy, etc) with actual URLs. Build a weekly learning schedule. Be specific about what to learn in what order and how long each will take. Use web search for current courses."},
];

function CrewCard({crew, onClick, working, mobile}) {
  const [hover,setHover]=useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{background:"#ffffff",border:`1.5px solid ${hover?"rgba(124,58,237,0.3)":"rgba(0,0,0,0.07)"}`,borderRadius:16,padding:mobile?"16px":"20px",cursor:"pointer",transition:"all .2s",transform:hover&&!mobile?"translateY(-2px)":"none",boxShadow:hover?"0 8px 24px rgba(124,58,237,0.1)":"0 2px 8px rgba(0,0,0,0.04)"}}>
      <div style={{fontSize:28,marginBottom:10}}>{crew.emoji}</div>
      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:16,color:"#1a1523",marginBottom:6}}>{crew.name}</div>
      <div style={{fontSize:13,color:"#6b6478",lineHeight:1.65}}>{crew.desc}</div>
      {working&&(
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:6,height:6,borderRadius:3,background:"#7c3aed",animation:"pulse 1.2s ease infinite"}}/>
          <span style={{fontSize:12,color:"#7c3aed",fontWeight:600}}>Working...</span>
        </div>
      )}
    </div>
  );
}

function CrewOutput({crew, intel, onClose, mobile}) {
  const [output,setOutput]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      try {
        const profileContext = [
          intel?.name ? `Name: ${intel.name}` : "",
          intel?.goal ? `Goal: ${intel.goal}` : "",
          intel?.context ? `Background: ${intel.context}` : "",
          intel?.blockers ? `Challenges: ${intel.blockers}` : "",
          intel?.experience_level ? `Experience: ${intel.experience_level}` : "",
        ].filter(Boolean).join("\n");

        const res = await fetch("/.netlify/functions/claude", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            messages:[{role:"user",content:`User profile:\n${profileContext}\n\n${crew.prompt}`}],
            system:"You are an autonomous agent working on behalf of this user. Use web search to find real, current, specific information. Be thorough. Deliver genuine value — real data, real links, real resources. Format with clear sections using **bold headers**. Keep paragraphs short — 2 to 3 sentences each. No walls of text.",
            useSearch: true
          })
        });
        const data = await res.json();
        let text = "";
        if(data.content) {
          text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n\n");
        }
        setOutput(text || "Something went wrong. Please try again.");
      } catch {
        setOutput("Something went wrong. Please try again.");
      }
      setLoading(false);
    })();
  },[]);

  return (
    <div style={{background:"#ffffff",border:"1px solid rgba(124,58,237,0.12)",borderRadius:20,padding:mobile?"16px":"28px",marginBottom:20,boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>{crew.emoji}</span>
          <div>
            <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:17,color:"#1a1523"}}>{crew.name}</div>
            <div style={{fontSize:12,color:"#7c3aed",fontWeight:600}}>Working on your behalf</div>
          </div>
        </div>
        <button onClick={onClose} style={{background:"rgba(0,0,0,0.04)",border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:16,color:"#6b6478"}}>×</button>
      </div>
      {loading ? (
        <div style={{padding:"32px 0",textAlign:"center"}}>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:16}}>
            {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:4,background:"#a78bfa",animation:`pulse 1.2s ease ${i*.3}s infinite`}}/>)}
          </div>
          <div style={{color:"#6b6478",fontSize:14}}>Your {crew.name.toLowerCase()} is working... searching the web and building results.</div>
        </div>
      ) : (
        <div style={{fontSize:15,color:"#3d3649",lineHeight:1.8}}>
          <MD text={output}/>
        </div>
      )}
    </div>
  );
}

// ─── AGENT DASHBOARD ──────────────────────────────────────────────────────────
function PersonalisedHome({intel,onNav,mobile,session}) {
  const [breakdown,setBreakdown]=useState(null);
  const [breakdownLoading,setBreakdownLoading]=useState(false);
  const [activeCrew,setActiveCrew]=useState(null);
  const [workingCrew,setWorkingCrew]=useState(null);
  const timeOfDay = new Date().getHours();
  const timeGreeting = timeOfDay<12 ? "Good morning" : timeOfDay<17 ? "Good afternoon" : "Good evening";
  const name = intel?.name || "friend";

  // On mount, generate goal breakdown
  useEffect(()=>{
    if(!intel?.goal || breakdown || breakdownLoading) return;
    const cached = sessionStorage.getItem("aiveree_breakdown");
    if(cached) { try { setBreakdown(JSON.parse(cached)); return; } catch {} }
    (async()=>{
      setBreakdownLoading(true);
      try {
        const profileContext = [
          intel.name ? `Name: ${intel.name}` : "",
          intel.goal ? `Goal: ${intel.goal}` : "",
          intel.context ? `Background: ${intel.context}` : "",
          intel.blockers ? `Challenges: ${intel.blockers}` : "",
          intel.experience_level ? `Experience: ${intel.experience_level}` : "",
        ].filter(Boolean).join("\n");

        const res = await fetch("/.netlify/functions/claude", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            messages:[{role:"user",content:`User profile:\n${profileContext}\n\nBreak down this person's goal into a clear roadmap. Return ONLY valid JSON, no markdown, no backticks.\n\n{"summary":"one paragraph genuinely understanding what they're trying to do and why it matters","milestones":[{"title":"milestone name","description":"what this involves — 1 to 2 sentences","timeframe":"e.g. Week 1-2","tasks":["specific task 1","specific task 2","specific task 3"]}],"quick_wins":["something they can do today that takes under 30 minutes","another quick win","a third one"],"key_insight":"one honest, specific observation about their situation that they probably haven't considered"}\n\nCreate 4 to 6 milestones. Make everything specific to their actual goal, not generic. Quick wins should be genuinely actionable right now.`}],
            system:"You are an autonomous planning agent. Analyse the user's goal and create a structured breakdown. Return only valid JSON. Be specific to their situation.",
            useSearch: true
          })
        });
        const data = await res.json();
        let text = "";
        if(data.content) text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("");
        text = text.replace(/```json|```/g,"").trim();
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if(jsonStart!==-1 && jsonEnd!==-1) text = text.slice(jsonStart, jsonEnd+1);
        const parsed = JSON.parse(text);
        setBreakdown(parsed);
        sessionStorage.setItem("aiveree_breakdown", JSON.stringify(parsed));
      } catch(e) {
        console.error("Breakdown error:", e);
        setBreakdown({error:true});
      }
      setBreakdownLoading(false);
    })();
  },[intel?.goal]);

  const launchCrew = (crew) => {
    setWorkingCrew(crew.id);
    setActiveCrew(crew);
  };

  // Loading state
  if(breakdownLoading) {
    return (
      <div style={{textAlign:"center",padding:mobile?"40px 16px":"60px 20px",maxWidth:600,margin:"0 auto"}}>
        <div style={{width:56,height:56,borderRadius:16,background:"linear-gradient(135deg,#5b21b6,#a78bfa)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
          <span style={{color:"#fff",fontSize:22,fontWeight:900,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>Ai</span>
        </div>
        <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?20:26,fontWeight:900,marginBottom:12}}>
          {timeGreeting}, <span style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{name}</span>
        </h2>
        <p style={{color:"#6b6478",fontSize:15,lineHeight:1.7,marginBottom:28}}>I'm breaking down your goal and building your roadmap. Give me a moment.</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:320,margin:"0 auto"}}>
          {["Analysing your goal...","Mapping out milestones...","Finding quick wins...","Building your dashboard..."].map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(124,58,237,0.04)",border:"1px solid rgba(124,58,237,0.1)",borderRadius:10}}>
              <div style={{width:8,height:8,borderRadius:4,background:"#a78bfa",animation:`pulse 1.5s ease ${i*0.4}s infinite`}}/>
              <span style={{fontSize:14,color:"#4b4558"}}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const b = breakdown || {};

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?22:32,fontWeight:900,letterSpacing:-1.5,marginBottom:8}}>
          {timeGreeting}, <span style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{name}</span>
        </h1>
        {b.summary && <p style={{fontSize:mobile?14:16,color:"#4b4558",lineHeight:1.8,maxWidth:700}}>{b.summary}</p>}
      </div>

      {/* Key Insight */}
      {b.key_insight && (
        <div style={{background:"linear-gradient(135deg,rgba(124,58,237,0.06),rgba(192,132,252,0.03))",border:"1px solid rgba(124,58,237,0.12)",borderLeft:"4px solid #7c3aed",borderRadius:14,padding:mobile?"16px":"20px 24px",marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff"}}>Ai</div>
            <span style={{fontWeight:700,fontSize:13,color:"#7c3aed",textTransform:"uppercase",letterSpacing:1}}>Insight</span>
          </div>
          <p style={{fontSize:15,color:"#3d3649",lineHeight:1.75,margin:0}}>{b.key_insight}</p>
        </div>
      )}

      {/* Quick Wins */}
      {b.quick_wins && b.quick_wins.length > 0 && (
        <div style={{marginBottom:28}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:16,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>⚡</span> Do these today
          </div>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr",gap:10}}>
            {b.quick_wins.map((qw,i)=>(
              <div key={i} style={{background:"#ffffff",border:"1px solid rgba(5,150,105,0.12)",borderRadius:12,padding:"14px 16px",display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:22,height:22,borderRadius:11,background:"rgba(5,150,105,0.08)",border:"1.5px solid rgba(5,150,105,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#059669",fontWeight:800,flexShrink:0}}>✓</div>
                <span style={{fontSize:13,color:"#3d3649",lineHeight:1.6}}>{qw}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestone Roadmap */}
      {b.milestones && b.milestones.length > 0 && (
        <div style={{marginBottom:32}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:16,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>🗺️</span> Your roadmap
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {b.milestones.map((ms,i)=>(
              <div key={i} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.06)",borderRadius:16,padding:mobile?"16px":"18px 22px",display:"flex",gap:16,alignItems:"flex-start"}}>
                <div style={{width:36,height:36,borderRadius:12,background:`linear-gradient(135deg,${i===0?"#7c3aed":"rgba(124,58,237,0.08)"},${i===0?"#a78bfa":"rgba(167,139,250,0.06)"})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:i===0?"#ffffff":"#7c3aed",flexShrink:0}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#1a1523"}}>{ms.title}</div>
                    {ms.timeframe&&<span style={{fontSize:11,color:"#8a8396",background:"rgba(0,0,0,0.04)",padding:"2px 8px",borderRadius:20,flexShrink:0}}>{ms.timeframe}</span>}
                  </div>
                  <div style={{fontSize:13,color:"#6b6478",lineHeight:1.65,marginBottom:ms.tasks?.length?8:0}}>{ms.description}</div>
                  {ms.tasks && ms.tasks.length > 0 && (
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {ms.tasks.map((task,ti)=>(
                        <div key={ti} style={{fontSize:13,color:"#4b4558",display:"flex",gap:6,alignItems:"flex-start"}}>
                          <span style={{color:"#a78bfa",flexShrink:0}}>→</span>
                          <span>{task}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Crew Output */}
      {activeCrew && (
        <CrewOutput crew={activeCrew} intel={intel} mobile={mobile} onClose={()=>{setActiveCrew(null);setWorkingCrew(null);}}/>
      )}

      {/* Crews */}
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:16,marginBottom:6,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🚀</span> Your crews — tap any to put them to work
        </div>
        <p style={{fontSize:13,color:"#8a8396",marginBottom:14}}>Each crew specialises in one thing. They'll search the web, analyse your situation, and deliver real results.</p>
        <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(3,1fr)",gap:mobile?10:14}}>
          {CREWS.map(crew=>(
            <CrewCard key={crew.id} crew={crew} mobile={mobile} working={workingCrew===crew.id} onClick={()=>launchCrew(crew)}/>
          ))}
        </div>
      </div>

      {/* Navigation to other features */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
        <button onClick={()=>onNav("advisor")} style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:11,padding:"11px 20px",color:"#7c3aed",fontWeight:600,cursor:"pointer",fontSize:14}}>💬 Talk to Aiveree</button>
        <button onClick={()=>onNav("idealab")} style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:11,padding:"11px 20px",color:"#7c3aed",fontWeight:600,cursor:"pointer",fontSize:14}}>💡 Idea Lab</button>
        <button onClick={()=>onNav("journey")} style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:11,padding:"11px 20px",color:"#7c3aed",fontWeight:600,cursor:"pointer",fontSize:14}}>🗺️ My Journey</button>
        <button onClick={()=>{setBreakdown(null);sessionStorage.removeItem("aiveree_breakdown");}} style={{background:"rgba(0,0,0,0.03)",border:"1px solid rgba(0,0,0,0.08)",borderRadius:11,padding:"11px 20px",color:"#6b6478",fontWeight:600,cursor:"pointer",fontSize:14}}>🔄 Refresh</button>
      </div>
    </div>
  );
}

// ─── JOURNEY TIMELINE ─────────────────────────────────────────────────────────
function JourneyTimeline({intel, session, vault, mobile}) {
  const startDate = intel?.created_at ? new Date(intel.created_at) : new Date();
  const daysSince = Math.max(1, Math.floor((Date.now() - startDate.getTime()) / (1000*60*60*24)));
  const formatDate = d => new Date(d).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"});

  // Build timeline events from available data
  const events = [];

  // Starting point
  events.push({
    date: startDate,
    icon: "🌱",
    title: "Your journey began",
    desc: intel?.goal ? `You came to Aiveree working toward: "${intel.goal}"` : "You joined Aiveree and started exploring.",
    type: "milestone"
  });

  // If we have context from onboarding
  if(intel?.context) {
    events.push({
      date: new Date(startDate.getTime() + 60000),
      icon: "🧠",
      title: "Aiveree got to know you",
      desc: intel.profile_summary || `Background: ${intel.context}`,
      type: "insight"
    });
  }

  // If blockers were identified
  if(intel?.blockers) {
    events.push({
      date: new Date(startDate.getTime() + 120000),
      icon: "🎯",
      title: "Challenges identified",
      desc: `What was getting in the way: ${intel.blockers}`,
      type: "insight"
    });
  }

  // Add vault sessions as milestones
  if(vault && vault.length > 0) {
    vault.slice(0,10).forEach((v,i) => {
      events.push({
        date: new Date(v.id || Date.now()),
        icon: "💡",
        title: `Idea Lab session ${vault.length - i}`,
        desc: v.messages?.[1]?.content?.slice(0,100) + "..." || "Explored a new idea",
        type: "session"
      });
    });
  }

  // Sort by date
  events.sort((a,b) => a.date - b.date);

  return (
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontSize:38,marginBottom:11}}>🗺️</div>
        <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,marginBottom:8}}>Your Journey</h2>
        <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75,maxWidth:480,margin:"0 auto"}}>
          Everything you've done with Aiveree, from the moment you started. This is your story.
        </p>
      </div>

      {/* Stats strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:32}}>
        <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:mobile?"14px":"18px 20px",textAlign:"center"}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:30,fontWeight:900,color:"#7c3aed"}}>{daysSince}</div>
          <div style={{fontSize:13,color:"#6b6478",fontWeight:600,marginTop:4}}>{daysSince===1?"Day":"Days"} with Aiveree</div>
        </div>
        <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:mobile?"14px":"18px 20px",textAlign:"center"}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:30,fontWeight:900,color:"#7c3aed"}}>{vault?.length||0}</div>
          <div style={{fontSize:13,color:"#6b6478",fontWeight:600,marginTop:4}}>Ideas explored</div>
        </div>
        <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:mobile?"14px":"18px 20px",textAlign:"center"}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:30,fontWeight:900,color:"#7c3aed"}}>{events.length}</div>
          <div style={{fontSize:13,color:"#6b6478",fontWeight:600,marginTop:4}}>Milestones</div>
        </div>
      </div>

      {/* Goal reminder */}
      {intel?.goal && (
        <div style={{background:"linear-gradient(135deg,rgba(124,58,237,0.06),rgba(192,132,252,0.04))",border:"1px solid rgba(124,58,237,0.15)",borderRadius:16,padding:mobile?"16px":"22px 28px",marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"#7c3aed",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>What you came here to do</div>
          <div style={{fontSize:mobile?16:18,fontWeight:700,color:"#1a1523",lineHeight:1.6}}>{intel.goal}</div>
        </div>
      )}

      {/* Timeline */}
      <div style={{position:"relative",paddingLeft:32}}>
        {/* Vertical line */}
        <div style={{position:"absolute",left:11,top:8,bottom:8,width:2,background:"linear-gradient(180deg,#a78bfa,rgba(167,139,250,0.15))",borderRadius:1}}/>

        {events.map((evt,i)=>(
          <div key={i} style={{position:"relative",marginBottom:24,paddingLeft:24}}>
            {/* Dot */}
            <div style={{position:"absolute",left:-26,top:4,width:24,height:24,borderRadius:12,background:evt.type==="milestone"?"linear-gradient(135deg,#c084fc,#7c3aed)":evt.type==="insight"?"rgba(124,58,237,0.12)":"#ffffff",border:evt.type==="session"?"2px solid rgba(124,58,237,0.25)":"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>
              {evt.type!=="milestone"&&evt.icon}
            </div>

            <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:14,padding:mobile?"14px 16px":"16px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{evt.icon}</span>
                  <span style={{fontWeight:700,fontSize:15,color:"#1a1523"}}>{evt.title}</span>
                </div>
                <span style={{fontSize:12,color:"#8a8396",flexShrink:0}}>{formatDate(evt.date)}</span>
              </div>
              <div style={{fontSize:14,color:"#4b4558",lineHeight:1.7}}>{evt.desc}</div>
            </div>
          </div>
        ))}

        {/* Future marker */}
        <div style={{position:"relative",marginBottom:0,paddingLeft:24}}>
          <div style={{position:"absolute",left:-26,top:4,width:24,height:24,borderRadius:12,border:"2px dashed rgba(124,58,237,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✨</div>
          <div style={{background:"rgba(124,58,237,0.04)",border:"1px dashed rgba(124,58,237,0.2)",borderRadius:14,padding:mobile?"14px 16px":"16px 20px"}}>
            <div style={{fontWeight:700,fontSize:15,color:"#7c3aed",marginBottom:4}}>What comes next</div>
            <div style={{fontSize:14,color:"#6b6478",lineHeight:1.7}}>Every conversation, every document, every decision builds your story. Keep going.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DATA TRANSPARENCY ────────────────────────────────────────────────────────
function DataTransparency({intel, session, mobile}) {
  const dataPoints = [];

  // Intelligence profile data
  if(intel?.name) dataPoints.push({label:"Your name",value:intel.name,source:"Onboarding conversation",icon:"👤"});
  if(intel?.goal) dataPoints.push({label:"Your goal",value:intel.goal,source:"Onboarding conversation",icon:"🎯"});
  if(intel?.context) dataPoints.push({label:"Your background",value:intel.context,source:"Onboarding conversation",icon:"📋"});
  if(intel?.blockers) dataPoints.push({label:"Your challenges",value:intel.blockers,source:"Onboarding conversation",icon:"🚧"});
  if(intel?.experience_level) dataPoints.push({label:"Experience level",value:intel.experience_level,source:"Onboarding conversation",icon:"📊"});
  if(intel?.profile_summary) dataPoints.push({label:"Profile summary",value:intel.profile_summary,source:"Built by Aiveree from your conversation",icon:"🧠"});

  const connections = [
    {name:"Aiveree Chat",status:"active",desc:"Your conversations with Aiveree. Stored in your intelligence profile.",icon:"💬",canDisconnect:false},
    {name:"Open Banking",status:"not connected",desc:"Bank transactions, spending patterns, balances. Not yet available.",icon:"🏦",canDisconnect:false},
    {name:"NHS",status:"not connected",desc:"Prescriptions, appointments, health records. Not yet available.",icon:"🏥",canDisconnect:false},
    {name:"HMRC",status:"not connected",desc:"Tax records, self assessment, VAT. Not yet available.",icon:"📄",canDisconnect:false},
    {name:"Email",status:"not connected",desc:"Gmail or Outlook. Read only with your permission. Not yet available.",icon:"📧",canDisconnect:false},
    {name:"Calendar",status:"not connected",desc:"Google or Outlook calendar. Not yet available.",icon:"📅",canDisconnect:false},
  ];

  const clearLocalData = () => {
    if(window.confirm("This will reset your local Aiveree profile. You'll see the onboarding conversation again next time. Are you sure?")) {
      localStorage.removeItem("aiveree_local_intel");
      localStorage.removeItem("aiveree_onboarding_skipped");
      window.location.reload();
    }
  };

  return (
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontSize:38,marginBottom:11}}>🔒</div>
        <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,marginBottom:8}}>Your Data</h2>
        <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75,maxWidth:520,margin:"0 auto"}}>
          Everything Aiveree knows about you, where it came from, and how to remove it. No hidden access. No surprises.
        </p>
      </div>

      {/* Principles strip */}
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:10,marginBottom:28}}>
        {[
          {icon:"👁️",text:"You can see everything we have"},
          {icon:"🚫",text:"We never access files on your device"},
          {icon:"🗑️",text:"Delete anything, any time"},
        ].map(p=>(
          <div key={p.text} style={{background:"rgba(5,150,105,0.05)",border:"1px solid rgba(5,150,105,0.15)",borderRadius:11,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:16}}>{p.icon}</span>
            <span style={{fontSize:13,color:"#059669",fontWeight:600}}>{p.text}</span>
          </div>
        ))}
      </div>

      {/* What Aiveree knows */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:13,fontWeight:700,color:"#8a8396",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>What Aiveree knows about you</div>
        {dataPoints.length > 0 ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {dataPoints.map((dp,i)=>(
              <div key={i} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:14}}>{dp.icon}</span>
                    <span style={{fontWeight:700,fontSize:14,color:"#1a1523"}}>{dp.label}</span>
                  </div>
                  <span style={{fontSize:11,color:"#8a8396",background:"rgba(0,0,0,0.04)",padding:"2px 8px",borderRadius:20}}>{dp.source}</span>
                </div>
                <div style={{fontSize:14,color:"#4b4558",lineHeight:1.65,paddingLeft:26}}>{dp.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:12,padding:"24px",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:8}}>📭</div>
            <div style={{color:"#6b6478",fontSize:14}}>Aiveree doesn't know anything about you yet. Complete the onboarding to get started.</div>
          </div>
        )}
      </div>

      {/* Connected services */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:13,fontWeight:700,color:"#8a8396",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Connected services</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {connections.map(c=>(
            <div key={c.name} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:18}}>{c.icon}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#1a1523",marginBottom:2}}>{c.name}</div>
                  <div style={{fontSize:12,color:"#6b6478"}}>{c.desc}</div>
                </div>
              </div>
              <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,
                background:c.status==="active"?"rgba(5,150,105,0.08)":"rgba(0,0,0,0.04)",
                color:c.status==="active"?"#059669":"#8a8396",
                border:`1px solid ${c.status==="active"?"rgba(5,150,105,0.2)":"rgba(0,0,0,0.08)"}`
              }}>
                {c.status==="active"?"Connected":"Coming soon"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Data commitments */}
      <div style={{marginBottom:28}}>
        <div style={{fontSize:13,fontWeight:700,color:"#8a8396",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Our commitments to you</div>
        <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:14,padding:mobile?"16px":"20px 24px"}}>
          {[
            "Aiveree never accesses files on your device. Documents only enter when you upload them.",
            "Your data is never used to train AI models.",
            "Every future integration requires your explicit permission before connecting.",
            "When an action is taken on your behalf, you'll see exactly what data was used and where it went.",
            "You can delete your entire profile and all data at any time.",
          ].map((commitment,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 0",borderBottom:i<4?"1px solid rgba(0,0,0,0.05)":"none"}}>
              <span style={{color:"#059669",fontWeight:800,fontSize:14,flexShrink:0}}>✓</span>
              <span style={{fontSize:14,color:"#3d3649",lineHeight:1.65}}>{commitment}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Delete data */}
      <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:14,padding:mobile?"16px":"20px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:mobile?"flex-start":"center",flexDirection:mobile?"column":"row",gap:12}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,color:"#1a1523",marginBottom:4}}>Reset your profile</div>
            <div style={{fontSize:13,color:"#6b6478"}}>Clears your local intelligence profile and restarts the onboarding conversation.</div>
          </div>
          <button onClick={clearLocalData} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"8px 16px",color:"#dc2626",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"}}>Reset data</button>
        </div>
      </div>
    </div>
  );
}

function Card({p,onClick,onStack,inStack,onCompare,canCompare,mobile}) {
  const [h,setH]=useState(false);
  return (
    <div style={{background:"#ffffff",border:`2px solid ${h?"rgba(124,58,237,0.4)":"rgba(0,0,0,0.12)"}`,borderRadius:16,padding:mobile?16:22,transition:"all .18s",transform:h&&!mobile?"translateY(-3px)":"none",boxShadow:h?"0 8px 32px rgba(124,58,237,0.18)":"0 2px 14px rgba(0,0,0,0.12)",position:"relative",overflow:"hidden"}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
      <div style={{position:"absolute",top:10,right:10,display:"flex",gap:4}}>
        {p.newThis&&<span style={{background:"#7c3aed",color:"#ffffff",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20}}>NEW</span>}
        {p.trending&&!p.newThis&&<span style={{background:"rgba(245,158,11,0.12)",color:"#92400e",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,border:"1px solid rgba(245,158,11,0.25)"}}>🔥 Hot</span>}
      </div>
      <div onClick={()=>onClick(p)} style={{cursor:"pointer"}}>
        <div style={{fontSize:30,marginBottom:10}}>{p.logo}</div>
        <div style={{fontSize:16,fontWeight:800,color:"#1a1523",fontFamily:"'Plus Jakarta Sans',sans-serif",marginBottom:3}}>{p.name}</div>
        <div style={{fontSize:13,color:"#8a8396",marginBottom:8,fontWeight:500}}>{p.company}</div>
        <div style={{fontSize:14,color:"#3d3649",lineHeight:1.65,marginBottom:12}}>{p.tagline}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
          {p.bestFor.slice(0,2).map(b=><span key={b} style={{fontSize:12,background:"rgba(124,58,237,0.06)",color:"#7c3aed",padding:"3px 9px",borderRadius:20,fontWeight:600}}>{b}</span>)}
        </div>
        <div style={{fontSize:13,color:"#059669",fontWeight:600,marginBottom:10}}>✦ {p.pricing.free}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
          <div style={{flex:1,height:4,background:"rgba(0,0,0,0.06)",borderRadius:2}}><div style={{width:`${p.popularity}%`,height:"100%",background:"linear-gradient(90deg,#a78bfa,#7c3aed)",borderRadius:2}}/></div>
          <span style={{fontSize:11,color:"#8a8396",fontWeight:600}}>{p.popularity}%</span>
          <span style={{fontSize:11,color:"#059669",fontWeight:700}}>{p.weeklyGrowth}</span>
        </div>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={e=>{e.stopPropagation();onStack(p);}} style={{flex:1,background:inStack?"rgba(124,58,237,0.08)":"rgba(0,0,0,0.03)",border:`1.5px solid ${inStack?"rgba(124,58,237,0.3)":"rgba(0,0,0,0.1)"}`,borderRadius:9,padding:"8px",color:inStack?"#7c3aed":"#4b4558",cursor:"pointer",fontSize:13,fontWeight:700}}>{inStack?"✓ In Layer":"+ Layer"}</button>
        <button onClick={e=>{e.stopPropagation();if(canCompare)onCompare(p);}} style={{flex:1,background:"rgba(124,58,237,0.06)",border:"1.5px solid rgba(124,58,237,0.2)",borderRadius:9,padding:"8px",color:"#7c3aed",cursor:canCompare?"pointer":"not-allowed",fontSize:13,fontWeight:700,opacity:canCompare?1:0.4}}>⚖ Compare</button>
      </div>
    </div>
  );
}

function Modal({p,onClose}) {
  if(!p) return null;
  const {description="",useCases=[]} = TOOL_DETAILS[p.id]||{};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.2)",borderRadius:22,padding:28,maxWidth:640,width:"100%",maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:34}}>{p.logo}</span><div><div style={{fontSize:20,fontWeight:800,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{p.name}</div><div style={{fontSize:15,color:"#4b4558"}}>{p.company}</div></div></div>
          <button onClick={onClose} style={{background:"#f9f7f4",border:"none",color:"#1a1523",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16}}>×</button>
        </div>
        <p style={{color:"#2e2839",lineHeight:1.8,marginBottom:20,fontSize:15}}>{description}</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
          <div style={{background:"rgba(124,58,237,0.05)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:11,padding:14}}><div style={{fontSize:10,color:"#7c3aed",fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Free Plan</div><div style={{color:"#1a1523",fontSize:15,marginBottom:4}}>{p.pricing.free}</div><div style={{color:"#6b6478",fontSize:15}}>{p.freeLimit}</div></div>
          <div style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:11,padding:14}}><div style={{fontSize:10,color:"rgba(167,139,250,0.9)",fontWeight:700,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Paid Plans</div><div style={{color:"#1a1523",fontSize:15}}>{p.pricing.paid}</div></div>
        </div>
        <div style={{marginBottom:18}}><div style={{fontSize:15,fontWeight:700,color:"#4b4558",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Best For</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{p.bestFor.map(b=><span key={b} style={{background:"#ffffff",color:"#3d3649",padding:"4px 12px",borderRadius:20,fontSize:15}}>{b}</span>)}</div></div>
        <div style={{marginBottom:22}}><div style={{fontSize:15,fontWeight:700,color:"#4b4558",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Case Studies</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{useCases.map((u,i)=><div key={i} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.06)",borderRadius:10,padding:12}}><div style={{color:"#7c3aed",fontWeight:700,fontSize:15,marginBottom:4}}>{u.title}</div><div style={{color:"#3d3649",fontSize:15,lineHeight:1.6}}>{u.desc}</div></div>)}</div></div>
        <a href={p.link} target="_blank" rel="noreferrer" style={{display:"block",background:"linear-gradient(135deg,#c084fc,#7c3aed)",color:"#ffffff",fontWeight:700,textAlign:"center",padding:"14px",borderRadius:11,textDecoration:"none",fontSize:15}}>Visit {p.name} →</a>
      </div>
    </div>
  );
}

function StackBuilder({stack,onRemove,onClear}) {
  const [analysis,setAnalysis]=useState("");
  const [busy,setBusy]=useState(false);
  const run=async()=>{if(stack.length<2)return;setBusy(true);const r=await claude([{role:"user",content:"Analyse my AI layer stack"}],`The user's AI stack on Aiveree: ${stack.map(p=>p.name).join(", ")}. In 3-4 sentences explain why this is a powerful combination, what end-to-end workflow it enables, and who benefits most. Be specific and enthusiastic but honest.`);setAnalysis(r);setBusy(false);};
  const copy=()=>navigator.clipboard.writeText(`My AI Layer Stack on Aiveree:\n${stack.map(p=>`• ${p.name} — ${p.tagline}`).join("\n")}\n\naiveree.com`);
  if(!stack.length) return <div style={{background:"#ffffff",border:"2px dashed rgba(124,58,237,0.2)",borderRadius:14,padding:36,textAlign:"center"}}><div style={{fontSize:34,marginBottom:11}}>🧱</div><div style={{color:"#4b4558",fontSize:15,marginBottom:6}}>Your layer is empty</div><div style={{color:"#8a8396",fontSize:15}}>Hit "+ Layer" on any tool card in Discover to start building</div></div>;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:700}}>Your Layer — {stack.length} tool{stack.length!==1?"s":""}</div><button onClick={onClear} style={{background:"rgba(255,80,80,0.09)",border:"1px solid rgba(255,80,80,0.2)",borderRadius:8,padding:"5px 12px",color:"rgba(255,100,100,0.8)",cursor:"pointer",fontSize:15}}>Clear</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10,marginBottom:16}}>
        {stack.map(p=><div key={p.id} style={{background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:12,padding:13,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20}}>{p.logo}</span><div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:"#1a1523"}}>{p.name}</div><div style={{fontSize:15,color:"#4b4558"}}>{p.category}</div></div><button onClick={()=>onRemove(p.id)} style={{background:"#f9f7f4",border:"none",color:"#8a8396",width:20,height:20,borderRadius:"50%",cursor:"pointer",fontSize:15}}>×</button></div>)}
      </div>
      <div style={{display:"flex",gap:9,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={run} disabled={busy||stack.length<2} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:9,padding:"9px 18px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15,opacity:stack.length<2?0.45:1}}>{busy?"Analysing…":"✨ Analyse My Layer"}</button>
        <button onClick={copy} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:9,padding:"9px 16px",color:"#3d3649",cursor:"pointer",fontSize:15,fontWeight:600}}>📋 Copy & Share</button>
      </div>
      {analysis&&<div style={{background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:12,padding:18}}><div style={{fontSize:15,color:"#7c3aed",fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Layer Analysis</div><div style={{color:"#3d3649",fontSize:15,lineHeight:1.78}}>{analysis}</div></div>}
    </div>
  );
}

function ComparePanel({list,onRemove,onClear,onCredit}) {
  const [result,setResult]=useState("");
  const [busy,setBusy]=useState(false);
  const [chat,setChat]=useState(false);
  const run=async()=>{if(list.length<2)return;
    if(onCredit){const ok=await onCredit();if(!ok)return;}
    setBusy(true);const r=await claude([{role:"user",content:`Compare ${list[0].name} vs ${list[1].name}`}],cmpPrompt(list[0],list[1]));setResult(r);setBusy(false);};
  if(!list.length) return <div style={{background:"#ffffff",border:"2px dashed rgba(124,58,237,0.2)",borderRadius:14,padding:36,textAlign:"center"}}><div style={{fontSize:34,marginBottom:11}}>⚖️</div><div style={{color:"#4b4558",fontSize:15,marginBottom:6}}>No tools selected</div><div style={{color:"#8a8396",fontSize:15}}>Click "⚖ Cmp" on any two tool cards in Discover</div></div>;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:700}}>Comparing {list.length}/2 tools</div><button onClick={onClear} style={{background:"rgba(255,80,80,0.09)",border:"1px solid rgba(255,80,80,0.2)",borderRadius:8,padding:"5px 12px",color:"rgba(255,100,100,0.8)",cursor:"pointer",fontSize:15}}>Clear</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13,marginBottom:20}}>
        {[0,1].map(i=>list[i]?(
          <div key={i} style={{background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.22)",borderRadius:14,padding:17}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:24}}>{list[i].logo}</span><div><div style={{fontWeight:700,fontSize:15}}>{list[i].name}</div><div style={{fontSize:15,color:"#4b4558"}}>{list[i].company}</div></div></div><button onClick={()=>onRemove(list[i].id)} style={{background:"#f9f7f4",border:"none",color:"#8a8396",width:22,height:22,borderRadius:"50%",cursor:"pointer"}}>×</button></div>
            <div style={{fontSize:15,color:"#3d3649",marginBottom:8}}>{list[i].tagline}</div>
            <div style={{fontSize:15,color:"#7c3aed",marginBottom:4}}>Free: {list[i].pricing.free}</div>
            <div style={{fontSize:15,color:"rgba(124,58,237,0.9)"}}>Paid: {list[i].pricing.paid}</div>
          </div>
        ):<div key={i} style={{background:"rgba(0,0,0,0.02)",border:"2px dashed rgba(0,0,0,0.12)",borderRadius:14,padding:17,display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(26,21,35,0.2)",fontSize:15}}>+ Add second tool</div>)}
      </div>
      {list.length===2&&<div style={{display:"flex",gap:9,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={run} disabled={busy} style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",border:"none",borderRadius:9,padding:"10px 20px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15}}>{busy?"Analysing…":"⚖️ Run Comparison"}</button>
        {result&&<button onClick={()=>setChat(c=>!c)} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:9,padding:"10px 16px",color:"#3d3649",cursor:"pointer",fontSize:15}}>{chat?"Hide Chat":"💬 Ask follow-up"}</button>}
      </div>}
      {result&&<div style={{background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.18)",borderRadius:13,padding:20,marginBottom:chat?16:0}}><div style={{fontSize:15,color:"#7c3aed",fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Aiveree Comparison</div><div style={{color:"#1a1523",fontSize:15,lineHeight:1.8}}><MD text={result}/></div></div>}
      {chat&&list.length===2&&<div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:20}}><Chat sys={cmpPrompt(list[0],list[1])} init={`I've compared ${list[0].name} and ${list[1].name} above. What else would you like to know?`} compact/></div>}
    </div>
  );
}

function Vault({vault,onDelete,onReopen,onNew}) {
  if(!vault.length) return (
    <div style={{background:"#ffffff",border:"2px dashed rgba(124,58,237,0.2)",borderRadius:14,padding:40,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:11}}>🗄️</div>
      <div style={{color:"#4b4558",fontSize:15,marginBottom:6}}>Your Idea Vault is empty</div>
      <div style={{color:"#8a8396",fontSize:15,marginBottom:18}}>Save Idea Lab sessions using the 💾 button — they'll live here</div>
      <button onClick={onNew} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:9,padding:"10px 20px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15}}>💡 Go to Idea Lab</button>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {vault.map((item,i)=>{
        const first=item.messages.find(m=>m.role==="user");
        const last=[...item.messages].reverse().find(m=>m.role==="assistant");
        return (
          <div key={item.id} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:14,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontWeight:700,fontSize:15,marginBottom:2,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>💡 {first?.content?.slice(0,62)}{first?.content?.length>62?"…":""}</div><div style={{fontSize:15,color:"#8a8396"}}>{item.date} · {item.messages.length} messages</div></div>
              <div style={{display:"flex",gap:6}}><button onClick={()=>onReopen(item)} style={{background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.22)",borderRadius:7,padding:"5px 12px",color:"#7c3aed",cursor:"pointer",fontSize:15,fontWeight:600}}>Open</button><button onClick={()=>onDelete(i)} style={{background:"rgba(255,80,80,0.07)",border:"1px solid rgba(255,80,80,0.14)",borderRadius:7,padding:"5px 10px",color:"rgba(255,100,100,0.7)",cursor:"pointer",fontSize:15}}>✕</button></div>
            </div>
            {last&&<div style={{background:"#ffffff",borderRadius:8,padding:11,fontSize:15,color:"#4b4558",lineHeight:1.65}}><MD text={last.content.slice(0,200)+(last.content.length>200?"…":"")}/></div>}
          </div>
        );
      })}
    </div>
  );
}

function EmailSignup({onSave,saved}) {
  const [form,setForm]=useState({name:"",email:"",prefs:[]});
  const [done,setDone]=useState(saved||false);
  const tags=["Writing AI","Image & Design","Video","Coding Tools","Audio","Automation","Research","Trend Reports"];
  const toggle=t=>setForm(f=>({...f,prefs:f.prefs.includes(t)?f.prefs.filter(x=>x!==t):[...f.prefs,t]}));
  const sub=()=>{if(!form.email||!form.name)return;onSave(form);setDone(true);};
  if(done) return (
    <div style={{background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.22)",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:36,marginBottom:12}}>✅</div>
      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:18,fontWeight:800,color:"#34d399",marginBottom:8}}>You're on the list!</div>
      <div style={{color:"#3d3649",fontSize:15}}>The Aiveree weekly digest will land in your inbox. Welcome aboard.</div>
    </div>
  );
  return (
    <div style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.15)",borderRadius:18,padding:28,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,fontWeight:800,marginBottom:4}}>📬 Join the Aiveree Weekly</div>
      <div style={{color:"#6b6478",fontSize:15,lineHeight:1.7}}>Curated weekly roundup of the best new AI tools, monthly trend reports, and Idea Lab tips. Free, always. No spam, ever.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[{key:"name",ph:"Your name",label:"Name *"},{key:"email",ph:"your@email.com",label:"Email *"}].map(f=>(
          <div key={f.key}><div style={{fontSize:15,color:"#4b4558",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{f.label}</div><input value={form[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))} placeholder={f.ph} style={{width:"100%",background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:9,padding:"10px 13px",color:"#1a1523",fontSize:15,outline:"none"}}/></div>
        ))}
      </div>
      <div><div style={{fontSize:15,color:"#4b4558",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>I'm most interested in (pick any)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
          {tags.map(t=><button key={t} onClick={()=>toggle(t)} style={{background:form.prefs.includes(t)?"rgba(124,58,237,0.12)(167,139,250,0.15)":"rgba(255,255,255,0.05)",border:`1px solid ${form.prefs.includes(t)?"rgba(167,139,250,0.35)":"rgba(255,255,255,0.09)"}`,borderRadius:20,padding:"6px 13px",color:form.prefs.includes(t)?"#7c3aed":"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:15,fontWeight:500}}>{t}</button>)}
        </div>
      </div>
      <button onClick={sub} disabled={!form.email||!form.name} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:11,padding:"12px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15,opacity:(!form.email||!form.name)?0.4:1}}>Subscribe — it's free →</button>
    </div>
  );
}

function Scanner({onAdd}) {
  const [busy,setBusy]=useState(false);
  const [results,setResults]=useState([]);
  const [added,setAdded]=useState({});
  const scan=async()=>{
    setBusy(true);setResults([]);
    const raw=await claude([{role:"user",content:"Find 5 new AI tools not in the Aiveree catalog"}],SCAN_PROMPT,true);
    const blocks=raw.split("---").filter(b=>b.includes("NAME:"));
    const parsed=blocks.map(b=>{
      const g=k=>{const m=b.match(new RegExp(k+":\\s*(.+)"));return m?m[1].trim():"";};
      return {id:Date.now()+Math.random(),name:g("NAME"),company:g("COMPANY"),category:g("CATEGORY")||"Writing",logo:g("LOGO")||"🔮",tagline:g("TAGLINE"),description:g("DESCRIPTION"),pricing:{free:g("FREE"),paid:g("PAID")},freeLimit:g("FREE"),link:g("LINK"),bestFor:g("BESTFOR").split(",").map(s=>s.trim()),tags:["discovered"],popularity:60,trending:false,newThis:true,weeklyGrowth:"+new",useCases:[]};
    }).filter(p=>p.name);
    setResults(parsed);setBusy(false);
  };
  return (
    <div>
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,fontWeight:800,marginBottom:7}}>🔭 Scan for New AI Tools</div>
        <div style={{color:"#4b4558",fontSize:15,lineHeight:1.7,marginBottom:16}}>Uses AI with live web search to surface tools not yet in the Aiveree catalog. AI-generated — always verify before relying on results.</div>
        <button onClick={scan} disabled={busy} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:10,padding:"11px 22px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15}}>{busy?"Scanning the AI landscape…":"🔍 Scan for New Tools"}</button>
        {busy&&<div style={{marginTop:12,color:"#4b4558",fontSize:15}}>Searching across AI news, launches, and directories…</div>}
      </div>
      {results.length>0&&(
        <div>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:700,marginBottom:14}}>Found {results.length} new tools</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {results.map(p=>(
              <div key={p.id} style={{background:"rgba(167,139,250,0.04)",border:"1px solid rgba(167,139,250,0.18)",borderRadius:13,padding:18,display:"flex",alignItems:"flex-start",gap:14}}>
                <span style={{fontSize:28,flexShrink:0}}>{p.logo}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:15,marginBottom:2}}>{p.name} <span style={{fontSize:15,color:"#6b6478",fontWeight:400}}>by {p.company}</span></div>
                  <div style={{fontSize:15,color:"#3d3649",marginBottom:6}}>{p.tagline}</div>
                  <div style={{fontSize:15,color:"#7c3aed",marginBottom:8}}>✦ Free: {p.pricing.free} · Paid: {p.pricing.paid}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <a href={p.link} target="_blank" rel="noreferrer" style={{fontSize:15,color:"#4b4558",textDecoration:"underline"}}>{p.link}</a>
                    <button onClick={()=>{onAdd(p);setAdded(a=>({...a,[p.id]:true}));}} disabled={added[p.id]} style={{background:added[p.id]?"rgba(52,211,153,0.12)":"rgba(167,139,250,0.1)",border:`1px solid ${added[p.id]?"rgba(52,211,153,0.3)":"rgba(167,139,250,0.25)"}`,borderRadius:7,padding:"5px 13px",color:added[p.id]?"#34d399":"#7c3aed",cursor:added[p.id]?"default":"pointer",fontSize:15,fontWeight:600}}>{added[p.id]?"✓ Added to Aiveree":"+ Add to Aiveree"}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AUTH & CREDITS HELPERS ───────────────────────────────────────────────────
const ANON_KEY = "aivey_anon_credits";
const SESSION_KEY = "aivey_session";
const WELCOME_KEY = "aivey_welcome_given";

function getAnonCredits() {
  try { const v=localStorage.getItem(ANON_KEY); return v===null?0:parseInt(v,10); } catch { return 0; }
}
function setAnonCredits(n) {
  try { localStorage.setItem(ANON_KEY,String(n)); } catch {}
}
function getSession() {
  try { const v=localStorage.getItem(SESSION_KEY); return v?JSON.parse(v):null; } catch { return null; }
}
function saveSession(s) {
  try { if(s) localStorage.setItem(SESSION_KEY,JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch {}
}

async function apiCall(path, body, token) {
  const res = await fetch(path, {
    method:"POST",
    headers:{"Content-Type":"application/json",...(token?{"Authorization":`Bearer ${token}`}:{})},
    body:JSON.stringify(body)
  });
  return res.json();
}

// ─── UPGRADE MODAL ────────────────────────────────────────────────────────────
function UpgradeModal({onClose, onUpgrade, reason="daily"}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.25)",borderRadius:22,padding:32,maxWidth:460,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:42,marginBottom:12}}>✨</div>
        <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:24,fontWeight:900,marginBottom:8}}>
          {reason==="anon" ? "Sign up free to start using AI features" : reason==="daily" ? "You've used today's 3 free credits" : "Unlock Pro Access"}
        </h2>
        <p style={{color:"#3d3649",fontSize:15,lineHeight:1.8,marginBottom:24}}>
          {reason==="anon"
            ? "Create a free account and get 5 welcome credits — then 3 free credits every day."
            : reason==="daily"
            ? "Free accounts get 3 credits per day. Upgrade to Pro for unlimited access plus exclusive guides and articles."
            : "Get unlimited AI credits plus exclusive guides, articles and resources on using AI to grow your business."}
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {reason==="anon" ? (
            <button onClick={()=>onUpgrade("signup")} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:11,padding:"14px",color:"#ffffff",fontWeight:700,cursor:"pointer",fontSize:15}}>
              Sign up free — get 5 welcome credits →
            </button>
          ) : (
            <>
              <button onClick={()=>onUpgrade("monthly")} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:11,padding:"14px",color:"#ffffff",fontWeight:700,cursor:"pointer",fontSize:15}}>
                Go Pro — £3/month
              </button>
              <button onClick={()=>onUpgrade("yearly")} style={{background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:11,padding:"14px",color:"#7c3aed",fontWeight:700,cursor:"pointer",fontSize:15}}>
                Go Pro — £24/year <span style={{fontSize:15,opacity:0.7}}>(save £12)</span>
              </button>
            </>
          )}
          {reason!=="anon" && <button onClick={()=>onUpgrade("signup")} style={{background:"transparent",border:"1px solid rgba(0,0,0,0.1)",borderRadius:11,padding:"12px",color:"#3d3649",cursor:"pointer",fontSize:15}}>Sign up free instead (3 credits/day)</button>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
          {["Unlimited AI credits — Advisor, Idea Lab, Compare and Trends","Exclusive Pro guides on using AI to grow your business","New articles added monthly","Cancel any time"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:15,color:"#3d3649"}}><span style={{color:"#7c3aed"}}>✓</span>{f}</div>
          ))}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#8a8396",cursor:"pointer",fontSize:15}}>Maybe later</button>
      </div>
    </div>
  );
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────────
function AuthModal({mode:initMode, onClose, onSuccess}) {
  const [mode,setMode]=useState(initMode||"signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [socialLoading,setSocialLoading]=useState("");
  const [error,setError]=useState("");
  const [done,setDone]=useState(false);

  // ── Social OAuth login ────────────────────────────────────────────────────
  const socialLogin = async (provider) => {
    setSocialLoading(provider); setError("");
    try {
      // Get the OAuth redirect URL from Supabase via our auth function
      const res = await apiCall("/.netlify/functions/auth", {
        action:"oauth", provider,
        redirectTo: window.location.origin + "/?auth=callback"
      });
      if(res.error) { setError(res.error); setSocialLoading(""); return; }
      if(res.url) window.location.href = res.url;
    } catch(e) {
      setError("Could not connect to " + provider + ". Please try email instead.");
      setSocialLoading("");
    }
  };

  // ── Email/password submit ─────────────────────────────────────────────────
  const submit = async () => {
    if(!email||!password) return setError("Please fill in all fields");
    if(mode==="signup"&&!name) return setError("Please enter your name");
    setLoading(true); setError("");
    const res = await apiCall("/.netlify/functions/auth", {action:mode,email,password,name});
    setLoading(false);
    if(res.error) return setError(res.error);
    if(mode==="signup") {
      setLoading(true);
      const signInRes = await apiCall("/.netlify/functions/auth", {action:"signin",email,password});
      setLoading(false);
      if(signInRes.error) { setDone(true); return; }
      onSuccess({...signInRes, isNewUser:true});
      return;
    }
    onSuccess({...res, isNewUser:false});
  };

  // ── Social button component ───────────────────────────────────────────────
  const SocialBtn = ({provider, icon, label, bg, border, textCol}) => (
    <button
      onClick={()=>socialLogin(provider)}
      disabled={!!socialLoading||loading}
      style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
        gap:10, background:bg||"#ffffff",
        border:`1.5px solid ${border||"rgba(0,0,0,0.12)"}`,
        borderRadius:10, padding:"11px 16px", cursor:"pointer",
        fontSize:15, fontWeight:600, color:textCol||"#1a1523",
        marginBottom:10, transition:"all .15s",
        opacity:(socialLoading&&socialLoading!==provider)?0.6:1
      }}
    >
      <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
      <span>{socialLoading===provider?"Connecting...":label}</span>
    </button>
  );

  if(done) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.25)",borderRadius:22,padding:36,maxWidth:420,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>📬</div>
        <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:22,fontWeight:900,marginBottom:8}}>Check your email</h2>
        <p style={{color:"#3d3649",fontSize:15,lineHeight:1.8,marginBottom:20}}>We sent a link to <strong style={{color:"#7c3aed"}}>{email}</strong>. Click it to activate your account and claim your 5 welcome credits.</p>
        <button onClick={()=>{setMode("signin");setDone(false);}} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:11,padding:"12px 24px",color:"#ffffff",fontWeight:700,cursor:"pointer",fontSize:15}}>Back to sign in</button>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.2)",borderRadius:22,padding:32,maxWidth:440,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div>
            <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:22,fontWeight:900,marginBottom:2}}>
              {mode==="signup"?"Create your account":"Welcome back"}
            </h2>
            <p style={{fontSize:13,color:"#8a8396",margin:0}}>
              {mode==="signup"?"Get 5 free credits to start":"Sign in to access your credits"}
            </p>
          </div>
          <button onClick={onClose} style={{background:"#f5f4f9",border:"none",color:"#1a1523",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:17,flexShrink:0}}>×</button>
        </div>

        {/* Social login buttons */}
        <SocialBtn
          provider="google"
          icon={<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
          label="Continue with Google"
          border="rgba(0,0,0,0.12)"
        />
        <SocialBtn
          provider="azure"
          icon={<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#0078D4" d="M11.5 3L3 8.5V15l4.5 2.5L11.5 21l8.5-5V8.5L11.5 3zm0 2.5l6 3.5v5l-6 3.5-6-3.5v-5l6-3.5z"/></svg>}
          label="Continue with Microsoft"
          border="rgba(0,0,0,0.12)"
        />
        <SocialBtn
          provider="apple"
          icon={<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#000" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.29.07 2.18.74 2.93.8.84-.17 1.65-.87 2.62-.94 1.04-.09 2.05.34 2.78 1.24-2.73 1.63-2.26 5.29.29 6.45-.6 1.52-1.35 3.02-2.62 4.33zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>}
          label="Continue with Apple"
          bg="#000000"
          border="#000000"
          textCol="#ffffff"
        />

        {/* Divider */}
        <div style={{display:"flex",alignItems:"center",gap:12,margin:"18px 0"}}>
          <div style={{flex:1,height:1,background:"rgba(0,0,0,0.08)"}}/>
          <span style={{fontSize:13,color:"#8a8396",whiteSpace:"nowrap"}}>or continue with email</span>
          <div style={{flex:1,height:1,background:"rgba(0,0,0,0.08)"}}/>
        </div>

        {/* Email form */}
        {mode==="signup"&&(
          <div style={{marginBottom:14}}>
            <label style={{fontSize:12,fontWeight:700,color:"#4b4558",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={{width:"100%",background:"#faf9fc",border:"1.5px solid rgba(0,0,0,0.1)",borderRadius:9,padding:"10px 13px",color:"#1a1523",fontSize:15,outline:"none",boxSizing:"border-box"}}
              onFocus={e=>e.target.style.borderColor="#7c3aed"} onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.1)"}/>
          </div>
        )}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:700,color:"#4b4558",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{width:"100%",background:"#faf9fc",border:"1.5px solid rgba(0,0,0,0.1)",borderRadius:9,padding:"10px 13px",color:"#1a1523",fontSize:15,outline:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor="#7c3aed"} onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.1)"}/>
        </div>
        <div style={{marginBottom:18}}>
          <label style={{fontSize:12,fontWeight:700,color:"#4b4558",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:5}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Minimum 6 characters" style={{width:"100%",background:"#faf9fc",border:"1.5px solid rgba(0,0,0,0.1)",borderRadius:9,padding:"10px 13px",color:"#1a1523",fontSize:15,outline:"none",boxSizing:"border-box"}}
            onFocus={e=>e.target.style.borderColor="#7c3aed"} onBlur={e=>e.target.style.borderColor="rgba(0,0,0,0.1)"}/>
        </div>

        {error&&<div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"10px 13px",fontSize:14,color:"#dc2626",marginBottom:14}}>{error}</div>}

        <button onClick={submit} disabled={loading||!!socialLoading} style={{width:"100%",background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:11,padding:"13px",color:"#ffffff",fontWeight:700,cursor:"pointer",fontSize:15,marginBottom:16,opacity:(loading||socialLoading)?0.7:1}}>
          {loading?"Please wait...":(mode==="signup"?"Create account":"Sign in")}
        </button>

        <div style={{textAlign:"center",fontSize:14,color:"#6b6478"}}>
          {mode==="signup"
            ? <>Already have an account? <button onClick={()=>{setMode("signin");setError("");}} style={{background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:14,fontWeight:600}}>Sign in</button></>
            : <>No account? <button onClick={()=>{setMode("signup");setError("");}} style={{background:"none",border:"none",color:"#7c3aed",cursor:"pointer",fontSize:14,fontWeight:600}}>Sign up free</button></>
          }
        </div>

        {mode==="signup"&&(
          <div style={{marginTop:16,padding:"11px 14px",background:"rgba(124,58,237,0.05)",border:"1px solid rgba(124,58,237,0.1)",borderRadius:9,fontSize:13,color:"#4b4558",textAlign:"center",lineHeight:1.6}}>
            ✨ 5 welcome credits on sign-up, then 3 free every day
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOOL PICKER ──────────────────────────────────────────────────────────────
function ToolPicker({label,value,all,onChange}) {
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);

  const filtered=all
    .filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.category.toLowerCase().includes(q.toLowerCase()))
    .slice(0,20);

  return (
    <div ref={ref} style={{position:"relative"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#6b6478",letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{label}</div>
      <div onClick={()=>setOpen(!open)} style={{background:"#ffffff",border:`2px solid ${open?"#7c3aed":"rgba(0,0,0,0.1)"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"border .15s"}}>
        {value?(
          <>
            <span style={{fontSize:22}}>{value.logo}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,color:"#1a1523"}}>{value.name}</div>
              <div style={{fontSize:15,color:"#6b6478"}}>{value.company} · {value.category}</div>
            </div>
            <span onClick={e=>{e.stopPropagation();onChange(null);}} style={{color:"#8a8396",fontSize:16,lineHeight:1,cursor:"pointer",padding:4}}>×</span>
          </>
        ):(
          <>
            <span style={{fontSize:18,color:"#8a8396"}}>🔍</span>
            <span style={{color:"#8a8396",fontSize:15}}>Search for a tool…</span>
          </>
        )}
        <span style={{color:"#8a8396",fontSize:15,marginLeft:"auto"}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#ffffff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",zIndex:100,overflow:"hidden"}}>
          <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Type to search tools…" style={{width:"100%",border:"none",outline:"none",fontSize:15,color:"#1a1523",background:"transparent"}}/>
          </div>
          <div style={{maxHeight:280,overflowY:"auto"}}>
            {filtered.length===0&&<div style={{padding:"16px",textAlign:"center",color:"#8a8396",fontSize:15}}>No tools found</div>}
            {filtered.map(p=>(
              <div key={p.id} onClick={()=>{onChange(p);setOpen(false);setQ("");}} style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span style={{fontSize:18,flexShrink:0}}>{p.logo}</span>
                <div>
                  <div style={{fontWeight:600,fontSize:15,color:"#1a1523"}}>{p.name}</div>
                  <div style={{fontSize:15,color:"#6b6478"}}>{p.company} · {p.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
// ─── FREE REPORTS PAGE ────────────────────────────────────────────────────────
const REPORT_TOPICS = [
  {id:"top5free",emoji:"🆓",title:"Best Free AI Tools This Week",desc:"The top 5 free AI tools worth trying right now — what they do, who they're for, and how to get started in under 5 minutes."},
  {id:"smallbiz",emoji:"🏪",title:"AI for Small Business Owners",desc:"A practical guide to the AI tools saving small business owners 10+ hours a week on admin, marketing, and customer service."},
  {id:"nocode",emoji:"🛠️",title:"Build Without Code: AI Tools for Non-Developers",desc:"You don't need to write a single line of code. Here are the best AI tools for building apps, websites, and automations — explained plainly."},
  {id:"writing",emoji:"✍️",title:"AI Writing Tools Compared",desc:"ChatGPT vs Claude vs Gemini vs Grammarly — a plain-English breakdown of which writing AI is actually best for your use case."},
  {id:"trending",emoji:"🔥",title:"What's Trending in AI Right Now",desc:"The 5 AI tools gaining the most momentum this week, why everyone's talking about them, and whether they're worth your time."},
  {id:"video",emoji:"🎬",title:"AI Video Tools: The Complete Guide",desc:"From making faceless videos to translating content into 40 languages — every AI video tool explained, with honest free vs paid breakdowns."},
];

// Published reports — loaded from Supabase, admin-curated
const PUBLISHED_REPORTS_KEY = "aiveree-published-reports";

function ReportsPage({all}) {
  const [expanded, setExpanded] = useState(null);
  // Published reports come from Supabase pro_articles table (admin publishes them)
  // For now show placeholder cards with "coming soon" for unpublished ones
  const REPORT_TOPICS_DISPLAY = [
    {id:"top5free",emoji:"🆓",title:"Best Free AI Tools This Week",desc:"The top 5 free AI tools worth trying right now — what they do, who they're for, and how to get started in under 5 minutes.",published:false},
    {id:"smallbiz",emoji:"🏪",title:"AI for Small Business Owners",desc:"A practical guide to the AI tools saving small business owners 10+ hours a week on admin, marketing, and customer service.",published:false},
    {id:"nocode",emoji:"🛠️",title:"Build Without Code: AI Tools for Non-Developers",desc:"You don't need to write a single line of code. Here are the best AI tools for building apps, websites, and automations — explained plainly.",published:false},
    {id:"writing",emoji:"✍️",title:"AI Writing Tools Compared",desc:"ChatGPT vs Claude vs Gemini vs Grammarly — a plain-English breakdown of which writing AI is actually best for your use case.",published:false},
    {id:"trending",emoji:"🔥",title:"What's Trending in AI Right Now",desc:"The 5 AI tools gaining the most momentum this week, why everyone's talking about them, and whether they're worth your time.",published:false},
    {id:"video",emoji:"🎬",title:"AI Video Tools: The Complete Guide",desc:"From making faceless videos to translating content into 40 languages — every AI video tool explained, with honest free vs paid breakdowns.",published:false},
  ];

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24}}>
        {REPORT_TOPICS_DISPLAY.map(topic=>(
          <div key={topic.id} style={{background:"#ffffff",border:`1px solid ${expanded===topic.id?"rgba(124,58,237,0.3)":"rgba(0,0,0,0.08)"}`,borderRadius:14,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.05)",transition:"all .2s"}}>
            <div style={{padding:"18px 20px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                <span style={{fontSize:28,flexShrink:0}}>{topic.emoji}</span>
                <div>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:15,color:"#1a1523",marginBottom:4,lineHeight:1.3}}>{topic.title}</div>
                  <div style={{fontSize:15,color:"#6b6478",lineHeight:1.6}}>{topic.desc}</div>
                </div>
              </div>
              {topic.published ? (
                <button onClick={()=>setExpanded(expanded===topic.id?null:topic.id)} style={{background:expanded===topic.id?"rgba(124,58,237,0.08)":"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:8,padding:"8px 16px",color:expanded===topic.id?"#7c3aed":"#ffffff",fontWeight:700,cursor:"pointer",fontSize:15,width:"100%"}}>
                  {expanded===topic.id?"▲ Collapse":"▼ Read Report"}
                </button>
              ) : (
                <div style={{background:"rgba(0,0,0,0.03)",border:"1px solid rgba(0,0,0,0.07)",borderRadius:8,padding:"8px 16px",fontSize:15,color:"#8a8396",textAlign:"center",fontWeight:500}}>
                  📅 Coming soon — published weekly
                </div>
              )}
            </div>
            {expanded===topic.id && topic.content && (
              <div style={{borderTop:"1px solid rgba(0,0,0,0.06)",padding:"18px 20px",background:"#faf8f5"}}>
                <MD text={topic.content}/>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{background:"rgba(124,58,237,0.04)",border:"1px solid rgba(124,58,237,0.1)",borderRadius:12,padding:"16px 20px",textAlign:"center",fontSize:15,color:"#4b4558"}}>
        📋 New reports published weekly by the Aiveree team. All free — no account needed.
      </div>
    </div>
  );
}

function AdminPanel({onClose}) {
  const [secret,setSecret]=useState("");
  const [authed,setAuthed]=useState(false);
  const [tools,setTools]=useState([]);
  const [history,setHistory]=useState([]);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const [editing,setEditing]=useState(null);
  const [editVals,setEditVals]=useState({});
  const [view,setView]=useState("tools"); // tools | history

  const api=async(action,extra={})=>{
    const r=await fetch("/.netlify/functions/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret,action,...extra})});
    return r.json();
  };

  const login=async()=>{
    setLoading(true);
    const r=await api("get_tools");
    setLoading(false);
    if(r.error){setMsg("Wrong password");return;}
    setTools(r.tools||[]);
    setAuthed(true);
    setMsg("");
  };

  const loadHistory=async()=>{
    const r=await api("get_history");
    setHistory(r.history||[]);
    setView("history");
  };

  const saveEdit=async()=>{
    setLoading(true);
    const r=await api("update_tool",{id:editing,...editVals});
    setLoading(false);
    if(r.error){setMsg(r.error);return;}
    setTools(t=>t.map(x=>x.id===editing?{...x,...editVals}:x));
    setEditing(null);
    setMsg("✓ Saved");
    setTimeout(()=>setMsg(""),3000);
  };

  const triggerRerank=async()=>{
    setLoading(true);setMsg("Re-ranking...");
    const r=await api("rerank");
    setLoading(false);
    if(r.success){const d=await api("get_tools");setTools(d.tools||[]);setMsg("✓ Re-ranked");}
    else setMsg(r.error||"Error");
    setTimeout(()=>setMsg(""),4000);
  };

  const triggerDailyRank=async()=>{
    setLoading(true);setMsg("Running AI ranking update (takes ~2 mins)...");
    const r=await fetch("/.netlify/functions/rank-tools",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret})});
    const d=await r.json();
    setLoading(false);
    if(d.success){setMsg(`✓ Ranked ${d.tools_scored} tools`);const rd=await api("get_tools");setTools(rd.tools||[]);}
    else setMsg(d.error||"Error");
    setTimeout(()=>setMsg(""),6000);
  };

  if(!authed) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,padding:32,maxWidth:380,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,fontWeight:900,marginBottom:20,color:"#1a1523"}}>🔐 Aiveree Admin</div>
        <input type="password" value={secret} onChange={e=>setSecret(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Admin password" style={{width:"100%",background:"#f9f7f4",border:"1px solid rgba(0,0,0,0.1)",borderRadius:9,padding:"10px 13px",color:"#1a1523",fontSize:15,outline:"none",boxSizing:"border-box",marginBottom:12}}/>
        {msg&&<div style={{color:"#dc2626",fontSize:15,marginBottom:12}}>{msg}</div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={login} disabled={loading} style={{flex:1,background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:9,padding:"11px",color:"#ffffff",fontWeight:700,cursor:"pointer",fontSize:15}}>{loading?"Loading...":"Login"}</button>
          <button onClick={onClose} style={{background:"rgba(0,0,0,0.06)",border:"none",borderRadius:9,padding:"11px 16px",cursor:"pointer",fontSize:15,color:"#1a1523"}}>Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:20,padding:24,maxWidth:860,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,fontWeight:900,color:"#1a1523"}}>🛠 Aiveree Admin — Tool Rankings</div>
          <button onClick={onClose} style={{background:"rgba(0,0,0,0.06)",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:15,color:"#1a1523"}}>Close</button>
        </div>

        {/* Actions bar */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <button onClick={triggerRerank} disabled={loading} style={{background:"#7c3aed",border:"none",borderRadius:8,padding:"8px 16px",color:"#ffffff",fontWeight:600,cursor:"pointer",fontSize:15}}>⚡ Re-rank Now</button>
          <button onClick={triggerDailyRank} disabled={loading} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:8,padding:"8px 16px",color:"#1a1523",fontWeight:600,cursor:"pointer",fontSize:15}}>🤖 Run AI Ranking</button>
          <button onClick={()=>{setView("tools");api("get_tools").then(r=>setTools(r.tools||[]));}} style={{background:view==="tools"?"rgba(124,58,237,0.1)":"rgba(0,0,0,0.05)",border:"none",borderRadius:8,padding:"8px 16px",color:view==="tools"?"#7c3aed":"#1a1523",fontWeight:600,cursor:"pointer",fontSize:15}}>📋 Tools</button>
          <button onClick={loadHistory} style={{background:view==="history"?"rgba(124,58,237,0.1)":"rgba(0,0,0,0.05)",border:"none",borderRadius:8,padding:"8px 16px",color:view==="history"?"#7c3aed":"#1a1523",fontWeight:600,cursor:"pointer",fontSize:15}}>📊 History</button>
          {msg&&<span style={{fontSize:15,color:msg.startsWith("✓")?"#059669":"#dc2626",fontWeight:600}}>{msg}</span>}
        </div>

        {view==="tools"&&(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:15}}>
              <thead><tr style={{borderBottom:"2px solid rgba(0,0,0,0.1)"}}>
                {["Rank","Name","Category","Popularity","Trending","New","Growth","Top20","Edit"].map(h=>(
                  <th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#4b4558",fontWeight:600,fontSize:15,textTransform:"uppercase",letterSpacing:0.5}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {tools.sort((a,b)=>(a.rank_position||99)-(b.rank_position||99)).map(t=>(
                  <tr key={t.id} style={{borderBottom:"1px solid rgba(0,0,0,0.06)",background:editing===t.id?"rgba(124,58,237,0.04)":"transparent"}}>
                    {editing===t.id?(
                      <>
                        <td style={{padding:"8px"}}><span style={{fontWeight:700,color:"#7c3aed"}}>#{t.rank_position}</span></td>
                        <td style={{padding:"8px",fontWeight:600}}>{t.name}</td>
                        <td style={{padding:"8px",color:"#4b4558"}}>{t.category}</td>
                        <td style={{padding:"8px"}}><input type="number" min="1" max="100" value={editVals.popularity??t.popularity} onChange={e=>setEditVals(v=>({...v,popularity:parseInt(e.target.value)}))} style={{width:55,padding:"3px 6px",border:"1px solid rgba(0,0,0,0.2)",borderRadius:5,fontSize:15}}/></td>
                        <td style={{padding:"8px"}}><input type="checkbox" checked={editVals.trending??t.trending} onChange={e=>setEditVals(v=>({...v,trending:e.target.checked}))}/></td>
                        <td style={{padding:"8px"}}><input type="checkbox" checked={editVals.new_this??t.new_this} onChange={e=>setEditVals(v=>({...v,new_this:e.target.checked}))}/></td>
                        <td style={{padding:"8px"}}><input type="text" value={editVals.weekly_growth??t.weekly_growth} onChange={e=>setEditVals(v=>({...v,weekly_growth:e.target.value}))} style={{width:60,padding:"3px 6px",border:"1px solid rgba(0,0,0,0.2)",borderRadius:5,fontSize:15}}/></td>
                        <td style={{padding:"8px"}}><span style={{color:t.top20?"#7c3aed":"rgba(26,21,35,0.3)",fontWeight:700}}>{t.top20?"★":"-"}</span></td>
                        <td style={{padding:"8px",display:"flex",gap:4}}>
                          <button onClick={saveEdit} style={{background:"#7c3aed",border:"none",borderRadius:5,padding:"4px 10px",color:"#ffffff",cursor:"pointer",fontSize:15,fontWeight:600}}>Save</button>
                          <button onClick={()=>setEditing(null)} style={{background:"rgba(0,0,0,0.08)",border:"none",borderRadius:5,padding:"4px 8px",cursor:"pointer",fontSize:15}}>✕</button>
                        </td>
                      </>
                    ):(
                      <>
                        <td style={{padding:"8px"}}><span style={{fontWeight:700,color:t.rank_position<=20?"#7c3aed":"rgba(26,21,35,0.4)"}}>#{t.rank_position}</span></td>
                        <td style={{padding:"8px",fontWeight:600,color:"#1a1523"}}>{t.name}</td>
                        <td style={{padding:"8px",color:"#4b4558"}}>{t.category}</td>
                        <td style={{padding:"8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:40,height:4,background:"rgba(0,0,0,0.06)",borderRadius:2}}><div style={{width:`${t.popularity}%`,height:4,background:"linear-gradient(90deg,#c084fc,#7c3aed)",borderRadius:2}}></div></div>
                            <span style={{fontWeight:700,color:"#1a1523"}}>{t.popularity}</span>
                          </div>
                        </td>
                        <td style={{padding:"8px"}}><span style={{color:t.trending?"#f59e0b":"rgba(26,21,35,0.3)"}}>{t.trending?"🔥":"-"}</span></td>
                        <td style={{padding:"8px"}}><span style={{color:t.new_this?"#059669":"rgba(26,21,35,0.3)"}}>{t.new_this?"✨":"-"}</span></td>
                        <td style={{padding:"8px",color:t.weekly_growth?.startsWith("-")?"#dc2626":"#059669",fontWeight:600}}>{t.weekly_growth}</td>
                        <td style={{padding:"8px"}}><span style={{color:t.top20?"#7c3aed":"rgba(26,21,35,0.3)",fontWeight:700}}>{t.top20?"★":"-"}</span></td>
                        <td style={{padding:"8px"}}>
                          <button onClick={()=>{setEditing(t.id);setEditVals({});}} style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:5,padding:"4px 10px",color:"#7c3aed",cursor:"pointer",fontSize:15,fontWeight:600}}>Edit</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view==="history"&&(
          <div>
            <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,marginBottom:12,color:"#1a1523"}}>📊 Recent Ranking Changes</div>
            {history.length===0?<div style={{color:"#6b6478",fontSize:15}}>No ranking history yet. Run the AI ranking update to generate history.</div>:(
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:15}}>
                <thead><tr style={{borderBottom:"2px solid rgba(0,0,0,0.1)"}}>
                  {["Tool","Old Rank","New Rank","Old Pop","New Pop","Reason","Date"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"6px 8px",color:"#4b4558",fontWeight:600,fontSize:15,textTransform:"uppercase"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {history.map((h,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                      <td style={{padding:"6px 8px",fontWeight:600}}>{h.tool_name}</td>
                      <td style={{padding:"6px 8px",color:"#4b4558"}}>{h.old_rank||"-"}</td>
                      <td style={{padding:"6px 8px",fontWeight:600,color:h.new_rank<h.old_rank?"#059669":h.new_rank>h.old_rank?"#dc2626":"#1a1523"}}>{h.new_rank||"-"} {h.new_rank<h.old_rank?"↑":h.new_rank>h.old_rank?"↓":""}</td>
                      <td style={{padding:"6px 8px"}}>{h.old_popularity}</td>
                      <td style={{padding:"6px 8px",fontWeight:600,color:h.new_popularity>h.old_popularity?"#059669":h.new_popularity<h.old_popularity?"#dc2626":"#1a1523"}}>{h.new_popularity}</td>
                      <td style={{padding:"6px 8px",color:"#4b4558",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.change_reason}</td>
                      <td style={{padding:"6px 8px",color:"#6b6478"}}>{new Date(h.ranked_at).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TOOL_DETAILS = {
  1: {description:"",useCases:[]},
  2: {description:"",useCases:[]},
  3: {description:"",useCases:[]},
  4: {description:"",useCases:[]},
  5: {description:"",useCases:[]},
  6: {description:"",useCases:[]},
  7: {description:"",useCases:[]},
  8: {description:"",useCases:[]},
  9: {description:"",useCases:[]},
  10: {description:"",useCases:[]},
  11: {description:"",useCases:[]},
  12: {description:"",useCases:[]},
  13: {description:"",useCases:[]},
  14: {description:"",useCases:[]},
  15: {description:"",useCases:[]},
  16: {description:"",useCases:[]},
  17: {description:"",useCases:[]},
  18: {description:"",useCases:[]},
  19: {description:"",useCases:[]},
  20: {description:"",useCases:[]},
  21: {description:"",useCases:[]},
  22: {description:"",useCases:[]},
  23: {description:"",useCases:[]},
  24: {description:"",useCases:[]},
  25: {description:"",useCases:[]},
  26: {description:"",useCases:[]},
  27: {description:"",useCases:[]},
  28: {description:"",useCases:[]},
  29: {description:"",useCases:[]},
  30: {description:"",useCases:[]},
  31: {description:"",useCases:[]},
  32: {description:"",useCases:[]},
  33: {description:"",useCases:[]},
  34: {description:"",useCases:[]},
  35: {description:"",useCases:[]},
  36: {description:"",useCases:[]},
  37: {description:"",useCases:[]},
  38: {description:"",useCases:[]},
  39: {description:"",useCases:[]},
  40: {description:"",useCases:[]},
  41: {description:"",useCases:[]},
  42: {description:"",useCases:[]},
  43: {description:"",useCases:[]},
  44: {description:"",useCases:[]},
  45: {description:"",useCases:[]},
  46: {description:"",useCases:[]},
  47: {description:"",useCases:[]},
  48: {description:"",useCases:[]},
  49: {description:"",useCases:[]},
  51: {description:"",useCases:[]},
  52: {description:"",useCases:[]},
  53: {description:"",useCases:[]},
  54: {description:"",useCases:[]},
  55: {description:"",useCases:[]},
  56: {description:"",useCases:[]},
  58: {description:"",useCases:[]},
  59: {description:"",useCases:[]},
  60: {description:"",useCases:[]},
  61: {description:"",useCases:[]},
  62: {description:"",useCases:[]},
  63: {description:"",useCases:[]},
  64: {description:"",useCases:[]},
  65: {description:"",useCases:[]},
  66: {description:"",useCases:[]},
  67: {description:"",useCases:[]},
  68: {description:"",useCases:[]},
  69: {description:"",useCases:[]},
  70: {description:"",useCases:[]},
  71: {description:"",useCases:[]},
  72: {description:"",useCases:[]},
  73: {description:"",useCases:[]},
  74: {description:"",useCases:[]},
  75: {description:"",useCases:[]},
  76: {description:"",useCases:[]},
  77: {description:"",useCases:[]},
  78: {description:"",useCases:[]},
  80: {description:"",useCases:[]},
  81: {description:"",useCases:[]},
  82: {description:"",useCases:[]},
  83: {description:"",useCases:[]},
  84: {description:"",useCases:[]},
  85: {description:"",useCases:[]},
  86: {description:"",useCases:[]},
  87: {description:"",useCases:[]},
  88: {description:"",useCases:[]},
  89: {description:"",useCases:[]},
  90: {description:"",useCases:[]},
  91: {description:"",useCases:[]},
  92: {description:"",useCases:[]},
  93: {description:"",useCases:[]},
  94: {description:"",useCases:[]},
  95: {description:"",useCases:[]},
  96: {description:"",useCases:[]},
  97: {description:"",useCases:[]},
  98: {description:"",useCases:[]},
  99: {description:"",useCases:[]},
  100: {description:"",useCases:[]},
  101: {description:"",useCases:[]},
  102: {description:"",useCases:[]},
  103: {description:"",useCases:[]},
};

export default function App() {
  const mobile=useIsMobile();
  // Hide skeleton screen as soon as React mounts
  useEffect(()=>{ if(window.__hideSkeleton) window.__hideSkeleton(); },[]);

  // Handle OAuth callback — when user returns from Google/Microsoft/Apple
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const authCallback = params.get('auth');
    const code = params.get('code');
    if(authCallback==='callback' && code) {
      // Clear URL params immediately
      window.history.replaceState({}, '', window.location.pathname);
      // Exchange code for session
      apiCall('/.netlify/functions/auth', {action:'oauth_callback', code})
        .then(res => {
          if(res.error) return;
          const s = {token:res.session?.access_token, user:res.user, profile:res.profile};
          setSession(s); saveSession(s);
          // Welcome credits for new social sign-ups
          if(res.isNewUser) {
            localStorage.setItem(WELCOME_KEY,'1');
            setUserCredits(5);
          } else if(res.profile?.credits !== undefined) {
            setUserCredits(res.profile.credits);
          }
        })
        .catch(()=>{});
    }
  },[]);
  const [tab,setTab]=useState("discover");
  const [cat,setCat]=useState("All");
  const [q,setQ]=useState("");
  const [sort,setSort]=useState("popularity");
  const [modal,setModal]=useState(null);
  const [stack,setStack]=useState([]);
  const [cmp,setCmp]=useState([]);
  const [vault,setVault]=useState([]);
  const [dSub,setDSub]=useState("browse");
  // Auth & credits
  const [session,setSession]=useState(()=>getSession());
  const [anonCredits,setAnonCreditsState]=useState(()=>getAnonCredits());
  const [userCredits,setUserCredits]=useState(null);
  const [showUpgrade,setShowUpgrade]=useState(null); // null | "anon" | "daily" | "pro"
  const [showAuth,setShowAuth]=useState(null); // null | "signin" | "signup"
  const isPro = session?.profile?.plan==="pro";
  const credits = session ? (isPro ? 999 : (userCredits??session?.profile?.credits??3)) : anonCredits;

  // Load user credits on mount / session change
  useEffect(()=>{
    if(session?.token) {
      apiCall("/.netlify/functions/credits",{action:"get"},session.token)
        .then(r=>{ if(r.credits!==undefined) setUserCredits(r.credits); })
        .catch(()=>{});
    }
  },[session]);

  // Check for post-upgrade redirect
  useEffect(()=>{
    if(window.location.search.includes("upgraded=true")) {
      if(session?.token) {
        apiCall("/.netlify/functions/auth",{action:"me"},session.token)
          .then(r=>{
            if(r.profile) {
              const s={...session,profile:r.profile}; setSession(s); saveSession(s);
              // Daily credit reset: if last reset wasn't today, give 3 fresh credits
              const today=new Date().toDateString();
              const lastReset=localStorage.getItem("aivey_credit_date");
              if(lastReset!==today) {
                localStorage.setItem("aivey_credit_date",today);
                const welcomeGiven=localStorage.getItem("aivey_welcome_given");
                // Only reset if they're past their welcome session
                if(welcomeGiven) {
                  setUserCredits(3);
                  apiCall("/.netlify/functions/credits",{action:"set",credits:3},session.token).catch(()=>{});
                }
              } else if(r.profile?.credits !== undefined) {
                setUserCredits(r.profile.credits);
              }
            }
          });
      }
      window.history.replaceState({},"",window.location.pathname);
    }
  },[]);

  const useCredit = async (feature) => {
    // Pro users — always allowed
    if(isPro) return true;
    // Not signed in — show sign-up wall immediately
    if(!session?.token) {
      setShowUpgrade("anon");
      return false;
    }
    // Signed-in free user — check credits
    const currentCredits = userCredits ?? session?.profile?.credits ?? 3;
    if(currentCredits <= 0) {
      setShowUpgrade("daily");
      return false;
    }
    // Deduct 1 credit locally immediately (optimistic)
    const newC = currentCredits - 1;
    setUserCredits(newC);
    // Sync to server in background
    apiCall("/.netlify/functions/credits",{action:"use",feature},session.token)
      .then(r=>{ if(r.credits !== undefined) setUserCredits(r.credits); })
      .catch(()=>{}); // don't block on failure
    return true;
  };

  const handleUpgradeAction = async (type) => {
    if(type==="signup") { setShowUpgrade(null); setShowAuth("signup"); return; }
    if(type==="signin") { setShowUpgrade(null); setShowAuth("signin"); return; }
    if((type==="monthly"||type==="yearly") && session) {
      const r = await apiCall("/.netlify/functions/stripe/checkout",{plan:type,userId:session.user.id,userEmail:session.user.email});
      if(r.url) window.location.href=r.url;
    } else {
      setShowUpgrade(null); setShowAuth("signup");
    }
  };

  const handleAuthSuccess = (res) => {
    const s = {token:res.session?.access_token, user:res.user, profile:res.profile};
    setSession(s); saveSession(s);
    setShowAuth(null);
    // Welcome bonus: 5 credits on first ever sign-up
    const alreadyWelcomed = localStorage.getItem(WELCOME_KEY);
    if(!alreadyWelcomed && res.isNewUser) {
      localStorage.setItem(WELCOME_KEY,'1');
      setUserCredits(5);
      // Sync 5 welcome credits to server
      if(res.session?.access_token) {
        apiCall('/.netlify/functions/credits',{action:'set',credits:5},res.session.access_token).catch(()=>{});
      }
    } else if(res.profile?.credits !== undefined) {
      setUserCredits(res.profile.credits);
    } else {
      setUserCredits(3); // default daily credits
    }
  };

  const signOut = () => { setSession(null); saveSession(null); setUserCredits(null); };
  const [subForm,setSubForm]=useState({name:"",company:"",link:"",category:"Writing",desc:"",who:""});
  const [subDone,setSubDone]=useState(false);
  const [subBusy,setSubBusy]=useState(false);
  const [vaultOpen,setVaultOpen]=useState(null);
  const [report,setReport]=useState("");
  const [reportBusy,setReportBusy]=useState(false);
  const [subscriber,setSubscriber]=useState(null);
  const [extras,setExtras]=useState([]);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const [ideaStarter,setIdeaStarter]=useState(null);
  const [liveTools,setLiveTools]=useState(AI_PRODUCTS); // starts with hardcoded, updates from Supabase
  const [toolsLoading,setToolsLoading]=useState(false);

  // ── Intelligence Profile & Onboarding ─────────────────────────
  const [intel,setIntel]=useState(null);
  const [intelLoaded,setIntelLoaded]=useState(false);
  const [showOnboarding,setShowOnboarding]=useState(false);

  // Load intelligence profile on session change
  useEffect(()=>{
    if(session?.token) {
      apiCall("/.netlify/functions/intelligence",{action:"get"},session.token)
        .then(r=>{
          if(r.profile) { setIntel(r.profile); setShowOnboarding(!r.profile.onboarding_complete); }
          else { setShowOnboarding(true); }
          setIntelLoaded(true);
        })
        .catch(()=>setIntelLoaded(true));
    } else {
      // Not signed in — check localStorage for local profile or onboarding skip
      const localIntel = localStorage.getItem("aiveree_local_intel");
      if(localIntel) {
        try { const parsed = JSON.parse(localIntel); setIntel(parsed); setShowOnboarding(false); } catch { setShowOnboarding(true); }
      } else {
        const skipped = localStorage.getItem("aiveree_onboarding_skipped");
        setShowOnboarding(!skipped);
      }
      setIntelLoaded(true);
    }
  },[session]);

  const handleOnboardingComplete = (conversationData) => {
    setShowOnboarding(false);
    if(!session?.token) {
      localStorage.setItem("aiveree_onboarding_skipped","1");
      // For non-signed-in users, build a local profile from conversation data
      if(conversationData) {
        const localProfile = {
          onboarding_complete: true,
          goal: conversationData.goal || "",
          name: conversationData.name || "",
          profile_summary: conversationData.summary || "",
        };
        setIntel(localProfile);
        localStorage.setItem("aiveree_local_intel", JSON.stringify(localProfile));
      }
    } else {
      // Reload intelligence profile from Supabase
      apiCall("/.netlify/functions/intelligence",{action:"get"},session.token)
        .then(r=>{ if(r.profile) setIntel(r.profile); })
        .catch(()=>{});
    }
  };

  const all=[...liveTools,...extras];

  // Fetch live tools from Supabase in background — seamless update
  useEffect(()=>{
    (async()=>{
      try {
        setToolsLoading(true);
        const res = await fetch("/.netlify/functions/tools");
        if(res.ok) {
          const data = await res.json();
          if(data.tools && data.tools.length > 0) {
            // Map Supabase snake_case back to camelCase for compatibility
            const mapped = data.tools.map(t=>({
              ...t,
              bestFor: t.best_for || [],
              pricing: { free: t.pricing_free || '', paid: t.pricing_paid || '' },
              freeLimit: t.free_limit || '',
              weeklyGrowth: t.weekly_growth || '+0%',
              newThis: t.new_this || false,
              useCases: t.use_cases || [],
            }));
            setLiveTools(mapped);
          }
        }
      } catch(e) {
        // Silent fail — keep using hardcoded tools
        console.log('Using cached tool data');
      } finally {
        setToolsLoading(false);
      }
    })();
  },[]);

  useEffect(()=>{(async()=>{
    const s=await store.get("aivey-guide");if(s)setStack(s);
    const v=await store.get("aivey-vault");if(v)setVault(v);
    const sub=await store.get("aivey-sub");if(sub)setSubscriber(sub);
    const ep=await store.get("aivey-extras");if(ep)setExtras(ep);
    const rpt=await store.get("aivey-report");if(rpt)setReport(rpt);
  })();},[]);

  useEffect(()=>{ store.set("aivey-guide",stack); },[stack]);
  useEffect(()=>{ store.set("aivey-vault",vault); },[vault]);
  useEffect(()=>{ if(subscriber)store.set("aivey-sub",subscriber); },[subscriber]);
  useEffect(()=>{ store.set("aivey-extras",extras); },[extras]);
  useEffect(()=>{ if(report)store.set("aivey-report",report); },[report]);

  const toggleStack=p=>setStack(s=>s.find(x=>x.id===p.id)?s.filter(x=>x.id!==p.id):[...s,p]);
  const toggleCmp=p=>{ if(cmp.find(x=>x.id===p.id)){setCmp(cmp.filter(x=>x.id!==p.id));return;} if(cmp.length>=2)return; setCmp([...cmp,p]);setTab("compare");setMobileMenu(false); };
  const saveIdea=msgs=>setVault(v=>[{messages:msgs,date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}),id:Date.now()},...v]);
  const doSubmit=async()=>{ if(!subForm.name||!subForm.link||!subForm.desc)return;setSubBusy(true);await new Promise(r=>setTimeout(r,1100));setSubDone(true);setSubBusy(false);setSubForm({name:"",company:"",link:"",category:"Writing",desc:"",who:""});setTimeout(()=>setSubDone(false),4000); };
  const genReport=async()=>{ setReportBusy(true);const r=await claude([{role:"user",content:"Write the Aiveree monthly AI trends report"}],REPORT_PROMPT,true);setReport(r);setReportBusy(false); };

  const filtered=all
    .filter(p=>cat==="All"||p.category===cat)
    .filter(p=>sort==="trending"?p.trending:true)
    .filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.description.toLowerCase().includes(q.toLowerCase())||p.tags?.some(t=>t.includes(q.toLowerCase())))
    .sort((a,b)=>sort==="popularity"||sort==="trending"?b.popularity-a.popularity:sort==="growth"?parseFloat(b.weeklyGrowth||0)-parseFloat(a.weeklyGrowth||0):a.name.localeCompare(b.name));

  const TABS=[
    {id:"discover",label:"🔭 Discover"},
    {id:"advisor",label:"🎯 Advisor"},
    {id:"idealab",label:"💡 Idea Lab"},
    {id:"trends",label:"📊 Trends"},
    {id:"reports",label:"📋 Free Reports"},
    {id:"stack",label:`🧱 Layer${stack.length?` (${stack.length})`:""}`},
    {id:"compare",label:`⚖️ Compare${cmp.length?` (${cmp.length})`:""}`},
    {id:"vault",label:`🗄️ Vault${vault.length?` (${vault.length})`:""}`},
    {id:"pro",label:isPro?"⭐ Pro":"⭐ Go Pro"},
    {id:"journey",label:"🗺️ My Journey"},
    {id:"mydata",label:"🔒 My Data"},
    {id:"digest",label:"📬 Digest"},
  ];
  const nav=t=>{setTab(t);setMobileMenu(false);};

  return (
    <div style={{minHeight:"100vh",background:"#FAFAFA",color:"#1a1523",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(167,139,250,0.25);border-radius:3px;}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        .skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#fafafa 50%,#f0f0f0 75%);background-size:600px 100%;animation:shimmer 1.4s infinite linear;border-radius:12px;}
        input::placeholder,textarea::placeholder{color:rgba(26,21,35,.3);}
        select option{background:#fff;}
        a{text-decoration:none;}
      `}</style>

      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-10%",left:"20%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(124,58,237,.04),transparent 70%)"}}/>
        <div style={{position:"absolute",bottom:"5%",right:"8%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(167,139,250,.03),transparent 70%)"}}/>
        <div style={{position:"absolute",top:"40%",left:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(192,132,252,.03),transparent 70%)"}}/>
      </div>

      <div style={{position:"relative",zIndex:1}}>

        {/* TICKER */}
        <div style={{background:"#ffffff",borderBottom:"1px solid rgba(124,58,237,0.08)",padding:"6px 0",overflow:"hidden"}}>
          <div style={{display:"flex",animation:"marquee 40s linear infinite",width:"max-content"}}>
            {[...WEEKLY_NEWS,...WEEKLY_NEWS].map((n,i)=>(
              <span key={i} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"0 32px",fontSize:15,color:"#6b6478",whiteSpace:"nowrap"}}>
                <span style={{background:"rgba(124,58,237,0.08)",color:"#7c3aed",fontWeight:700,padding:"2px 7px",borderRadius:20,fontSize:9,fontWeight:800}}>{n.tag}</span>
                {n.date} — {n.title}
              </span>
            ))}
          </div>
        </div>

        {/* HEADER */}
        <header style={{background:"#ffffff",borderBottom:"1px solid rgba(0,0,0,0.06)",position:"sticky",top:0,zIndex:50,boxShadow:"0 1px 8px rgba(0,0,0,0.03)"}}>
          <div style={{display:"flex",alignItems:"center",height:54,padding:`0 ${mobile?12:20}px`,gap:0}}>

            {/* LOGO — fixed, never shrinks */}
            <div onClick={()=>nav("discover")} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0,marginRight:12}}>
              <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#a78bfa)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#ffffff"}}>Ai</div>
              {!mobile&&<span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:900,letterSpacing:-0.5,color:"#1a1523",whiteSpace:"nowrap"}}>Aiveree</span>}
              <span style={{fontSize:9,background:"rgba(124,58,237,0.08)",color:"#7c3aed",padding:"1px 5px",borderRadius:8,fontWeight:700}}>BETA</span>
            </div>

            {/* NAV TABS — takes all remaining space, scrolls if needed */}
            {!mobile&&(
              <nav style={{flex:1,minWidth:0,display:"flex",overflowX:"auto",scrollbarWidth:"none"}}>
                {TABS.map(t=>(
                  <button key={t.id} onClick={()=>nav(t.id)} style={{
                    background:"transparent",
                    border:"none",
                    borderBottom:tab===t.id?"2px solid #7c3aed":"2px solid transparent",
                    color:tab===t.id?"#1a1523":"#8a8396",
                    padding:"0 10px",
                    height:54,
                    cursor:"pointer",
                    fontSize:11,
                    fontWeight:tab===t.id?700:500,
                    whiteSpace:"nowrap",
                    flexShrink:0,
                    transition:"color .15s,border-color .15s",
                  }}>
                    {t.label}
                  </button>
                ))}
              </nav>
            )}

            {/* RIGHT SECTION — fixed, never shrinks, pushed to right */}
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:mobile?0:8}}>
              {!isPro&&!mobile&&(
                <div onClick={()=>session?setShowUpgrade("daily"):setShowUpgrade("anon")} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.12)",borderRadius:16,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap"}}>
                  <span style={{fontSize:11}}>✨</span>
                  <span style={{fontSize:11,fontWeight:600,color:"#7c3aed"}}>{credits} {credits===1?"credit":"credits"}</span>
                </div>
              )}
              {isPro&&!mobile&&(
                <div style={{background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:16,padding:"4px 10px",whiteSpace:"nowrap"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#d97706"}}>⭐ Pro</span>
                </div>
              )}
              {session ? (
                <>
                  {!mobile&&<span style={{fontSize:11,color:"#8a8396",whiteSpace:"nowrap",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis"}}>{session.user?.email?.split("@")[0]}</span>}
                  <button onClick={signOut} style={{background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.08)",borderRadius:7,padding:"5px 10px",color:"#6b6478",cursor:"pointer",fontSize:11,whiteSpace:"nowrap"}}>Sign out</button>
                </>
              ) : (
                <>
                  <button onClick={()=>setShowAuth("signin")} style={{background:"rgba(0,0,0,0.04)",border:"1px solid rgba(0,0,0,0.08)",borderRadius:7,padding:"5px 12px",color:"#3d3649",cursor:"pointer",fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>Sign in</button>
                  <button onClick={()=>setShowAuth("signup")} style={{background:"linear-gradient(135deg,#7c3aed,#a78bfa)",border:"none",borderRadius:7,padding:"5px 12px",color:"#ffffff",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>Sign up free</button>
                </>
              )}
              {mobile&&<button onClick={()=>setMobileMenu(m=>!m)} style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.12)",borderRadius:7,padding:"6px 10px",color:"#7c3aed",cursor:"pointer",fontSize:15,marginLeft:4}}>☰</button>}
            </div>

          </div>
        </header>

        {mobileMenu&&(
          <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.06)",borderRadius:12,margin:"8px 16px",padding:14,display:"flex",flexDirection:"column",gap:3,position:"relative",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.08)"}}>
            {TABS.map(t=><button key={t.id} onClick={()=>nav(t.id)} style={{background:tab===t.id?"rgba(124,58,237,0.06)":"transparent",border:tab===t.id?"1px solid rgba(124,58,237,0.12)":"1px solid transparent",color:tab===t.id?"#7c3aed":"#3d3649",borderRadius:8,padding:"10px 14px",cursor:"pointer",fontSize:15,fontWeight:tab===t.id?600:500,textAlign:"left"}}>{t.label}</button>)}
          </div>
        )}

        <main style={{maxWidth:1300,margin:"0 auto",padding:`28px ${mobile?14:28}px 80px`}}>

          {/* ── DISCOVER ── */}
          {tab==="discover"&&(
            <>
              {/* Show onboarding for first-time users */}
              {showOnboarding && intelLoaded ? (
                <OnboardingChat onComplete={handleOnboardingComplete} session={session} onCredit={session?.token ? useCredit : null}/>
              ) : (
              <>
              {/* Personalised or default hero */}
              {intel?.onboarding_complete ? (
                <PersonalisedHome intel={intel} onNav={nav} mobile={mobile} session={session}/>
              ) : (
              <div style={{textAlign:"center",marginBottom:mobile?28:44}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:20,padding:"5px 16px",fontSize:15,color:"#7c3aed",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:20}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:"#7c3aed",display:"inline-block"}}/>
                  Your AI Guide
                </div>
                <h1 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?"clamp(30px,8vw,44px)":"clamp(36px,5vw,68px)",fontWeight:900,lineHeight:1.04,letterSpacing:-3,marginBottom:18}}>
                  Find your<br/>
                  <span style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed,#c4b5fd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AI tool.</span>
                </h1>
                <p style={{fontSize:mobile?14:17,color:"#6b6478",maxWidth:520,margin:"0 auto 28px",lineHeight:1.8}}>
                  Enhance your creativity, sharpen your workflow and bring your ideas to life. Find the right AI tool for you, explained plainly.
                </p>
                <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                  <button onClick={()=>nav("idealab")} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:11,padding:"12px 24px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15}}>💡 Take an idea to the Lab →</button>
                  <button onClick={()=>nav("advisor")} style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.2)",borderRadius:11,padding:"12px 24px",color:"#1a1523",fontWeight:600,cursor:"pointer",fontSize:15}}>🎯 Get matched to a tool</button>
                </div>
              </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:36}}>
                {[{n:all.filter(p=>p.trending).length,l:"Trending Now",emoji:"🔥",action:()=>{setTab("discover");setTimeout(()=>{setDSub("browse");setCat("All");setQ("");setSort("trending");},50);}},{n:all.filter(p=>!p.pricing.free.toLowerCase().includes("no")).length,l:"Have Free Plans",emoji:"🆓",action:()=>{setTab("discover");setTimeout(()=>{setDSub("browse");setCat("All");setQ("free");setSort("popularity");},50);}},{n:all.filter(p=>p.newThis).length,l:"New This Month",emoji:"✨",action:()=>{setTab("discover");setTimeout(()=>setDSub("new"),50);}},{n:"20",l:"Top 20 List",emoji:"🏆",action:()=>{setTab("discover");setTimeout(()=>setDSub("top20"),50);}}].map(s=>(
                  <div key={s.l} onClick={s.action} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:mobile?"14px 12px":"18px 20px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.05)",cursor:"pointer",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(124,58,237,0.3)";e.currentTarget.style.boxShadow="0 4px 16px rgba(124,58,237,0.1)";e.currentTarget.style.transform="translateY(-2px)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,0.07)";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.05)";e.currentTarget.style.transform="none";}}>
                    <div style={{fontSize:18,marginBottom:4}}>{s.emoji}</div>
                    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?26:32,fontWeight:900,color:"#1a1523"}}>{s.n}</div>
                    <div style={{fontSize:15,color:"#4b4558",marginTop:4,fontWeight:600}}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",paddingBottom:4}}>
                {[{id:"browse",label:"Browse All"},{id:"top20",label:"🏆 Top 20"},{id:"new",label:"🆕 New This Week"},{id:"scan",label:"🔭 Scan for Tools"},{id:"submit",label:"+ Submit a Tool"}].map(st=>(
                  <button key={st.id} onClick={()=>setDSub(st.id)} style={{background:dSub===st.id?"#7c3aed":"#ffffff",border:dSub===st.id?"1px solid #7c3aed":"1px solid rgba(0,0,0,0.1)",color:dSub===st.id?"#ffffff":"rgba(26,21,35,0.6)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:15,fontWeight:600,whiteSpace:"nowrap"}}>
                    {st.label}
                  </button>
                ))}
              </div>

              {dSub==="browse"&&(
                <>
                  {/* Prominent search bar */}
                  <div style={{position:"relative",marginBottom:16}}>
                    <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:20,pointerEvents:"none"}}>🔍</span>
                    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search 100+ AI tools — by name, category or what you want to do…" style={{width:"100%",background:"#ffffff",border:"2px solid rgba(0,0,0,0.1)",borderRadius:14,padding:"15px 16px 15px 50px",color:"#1a1523",fontSize:16,outline:"none",boxShadow:"0 2px 16px rgba(0,0,0,0.07)",boxSizing:"border-box",transition:"all .15s"}}
                      onFocus={e=>{e.target.style.borderColor="#7c3aed";e.target.style.boxShadow="0 4px 24px rgba(124,58,237,0.15)";}}
                      onBlur={e=>{e.target.style.borderColor="rgba(0,0,0,0.1)";e.target.style.boxShadow="0 2px 16px rgba(0,0,0,0.07)";}}/>
                    {q&&<button onClick={()=>setQ("")} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.08)",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",fontSize:15,color:"#6b6478",lineHeight:1}}>×</button>}
                  </div>
                  {/* Category filters + sort */}
                  <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>
                      {CATEGORIES.map(c=><button key={c} onClick={()=>setCat(c)} style={{background:cat===c?"rgba(124,58,237,0.1)":"#ffffff",border:cat===c?"1px solid rgba(124,58,237,0.3)":"1px solid rgba(0,0,0,0.07)",color:cat===c?"#7c3aed":"rgba(26,21,35,0.55)",borderRadius:7,padding:"6px 10px",cursor:"pointer",fontSize:15,fontWeight:500}}>{c}</button>)}
                    </div>
                    <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:8,padding:"8px 11px",color:"#3d3649",fontSize:15,outline:"none",cursor:"pointer"}}>
                      <option value="popularity">Popularity</option>
                      <option value="growth">Growth</option>
                      <option value="name">A–Z</option>
                    </select>
                  </div>

                  {cat==="All"&&!q ? (
                    <>
                      {[
                        { heading:"Ready to write?",              sub:"AI that thinks, writes and reasons for you",           emoji:"✍️",  cats:["Writing"] },
                        { heading:"Get creative",                 sub:"Turn words into stunning images, music and sound",     emoji:"🎨",  cats:["Image","Audio"] },
                        { heading:"Bring ideas to life on screen",sub:"AI video. No camera, no crew, no problem",            emoji:"🎬",  cats:["Video"] },
                        { heading:"Design something beautiful",   sub:"Wireframes, websites and visual assets built with AI", emoji:"🖌️",  cats:["Design"] },
                        { heading:"Develop a digital product",    sub:"Build apps, sites and interfaces without a dev team",  emoji:"💻",  cats:["Code"] },
                        { heading:"Let AI do the work for you",   sub:"Agents and automation that run your business",        emoji:"🤖",  cats:["Agents"] },
                        { heading:"Grow your business",           sub:"AI for marketing, sales and customer success",        emoji:"📈",  cats:["Marketing","Customer Service"] },
                        { heading:"Do more in less time",         sub:"Automate the busywork. Focus on what matters",        emoji:"⚡",  cats:["Productivity"] },
                        { heading:"Dig deeper",                   sub:"Research, analyse and understand anything faster",    emoji:"🔍",  cats:["Research"] },
                        { heading:"Learn anything faster",        sub:"AI tutors, language tools and education assistants",  emoji:"🎓",  cats:["Education"] },
                        { heading:"Your money and your health",   sub:"AI for personal finance, wellness and legal queries", emoji:"💰",  cats:["Health","Finance","Legal"] },
                      ].map(section=>{
                        const sectionTools=all.filter(p=>section.cats.includes(p.category)).sort((a,b)=>b.popularity-a.popularity);
                        if(!sectionTools.length) return null;
                        return (
                          <div key={section.heading} style={{marginBottom:mobile?36:52}}>
                            <div style={{marginBottom:20,paddingBottom:14,borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
                                <span style={{fontSize:22}}>{section.emoji}</span>
                                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?18:24,fontWeight:800,letterSpacing:-0.5,color:"#1a1523"}}>{section.heading}</h2>
                              </div>
                              <p style={{fontSize:15,color:"#6b6478",marginLeft:34,lineHeight:1.6}}>{section.sub}</p>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:mobile?10:16}}>
                              {sectionTools.map(p=><Card key={p.id} p={p} onClick={setModal} onStack={toggleStack} inStack={!!stack.find(s=>s.id===p.id)} onCompare={toggleCmp} canCompare={cmp.length<2||!!cmp.find(c=>c.id===p.id)} mobile={mobile}/>)}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <>
                      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:mobile?10:16}}>
                        {filtered.map(p=><Card key={p.id} p={p} onClick={setModal} onStack={toggleStack} inStack={!!stack.find(s=>s.id===p.id)} onCompare={toggleCmp} canCompare={cmp.length<2||!!cmp.find(c=>c.id===p.id)} mobile={mobile}/>)}
                      </div>
                      {!filtered.length&&<div style={{textAlign:"center",padding:"48px 0",color:"#6b6478"}}>No tools found for "{q}".</div>}
                    </>
                  )}
                </>
              )}

              {dSub==="top20"&&(
                <div>
                  <div style={{marginBottom:28}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                      <span style={{fontSize:26}}>🏆</span>
                      <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?20:28,fontWeight:900,letterSpacing:-0.5}}>Aiveree Top 20</h2>
                    </div>
                    <p style={{fontSize:15,color:"#4b4558",marginLeft:36,lineHeight:1.7}}>The 20 AI tools our team rates as the most impactful, most accessible, and most worth your time in 2026. Reviewed and updated regularly.</p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
                    {/* Top 20 from live data — tools with top20=true, sorted by rank_position */}
                  {(()=>{
                    const top20 = all
                      .filter(t=>t.top20)
                      .sort((a,b)=>(a.rank_position||99)-(b.rank_position||99))
                      .slice(0,20);
                    // fallback to static list if Supabase data not loaded yet
                    const list = top20.length>=10 ? top20 : TOP20_IDS.map(id=>all.find(t=>t.id===id)).filter(Boolean);
                    return list.map((p,i)=>(
                        <div key={p.id} onClick={()=>setModal(p)} style={{display:"flex",alignItems:"center",gap:14,background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:12,padding:mobile?"12px 14px":"14px 18px",cursor:"pointer",transition:"all .18s"}}
                          onMouseEnter={e=>{e.currentTarget.style.background="rgba(124,58,237,0.04)";e.currentTarget.style.borderColor="rgba(124,58,237,0.2)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background="#ffffff";e.currentTarget.style.borderColor="rgba(0,0,0,0.08)";}}>
                          <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?18:22,fontWeight:900,color:i<3?"#f59e0b":"rgba(26,21,35,0.2)",minWidth:32,textAlign:"center"}}>{i+1}</div>
                          <div style={{fontSize:mobile?20:24}}>{p.logo}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?13:15,fontWeight:700,color:"#1a1523"}}>{p.name}</span>
                              <span style={{fontSize:10,color:"#6b6478",fontSize:15}}>{p.company}</span>
                              <span style={{fontSize:10,background:"rgba(124,58,237,0.08)",color:"#7c3aed",padding:"1px 7px",borderRadius:20,fontWeight:600,flexShrink:0}}>{p.category}</span>
                            </div>
                            <div style={{fontSize:15,color:"#6b6478",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.tagline}</div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:15,color:"#7c3aed",marginBottom:2}}>{p.pricing?.free?.includes("No")||p.pricing?.free?.includes("trial")?"Paid":"Free plan"}</div>
                            <div style={{fontSize:10,color:"#047857",fontWeight:700}}>{p.weeklyGrowth}</div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div style={{background:"rgba(124,58,237,0.04)",border:"1px solid rgba(124,58,237,0.12)",borderRadius:12,padding:"14px 18px",fontSize:15,color:"#6b6478",lineHeight:1.8}}>
                    🔄 <strong style={{color:"#3d3649"}}>Updated daily</strong> — Rankings are recalculated every day using real-time momentum signals. Tools are scored on popularity, user growth, free tier value, and real-world impact.
                  </div>
                </div>
              )}

              {dSub==="new"&&(
                <div>
                  <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:16,padding:24,marginBottom:22}}>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:16,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>📰 This Week in AI</div>
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {WEEKLY_NEWS.map((n,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:11,paddingBottom:12,borderBottom:i<WEEKLY_NEWS.length-1?"1px solid rgba(0,0,0,0.06)":"none"}}>
                          <span style={{background:"rgba(0,0,0,0.07)",color:"#1a1523",fontWeight:700,padding:"2px 8px",borderRadius:20,fontSize:9,fontWeight:800,flexShrink:0,marginTop:2}}>{n.tag}</span>
                          <div><div style={{fontSize:15,fontWeight:600,lineHeight:1.5}}>{n.title}</div><div style={{fontSize:15,color:"#8a8396",marginTop:2}}>{n.date} 2026</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,marginBottom:12}}>🆕 Newly Added</div>
                  <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:mobile?10:16,marginBottom:28}}>
                    {all.filter(p=>p.newThis).map(p=><Card key={p.id} p={p} onClick={setModal} onStack={toggleStack} inStack={!!stack.find(s=>s.id===p.id)} onCompare={toggleCmp} canCompare={cmp.length<2||!!cmp.find(c=>c.id===p.id)} mobile={mobile}/>)}
                  </div>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,marginBottom:12}}>⚡ Fastest Growing</div>
                  <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:mobile?10:16}}>
                    {[...all].sort((a,b)=>parseFloat(b.weeklyGrowth||0)-parseFloat(a.weeklyGrowth||0)).slice(0,4).map(p=><Card key={p.id} p={p} onClick={setModal} onStack={toggleStack} inStack={!!stack.find(s=>s.id===p.id)} onCompare={toggleCmp} canCompare={cmp.length<2||!!cmp.find(c=>c.id===p.id)} mobile={mobile}/>)}
                  </div>
                </div>
              )}

              {dSub==="scan"&&<Scanner onAdd={p=>setExtras(prev=>[...prev,p])}/>}

              {dSub==="submit"&&(
                <div style={{maxWidth:540}}>
                  <div style={{marginBottom:22}}><div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:20,fontWeight:800,marginBottom:6}}>Submit a Tool to Aiveree</div><div style={{color:"#4b4558",fontSize:15,lineHeight:1.7}}>Know an AI tool that should be on Aiveree? Help the community discover it and we'll review it for the catalog.</div></div>
                  {subDone?(
                    <div style={{background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.22)",borderRadius:14,padding:28,textAlign:"center"}}>
                      <div style={{fontSize:34,marginBottom:11}}>🎉</div>
                      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:17,fontWeight:800,color:"#34d399",marginBottom:6}}>Submission received!</div>
                      <div style={{color:"#6b6478",fontSize:15}}>We'll review and add it to the Aiveree catalog shortly.</div>
                    </div>
                  ):(
                    <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:16,padding:24,display:"flex",flexDirection:"column",gap:13}}>
                      {[{l:"Tool Name *",k:"name",ph:"e.g. Jasper AI"},{l:"Company",k:"company",ph:"e.g. Jasper Inc."},{l:"Website URL *",k:"link",ph:"https://jasper.ai"},{l:"Your name (optional)",k:"who",ph:"We'll credit you"}].map(f=>(
                        <div key={f.k}><div style={{fontSize:10,fontWeight:600,color:"#4b4558",marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>{f.l}</div><input value={subForm[f.k]} onChange={e=>setSubForm(s=>({...s,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:8,padding:"9px 12px",color:"#1a1523",fontSize:15,outline:"none"}}/></div>
                      ))}
                      <div><div style={{fontSize:10,fontWeight:600,color:"#4b4558",marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>Category</div><select value={subForm.category} onChange={e=>setSubForm(s=>({...s,category:e.target.value}))} style={{width:"100%",background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:8,padding:"9px 12px",color:"#1a1523",fontSize:15,outline:"none",cursor:"pointer"}}>{CATEGORIES.filter(c=>c!=="All").map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                      <div><div style={{fontSize:10,fontWeight:600,color:"#4b4558",marginBottom:5,textTransform:"uppercase",letterSpacing:.8}}>What does it do? *</div><textarea value={subForm.desc} onChange={e=>setSubForm(s=>({...s,desc:e.target.value}))} placeholder="Brief description of the tool and who it's for…" rows={3} style={{width:"100%",background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:8,padding:"9px 12px",color:"#1a1523",fontSize:15,outline:"none",resize:"vertical"}}/></div>
                      <button onClick={doSubmit} disabled={subBusy||!subForm.name||!subForm.link||!subForm.desc} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:10,padding:"11px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15,opacity:(!subForm.name||!subForm.link||!subForm.desc)?0.4:1}}>{subBusy?"Submitting…":"Submit to Aiveree →"}</button>
                    </div>
                  )}
                </div>
              )}
            </>
            )}
          </>
          )}

          {/* ── ADVISOR ── */}
          {tab==="advisor"&&(
            <div style={{maxWidth:760,margin:"0 auto"}}>
              {/* Header */}
              <div style={{textAlign:"center",marginBottom:28}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,rgba(124,58,237,0.08),rgba(192,132,252,0.08))",border:"1px solid rgba(124,58,237,0.15)",borderRadius:16,padding:"10px 20px",marginBottom:16}}>
                  <span style={{fontSize:28}}>🎯</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:800,color:"#1a1523"}}>AI Tool Advisor</div>
                    <div style={{fontSize:15,color:"#7c3aed",fontWeight:600}}>Powered by Aiveree + Claude</div>
                  </div>
                  {/* ElevenLabs voice placeholder — coming soon */}
                  <button title="Voice mode — coming soon" style={{marginLeft:8,background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:8,padding:"6px 10px",cursor:"not-allowed",opacity:0.5,fontSize:16}}>🔊</button>
                </div>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75,maxWidth:540,margin:"0 auto"}}>Tell me what you want to do and I'll find the exact right AI tools for you — explained simply, no jargon.</p>
              </div>
              {/* Suggested prompts */}
              <div style={{marginBottom:18}}>
                <div style={{fontSize:15,fontWeight:700,color:"#8a8396",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Try asking about...</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["I want to make videos without showing my face","Help me write better emails faster","I need to build an app but can't code","What's the best free AI for my small business?","I want to turn my podcast into written content","Help me create social media content in minutes"].map(p=>(
                    <button key={p} onClick={()=>{}} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:20,padding:"7px 14px",fontSize:15,color:"#3d3649",cursor:"pointer",fontWeight:500,transition:"all .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#7c3aed";e.currentTarget.style.color="#7c3aed";e.currentTarget.style.background="rgba(124,58,237,0.04)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,0.1)";e.currentTarget.style.color="#3d3649";e.currentTarget.style.background="#ffffff";}}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {/* Chat */}
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:18,padding:mobile?16:24,boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
                <Chat sys={ADVISOR_PROMPT} onCredit={useCredit} init="Hey! 👋 I'm your Aiveree tool advisor. Tell me what you're trying to accomplish and I'll find the perfect AI tools for you — explained in plain English, no jargon."/>
              </div>
              {/* Trust strip */}
              <div style={{display:"flex",justifyContent:"center",gap:mobile?16:28,marginTop:18,flexWrap:"wrap"}}>
                {["🔒 Private conversation","⚡ Instant recommendations","🆓 Free to use"].map(t=>(
                  <span key={t} style={{fontSize:15,color:"#8a8396",fontWeight:500}}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── IDEA LAB ── */}
          {tab==="idealab"&&(
            <div style={{maxWidth:820,margin:"0 auto"}}>
              {/* Header */}
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,rgba(245,158,11,0.08),rgba(192,132,252,0.08))",border:"1px solid rgba(245,158,11,0.2)",borderRadius:16,padding:"10px 20px",marginBottom:16}}>
                  <span style={{fontSize:28,animation:"float 3s ease-in-out infinite"}}>💡</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:800,color:"#1a1523"}}>Idea Lab</div>
                    <div style={{fontSize:15,color:"#b45309",fontWeight:600}}>Turn any idea into a real plan</div>
                  </div>
                  <button title="Voice mode — coming soon" style={{marginLeft:8,background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)",borderRadius:8,padding:"6px 10px",cursor:"not-allowed",opacity:0.5,fontSize:16}}>🔊</button>
                </div>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.8,maxWidth:520,margin:"0 auto"}}>Rough idea or bold vision — bring it here. Get it refined, scored on feasibility, and handed a complete AI-powered roadmap.</p>
              </div>

              {/* What you'll get */}
              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:8,marginBottom:22}}>
                {[{icon:"🔍",label:"Idea Refinement"},{icon:"📊",label:"Feasibility Score"},{icon:"🧱",label:"AI Tool Stack"},{icon:"🗺️",label:"Build Roadmap"}].map(f=>(
                  <div key={f.label} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:10,padding:"12px",textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                    <div style={{fontSize:20,marginBottom:4}}>{f.icon}</div>
                    <div style={{fontSize:15,fontWeight:700,color:"#1a1523"}}>{f.label}</div>
                  </div>
                ))}
              </div>

              {/* Chat */}
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:20,padding:mobile?16:26,boxShadow:"0 4px 24px rgba(0,0,0,0.06)",marginBottom:16}}>
                <Chat sys={IDEA_PROMPT} onCredit={useCredit} init={"Welcome to the Aiveree Idea Lab! 💡 This is your space to bring any idea — rough or refined — and I'll help you shape it, score it, and hand you a complete AI build roadmap.\n\nSo — what's the idea?"} onSave={saveIdea} prefill={ideaStarter} onPrefillUsed={()=>setIdeaStarter(null)}/>
              </div>

              {/* Idea starters */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:15,fontWeight:700,color:"#8a8396",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Need inspiration? Try one of these...</div>
                <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr 1fr",gap:8}}>
                  {[
                    {emoji:"🎙️",text:"I want to start a podcast but don't want to record my own voice"},
                    {emoji:"🏪",text:"I have a business idea but need to validate it before spending money"},
                    {emoji:"📱",text:"I want to build an app but I can't write a line of code"},
                    {emoji:"📸",text:"I want to grow my Instagram with AI but keep it authentic"},
                    {emoji:"📚",text:"I want to turn my knowledge into an online course"},
                    {emoji:"🤖",text:"I want to automate my business admin to save 10 hours a week"},
                  ].map(ex=>(
                    <div key={ex.text} onClick={()=>setIdeaStarter(ex.text)} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:10,padding:"12px 14px",fontSize:15,color:"#3d3649",lineHeight:1.65,cursor:"pointer",transition:"all .15s",display:"flex",gap:8,alignItems:"flex-start"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#7c3aed";e.currentTarget.style.background="rgba(124,58,237,0.03)";e.currentTarget.style.boxShadow="0 2px 12px rgba(124,58,237,0.08)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(0,0,0,0.08)";e.currentTarget.style.background="#ffffff";e.currentTarget.style.boxShadow="none";}}>
                      <span style={{fontSize:16,flexShrink:0}}>{ex.emoji}</span>
                      <span style={{fontStyle:"italic"}}>"{ex.text}"</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TRENDS ── */}
          {tab==="trends"&&(
            <div style={{maxWidth:860,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:36}}>
                <div style={{fontSize:15,color:"#6b6478",fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>March 2026 · Aiveree Monthly Report</div>
                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?26:36,fontWeight:900,marginBottom:8,letterSpacing:-1}}>AI Trends Report</h2>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.7,marginBottom:20}}>What's growing, what's shifting, and where the AI market is heading — written fresh by AI, every time.</p>
                <button onClick={genReport} disabled={reportBusy} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:10,padding:"11px 22px",color:"#1a1523",fontWeight:700,cursor:"pointer",fontSize:15}}>
                  {reportBusy?"Generating report…":report?"🔄 Regenerate Report":"✨ Generate AI Report"}
                </button>
                {reportBusy&&<div style={{marginTop:12,color:"#4b4558",fontSize:15}}>Writing a fresh, live analysis of the AI landscape…</div>}
              </div>
              {report&&(
                <div style={{background:"rgba(167,139,250,0.04)",border:"1px solid rgba(167,139,250,0.15)",borderRadius:18,padding:mobile?18:32,marginBottom:24}}>
                  <div style={{fontSize:15,color:"rgba(167,139,250,0.7)",fontWeight:700,marginBottom:16,textTransform:"uppercase",letterSpacing:1}}>✦ Aiveree AI-Generated Report · March 2026</div>
                  <div style={{color:"#1a1523",fontSize:15,lineHeight:1.9}}><MD text={report}/></div>
                </div>
              )}
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:16,padding:mobile?16:28,marginBottom:20}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:18,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>📈 Category Growth</div>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {[{label:"Agentic AI",growth:340,color:"#7c3aed"},{label:"Voice & Audio",growth:210,color:"#8b5cf6"},{label:"Video Generation",growth:185,color:"#7c3aed"},{label:"AI Coding",growth:160,color:"#8b5cf6"},{label:"Multimodal Models",growth:145,color:"#ddd6fe"}].map(t=>(
                    <div key={t.label}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:700,fontSize:15}}>{t.label}</span><span style={{color:t.color,fontWeight:800,fontSize:15}}>+{t.growth}%</span></div>
                      <div style={{height:4,background:"#ffffff",borderRadius:2}}><div style={{width:`${Math.min(t.growth/4,100)}%`,height:"100%",background:t.color,borderRadius:2,opacity:.8}}/></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:12,marginBottom:20}}>
                {[{icon:"🚀",title:"Model War Intensifies",body:"OpenAI, Anthropic, Google, and Meta are shipping major model updates quarterly. Capability gaps that lasted years now close in weeks."},{icon:"💰",title:"Pricing Drops Across the Board",body:"Free tiers are getting more generous as competition intensifies. Tools that were paid-only in 2024 now have free plans."},{icon:"🏢",title:"Enterprise Adoption Surges",body:"Fortune 500 AI adoption rose 340% YoY. Legal, finance, and healthcare are the fastest-moving sectors."},{icon:"🧩",title:"The Rise of AI Layering",body:"Businesses now run 3–5 AI tools per workflow rather than relying on one. Integration and automation tools are surging alongside them."}].map(ins=>(
                  <div key={ins.title} style={{background:"rgba(167,139,250,0.04)",border:"1px solid rgba(167,139,250,0.1)",borderRadius:13,padding:18}}>
                    <div style={{fontSize:22,marginBottom:8}}>{ins.icon}</div>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:5,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>{ins.title}</div>
                    <div style={{color:"#3d3649",fontSize:15,lineHeight:1.7}}>{ins.body}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:16,padding:mobile?16:24}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:16,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>🔥 Hottest on Aiveree This Month</div>
                <div style={{display:"flex",flexDirection:"column",gap:11}}>
                  {all.filter(p=>p.trending).slice(0,7).map((p,i)=>(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:11,cursor:"pointer",paddingBottom:11,borderBottom:"1px solid rgba(0,0,0,0.06)"}} onClick={()=>setModal(p)}>
                      <div style={{width:20,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:900,color:"#8a8396",fontSize:15}}>#{i+1}</div>
                      <div style={{fontSize:19}}>{p.logo}</div>
                      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:"#1a1523"}}>{p.name}</div><div style={{fontSize:15,color:"#6b6478"}}>{p.tagline}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:15,color:"#7c3aed",fontWeight:700}}>{p.popularity}%</div><div style={{fontSize:10,color:"#34d399"}}>{p.weeklyGrowth}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── FREE REPORTS ── */}
          {tab==="reports"&&(
            <div style={{maxWidth:860,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:32}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:20,padding:"6px 16px",marginBottom:16}}>
                  <span style={{fontSize:15,fontWeight:700,color:"#047857",letterSpacing:1,textTransform:"uppercase"}}>Free for Everyone</span>
                </div>
                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?26:36,fontWeight:900,marginBottom:8,color:"#1a1523"}}>AI Guides & Reports</h2>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75,maxWidth:520,margin:"0 auto"}}>Fresh AI reports and practical guides generated weekly. No signup needed. Just useful, plain-English insights on the tools that matter.</p>
              </div>

              {/* Report generator */}
              <ReportsPage all={all}/>
            </div>
          )}

          {/* ── STACK / LAYER ── */}
          {tab==="stack"&&(
            <div style={{maxWidth:900,margin:"0 auto"}}>
              <div style={{marginBottom:28}}>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,marginBottom:8}}>🧱 Your AI Layer</div>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75}}>Add tools from Discover using the "+ Layer" button. Build your personal AI stack, then run an analysis to understand how they work together — and copy it to share with anyone.</p>
              </div>
              <StackBuilder stack={stack} onRemove={id=>setStack(stack.filter(s=>s.id!==id))} onClear={()=>setStack([])}/>
              {stack.length>0&&<div style={{marginTop:28}}>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,marginBottom:14}}>Suggested additions for your layer</div>
                <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:mobile?10:15}}>
                  {all.filter(p=>!stack.find(s=>s.id===p.id)).slice(0,3).map(p=><Card key={p.id} p={p} onClick={setModal} onStack={toggleStack} inStack={false} onCompare={toggleCmp} canCompare={cmp.length<2||!!cmp.find(c=>c.id===p.id)} mobile={mobile}/>)}
                </div>
              </div>}
            </div>
          )}

          {/* ── COMPARE ── */}
          {tab==="compare"&&(
            <div style={{maxWidth:900,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:28}}>
                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,marginBottom:8}}>⚖️ Head-to-Head</h2>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75}}>Pick any two AI tools and get an honest, AI-powered verdict on which is right for you.</p>
              </div>
              {/* Tool pickers */}
              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr auto 1fr",gap:12,alignItems:"flex-start",marginBottom:24}}>
                <ToolPicker label="Tool A" value={cmp[0]||null} all={all} onChange={t=>setCmp(prev=>{const b=prev[1]||null;return [t,b].filter(Boolean);})}/>
                <div style={{textAlign:"center",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:900,fontSize:22,color:"#7c3aed",paddingTop:36}}>vs</div>
                <ToolPicker label="Tool B" value={cmp[1]||null} all={all} onChange={t=>setCmp(prev=>{const a=prev[0]||null;return [a,t].filter(Boolean);})}/>
              </div>
              <ComparePanel list={cmp} onRemove={id=>setCmp(cmp.filter(c=>c.id!==id))} onClear={()=>setCmp([])} onCredit={useCredit}/>
              {/* Preset comparisons */}
              <div style={{marginTop:28}}>
                <div style={{fontSize:15,fontWeight:700,color:"#6b6478",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Popular comparisons</div>
                <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
                  {[[1,2],[4,5],[6,7],[15,17],[8,45],[26,24],[10,4],[3,1]].map(([aId,bId])=>{
                    const a=all.find(p=>p.id===aId),b=all.find(p=>p.id===bId);
                    if(!a||!b)return null;
                    const isActive=cmp[0]?.id===aId&&cmp[1]?.id===bId;
                    return(
                      <button key={`${aId}-${bId}`} onClick={()=>setCmp([a,b])} style={{background:isActive?"rgba(124,58,237,0.06)":"#ffffff",border:`2px solid ${isActive?"#7c3aed":"rgba(0,0,0,0.08)"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",textAlign:"left",transition:"all .15s"}}
                        onMouseEnter={e=>{if(!isActive){e.currentTarget.style.borderColor="#7c3aed";e.currentTarget.style.boxShadow="0 2px 12px rgba(124,58,237,0.1)";}}}
                        onMouseLeave={e=>{if(!isActive){e.currentTarget.style.borderColor="rgba(0,0,0,0.08)";e.currentTarget.style.boxShadow="none";}}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:16}}>{a.logo}</span>
                          <span style={{fontSize:10,color:"#6b6478",fontWeight:600}}>vs</span>
                          <span style={{fontSize:16}}>{b.logo}</span>
                        </div>
                        <div style={{fontSize:15,fontWeight:700,color:"#1a1523",lineHeight:1.3}}>{a.name} vs {b.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── VAULT ── */}
                    {/* ── GO PRO ── */}
          {tab==="pro"&&(
            <div style={{maxWidth:860,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:40}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,rgba(192,132,252,0.1),rgba(124,58,237,0.1))",border:"1px solid rgba(124,58,237,0.2)",borderRadius:20,padding:"6px 18px",marginBottom:16}}>
                  <span style={{fontSize:15,fontWeight:700,color:"#7c3aed",letterSpacing:1,textTransform:"uppercase"}}>⭐ Aiveree Pro</span>
                </div>
                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?28:40,fontWeight:900,marginBottom:12,color:"#1a1523"}}>AI tools, properly explained.</h2>
                <p style={{color:"#4b4558",fontSize:16,lineHeight:1.75,maxWidth:520,margin:"0 auto"}}>Unlimited access to every AI feature on Aiveree — plus exclusive guides written for everyday people, not developers.</p>
              </div>

              {/* Pricing cards */}
              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:16,marginBottom:40}}>
                {/* Monthly */}
                <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:20,padding:28}}>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,color:"#6b6478",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Monthly</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                    <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:42,fontWeight:900,color:"#1a1523"}}>£3</span>
                    <span style={{color:"#6b6478",fontSize:15}}>/month</span>
                  </div>
                  <div style={{color:"#8a8396",fontSize:15,marginBottom:24}}>Cancel any time</div>
                  <button onClick={()=>setShowUpgrade("monthly")} style={{width:"100%",background:"#ffffff",border:"2px solid #1a1523",borderRadius:12,padding:"13px",color:"#1a1523",fontWeight:800,cursor:"pointer",fontSize:15,transition:"all .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#1a1523";e.currentTarget.style.color="#ffffff";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="#ffffff";e.currentTarget.style.color="#1a1523";}}>
                    Get started
                  </button>
                </div>
                {/* Annual — recommended */}
                <div style={{background:"linear-gradient(135deg,#7c3aed,#5b21b6)",border:"none",borderRadius:20,padding:28,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 12px",fontSize:15,fontWeight:700,color:"#ffffff"}}>BEST VALUE</div>
                  <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Annual</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                    <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:42,fontWeight:900,color:"#ffffff"}}>£24</span>
                    <span style={{color:"rgba(255,255,255,0.7)",fontSize:15}}>/year</span>
                  </div>
                  <div style={{color:"rgba(255,255,255,0.6)",fontSize:15,marginBottom:24}}>That's just £2/month · Save £12</div>
                  <button onClick={()=>setShowUpgrade("yearly")} style={{width:"100%",background:"#ffffff",border:"none",borderRadius:12,padding:"13px",color:"#7c3aed",fontWeight:800,cursor:"pointer",fontSize:15}}>
                    Get started
                  </button>
                </div>
              </div>

              {/* Features */}
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:20,padding:mobile?20:32,marginBottom:28}}>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:16,color:"#1a1523",marginBottom:20}}>Everything in Pro</div>
                <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:14}}>
                  {[
                    {icon:"♾️",title:"Unlimited AI conversations",desc:"Advisor and Idea Lab with no daily limits"},
                    {icon:"📋",title:"Exclusive Pro guides",desc:"In-depth reports written for non-technical people"},
                    {icon:"⚖️",title:"Unlimited comparisons",desc:"Head-to-head any two tools, as many times as you like"},
                    {icon:"📊",title:"Full Trends access",desc:"Monthly AI trends reports and market insights"},
                    {icon:"🧱",title:"Unlimited Layer stacks",desc:"Build and save as many tool stacks as you need"},
                    {icon:"🔔",title:"Early access",desc:"First to know about new tools and Aiveree features"},
                  ].map(f=>(
                    <div key={f.title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <span style={{fontSize:20,flexShrink:0,marginTop:2}}>{f.icon}</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,color:"#1a1523",marginBottom:2}}>{f.title}</div>
                        <div style={{fontSize:15,color:"#6b6478",lineHeight:1.5}}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Free vs Pro table */}
              <div style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:20,padding:mobile?20:32,marginBottom:28}}>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:16,color:"#1a1523",marginBottom:20}}>Free vs Pro</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:0}}>
                  {/* Header */}
                  <div style={{padding:"8px 0",borderBottom:"2px solid rgba(0,0,0,0.08)"}}></div>
                  <div style={{padding:"8px",textAlign:"center",fontWeight:700,fontSize:15,color:"#6b6478",borderBottom:"2px solid rgba(0,0,0,0.08)"}}>FREE</div>
                  <div style={{padding:"8px",textAlign:"center",fontWeight:700,fontSize:15,color:"#7c3aed",borderBottom:"2px solid rgba(0,0,0,0.08)"}}>PRO</div>
                  {[
                    {label:"AI Advisor conversations",free:"5/day",pro:"Unlimited"},
                    {label:"Idea Lab sessions",free:"5/day",pro:"Unlimited"},
                    {label:"Tool comparisons",free:"5/day",pro:"Unlimited"},
                    {label:"Tool discovery",free:"✓",pro:"✓"},
                    {label:"Free Reports",free:"✓",pro:"✓"},
                    {label:"Pro guides & reports",free:"✗",pro:"✓"},
                    {label:"Priority support",free:"✗",pro:"✓"},
                  ].map((row,i)=>(
                    <>
                      <div key={`l${i}`} style={{padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.05)",fontSize:15,color:"#3d3649"}}>{row.label}</div>
                      <div key={`f${i}`} style={{padding:"10px",textAlign:"center",borderBottom:"1px solid rgba(0,0,0,0.05)",fontSize:15,color:row.free==="✗"?"#d1d5db":"#1a1523"}}>{row.free}</div>
                      <div key={`p${i}`} style={{padding:"10px",textAlign:"center",borderBottom:"1px solid rgba(0,0,0,0.05)",fontSize:15,color:"#7c3aed",fontWeight:600}}>{row.pro}</div>
                    </>
                  ))}
                </div>
              </div>

              <div style={{textAlign:"center",fontSize:15,color:"#8a8396"}}>
                🔒 Secure payment · Cancel any time · No hidden fees
              </div>
            </div>
          )}

{tab==="vault"&&(
            <div style={{maxWidth:820,margin:"0 auto"}}>
              <div style={{marginBottom:28}}>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,marginBottom:8}}>🗄️ Idea Vault</div>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75}}>Every Idea Lab session you save lives here. Revisit, continue building, or pick up exactly where you left off.</p>
              </div>
              {vaultOpen?(
                <div>
                  <button onClick={()=>setVaultOpen(null)} style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",borderRadius:8,padding:"7px 14px",color:"#4b4558",cursor:"pointer",fontSize:15,marginBottom:20}}>← Back to Vault</button>
                  <div style={{background:"#ffffff",border:"1px solid rgba(167,139,250,0.12)",borderRadius:18,padding:mobile?16:26}}>
                    <Chat sys={IDEA_PROMPT} onCredit={useCredit} init={"Welcome back to Aiveree! 💡 Continue your saved session or explore new directions."} onSave={saveIdea}/>
                  </div>
                </div>
              ):<Vault vault={vault} onDelete={i=>setVault(vault.filter((_,idx)=>idx!==i))} onReopen={item=>setVaultOpen(item)} onNew={()=>nav("idealab")}/>}
            </div>
          )}

          {/* ── DIGEST ── */}
          {/* ── MY JOURNEY ── */}
          {tab==="journey"&&(
            <JourneyTimeline intel={intel} session={session} vault={vault} mobile={mobile}/>
          )}

          {/* ── MY DATA ── */}
          {tab==="mydata"&&(
            <DataTransparency intel={intel} session={session} mobile={mobile}/>
          )}

          {tab==="digest"&&(
            <div style={{maxWidth:680,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:32}}>
                <div style={{fontSize:38,marginBottom:11}}>📬</div>
                <h2 style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:mobile?24:32,fontWeight:900,marginBottom:8}}>The Aiveree Weekly</h2>
                <p style={{color:"#4b4558",fontSize:15,lineHeight:1.75}}>The best new AI tools, monthly trend reports, and Idea Lab tips — delivered weekly. Free, always. No spam.</p>
              </div>
              <EmailSignup onSave={sub=>setSubscriber(sub)} saved={!!subscriber}/>
              {subscriber&&(
                <div style={{marginTop:20,background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:18}}>
                  <div style={{fontSize:15,color:"#6b6478",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Your subscription</div>
                  <div style={{color:"#3d3649",fontSize:15,marginBottom:8}}>👤 {subscriber.name} · {subscriber.email}</div>
                  {subscriber.prefs.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>{subscriber.prefs.map(p=><span key={p} style={{background:"rgba(167,139,250,0.08)",color:"rgba(167,139,250,0.7)",padding:"3px 10px",borderRadius:20,fontSize:15}}>{p}</span>)}</div>}
                </div>
              )}
              <div style={{marginTop:24,background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",borderRadius:13,padding:20}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:14,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>What lands in your inbox</div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {[{icon:"🔥",title:"Weekly Hot Tools",desc:"Top 5 new and trending AI tools discovered each week on Aiveree"},{icon:"📊",title:"Monthly Trends Report",desc:"AI-written deep dive on what's shifting in the AI product space"},{icon:"💡",title:"Idea Lab Tips",desc:"Prompts and frameworks to get more from your Aiveree sessions"},{icon:"⚡",title:"Breaking AI News",desc:"The 3 most important AI developments you need to know"}].map(item=>(
                    <div key={item.title} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                      <div><div style={{fontWeight:600,fontSize:15,marginBottom:2}}>{item.title}</div><div style={{fontSize:15,color:"#4b4558",lineHeight:1.6}}>{item.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ── FOOTER ── */}
        <footer role="contentinfo" style={{background:"#ffffff",borderTop:"1px solid rgba(0,0,0,0.06)",padding:`28px ${mobile?14:28}px`,marginTop:0}}>
          <div style={{maxWidth:1300,margin:"0 auto",display:"flex",flexDirection:mobile?"column":"row",gap:mobile?20:0,justifyContent:"space-between",alignItems:mobile?"flex-start":"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#ffffff"}} aria-hidden="true">Ai</div>
              <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:15,fontWeight:900,color:"#1a1523",letterSpacing:-.5}}>Aiveree</span>
              <span style={{fontSize:15,color:"#6b6478"}}>· Find your AI tool. · © 2026</span>
              {/* Hidden admin trigger — triple click the copyright */}
              <span onClick={()=>setShowAdmin(true)} style={{fontSize:10,color:"transparent",cursor:"default",userSelect:"none",marginLeft:4}}>·</span>
            </div>
            <nav aria-label="Legal pages" style={{display:"flex",gap:mobile?16:28,flexWrap:"wrap"}}>
              {[
                {label:"Privacy Policy",href:"/privacy.html"},
                {label:"Terms of Use",href:"/terms.html"},
                {label:"Cookie Policy",href:"/cookies.html"},
                {label:"Contact",href:"mailto:hello@aiveree.com"},
              ].map(l=>(
                <a key={l.label} href={l.href} style={{fontSize:15,color:"#6b6478",textDecoration:"none",transition:"color .15s"}}
                  onMouseEnter={e=>e.target.style.color="#7c3aed"} onMouseLeave={e=>e.target.style.color="rgba(26,21,35,0.4)"}>
                  {l.label}
                </a>
              ))}
            </nav>
            <div style={{fontSize:15,color:"#6b6478",maxWidth:320,lineHeight:1.6}}>
              Tool pricing and features change frequently. Always verify directly with each provider before purchasing.
            </div>
          </div>
        </footer>

        {/* Admin panel — hidden, triggered from footer */}
        {showAdmin&&<AdminPanel onClose={()=>setShowAdmin(false)}/>}

      </div>

      {/* ── MODAL ── */}
      <Modal p={modal} onClose={()=>setModal(null)}/>

      {/* ── AUTH MODAL ── */}
      {showAuth&&(
        <AuthModal
          mode={showAuth}
          onClose={()=>setShowAuth(null)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* ── COOKIE BANNER ── */}
      <CookieBanner/>
    </div>
  );
}

// ─── COOKIE BANNER ────────────────────────────────────────────────────────────
function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(()=>{
    try {
      const consent = localStorage.getItem("aivey-cookie-consent");
      if (!consent) setVisible(true);
    } catch { /* storage blocked */ }
  },[]);

  const accept = (all) => {
    try {
      localStorage.setItem("aivey-cookie-consent", all ? "all" : "necessary");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Cookie consent" style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:2000,
      background:"#1a1523", borderTop:"2px solid rgba(124,58,237,0.4)",
      padding:"20px 24px",
    }}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        {!showDetail ? (
          <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"center",justifyContent:"space-between"}}>
            <div style={{flex:1,minWidth:280}}>
              <p style={{fontSize:15,color:"rgba(255,255,255,0.9)",lineHeight:1.7,margin:0}}>
                Aiveree uses browser local storage to save your AI stack and Idea Vault between visits. No advertising cookies. No tracking.{" "}
                <button onClick={()=>setShowDetail(true)} style={{background:"none",border:"none",color:"#c084fc",cursor:"pointer",fontSize:15,padding:0,textDecoration:"underline"}}>Learn more</button>{" "}
                or read our <a href="/cookies.html" style={{color:"#c084fc",fontSize:15}}>Cookie Policy</a>.
              </p>
            </div>
            <div style={{display:"flex",gap:10,flexShrink:0,flexWrap:"wrap"}}>
              <button onClick={()=>accept(false)} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:9,padding:"10px 20px",color:"#ffffff",cursor:"pointer",fontSize:15,fontWeight:600}}>
                Necessary only
              </button>
              <button onClick={()=>accept(true)} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:9,padding:"10px 24px",color:"#ffffff",cursor:"pointer",fontSize:15,fontWeight:700}}>
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:16,fontWeight:700,color:"#ffffff"}}>Cookie settings</div>
              <button onClick={()=>setShowDetail(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:20}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              {[
                {title:"Strictly necessary",desc:"Browser local storage for your AI stack, Idea Vault, and preferences. Required for core features to work.",locked:true},
                {title:"Analytics (optional)",desc:"Anonymous, aggregated usage data to understand how the platform is used. No personal identifiers.",locked:false},
              ].map(c=>(
                <div key={c.title} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,background:"#ffffff",borderRadius:10,padding:"14px 16px"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:15,marginBottom:4,color:"#1a1523"}}>{c.title}</div>
                    <div style={{fontSize:15,color:"#6b6478",lineHeight:1.6}}>{c.desc}</div>
                  </div>
                  <div style={{flexShrink:0,fontSize:15,color:c.locked?"#059669":"rgba(26,21,35,0.4)",fontWeight:600,marginTop:2}}>{c.locked?"Always on":"Optional"}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button onClick={()=>accept(false)} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:9,padding:"10px 20px",color:"#ffffff",cursor:"pointer",fontSize:15,fontWeight:600}}>Save necessary only</button>
              <button onClick={()=>accept(true)} style={{background:"linear-gradient(135deg,#c084fc,#7c3aed)",border:"none",borderRadius:9,padding:"10px 24px",color:"#ffffff",cursor:"pointer",fontSize:15,fontWeight:700}}>Accept all</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
