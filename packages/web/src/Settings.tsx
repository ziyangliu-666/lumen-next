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
 *   Every changeable setting says when it starts to matter. Two of the three cannot claim
 *   "now": pi binds the model and the compaction thresholds when a session is built, so
 *   they apply to the next window. A page that implied otherwise would have people watching
 *   a run they thought had changed model.
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
	| { kind: "optionalNumber"; key: "keepRecentTokens"; label: string; when: string; help: string };

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
];

export function Settings({
	settings,
	fixed,
	onChange,
	onClose,
}: {
	settings: SettingsValues;
	fixed: Fixed;
	onChange: (patch: Partial<SettingsValues>) => void;
	onClose: () => void;
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

				<div className="field fixed">
					<strong>fixed when the server started</strong>
					<p className="help">
						Changing these from a page would mean a page that can point the agents at another
						directory, or hand them another tool. Both stay on the command line.
					</p>
					<dl>
						<dt>what the agents can read</dt>
						<dd>{fixed.cwd}</dd>
						<dt>extensions loaded</dt>
						<dd>{fixed.extensions.length > 0 ? fixed.extensions.join(", ") : "none"}</dd>
						<dt>port</dt>
						<dd>{fixed.port}</dd>
					</dl>
				</div>
			</div>
		</div>
	);
}
