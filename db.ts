import z from 'npm:zod'
import log4js from 'npm:log4js';

const log = log4js.getLogger('db');
log.level = Deno.env.get("DEBUG")?.split(',').includes('db') ? log4js.levels.DEBUG : log4js.levels.INFO;

export default class Database {
	static schema = z.array(z.object({
		id: z.string(),
		areas: z.array(z.number())
	}));

	all: z.infer<typeof Database.schema>;
	#dbPath: string;

	constructor(dbPath: string = 'db/channels.json') {
		try { Deno.lstatSync(dbPath) }
		catch(e) {
			if (!(e instanceof Deno.errors.NotFound)) throw e;
			Deno.writeTextFileSync(dbPath, '[]');
		} 

		this.all = Database.schema.parse(JSON.parse(Deno.readTextFileSync(dbPath)));
		this.#dbPath = dbPath;
		
		log.info(`Database initialized with path ${this.#dbPath}.`);
	}
	
	upsert(id: string, areas: number[]) {
		const index = this.all.findIndex(c => c.id === id);

		if (index === -1) this.all.push({ id, areas });
		else this.all[index].areas = areas;
		log.debug(`Upserted ${id} with areas ${areas.join(', ')}.`);
		this.save();
	}

	destroy(id: string) {
		this.all = this.all.filter(c => c.id !== id);
		log.debug(`Destroyed entry ${id}.`);
	}

	save() {
		Deno.writeTextFileSync(this.#dbPath, JSON.stringify(this.all));
		log.debug(`Saved database to ${this.#dbPath}.`);
	}
}