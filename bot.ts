import { Bot } from 'grammy';
import createLogger from 'logging';
import { Sequelize, DataTypes, Model } from 'sequelize';
import { Monitor } from './monitor';
import regions from './regions.json';

const log = createLogger('Bot');

if (!process.env.BOT_TOKEN || !process.env.API_TOKEN) {
	log.error('Bot and/or API token is not set!');
	process.exit(1);
}

const monitor = new Monitor(process.env.API_TOKEN);
const bot = new Bot(process.env.BOT_TOKEN);
const db = new Sequelize('sqlite://channels.sqlite', { logging: log.debug });

interface Channel {
	id: string;
	areas: string;
	areasArray: number[];
}

const Channels = class Channels extends Model {
	id!: string;
	areas!: string;

	get areasArray () {
		return this.getDataValue('areas').split(',').map(Number);
	}

	add(area: number) {
		const areas = this.areasArray;
		if (areas.includes(area)) return;
		areas.push(area);
		this.areas = areas.join(',');
	}

	remove(area: number) {
		const areas = this.areasArray;
		if (!areas.includes(area)) return;
		areas.splice(areas.indexOf(area), 1);
		this.areas = areas.join(',');
	}
}.init({
	id: { type: DataTypes.STRING, primaryKey: true },
	areas: { type: DataTypes.STRING, validate: { is: /^(\d+(,\d+)*)$/ } }
}, { sequelize: db, modelName: 'channels' });

bot.command("getchannel", ctx => ctx.reply(`Chat ID: \`${ctx.chat.id}\``, { parse_mode: 'MarkdownV2' }));
bot.command("subscribe", async ctx => {
	await Channels.upsert({ id: ctx.chat.id.toString(), areas: '8' });
	ctx.reply('Цей канал тепер підписаний на тривоги **м\\. Київ**\\.', { parse_mode: 'MarkdownV2' });
});
bot.command("unsubscribe", async ctx => {
	await Channels.destroy({ where: { id: ctx.chat.id.toString() } });
	ctx.reply('Цей канал тепер відписаний від сповіщень про тривоги\\.');
});
bot.command("debugsubscribeall", async ctx => {
	await Channels.upsert({ id: ctx.chat.id.toString(), areas: '0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24' });
	ctx.reply('Цей канал тепер підписаний на всі тривоги\\.', { parse_mode: 'MarkdownV2' });
})


bot.init().then(async () => {
	log.info(`Initialized as @${bot.botInfo?.username}.`);
	await db.sync({ logging: () => log.debug('Database synced.') }); // the object it logs is way too big
	log.info('Connected to the database.');

	monitor.start().events.on('update', async (oldAlerts, newAlerts) => {
		const changed: number[] = newAlerts.map((a: string, i: number) => a !== oldAlerts[i] ? i : -1).filter((i: number) => i !== -1);
		log.debug("Changed:", changed);
		if (changed.length === 0) return;

		(await Channels.findAll()).every(async (channel: Channel) => {
			const relevant = changed.filter((i: number) => channel.areasArray.includes(i));
			log.debug("Relevant:", relevant);
			if (relevant.length < 1) return;
			await bot.api.sendMessage(channel.id, `Alert changed in ${relevant.map((i: number) => `${regions[i]}: ${oldAlerts[i]} to ${newAlerts[i]}`).join(', ')}.`);
		})
	})
})

bot.start().catch(log.error);
