# Plain last lines in the deck GIFs (2026-10-23)

The last line of a GIF is the title on its held last frame. Each new line names
the diagram type and what the diagram shows. The script.md timeline quotes use
the new lines too.

| GIF | Scene (key) | Old last line | New last line |
|---|---|---|---|
| platform.gif | scenes_motion_logical (std_platform) | Producers publish, consumers ask, the seed runs it | Overview: the Lumen platform between producers and consumers |
| usecases.gif | scenes_motion_logical (usecases) | Six use cases, four actors, all built | Use case diagram: six use cases and four actors |
| usecases.gif, first step | scenes_motion_logical (usecases) | Four actors, six use cases, one system boundary | Four actors and the system boundary of the Lumen platform |
| contextmap.gif | scenes_motion_logical (contextmap) | Five contexts, one core domain, six domain events | Context map: five bounded contexts and six domain events |
| interaction.gif | scenes_motion_logical (interaction) | Publish, list, ask, read: all on the public API v1 | Sequence diagram: producer and consumer calls on the public API v1 |
| logical.gif | scenes_motion_logical (logical) | Five services behind one gateway; turns wait in RabbitMQ | Component diagram: five services behind the Traefik API gateway |
| queues.gif | scenes_motion_logical (queues) | The leads write their answers: every question finishes | Per-level queues and worker slots after all questions finish |
| physdecisions.gif | scenes_motion_physical (physdecisions) | Three decisions shape the physical architecture | Physical architecture decisions AD-09, AD-11 and AD-06 |
| deployment.gif | scenes_motion_physical (deployment) | One EC2 node runs the whole platform in k3s | UML deployment diagram: the platform in k3s on one EC2 node |
| scaling.gif | scenes_motion_physical (scaling) | Up to 4 workers at the peak, back to 1 after; no request failed | Load test of 20 October: 1 to 4 workers, and no request failed |
| er.gif | scenes_motion_physical (er) | PostgreSQL 16, money as numeric(12,6); turns stay in RabbitMQ | ER diagram: PostgreSQL 16 tables, money as numeric(12,6) |
| branches.gif | scenes_motion_physical (branches) | One integration branch, one image per commit | Git branches and the deploy path of each commit on ass/platform |
| pipeline.gif | scenes_motion_physical (cicd) | Every stage passed: all jobs done in 12 min 30 s | CI/CD pipeline: all jobs passed in 12 min 30 s |
| milestones.gif | scenes_lean (milestones) | 3. Every part was built and deployed to AWS by 21 October | 3. Gantt chart: all tasks done and deployed to AWS by 21 October |

## Not changed

These last lines are already plain:

- decisions.gif: "Three key decisions of the logical design"
- findings.gif: "Three technical findings and how the team fixed them"
- sequence.gif: "The app gets 201 at once and reads the answer while the worker runs"

Recordings (rec-*.gif, lumen-at-work.gif) are out of scope.

## Left for a later pass

- Intermediate titles with a semicolon, not slogans, so they stay:
  "More commits land; each one is pushed" (branches),
  "AD-04 after: that line breaks; the step goes through session" (decisions),
  "AD-06, after: one PostgreSQL; each context keeps its own tables" (physdecisions),
  "The image passes the gate; the deploy steps run one after another" (pipeline).
- script.md heading "Slide 7: Five services behind one gateway" is a slide
  heading, not a GIF line.
- Spoken lines in script.md that paraphrase an old line (usecases 20.1 s,
  queues 24.9 s, pipeline 18.3 s) read as plain speech and stay.
