import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@lumen/contracts';
import { Broker } from './broker.js';

const opened: ServerEvent = { type: 'point.opened', pointId: 'p1', parentId: null, edge: null };

describe('core: Broker', () => {
  it('delivers a published event to every subscriber', () => {
    const broker = new Broker();
    const seen: ServerEvent[] = [];
    broker.subscribe((e) => seen.push(e));
    broker.subscribe((e) => seen.push(e));
    broker.publish(opened);
    expect(seen).toEqual([opened, opened]);
  });

  it('stops delivering after unsubscribe', () => {
    const broker = new Broker();
    const seen: ServerEvent[] = [];
    const off = broker.subscribe((e) => seen.push(e));
    off();
    broker.publish(opened);
    expect(seen).toEqual([]);
  });
});
