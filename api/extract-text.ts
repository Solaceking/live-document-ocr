// This file should be placed in `api/extract-text.ts`
// It's a Vercel Serverless Function that acts as a secure backend router for multiple LLM APIs.
// It handles both streaming image OCR and non-streaming text processing tasks.

interface VercelRequest {
    method?: string;
    body: any;
}

interface VercelResponse {
    headersSent: boolean;
    status: (statusCode: number) => VercelResponse;
    setHeader: (name: string, value: string | string[]) => void;
    write: (chunk: any) => boolean;
    end: (cb?: () => void) => void;
    send: (body: any) => void;
}

interface ImageRequestBody {
    image: string; // base64 encoded image
    mimeType: string;
    context: string;
    quality: string;
    llm: 'gemini' | 'deepseek' | 'openai' | string;
}

interface TextRequestBody {
    text: string;
    task: 'summarize' | 'title';
    llm: 'gemini' | 'deepseek' | 'openai' | string;
}

// --- PROMPT GENERATION ---

const getOcrPrompt = (context: string): string => {
  const baseInstruction = "You are an expert OCR engine. Extract all text from the image. Format the output as clean, semantic HTML. Use tags like `<p>`, `<h1>`, `<h2>`, `<ul>`, `<li>`, `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`, `<strong>`, and `<em>`. Preserve the original formatting as much as possible. Do not include `<html>`, `<head>`, or `<body>` tags in your response. Only output the extracted content as HTML.";
  switch (context) {
    case 'receipt': return `Extract all items, prices, and the total amount from this receipt. Structure the output as an HTML table. ${baseInstruction}`;
    case 'handwriting': return `Transcribe the handwritten text from this image. Use <p> and <br> tags to preserve the original line breaks and layout. ${baseInstruction}`;
    case 'book': return `Extract the text from this page of a book or article. Maintain the original paragraph structure, headings, and any lists accurately using appropriate HTML tags. ${baseInstruction}`;
    case 'whiteboard': return `Transcribe the text and diagrams from this whiteboard. Pay attention to the layout, bullet points, and any drawn structures to capture the content as accurately as possible using HTML. ${baseInstruction}`;
    case 'quiz': return `Extract the multiple-choice questions from this image. Format each question using an <ol> for the questions and a <ul> for the options. Preserve the lettering (e.g., A, B, C) for each option. ${baseInstruction}`;
    default: return `${baseInstruction}`;
  }
};

const getTextTaskPrompt = (task: 'summarize' | 'title', text: string): string => {
    switch(task) {
        case 'summarize':
            return `Summarize the following text in one or two paragraphs. Focus on the key points and main arguments. The text is: "${text}"`;
        case 'title':
            return `Generate a concise, descriptive title (5 words or less) for the following document. Do not use quotation marks in the title. The document text is: "${text}"`;
    }
}

// --- STREAMING HANDLERS (for OCR) ---

const handleOpenAICompatibleStream = async (res: VercelResponse, body: ImageRequestBody, apiUrl: string, model: string, apiKey: string) => {
    const payload = { model, messages: [{ role: "user", content: [{ type: "text", text: getOcrPrompt(body.context) }, { type: "image_url", image_url: { url: `data:${body.mimeType};base64,${body.image}` } }] }], stream: true };
    const apiResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
    if (!apiResponse.ok) throw new Error(`API error: ${apiResponse.status} ${await apiResponse.text()}`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const reader = apiResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data.trim() === '[DONE]') continue;
                try {
                    const json = JSON.parse(data);
                    const textChunk = json.choices[0]?.delta?.content;
                    if (textChunk) res.write(textChunk);
                } catch (e) { console.error('Error parsing stream JSON:', e); }
            }
        }
    }
};

