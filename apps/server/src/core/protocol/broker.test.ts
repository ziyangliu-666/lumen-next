import { describe, expect, it, vi } from 'vitest';
import type { ClientCommand, ServerEvent } from '@lumen/contracts';
import type { Principal } from '../http/authGuard.js';
import { makeTask } from '../domain/task.js';
import { Broker } from './broker.js';

const opened: ServerEvent = {
  type: 'task.opened',
  task: makeTask('t1', 's1', null, 'lead', '', 0),
};

const user: Principal = { accountId: 'acc-1', role: 'user' };

describe('core: Broker', () => {
  it('delivers a published event to every subscriber of that session', () => {
    const broker = new Broker();
    const seen: ServerEvent[] = [];
    broker.subscribe('s1', (e) => seen.push(e));
    broker.subscribe('s1', (e) => seen.push(e));

    broker.publish('s1', opened);

    expect(seen).toEqual([opened, opened]);
  });

  it('keeps one session out of another session', () => {
    const broker = new Broker();
    const mine: ServerEvent[] = [];
    const theirs: ServerEvent[] = [];
    broker.subscribe('s1', (e) => mine.push(e));
    broker.subscribe('s2', (e) => theirs.push(e));

    broker.publish('s1', opened);

    expect(mine).toEqual([opened]);
    expect(theirs).toEqual([]);
  });

  it('stops delivering after unsubscribe, and forgets the session', () => {
    const broker = new Broker();
    const seen: ServerEvent[] = [];
    const off = broker.subscribe('s1', (e) => seen.push(e));

    off();
    broker.publish('s1', opened);

    expect(seen).toEqual([]);
    expect(broker.subscriberCount('s1')).toBe(0);
  });

  it('survives a listener that unsubscribes while being notified', () => {
    const broker = new Broker();
    const seen: ServerEvent[] = [];
    const off = broker.subscribe('s1', (e) => {
      seen.push(e);
      off();
    });
    broker.subscribe('s1', (e) => seen.push(e));

    expect(() => broker.publish('s1', opened)).not.toThrow();
    expect(seen).toHaveLength(2);
  });

  it('publishing to a session nobody watches is a no-op, not a throw', () => {
    const broker = new Broker();
    expect(() => broker.publish('nobody', opened)).not.toThrow();
  });

  it('routes a command to the slice that claimed its type', async () => {
    const broker = new Broker();
    const said = vi.fn();
    broker.onCommand('session.say', said);

    const command: ClientCommand = { type: 'session.say', sessionId: 's1', text: 'hello' };
    const handled = await broker.dispatch(command, user);

    expect(handled).toBe(true);
    expect(said).toHaveBeenCalledWith(command, user);
  });

  it('reports an unclaimed command type rather than throwing', async () => {
    const broker = new Broker();
    const command: ClientCommand = { type: 'session.stop', sessionId: 's1' };

    expect(await broker.dispatch(command, user)).toBe(false);
  });

  it('refuses a second owner for one command type', () => {
    const broker = new Broker();
    broker.onCommand('session.say', () => {});

    expect(() => broker.onCommand('session.say', () => {})).toThrow(/already has a handler/);
  });

  it('counts the sockets watching a session', () => {
    const broker = new Broker();
    expect(broker.subscriberCount('s1')).toBe(0);
    const off = broker.subscribe('s1', () => {});
    expect(broker.subscriberCount('s1')).toBe(1);
    off();
    expect(broker.subscriberCount('s1')).toBe(0);
  });
});
