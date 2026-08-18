/**
 * The canvas: points as boxes, edges as curves, pan and zoom.
 *
 * Edges are SVG because they are curves; points are ordinary HTML on top, because text
 * wrapping and truncation in SVG is a fight for nothing. Both live in one transformed
 * layer, so panning and zooming move them together and there is no second coordinate
 * system to keep in step.
 */

import { useEffect, useRef, useState } from "react";
import { money } from "@lumen/kernel/trace/types";
import { formatDuration, useElapsed } from "./elapsed.ts";
import { fit } from "./fit.ts";
import { COL, edges, layout, LANE, NODE_H, NODE_W, type Placed } from "./layout.ts";
import { isLive, rollup, type State } from "./state.ts";

const MARK: Record<string, string> = { done: "✓", failed: "✗", aborted: "■", running: "•" };

export function Canvas({
	state,
	onSelect,
}: {
	state: State;
	onSelect: (id: string) => void;
}) {
	const { placed, width, height } = layout(state);
	const wires = edges(state, placed);
	const [view, setView] = useState({ x: 24, y: 24, k: 1 });
	const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
	const seen = useRef(0);
	const frame = useRef<HTMLDivElement | null>(null);

	// Follow the work when the graph grows, but never while the person is looking around:
	// yanking the view mid-read is worse than letting a new point wait to be found.
	useEffect(() => {
		if (placed.length <= seen.current) return;
		seen.current = placed.length;
		if (drag.current) return;
		const last = placed[placed.length - 1];
		setView((v) => {
			const needsX = last.x * v.k + v.x > window.innerWidth - NODE_W * 1.6;
			const needsY = last.y * v.k + v.y > window.innerHeight - NODE_H * 5;
			if (!needsX && !needsY) return v;
			return {
				...v,
				x: needsX ? -last.x * v.k + 120 : v.x,
				y: needsY ? -last.y * v.k + 120 : v.y,
			};
		});
	}, [placed.length]);

	return (
		<div
			className="canvas"
			ref={frame}
			onMouseDown={(event) => {
				drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
			}}
			onMouseMove={(event) => {
				const d = drag.current;
				if (!d) return;
				setView((v) => ({ ...v, x: d.vx + (event.clientX - d.x), y: d.vy + (event.clientY - d.y) }));
			}}
			onMouseUp={() => {
				drag.current = null;
			}}
			onMouseLeave={() => {
				drag.current = null;
			}}
			onWheel={(event) => {
				if (!event.ctrlKey && !event.metaKey) return;
				setView((v) => ({ ...v, k: Math.min(2, Math.max(0.3, v.k * (event.deltaY > 0 ? 0.9 : 1.1))) }));
			}}
		>
			<div
				className="world"
				style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
			>
				<svg className="wires" width={width + COL} height={height + LANE}>
					{wires.map((wire) => (
						<path
							key={`${wire.from.id}-${wire.to.id}`}
							d={wire.path}
							className={`wire ${wire.kind}`}
							markerEnd={wire.kind === "branch" ? "url(#tip)" : undefined}
						/>
					))}
					{/* Drawn again on top, and only while the far end is thinking. A second path
					    rather than a dash on the first, so the wire keeps saying what kind of edge
					    it is — solid for delegated work, dashed for a line nobody waits for — while
					    the light travelling along it says the work is live. The two facts are
					    different and the picture must not merge them. */}
					{wires
						.filter((wire) => wire.live)
						.map((wire) => (
							<path
								key={`flow-${wire.from.id}-${wire.to.id}`}
								d={wire.path}
								className="wire flow"
							/>
						))}
					<defs>
						<marker id="tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
							<path d="M0,0 L8,4 L0,8 z" className="tipFill" />
						</marker>
					</defs>
				</svg>

				{placed.map((spot) => (
					<Point key={spot.id} state={state} spot={spot} onSelect={onSelect} />
				))}
			</div>

			<div className="scale">
				{Math.round(view.k * 100)}% · drag to pan · ⌘scroll to zoom
				{/* Before this there was only `reset`, which goes back to 100% at the origin —
				    no help at all once the graph is bigger than the window, which is what a
				    fan-out of twenty-eight points is. The shape of the run is the product, and
				    this is the only control that shows all of it. */}
				<button
					type="button"
					onClick={() => {
						const box = frame.current?.getBoundingClientRect();
						if (box) setView(fit(placed, { width: box.width, height: box.height }));
					}}
				>
					fit
				</button>
				<button type="button" onClick={() => setView({ x: 24, y: 24, k: 1 })}>
					100%
				</button>
			</div>
		</div>
	);
}

function Point({
	state,
	spot,
	onSelect,
}: {
	state: State;
	spot: Placed;
	onSelect: (id: string) => void;
}) {
	const node = state.nodes[spot.id];
	// Called before the early return, because a hook cannot be skipped. A missing node is
	// drawn as nothing, and passing zeros here costs one wasted format on a frame that is
	// about to render null anyway.
	const elapsed = useElapsed(node?.startedAt ?? 0, node?.endedAt);
	if (!node) return null;
	const live = isLive(node);
	const selected = state.selected === node.id;
	const spend = rollup(state, node.id);
	const tools = node.steps.filter((step) => !step.childIds?.length).length;

	return (
		<div
			className={`point ${live ? "live" : "ended"} ${selected ? "selected" : ""} ${node.busy ? "busy" : ""}`}
			style={{ left: spot.x, top: spot.y, width: NODE_W, height: NODE_H }}
			onMouseDown={(event) => event.stopPropagation()}
			onClick={() => onSelect(node.id)}
			role="button"
			tabIndex={0}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect(node.id);
				}
			}}
			title={node.summary?.slice(0, 300) ?? node.task.slice(0, 300)}
		>
			<div className="pointHead">
				<span className={`mark ${node.state}`}>{node.busy ? "◍" : MARK[node.state]}</span>
				<span className="pointAgent">{node.agent}</span>
				<span className="pointId">{node.id}</span>
			</div>
			<div className="pointFoot">
				{/* Only once there is something to say. A window that has not billed yet drew
				    `$0.0000`, and four zeros repeated on every fresh point is a column of noise
				    that reads as a figure. */}
				{spend.cost.total > 0 && <span>{money(spend.cost.total)}</span>}
				{tools > 0 && <span>{tools} tool{tools > 1 ? "s" : ""}</span>}
				{/* The figure takes the slot the word "working" used to hold. That word said
				    nothing the accent border, the pulsing mark and the wire arriving had not
				    already said three times over, while the one thing a person actually wants
				    from a point that has been going for a while — how long — was nowhere. */}
				<span className={node.busy ? "working" : undefined}>{formatDuration(elapsed)}</span>
			</div>
		</div>
	);
}
