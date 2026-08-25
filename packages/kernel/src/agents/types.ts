/**
 * What an agent is here: a name, a job description, a system prompt, and a tool budget.
 *
 * The description is not documentation. It is the text the calling agent reads when it
 * chooses who to delegate to, so it has to say what this agent is good at and what it
 * returns. A description written for a human reader ("Handles research tasks") gives
 * the caller nothing to choose on, and the caller then picks the first one every time.
 */

export interface AgentSpec {
	name: string;
	/** Read by the calling model. Say what it does and what it hands back. */
	description: string;
	systemPrompt: string;
	/**
	 * Tool allowlist. Omit to inherit the caller's tools.
	 *
	 * A narrow list is the cheapest safety device in the system: an agent that cannot
	 * call `write` cannot damage the workspace whatever it is talked into.
	 */
	tools?: string[];
	/** Model id. Omit to inherit the caller's model, which is almost always right. */
	model?: string;
	/**
	 * Whether this agent may spawn agents of its own.
	 *
	 * Off by default. Mutual delegation is the point of this system, but a leaf agent
	 * that can delegate turns one careless prompt into an unbounded bill, and the depth
	 * cap alone catches that too late to be comfortable.
	 */
	canDelegate?: boolean;
	/**
	 * Whether this agent may declare its work complete, and so stop whoever is driving it.
	 *
	 * Only worth giving to an agent that is driven — one that is asked again the moment it
	 * stops. A delegated worker ends its own turn by saying nothing more, and needs no tool
	 * to do it; handing it one only invites a call that means nothing to anybody.
	 */
	canFinish?: boolean;
	/**
	 * Whether this agent may leave files in the conversation's own directory.
	 *
	 * Separate from the file tools in `tools`, because it is a different question. Those say
	 * what an agent may look at; this says whether it may leave anything behind. An agent
	 * that reads a repository and an agent that writes a report are not the same risk, and
	 * they are not the same feature.
	 */
	canSave?: boolean;
	/**
	 * Whether this agent may run commands on the conversation's machine.
	 *
	 * The widest permission here, and separate from every other one because it is a
	 * different kind of thing. `tools` says what an agent may look at and `canSave` says
	 * what it may leave behind; this says whether it may cause arbitrary code to execute.
	 * That the code runs in somebody else's container and not on this disk is what makes it
	 * grantable at all, and it is still the permission to read every second of it as money.
	 */
	canRun?: boolean;
	/**
	 * Whether this agent may declare a finding with `discover`.
	 *
	 * Unlike `canRun` and `canSave`, this is not a permission worth keeping scarce: declaring
	 * a finding costs nothing beyond the turn that calls it, and it is not a way to damage
	 * anything or spend money nobody agreed to. It is likely to end up `true` for every agent
	 * in practice. It stays an explicit flag anyway, so the same rule holds for this as for
	 * every other capability here — what an agent can do is read from its spec, not assumed.
	 */
	canDiscover?: boolean;
	/**
	 * Whether other agents may be handed work as this one. On by default.
	 *
	 * Off for the agent that holds the conversation. Once workers can delegate, the catalogue
	 * is a menu they read and the lead is on it — so a worker hands work to a lead, which is
	 * a full conversational window with no file tools, which delegates again. The depth cap
	 * is the only thing that ends that, three levels too late, and every window of it is
	 * billed. A person sending a line off by hand is not affected: that goes through the
	 * server, not through this menu.
	 */
	delegable?: boolean;
}

export class AgentRegistry {
	private readonly specs = new Map<string, AgentSpec>();

	constructor(specs: AgentSpec[] = []) {
		for (const spec of specs) this.add(spec);
	}

	add(spec: AgentSpec): void {
		if (this.specs.has(spec.name)) {
			throw new Error(`agent ${spec.name} is already registered`);
		}
		this.specs.set(spec.name, spec);
	}

	get(name: string): AgentSpec {
		const spec = this.specs.get(name);
		if (!spec) {
			throw new Error(`unknown agent ${name}; available: ${[...this.specs.keys()].join(", ")}`);
		}
		return spec;
	}

	has(name: string): boolean {
		return this.specs.has(name);
	}

	/** Whether a model may hand work to this agent. Enforced, not merely left off the menu. */
	delegable(name: string): boolean {
		return this.specs.get(name)?.delegable !== false;
	}

	list(): AgentSpec[] {
		return [...this.specs.values()];
	}

	/**
	 * The menu handed to a delegating model, as one block of text.
	 *
	 * Only what may actually be delegated to. An agent listed here and refused on call would
	 * teach the model to try it every time, and each attempt costs a turn.
	 */
	catalogue(): string {
		return this.list()
			.filter((spec) => spec.delegable !== false)
			.map((spec) => `- ${spec.name}: ${spec.description}`)
			.join("\n");
	}
}
