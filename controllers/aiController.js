const axios = require('axios');
const mongoose = require('mongoose');
const Generation = require('../models/Generation');
const Chat = require('../models/Chat');
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

const hasKey = (p) => {
    if (p === 'openai') return !!OPENAI_API_KEY;
    if (p === 'gemini') return !!GEMINI_API_KEY;
    if (p === 'claude') return !!ANTHROPIC_API_KEY;
    return false;
};

const selectProvider = (requested) => {
    const req = (requested || 'auto').toLowerCase();
    if (req !== 'auto') {
        if (hasKey(req)) return { provider: req, fallback: false };
        return { provider: 'mock', fallback: true };
    }
    // Prefer Anthropic if available (user provided ANTHROPIC_API_KEY)
    if (hasKey('claude')) return { provider: 'claude', fallback: false };
    if (hasKey('openai')) return { provider: 'openai', fallback: false };
    if (hasKey('gemini')) return { provider: 'gemini', fallback: false };
    return { provider: 'mock', fallback: true };
};

const callOpenAI = async (prompt, mode = 'code', context = '') => {
    if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
    const system = mode === 'project'
        ? 'Return only valid JSON: {"files": {"path": "content"}} for a complete component-based project. No prose.'
        : mode === 'chat'
        ? 'You are a helpful assistant. Respond concisely in plain text. Only include code blocks if explicitly asked to provide code.'
        : 'Return only complete, runnable React/Tailwind code for a modern component or page. No prose.';
    const userContent = context
        ? `Context:\n${context}\n\nTask:\n${prompt}`
        : prompt;
    const resp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: OPENAI_MODEL,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: userContent }
            ],
            temperature: 0.2
        },
        {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );
    return resp.data.choices?.[0]?.message?.content || '';
};

const callGemini = async (prompt, mode = 'code', context = '') => {
    if (!GEMINI_API_KEY) throw new Error('Gemini API key not configured');
    const system = mode === 'project'
        ? 'Return only JSON: {"files": {"path": "content"}}. No extra text.'
        : mode === 'chat'
        ? 'You are a helpful assistant. Respond concisely in plain text. Only include code blocks if explicitly asked.'
        : 'Return only complete runnable React/Tailwind code. No extra text.';
    const bodyText = `${system}\n\n${context ? `Context:\n${context}\n\n` : ''}${prompt}`;
    const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: bodyText }]
                }
            ]
        },
        { headers: { 'Content-Type': 'application/json' } }
    );
    const text =
        resp.data.candidates?.[0]?.content?.parts?.[0]?.text ||
        resp.data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') ||
        '';
    return text;
};

const callClaude = async (prompt, mode = 'code', context = '') => {
    if (!ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured');
    const system = mode === 'project'
        ? 'Return only JSON: {"files": {"path": "content"}} representing a complete React/Tailwind project. No prose.'
        : mode === 'chat'
        ? 'You are a helpful assistant. Respond concisely in plain text. Only include code if explicitly asked.'
        : 'Return only complete, runnable React/Tailwind code for a modern component or page. No prose.';
    const userText = context
        ? `Context:\n${context}\n\nTask:\n${prompt}`
        : prompt;
    const resp = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system,
            messages: [
                {
                    role: 'user',
                    content: [{ type: 'text', text: userText }]
                }
            ]
        },
        {
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        }
    );
    const text = resp.data?.content?.[0]?.text || '';
    return text;
};