const handleGeminiStream = async (res: VercelResponse, body: ImageRequestBody, apiKey: string) => {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:streamGenerateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: getOcrPrompt(body.context) }, { inline_data: { mime_type: body.mimeType, data: body.image } }] }] };
    const apiResponse = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!apiResponse.ok) throw new Error(`Gemini API error: ${apiResponse.status} ${await apiResponse.text()}`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const reader = apiResponse.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        try {
            const jsonArray = JSON.parse(chunk.replace(/^data: /, ''));
            const textChunk = jsonArray[0]?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textChunk) res.write(textChunk);
        } catch (e) { console.error('Error parsing Gemini stream chunk:', e, 'Chunk:', chunk); }
    }
};

// --- NON-STREAMING HANDLERS (for Text Tasks) ---

const handleOpenAICompatibleText = async (body: TextRequestBody, apiUrl: string, model: string, apiKey: string): Promise<string> => {
    const payload = { model, messages: [{ role: "user", content: getTextTaskPrompt(body.task, body.text) }], stream: false };
    const apiResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
    if (!apiResponse.ok) throw new Error(`API error: ${apiResponse.status} ${await apiResponse.text()}`);
    const json = await apiResponse.json();
    return json.choices[0]?.message?.content?.trim() || '';
};

const handleGeminiText = async (body: TextRequestBody, apiKey: string): Promise<string> => {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: getTextTaskPrompt(body.task, body.text) }] }] };
    const apiResponse = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!apiResponse.ok) throw new Error(`Gemini API error: ${apiResponse.status} ${await apiResponse.text()}`);
    const json = await apiResponse.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
};

// --- MAIN HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).send({ error: 'Method Not Allowed' });
    }

    try {
        // --- TEXT PROCESSING ROUTE ---
        if (req.body.task && req.body.text) {
            const body = req.body as TextRequestBody;
            let result = '';
            switch (body.llm) {
                case 'deepseek':
                    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
                    if (!deepseekApiKey) throw new Error('DEEPSEEK_API_KEY is not configured.');
                    result = await handleOpenAICompatibleText(body, "https://api.deepseek.com/chat/completions", "deepseek-chat", deepseekApiKey);
                    break;
                case 'openai':
                    const openaiApiKey = process.env.OPENAI_API_KEY;
                    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not configured.');
                    result = await handleOpenAICompatibleText(body, "https://api.openai.com/v1/chat/completions", "gpt-4o-mini", openaiApiKey);
                    break;
                case 'gemini':
                default:
                    const geminiApiKey = process.env.GEMINI_API_KEY;
                    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');
                    result = await handleGeminiText(body, geminiApiKey);
                    break;
            }
            return res.status(200).send({ result });
        }

        // --- IMAGE OCR ROUTE ---
        if (req.body.image) {
            const body = req.body as ImageRequestBody;
            switch (body.llm) {
                case 'deepseek':
                    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
                    if (!deepseekApiKey) throw new Error('DEEPSEEK_API_KEY is not configured.');
                    await handleOpenAICompatibleStream(res, body, "https://api.deepseek.com/chat/completions", "deepseek-vl-chat", deepseekApiKey);
                    break;
                case 'openai':
                    const openaiApiKey = process.env.OPENAI_API_KEY;
                    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not configured.');
                    await handleOpenAICompatibleStream(res, body, "https://api.openai.com/v1/chat/completions", "gpt-4o", openaiApiKey);
                    break;
                case 'gemini':
                default:
                    const geminiApiKey = process.env.GEMINI_API_KEY;
                    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not configured.');
                    await handleGeminiStream(res, body, geminiApiKey);
                    break;
            }
            return res.end();
        }

        return res.status(400).send({ error: 'Invalid request body.' });

    } catch (error) {
        console.error("Error in Vercel Serverless Function:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        if (!res.headersSent) {
            res.status(500).send({ error: `Error processing your request: ${errorMessage}` });
        } else {
            console.error("Error occurred mid-stream. Closing connection.");
            res.end();
        }
    }
}