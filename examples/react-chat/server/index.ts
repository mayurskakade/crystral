import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Crystral from '@crystralai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const client = new Crystral({ cwd: path.join(__dirname, '..') });

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/logs', (req, res) => {
  const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
  const agentName = typeof req.query['agent'] === 'string' ? req.query['agent'] : undefined;
  const logs = client.getLogs({ limit, agentName });
  res.json(logs);
});

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body as { message: string; sessionId?: string };

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const result = await client.run('assistant', message, { sessionId });
    res.json({
      content: result.content,
      sessionId: result.sessionId,
      usage: result.usage,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error('Agent error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

const PORT = process.env['PORT'] ?? 3001;
app.listen(PORT, () => {
  console.log(`Crystral server running at http://localhost:${PORT}`);
  if (!process.env['OPENAI_API_KEY']) {
    console.warn('Warning: OPENAI_API_KEY is not set. Add it to a .env file.');
  }
});
