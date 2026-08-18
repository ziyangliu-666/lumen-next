/**
 * One input box and one question: where does this sentence go?
 *
 * Not two verbs. "Keep talking" and "hand over" are the same act — you say something — and
 * they differ only in how much of the conversation travels with it. Asking a person to
 * choose a verb makes them work out the consequence themselves; asking them to choose a
 * recipient is a question they can always answer.
 */

import { useState } from "react";
import type { Target } from "@lumen/server/protocol";
import { describeTarget, frontierOf, isLive, quotable, type State } from "./state.ts";

export function Composer({
	state,
	onSend,
	onAbort,
	onSelect,
}: {
	state: State;
	onSend: (text: string, target: Target) => void;
	onAbort: () => void;
	onSelect: (nodeId: string) => void;
}) {
	const [text, setText] = useState("");
	const [choice, setChoice] = useState("continue");

	const node = state.selected ? state.nodes[state.selected] : undefined;
	const live = node ? isLive(node) : false;
	const busy = node?.busy === true;
	const cites = quotable(state);
	// Where this line actually is now, if you are standing on a window it has left behind.
	const ahead = node && !live ? frontierOf(state, node.id) : null;
	// Teach a reference that exists. Ids are a base-36 counter, so the one in the old
	// placeholder was a number the session might never reach.
	const exampleId = cites[cites.length - 1]?.id ?? node?.id ?? "";
	// A mistyped reference is passed through verbatim, so the receiving agent reads
	// "@n-zz" as part of the question rather than as a citation that failed.
	const unknown = [...text.matchAll(/@(n-[a-z0-9]+)/g)]
		.map((match) => match[1])
		.filter((id) => !state.nodes[id]);

	const target: Target = choice.startsWith("handoff:")
		? { kind: "handoff", agent: choice.slice("handoff:".length) }
		: choice.startsWith("send:")
			? { kind: "send", agent: choice.slice("send:".length) }
			: choice === "next"
				? { kind: "next" }
				: { kind: "continue" };

	// Sending a line off does not touch this window's session, so it need not wait for it.
	// Making you wait would defeat the point: branches exist so a long run does not freeze
	// the conversation.
	const blocked = !live || !state.connected || (busy && target.kind !== "send");

	function send() {
		const trimmed = text.trim();
		if (!trimmed || blocked) return;
		onSend(trimmed, target);
		setText("");
		setChoice("continue");
	}

	return (
		<div className="composer">
			{node && !live && (
				<div className="row">
					<span className="warn">
						You are reading a window that has ended. It cannot be typed into.
					</span>
					{ahead && (
						<button type="button" onClick={() => onSelect(ahead)}>
							go to the live point ({state.nodes[ahead]?.agent})
						</button>
					)}
				</div>
			)}

			<div className="row">
				<select value={choice} onChange={(event) => setChoice(event.target.value)}>
					<option value="continue">talk to {node?.agent ?? "…"}</option>
					<option value="next">start the next window</option>
					<optgroup label="hand over — this line becomes theirs">
						{state.agents
							// Handing a line to the agent already holding it is a no-op that
							// still pays for a summarisation. Offering it invites the mistake.
							.filter((agent) => agent.name !== node?.agent)
							.map((agent) => (
								<option key={agent.name} value={`handoff:${agent.name}`}>
									hand over to {agent.name}
								</option>
							))}
					</optgroup>
					<optgroup label="send off — a new line, you stay here">
						{state.agents.map((agent) => (
							<option key={agent.name} value={`send:${agent.name}`}>
								send {agent.name} off
							</option>
						))}
					</optgroup>
				</select>
				<span className="hint">{describeTarget(target)}</span>
				{busy && (
					<button type="button" className="stop" onClick={onAbort}>
						stop
					</button>
				)}
			</div>

			<textarea
				value={text}
				placeholder={
					!state.connected
						? "not connected"
						: !live
							? `this window is ${node?.state === "aborted" ? "stopped" : node?.state === "failed" ? "failed" : "closed"} — nothing can be sent to it`
							: busy
								? `${node?.agent} is working. To work meanwhile, choose "send … off" above.`
								: exampleId
									? `say something. @${exampleId} pastes in what that point currently says`
									: "say something"
				}
				disabled={blocked}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						send();
					}
				}}
			/>

			{cites.length > 0 && (
				<div className="row cites">
					<span className="hint">quote:</span>
					{cites.slice(-6).map((cite) => (
						<button
							type="button"
							key={cite.id}
							className="cite"
							title={cite.summary?.slice(0, 200)}
							onClick={() => setText((current) => `${current}${current ? " " : ""}@${cite.id} `)}
						>
							@{cite.id} {cite.agent}
						</button>
					))}
				</div>
			)}

			{unknown.length > 0 && (
				<div className="row">
					<span className="warn">
						no such point: {unknown.join(", ")} — it will be sent as plain text
					</span>
				</div>
			)}

			<div className="row">
				<button type="button" onClick={send} disabled={blocked || !text.trim()}>
					send
				</button>
				<span className="hint">⌘↵</span>
			</div>
		</div>
	);
}