// This is a basic structure. You can expand this to support multiple providers.
const generateCode = async (req, res, next) => {
    try {
        const { prompt, provider = 'auto' } = req.body; // Default to auto provider selection
        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Prompt is required' });
        }

        let result;

        // Simple switch to handle different providers in the future
        const chosen = selectProvider(provider);
        console.log(`[AI] provider=${chosen.provider} fallback=${chosen.fallback} intent=code`);
        switch (chosen.provider) {
            case 'openai':
                try {
                    const content = await callOpenAI(prompt, 'code');
                    result = { code: content, explanation: 'OpenAI generated code' };
                } catch (e) {
                    result = {
                        code: `
                        // Fallback to mock due to OpenAI error: ${e.message}
                        export default function Generated() { return null; }
                        `,
                        explanation: `Fallback mock after OpenAI error: ${e.message}`,
                    };
                }
                break;
            case 'gemini':
                try {
                    const content = await callGemini(prompt, 'code');
                    result = { code: content, explanation: 'Gemini generated code' };
                } catch (e) {
                    result = {
                        code: `
                        // Fallback to mock due to Gemini error: ${e.message}
                        export default function Generated() { return null; }
                        `,
                        explanation: `Fallback mock after Gemini error: ${e.message}`,
                    };
                }
                break;
            case 'claude':
                try {
                    const content = await callClaude(prompt, 'code');
                    result = { code: content, explanation: 'Claude generated code' };
                } catch (e) {
                    result = {
                        code: `
                        // Fallback to mock due to Claude error: ${e.message}
                        export default function Generated() { return null; }
                        `,
                        explanation: `Fallback mock after Claude error: ${e.message}`,
                    };
                }
                break;
            case 'mock':
            default:
                // Mock response for initial setup
                result = {
                    code: `
                        // Generated code based on prompt: ${prompt}
                        import React from 'react';
                        
                        const GeneratedComponent = () => {
                            return (
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <h1 className="text-2xl font-bold">Hello from AI Generated Code</h1>
                                    <p>This is a placeholder for the actual generated code.</p>
                                </div>
                            );
                        };
                        
                        export default GeneratedComponent;
                    `,
                    explanation: "This is a mock response. Connect an API key to get real results."
                };
                break;
        }

        const isConnected = mongoose.connection && mongoose.connection.readyState === 1;
        if (isConnected && result && result.code && req.user && req.user.id) {
            try {
                await Generation.create({
                    user: req.user.id,
                    prompt,
                    provider,
                    code: result.code,
                    explanation: result.explanation,
                });
            } catch (e) {}
        }

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

const generateProject = async (req, res, next) => {
    try {
        const { prompt, provider = 'auto', type = 'web', chatId } = req.body;
        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Prompt is required' });
        }
        const isConnected = mongoose.connection && mongoose.connection.readyState === 1;
        const baseDir = path.join(__dirname, '../projects', String(req.user.id));
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        const folder = path.join(baseDir, `project-${Date.now()}`);
        fs.mkdirSync(folder, { recursive: true });
        const srcDir = path.join(folder, 'src');
        const compDir = path.join(srcDir, 'components');
        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(compDir, { recursive: true });

        const files = [];
        const fileMap = {};

        let generatedFileMap = null;
        const chosen = selectProvider(provider);
        console.log(`[AI] provider=${chosen.provider} fallback=${chosen.fallback} intent=project`);
        if (chosen.provider !== 'mock') {
            try {
                let raw = '';
                const context = await getChatContext(chatId, req.user.id);
                if (chosen.provider === 'openai') raw = await callOpenAI(prompt, 'project', context);
                else if (chosen.provider === 'gemini') raw = await callGemini(prompt, 'project', context);
                else if (chosen.provider === 'claude') raw = await callClaude(prompt, 'project', context);
                // Attempt to parse JSON directly or from a fenced code block
                const tryParse = (text) => {
                    try {
                        return JSON.parse(text);
                    } catch {
                        const match = text.match(/\{[\s\S]*\}/);
                        if (match) {
                            try {
                                return JSON.parse(match[0]);
                            } catch {}
                        }
                        return null;
                    }
                };
                const parsed = tryParse(raw);
                if (parsed && parsed.files && typeof parsed.files === 'object') {
                    generatedFileMap = parsed.files;
                }
            } catch (e) {
                // fall back to skeleton below
                generatedFileMap = null;
            }
        }

        const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Project</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
        if (!generatedFileMap || !generatedFileMap['index.html']) {
            fs.writeFileSync(path.join(folder, 'index.html'), indexHtml);
            files.push('index.html');
            fileMap['index.html'] = indexHtml;
        }

        const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`;
        if (!generatedFileMap || !generatedFileMap['src/main.jsx']) {
            fs.writeFileSync(path.join(srcDir, 'main.jsx'), mainJsx);
            files.push('src/main.jsx');
            fileMap['src/main.jsx'] = mainJsx;
        }

        const appJsx = `import React from 'react'
import Hero from './components/Hero.jsx'
import Features from './components/Features.jsx'
import Sections from './components/Sections.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Hero />
      <Features />
      <Sections />
    </div>
  )
}`;
        if (!generatedFileMap || !generatedFileMap['src/App.jsx']) {
            fs.writeFileSync(path.join(srcDir, 'App.jsx'), appJsx);
            files.push('src/App.jsx');
            fileMap['src/App.jsx'] = appJsx;
        }

        const heroJsx = `import React from 'react'

export default function Hero() {
  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">AI Built Experience</h1>
        <p className="mt-4 text-lg text-gray-600">${prompt}</p>
        <div className="mt-8 flex justify-center gap-4">
          <a className="px-6 py-3 rounded-md bg-blue-600 text-white">Get Started</a>
          <a className="px-6 py-3 rounded-md bg-gray-900 text-white">Learn More</a>
        </div>
      </div>
    </section>
  )
}`;
        if (!generatedFileMap || !generatedFileMap['src/components/Hero.jsx']) {
            fs.writeFileSync(path.join(compDir, 'Hero.jsx'), heroJsx);
            files.push('src/components/Hero.jsx');
            fileMap['src/components/Hero.jsx'] = heroJsx;
        }

        const featuresJsx = `import React from 'react'

