import { Bot } from 'grammy';
import { Sequelize, DataTypes, Model } from 'npm:sequelize';
import { Monitor } from './monitor.ts';
import regions from './regions.json' with { type: "json" };

import { default as logging } from 'npm:logging'
// @ts-ignore: this library imports weirdly in deno
const log = logging.default("Bot");

if (!Deno.env.get("BOT_TOKEN") || !Deno.env.get("API_TOKEN")) {
	log.error('Bot and/or API token is not set!');
	Deno.exit(1);
}

const monitor = new Monitor(Deno.env.get("API_TOKEN")!);
const bot = new Bot(Deno.env.get("BOT_TOKEN")!);
const db = new Sequelize('sqlite://db/channels.sqlite', { logging: log.debug });

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

const getTime = (start: Date, end: Date) => {
	const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
	const hours = Math.floor(diff / 3600);
	const minutes = Math.ceil((diff % 3600) / 60);
	return `${hours > 0 ? `${hours} год. ` : ''}${minutes} хв.`;
}

bot.command("getchannel", ctx => ctx.reply(`Chat ID: \`${ctx.chatId}\``, { parse_mode: 'MarkdownV2' }));

bot.command("subscribe", async ctx => {
	await Channels.upsert({ id: ctx.chat.id.toString(), areas: '8' });
	return ctx.reply('Цей канал тепер підписаний на тривоги *м\\. Київ*\\.', { parse_mode: 'MarkdownV2' });
});
bot.command("unsubscribe", async ctx => {
	await Channels.destroy({ where: { id: ctx.chat.id.toString() } });
	return ctx.reply('Цей канал тепер відписаний від сповіщень про тривоги.');
});

bot.command("subscribeall", async ctx => {
	await Channels.upsert({ id: ctx.chat.id.toString(), areas: '0,1,2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24' });
	return ctx.reply('Цей канал тепер підписаний на всі тривоги\\.', { parse_mode: 'MarkdownV2' });
})

bot.command("alerts", ctx => ctx.reply(`🚨 *__Активні тривоги:__*\n${monitor.alerts.map((a, i) => ({active: a.active, text: '*' + regions[i] + '* (' + getTime(a.since, new Date()) + ')'})).filter(a => a.active).map(a => a.text).join(', ')}`.replace(/([\(\)\.!-])/g, '\\$1'), { parse_mode: "MarkdownV2" }));
bot.command("subscribed", async ctx => {
	const channel = await Channels.findOne({ where: { id: ctx.chat.id.toString() } });
	if (!channel) return ctx.reply('Цей канал не підписаний на жодні тривоги.');
	return ctx.reply(`Цей канал підписаний на: ${channel.areasArray.map((i: number) => '*' + regions[i] + '*').join(', ')}.`.replace(/([\(\)\.!-])/g, '\\$1'), { parse_mode: 'MarkdownV2' });
}
)

bot.init().then(async () => {
	log.info(`Initialized as @${bot.botInfo?.username}.`);
	await db.sync({ logging: () => log.debug('Database synced.') }); // the object it logs is way too big
	log.info('Connected to the database.');

	monitor.start().on('update', async (oldAlerts, newAlerts) => {
		const changed: number[] = newAlerts.map((a: {active: boolean}, i: number) => a.active !== oldAlerts[i].active ? i : -1).filter((i: number) => i !== -1);
		log.debug("Changed:", changed);
		if (changed.length === 0) return;

		const queue: { id: string, message: string }[] = [];
		(await Channels.findAll()).every((channel: Channel) => {
			const relevant = changed.filter((i: number) => channel.areasArray.includes(i));
			log.debug(`Relevant for ${channel.id}:`, relevant);
			if (relevant.length < 1) return;

			queue.push({id: channel.id, message: relevant.map((i: number) => `${newAlerts[i].active ? "🚨" : "🟢"} *${regions[i]}*: ${newAlerts[i].active ? "Повітряна тривога!" : `Відбій _(тривала ${getTime(oldAlerts[i].since, newAlerts[i].since)})_`}`).join('\n')});
			log.debug(`Queued message for ${channel.id}.`);
		});

		log.info(`Sending updates to ${queue.length} channels.`);
		for (const { id, message } of queue) await bot.api.sendMessage(id, message.replace(/([\(\)\.!-])/g, '\\$1'), { parse_mode: 'MarkdownV2' })
			.catch(e => log.error(`Failed to send message to ${id}:`, e))
			.finally(() => log.debug(`Sent update to ${id}.`));
	})
})

bot.start().catch(log.error);
