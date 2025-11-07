#!/usr/bin/env node
// Local simulation to verify Deepseek server-side path without external network calls.
// It mocks fetch and runs the same text-handling logic used in `api/extract-text.ts`.

const apiKey = process.env.DEEPSEEK_API_KEY || 'dummy-key';
if (!process.env.DEEPSEEK_API_KEY) console.log('DEEPSEEK_API_KEY not set; using dummy-key for simulation');

// Mock global.fetch to simulate Deepseek API response
global.fetch = async (url, opts) => {
  console.log('[mock fetch] URL:', url);
  // Optionally inspect opts.body to ensure payload shape
  try {
    const body = JSON.parse(opts.body || '{}');
    console.log('[mock fetch] payload example:', JSON.stringify({ model: body.model, messages: body.messages?.slice(0,1) }));
  } catch (e) {}

  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Mocked Deepseek Title' } }] }),
    text: async () => JSON.stringify({ choices: [{ message: { content: 'Mocked Deepseek Title' } }] }),
    body: {
      getReader: () => ({
        read: async () => ({ done: true, value: undefined })
      })
    }
  };
};

function getTextTaskPrompt(task, text) {
  switch (task) {
    case 'summarize':
      return `Summarize the following text in one or two paragraphs. Focus on the key points and main arguments. The text is: "${text}"`;
    case 'title':
    default:
      return `Generate a concise, descriptive title (5 words or less) for the following document. Do not use quotation marks in the title. The document text is: "${text}"`;
  }
}

async function handleOpenAICompatibleText(body, apiUrl, model, apiKeyParam) {
  const payload = { model, messages: [{ role: 'user', content: getTextTaskPrompt(body.task, body.text) }], stream: false };
  const apiResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyParam}` }, body: JSON.stringify(payload) });
  if (!apiResponse.ok) throw new Error(`API error: ${apiResponse.status} ${await apiResponse.text()}`);
  const json = await apiResponse.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
}

(async () => {
  const body = { text: 'This is a quick test document about AI testing.', task: 'title', llm: 'deepseek' };
  try {
    const deepseekApiKey = apiKey;
    const result = await handleOpenAICompatibleText(body, 'https://api.deepseek.com/chat/completions', 'deepseek-chat', deepseekApiKey);
    console.log('\nSimulation result:', result);
    process.exit(0);
  } catch (e) {
    console.error('Simulation error:', e);
    process.exit(1);
  }
})();
