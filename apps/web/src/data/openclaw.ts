import { setToolConnected } from '../state/toolConnections';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamChatOptions {
  messages: ChatTurn[];
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

interface ChoiceDelta {
  content?: string;
}

interface ChunkChoice {
  delta?: ChoiceDelta;
  message?: ChoiceDelta;
}

interface ChatChunk {
  choices?: ChunkChoice[];
}

export async function streamChat({ messages, onDelta, signal }: StreamChatOptions): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model: 'openclaw/default', stream: true, messages }),
      signal,
    });
  } catch (err) {
    setToolConnected('openclaw', false);
    throw err;
  }
  if (!res.ok || !res.body) {
    setToolConnected('openclaw', false);
    const text = await res.text().catch(() => '');
    throw new Error(`OpenClaw chat failed: ${res.status} ${text.slice(0, 200)}`);
  }
  setToolConnected('openclaw', true);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLines: string[] = [];
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) continue;
        const payload = dataLines.join('\n');
        if (payload === '[DONE]') return;
        let chunk: ChatChunk;
        try {
          chunk = JSON.parse(payload) as ChatChunk;
        } catch {
          continue;
        }
        const choices = chunk.choices ?? [];
        for (const c of choices) {
          const piece = c.delta?.content ?? c.message?.content ?? '';
          if (piece) onDelta(piece);
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return;
    setToolConnected('openclaw', false);
    throw err;
  }
}
