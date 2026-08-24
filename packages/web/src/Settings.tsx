/**
 * The settings panel.
 *
 * Built as a list of field descriptions rather than as a form, because the list is expected
 * to grow. Adding a setting should be one entry here, one field on `Settings` in the
 * protocol, and one clause in the server's `applySettings` — and nothing else, in
 * particular no new frame kind and no new case in the reducer.
 *
 * Two rules the panel keeps, and both are about not lying:
 *
 *   Every changeable setting says when it starts to matter, and they differ. pi binds the
 *   model and the compaction thresholds when a session is built, so those reach the next
 *   window and not this one. A page that implied otherwise would have people watching a run
 *   they thought had changed model.
 *
 *   What cannot be changed is shown anyway, as text. A panel listing only the changeable
 *   things teaches that the rest does not exist — and the two worth reading most, the
 *   directory the agents can see and the extensions they were given, are exactly the two
 *   nobody should be able to change from a browser.
 */

import { useEffect, useState } from "react";
import type { Fixed, Settings as SettingsValues } from "@lumen/server/protocol";

/** How a setting is edited, and what it is worth telling the person about it. */
type Field =
	| {
			kind: "number";
			key: "autoBudget";
			label: string;
			when: string;
			help: string;
			min: number;
			step: number;
	  }
	| { kind: "model"; key: "model"; label: string; when: string; help: string }
	| { kind: "optionalNumber"; key: "keepRecentTokens"; label: string; when: string; help: string }
	| {
			kind: "whole";
			key: "maxDepth" | "maxConcurrent";
			label: string;
			when: string;
			help: string;
	  }
	| { kind: "path"; key: "material"; label: string; when: string; help: string };

const FIELDS: Field[] = [
	{
		kind: "number",
		key: "autoBudget",
		label: "budget",
		when: "at once, including a run already going",
		help:
			"Dollars one automatic run may spend. The only limit there is: a run stops when it " +
			"passes this, whatever the agents think. Raising it while a run is stopped lets it " +
			"carry on rather than start again.",
		min: 0.01,
		step: 0.25,
	},
	{
		kind: "path",
		key: "material",
		label: "material",
		when: "the next window that opens",
		help:
			"A folder the agents should study, if this conversation is about one. Leave it empty " +
			"and they know about nothing but their own directory — which is what you want when " +
			"the question is not about code. Point it at a repository and every window opened " +
			"from then on is told where it is and told to read it without changing it.",
	},
	{
		kind: "model",
		key: "model",
		label: "model",
		when: "the next window that opens",
		help:
			"Only the models your credentials reach. A window already open keeps the model it " +
			"was built with, because changing it would mean rebuilding the session and throwing " +
			"away the conversation.",
	},
	{
		kind: "optionalNumber",
		key: "keepRecentTokens",
		label: "keep recent",
		when: "the next window that opens",
		help:
			"How many tokens of recent conversation survive a compaction. Leave it empty for " +
			"pi's own default of 20k. Set it to a few hundred to watch a line compact without " +
			"holding a long conversation first.",
	},
	{
		kind: "whole",
		key: "maxDepth",
		label: "depth",
		when: "work started from now on",
		help:
			"How many levels of delegation are allowed. Three is a lead that splits a question, " +
			"workers that split their part, and a leaf that goes and looks. Each level multiplies " +
			"the tree rather than lengthening it, and nothing bounds what that costs except the " +
			"budget.",
	},
	{
		kind: "whole",
		key: "maxConcurrent",
		label: "at once",
		when: "the next delegation call",
		help:
			"How many children one call runs at the same time. The rest queue behind them and " +
			"all of them still run, so this is about how hard the model provider is hit, not " +
			"about how much work happens.",
	},
];

