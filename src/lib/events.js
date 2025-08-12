// Simple singleton event emitter for server runtime (not persisted across redeploys)
import { EventEmitter } from 'events';

// Ensure single instance across hot reloads
const globalKey = '__YARD_SALES_EVENT_EMITTER__';
let emitter;
if (globalThis[globalKey]) {
  emitter = globalThis[globalKey];
} else {
  emitter = new EventEmitter();
  emitter.setMaxListeners(1000);
  globalThis[globalKey] = emitter;
}

export default emitter;

export function broadcast(type, payload) {
  emitter.emit('message', { type, ts: Date.now(), payload });
}
