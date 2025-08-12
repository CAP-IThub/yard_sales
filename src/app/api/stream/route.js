import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import emitter from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const stream = new ReadableStream({
    start(controller) {
      const send = (data) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {}
      };
      const handler = (msg) => send(msg);
      emitter.on('message', handler);
      send({ type: 'hello', ts: Date.now() });
      const heartbeat = setInterval(()=> send({ type: 'ping', ts: Date.now() }), 25000);
      controller._cleanup = () => {
        clearInterval(heartbeat);
        emitter.off('message', handler);
      };
    },
    cancel() {
      if (this._cleanup) this._cleanup();
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
