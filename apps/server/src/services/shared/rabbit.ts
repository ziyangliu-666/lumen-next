// RabbitMQ for the two kinds of message that cross from session to the
// workers (docs/platform/contract.md, "A turn" and the steer fanout):
//
// - lumen.turns.<depth>, durable work queues. Each turn goes to exactly one
//   worker. KEDA scales the worker Deployment on their length.
// - lumen.steers, a fanout exchange. Every worker pod gets every steer and
//   applies the ones whose task it is running.
//
// Why one queue per depth: a parent turn waits inside delegate() until its
// children are at rest, and it keeps its worker slot while it waits. With one
// queue, enough waiting parents fill every slot and their children never
// start. Each depth has its own slots, and the deepest level never waits, so
// the work always drains.
import amqp from 'amqplib';
import type { ClientCommand, Task } from '@lumen/contracts';
import type { Principal } from '../../core/http/authGuard.js';
import type { Log } from '../../core/log/log.js';

/** Depths at or past this share the last queue. Readers, at depth 1, do not delegate. */
export const DEEPEST_TURN_QUEUE = 2;
export const STEER_EXCHANGE = 'lumen.steers';

export function turnQueue(depth: number): string {
  return `lumen.turns.${Math.min(Math.max(depth, 0), DEEPEST_TURN_QUEUE)}`;
}

export const TURN_QUEUES: readonly string[] = Array.from(
  { length: DEEPEST_TURN_QUEUE + 1 },
  (_, depth) => turnQueue(depth),
);

/** One turn of one task, as session hands it to a worker. */
export interface TurnMessage {
  readonly turnId: string;
  readonly task: Task;
  readonly input: string;
}

export type SteerCommand = Extract<ClientCommand, { type: 'task.steer' }>;

export interface SteerMessage {
  readonly command: SteerCommand;
  readonly principal: Principal;
}

/** What session and the worker need from the broker, and no more. Tests pass a fake. */
export interface MessageBus {
  publishTurn(turn: TurnMessage): Promise<void>;
  /**
   * Take turns, at most `slots` at a time from each depth's queue. A handler
   * that resolves acknowledges the turn; a handler that throws puts it back on
   * the queue for another worker.
   */
  consumeTurns(handler: (turn: TurnMessage) => Promise<void>, slots: number): Promise<void>;
  /** Stop taking new turns. The ones in hand still finish. */
  stopConsuming(): Promise<void>;
  publishSteer(steer: SteerMessage): Promise<void>;
  consumeSteers(handler: (steer: SteerMessage) => Promise<void>): Promise<void>;
  close(): Promise<void>;
}

/**
 * Connects and declares the queues and the exchange. A lost connection ends
 * the process: Kubernetes restarts the pod, and a turn that was not
 * acknowledged goes back on its queue. That is simpler and safer than a
 * reconnect loop that could hold a half-open channel.
 */
export async function connectRabbit(url: string, log: Log): Promise<MessageBus> {
  const connection = await amqp.connect(url);
  connection.on('close', () => {
    log.fatal('rabbitmq connection closed');
    process.exit(1);
  });
  connection.on('error', (error: unknown) => log.error({ err: error }, 'rabbitmq error'));
  const channel = await connection.createConfirmChannel();
  for (const queue of TURN_QUEUES) await channel.assertQueue(queue, { durable: true });
  await channel.assertExchange(STEER_EXCHANGE, 'fanout', { durable: true });
  // Prefetch counts per channel, so each depth gets its own channel and slots.
  const consumers: { channel: amqp.Channel; tag: string }[] = [];

  const send = (exchange: string, routingKey: string, body: unknown): Promise<void> =>
    new Promise((resolve, reject) => {
      channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        { persistent: true, contentType: 'application/json' },
        (error) =>
          error ? reject(error instanceof Error ? error : new Error(String(error))) : resolve(),
      );
    });

  return {
    publishTurn: (turn) => send('', turnQueue(turn.task.depth), turn),
    async consumeTurns(handler, slots) {
      for (const queue of TURN_QUEUES) {
        const depthChannel = await connection.createChannel();
        await depthChannel.prefetch(slots);
        const { consumerTag } = await depthChannel.consume(queue, (message) => {
          if (!message) return;
          let turn: TurnMessage;
          try {
            turn = JSON.parse(message.content.toString()) as TurnMessage;
          } catch (error) {
            // A message nobody can read would loop forever if put back.
            log.error({ err: error, queue }, 'dropping an unreadable turn');
            depthChannel.nack(message, false, false);
            return;
          }
          handler(turn).then(
            () => depthChannel.ack(message),
            (error: unknown) => {
              log.warn({ err: error, turnId: turn.turnId }, 'turn returned to the queue');
              depthChannel.nack(message, false, true);
            },
          );
        });
        consumers.push({ channel: depthChannel, tag: consumerTag });
      }
    },
    async stopConsuming() {
      for (const consumer of consumers.splice(0)) {
        await consumer.channel.cancel(consumer.tag);
      }
    },
    publishSteer: (steer) => send(STEER_EXCHANGE, '', steer),
    async consumeSteers(handler) {
      // One queue per pod, deleted with it: a steer is only useful to the pod
      // that is running the task right now.
      const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
      await channel.bindQueue(queue, STEER_EXCHANGE, '');
      await channel.consume(
        queue,
        (message) => {
          if (!message) return;
          try {
            void handler(JSON.parse(message.content.toString()) as SteerMessage).catch(
              (error: unknown) => log.warn({ err: error }, 'steer not applied'),
            );
          } catch (error) {
            log.error({ err: error }, 'dropping an unreadable steer');
          }
        },
        { noAck: true },
      );
    },
    async close() {
      connection.removeAllListeners('close');
      await connection.close();
    },
  };
}