const items = [
  { title: 'Fast', desc: 'Generate structures quickly.' },
  { title: 'Modern', desc: 'React components and sections.' },
  { title: 'Flexible', desc: 'Switch providers easily.' },
  { title: 'Extensible', desc: 'Grow to full apps.' },
]

export default function Features() {
  return (
    <section className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center">Features</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((i) => (
            <div key={i.title} className="rounded-lg bg-white p-6 shadow">
              <div className="text-xl font-semibold">{i.title}</div>
              <div className="mt-2 text-gray-600">{i.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}`;
        if (!generatedFileMap || !generatedFileMap['src/components/Features.jsx']) {
            fs.writeFileSync(path.join(compDir, 'Features.jsx'), featuresJsx);
            files.push('src/components/Features.jsx');
            fileMap['src/components/Features.jsx'] = featuresJsx;
        }

        const sectionsJsx = `import React from 'react'

export default function Sections() {
  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-3">
            <h3 className="text-2xl font-bold">Showcase</h3>
            <p className="text-gray-600">Scrollable sections to explore more.</p>
          </div>
          <div className="rounded-lg bg-gray-100 h-48" />
        </div>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="rounded-lg bg-gray-100 h-48" />
          <div className="space-y-3">
            <h3 className="text-2xl font-bold">Components</h3>
            <p className="text-gray-600">Modular and reusable blocks.</p>
          </div>
        </div>
      </div>
    </section>
  )
}`;
        if (!generatedFileMap || !generatedFileMap['src/components/Sections.jsx']) {
            fs.writeFileSync(path.join(compDir, 'Sections.jsx'), sectionsJsx);
            files.push('src/components/Sections.jsx');
            fileMap['src/components/Sections.jsx'] = sectionsJsx;
        }

        const pkg = {
            name: "ai-project",
            private: true,
            version: "0.0.0",
            type: "module",
            scripts: {
                dev: "vite",
                build: "vite build",
                preview: "vite preview"
            },
            dependencies: {
                react: "^18.2.0",
                "react-dom": "^18.2.0"
            },
            devDependencies: {
                vite: "^5.4.1",
                "@vitejs/plugin-react": "^4.3.1"
            }
        };
        if (!generatedFileMap || !generatedFileMap['package.json']) {
            fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify(pkg, null, 2));
            files.push('package.json');
            fileMap['package.json'] = JSON.stringify(pkg, null, 2);
        }

        // If provider returned a file map, write those to disk
        if (generatedFileMap) {
            for (const [p, content] of Object.entries(generatedFileMap)) {
                const abs = path.join(folder, p);
                const absDir = path.dirname(abs);
                if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
                fs.writeFileSync(abs, content ?? '');
                if (!files.includes(p)) files.push(p);
                fileMap[p] = content ?? '';
            }
        }

        if (isConnected) {
            try {
                await Generation.create({
                    user: req.user.id,
                    prompt,
                    provider,
                    code: 'files',
                    explanation: 'project',
                    folder,
                    files,
                });
            } catch (e) {}
        }

        res.status(201).json({
            success: true,
            data: { intent: 'generate_project', folder, files, fileMap }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateCode,
    generateProject
};

const getLatestProjectFolder = (userId) => {
    const baseDir = path.join(__dirname, '../projects', String(userId));
    if (!fs.existsSync(baseDir)) return null;
    const entries = fs.readdirSync(baseDir).filter((f) => f.startsWith('project-'));
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => {
        const ta = Number(a.replace('project-', ''));
        const tb = Number(b.replace('project-', ''));
        return tb - ta;
    });
    return path.join(baseDir, sorted[0]);
};

const getChatContext = async (chatId, userId) => {
    try {
        if (!chatId) return '';
        const chat = await Chat.findOne({ _id: chatId, user: userId });
        if (!chat || !Array.isArray(chat.messages)) return '';
        const last = chat.messages.slice(-20);
        const parts = last.map(m => {
            if (m.role === 'user') return `User: ${m.prompt || ''}`.trim();
            const content = m.text || (m.code ? `[code]\n${m.code}\n[/code]` : '');
            return `Assistant: ${content}`.trim();
        });
        return parts.join('\n\n');
    } catch {
        return '';
    }
};
const appendChat = async ({ chatId, userId, prompt, intent, provider, result }) => {
    try {
        let chat = null;
        if (chatId) {
            chat = await Chat.findOne({ _id: chatId, user: userId });
        }
        if (!chat) {
            const title = (prompt || '').slice(0, 48) || 'New Chat';
            chat = await Chat.create({ user: userId, title, messages: [] });
        }
        chat.messages.push({
            role: 'user',
            prompt,
            intent,
            provider,
        });
        chat.messages.push({
            role: 'assistant',
            intent,
            provider,
            text: result.text,
            code: result.code,
            folder: result.folder,
            files: result.files,
            explanation: result.explanation || `Intent=${intent}, provider=${provider}`,
            summary: result.summary || `Processed ${intent}`,
        });
        await chat.save();
        return chat;
    } catch (e) {
        return null;
    }
};
const writeFileToProject = (userId, folder, relPath, content) => {
    const root = folder || getLatestProjectFolder(userId) || path.join(__dirname, '../projects', String(userId), `project-${Date.now()}`);
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    const abs = path.join(root, relPath);
    const dir = path.dirname(abs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, content ?? '');
    return { folder: root, filePath: relPath };
};

const detectIntent = (text, hasFiles) => {
    const t = (text || '').toLowerCase();
    if (hasFiles) return 'modify_files';
    const projectWords = ['create project', 'generate project', 'build project', 'complete website', 'complete app', 'multiple files', 'file map', 'component-based', 'pages'];
    if (projectWords.some(w => t.includes(w))) return 'generate_project';
    const codeWords = ['code', 'component', 'function', 'react', 'tailwind', 'js', 'jsx', 'html', 'css'];
    if (codeWords.some(w => t.includes(w))) return 'code';
    return 'chat';
};

const send = async (req, res, next) => {
    try {
        const { prompt, provider = 'auto', projectFolder, chatId } = req.body;
        const filesUploaded = Array.isArray(req.files) ? req.files : [];
        if (!prompt && filesUploaded.length === 0) {
            return res.status(400).json({ success: false, message: 'Prompt or files required' });
        }
        const intent = detectIntent(prompt, filesUploaded.length > 0);
        const context = await getChatContext(chatId, req.user.id);
        if (intent === 'modify_files') {
            const folder = projectFolder || getLatestProjectFolder(req.user.id);
            const writes = [];
            for (const f of filesUploaded) {
                const name = f.originalname || `file-${Date.now()}`;
                const relPath = name;
                const root = folder || path.join(__dirname, '../projects', String(req.user.id), `project-${Date.now()}`);
                if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
                const abs = path.join(root, relPath);
                const dir = path.dirname(abs);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(abs, f.buffer);
                writes.push(relPath);
            }
            const saved = await appendChat({
                chatId,
                userId: req.user.id,
                prompt,
                intent,
                provider: 'upload',
                result: { folder: folder || getLatestProjectFolder(req.user.id), files: writes, text: `Uploaded ${writes.length} files` },
            });
            return res.status(200).json({ success: true, data: { intent, folder: folder || getLatestProjectFolder(req.user.id), files: writes, chatId: saved?._id?.toString() } });
        } else if (intent === 'generate_project') {
            req.body.provider = provider;
            const before = await generateProject(req, res, next);
            return before;
        } else {
            let result;
            const chosen = selectProvider(provider);
            try {
                if (intent === 'chat') {
                    let content;
                    if (chosen.provider === 'openai') content = await callOpenAI(prompt, 'chat', context);
                    else if (chosen.provider === 'gemini') content = await callGemini(prompt, 'chat', context);
                    else if (chosen.provider === 'claude') content = await callClaude(prompt, 'chat', context);
                    else content = `You asked: ${prompt}`;
                    result = { intent, text: content, explanation: `Chat response from ${chosen.provider}` };
                } else {
                    let content;
                    if (chosen.provider === 'openai') content = await callOpenAI(prompt, 'code', context);
                    else if (chosen.provider === 'gemini') content = await callGemini(prompt, 'code', context);
                    else if (chosen.provider === 'claude') content = await callClaude(prompt, 'code', context);
                    else content = `
                        import React from 'react';
                        export default function Answer() { return <div>${prompt}</div>; }
                    `;
                    result = { intent, code: content, explanation: `Code generated by ${chosen.provider}` };
                }
            } catch (e) {
                result = {
                    intent,
                    text: `Sorry, the provider failed: ${e.message}`,
                };
            }
            const saved = await appendChat({ chatId, userId: req.user.id, prompt, intent, provider: chosen.provider, result });
            return res.status(200).json({ success: true, data: { ...result, chatId: saved?._id?.toString() } });
        }
    } catch (error) {
        next(error);
    }
};

module.exports.send = send;