export function Settings({
	settings,
	fixed,
	onChange,
	onClose,
	onNewConversation,
}: {
	settings: SettingsValues;
	fixed: Fixed;
	onChange: (patch: Partial<SettingsValues>) => void;
	onClose: () => void;
	onNewConversation: () => void;
}) {
	// A draft, so typing "0.5" does not send a patch at "0" and again at "0.". The server is
	// the authority: whatever it sends back replaces this.
	const [draft, setDraft] = useState(settings);
	useEffect(() => setDraft(settings), [settings]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	function commit(patch: Partial<SettingsValues>) {
		setDraft((current) => ({ ...current, ...patch }));
		onChange(patch);
	}

	return (
		<div className="sheet" onClick={onClose}>
			<div className="settings" onClick={(event) => event.stopPropagation()}>
				<div className="row">
					<strong>settings</strong>
					<span className="hint">this conversation only — nothing here is saved</span>
					<button type="button" onClick={onClose}>
						close
					</button>
				</div>

				{FIELDS.map((field) => (
					<div className="field" key={field.key}>
						<label htmlFor={`set-${field.key}`}>{field.label}</label>

						{field.kind === "number" && (
							<input
								id={`set-${field.key}`}
								type="number"
								min={field.min}
								step={field.step}
								value={draft.autoBudget}
								onChange={(event) => setDraft({ ...draft, autoBudget: Number(event.target.value) })}
								onBlur={(event) => commit({ autoBudget: Number(event.target.value) })}
							/>
						)}

						{field.kind === "model" && (
							<select
								id={`set-${field.key}`}
								value={draft.model}
								onChange={(event) => commit({ model: event.target.value })}
							>
								{/* The model in use, even when it is not one of the available ones. It was
								    reachable when the process started, and dropping it from the list would
								    silently redraw the menu as though something else were running. */}
								{!fixed.models.some((model) => model.id === draft.model) && (
									<option value={draft.model}>{draft.model}</option>
								)}
								{fixed.models.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name} — {model.id}
									</option>
								))}
							</select>
						)}

						{field.kind === "whole" && (
							<input
								id={`set-${field.key}`}
								type="number"
								min={1}
								max={8}
								step={1}
								value={draft[field.key]}
								onChange={(event) =>
									setDraft({ ...draft, [field.key]: Number(event.target.value) })
								}
								onBlur={(event) => commit({ [field.key]: Number(event.target.value) })}
							/>
						)}

						{field.kind === "path" && (
							<input
								id={`set-${field.key}`}
								type="text"
								spellCheck={false}
								placeholder="empty — the agents study nothing on this disk"
								value={draft.material ?? ""}
								onChange={(event) => setDraft({ ...draft, material: event.target.value })}
								onBlur={(event) => commit({ material: event.target.value.trim() || null })}
							/>
						)}

						{field.kind === "optionalNumber" && (
							<input
								id={`set-${field.key}`}
								type="number"
								min={1}
								step={100}
								placeholder="pi's default (20k)"
								value={draft.keepRecentTokens ?? ""}
								onChange={(event) =>
									setDraft({
										...draft,
										keepRecentTokens: event.target.value === "" ? null : Number(event.target.value),
									})
								}
								onBlur={(event) =>
									commit({
										keepRecentTokens: event.target.value === "" ? null : Number(event.target.value),
									})
								}
							/>
						)}

						<span className="when">takes effect: {field.when}</span>
						<p className="help">{field.help}</p>
					</div>
				))}

				{/* Down here rather than in the header, because it cannot be undone: the run you
				    are looking at is closed and its key forgotten, and there is no history to
				    find it in again. A destructive action a stray click can reach needs either a
				    confirmation box or somewhere quieter to live, and this is the quieter one. */}
				<div className="field fixed">
					<strong>start again</strong>
					<p className="help">
						Closes this conversation — it stops running by itself, its windows end, and the
						server forgets it. The graph you are looking at goes with it. Nothing is saved
						anywhere, so this is the only way back to an empty page.
					</p>
					<button type="button" onClick={onNewConversation}>
						new conversation
					</button>
				</div>

				<div className="field fixed">
					<strong>where this conversation lives</strong>
					<p className="help">
						Its own directory, made when it started and named after it. Everything the agents
						save lands there, and it is how one of them leaves something for another. It is
						not changeable, and it is not cleaned up: a folder deleted on your behalf is a
						folder you wanted. The machine is somewhere else and shares no files with it; it
						starts on the first command an agent runs, and every second it is up is in the
						total above.
					</p>
					<dl>
						<dt>this conversation's directory</dt>
						<dd>{fixed.workspace}</dd>
						<dt>extensions loaded</dt>
						<dd>{fixed.extensions.length > 0 ? fixed.extensions.join(", ") : "none"}</dd>
						<dt>machine</dt>
						<dd>{fixed.compute ?? "none — agents cannot run anything"}</dd>
						<dt>port</dt>
						<dd>{fixed.port}</dd>
					</dl>
				</div>
			</div>
		</div>
	);
}
