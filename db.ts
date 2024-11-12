import z from 'npm:zod'
import log4js from 'npm:log4js';

const log = log4js.getLogger('db');
log.level = Deno.env.get("DEBUG")?.split(',').includes('db') ? log4js.levels.DEBUG : log4js.levels.INFO;

export default class Database {
	static schema = z.record(z.array(z.number()));

	all: z.infer<typeof Database.schema>;
	#dbPath: string;

	constructor(dbPath: string = 'db/channels.json') {
		try { Deno.lstatSync(dbPath) }
		catch(e) {
			if (!(e instanceof Deno.errors.NotFound)) throw e;
			Deno.writeTextFileSync(dbPath, '{}');
		} 

		this.all = Database.schema.parse(JSON.parse(Deno.readTextFileSync(dbPath)));
		this.#dbPath = dbPath;
		
		log.info(`Database initialized with path ${this.#dbPath}.`);
	}
	
	upsert(id: string, areas: number[]) {
		this.all[id] = areas;
		log.debug(`Upserted ${id} with areas ${areas.join(', ')}.`);
		this.save();
	}

	destroy(id: string) {
		delete this.all[id]
		log.debug(`Destroyed entry ${id}.`);
	}

	save() {
		Deno.writeTextFileSync(this.#dbPath, JSON.stringify(this.all));
		log.debug(`Saved database to ${this.#dbPath}.`);
	}
}