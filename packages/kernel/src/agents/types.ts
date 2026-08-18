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

	list(): AgentSpec[] {
		return [...this.specs.values()];
	}

	/** The menu handed to a delegating model, as one block of text. */
	catalogue(): string {
		return this.list()
			.map((spec) => `- ${spec.name}: ${spec.description}`)
			.join("\n");
	}
}
