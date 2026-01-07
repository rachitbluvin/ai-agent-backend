const axios = require('axios');
const mongoose = require('mongoose');
const Generation = require('../models/Generation');
const fs = require('fs');
const path = require('path');

// This is a basic structure. You can expand this to support multiple providers.
const generateCode = async (req, res, next) => {
    try {
        const { prompt, provider = 'mock' } = req.body; // Default to mock for now

        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Prompt is required' });
        }

        let result;

        // Simple switch to handle different providers in the future
        switch (provider) {
            case 'openai':
                // Implement OpenAI logic here
                // result = await callOpenAI(prompt);
                break;
            case 'gemini':
                // Implement Gemini logic here
                break;
            case 'claude':
                // Implement Claude logic here
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
        const { prompt, provider = 'mock', type = 'web' } = req.body;
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
        fs.writeFileSync(path.join(folder, 'index.html'), indexHtml);
        files.push('index.html');
        fileMap['index.html'] = indexHtml;

        const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`;
        fs.writeFileSync(path.join(srcDir, 'main.jsx'), mainJsx);
        files.push('src/main.jsx');
        fileMap['src/main.jsx'] = mainJsx;

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
        fs.writeFileSync(path.join(srcDir, 'App.jsx'), appJsx);
        files.push('src/App.jsx');
        fileMap['src/App.jsx'] = appJsx;

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
        fs.writeFileSync(path.join(compDir, 'Hero.jsx'), heroJsx);
        files.push('src/components/Hero.jsx');
        fileMap['src/components/Hero.jsx'] = heroJsx;

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
        fs.writeFileSync(path.join(compDir, 'Features.jsx'), featuresJsx);
        files.push('src/components/Features.jsx');
        fileMap['src/components/Features.jsx'] = featuresJsx;

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
        fs.writeFileSync(path.join(compDir, 'Sections.jsx'), sectionsJsx);
        files.push('src/components/Sections.jsx');
        fileMap['src/components/Sections.jsx'] = sectionsJsx;

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
        fs.writeFileSync(path.join(folder, 'package.json'), JSON.stringify(pkg, null, 2));
        files.push('package.json');
        fileMap['package.json'] = JSON.stringify(pkg, null, 2);

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
            data: { folder, files, fileMap }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    generateCode,
    generateProject
};
