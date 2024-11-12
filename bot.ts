import log4js from 'npm:log4js';
import { Bot, Context } from 'grammy';
import { Monitor } from './monitor.ts';
import Database from './db.ts'
import regions from './regions.json' with { type: "json" };

const log = log4js.getLogger('bot');
log.level = Deno.env.get("DEBUG")?.split(',').includes('bot') ? log4js.levels.DEBUG : log4js.levels.INFO;

if (!Deno.env.get("BOT_TOKEN") || !Deno.env.get("API_TOKEN")) {
	log.error('Bot and/or API token is not set!');
	Deno.exit(1);
}

const monitor = new Monitor(Deno.env.get("API_TOKEN")!);
const bot = new Bot(Deno.env.get("BOT_TOKEN")!);
const db = new Database();

const getTime = (start: Date, end: Date) => {
	const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
	const hours = Math.floor(diff / 3600);
	const minutes = Math.ceil((diff % 3600) / 60);
	return `${hours > 0 ? `${hours} год. ` : ''}${minutes} хв.`;
}

const reply = (ctx: Context, text: string) => ctx.reply(text.replace(/([()*.!-])/g, '\\$1'), { 
	parse_mode: 'MarkdownV2',
});

bot.command("getchannel", ctx => reply(ctx, `Chat ID: \`${ctx.chatId}\``));

bot.command("subscribe", ctx => {
	const areas = [
		...db.all[ctx.chat.id.toString()] || [],
		...ctx.match?.match(/\d+/g)?.map(Number) || [8]
	].toSorted((a, b) => a - b).filter(i => i >= 0 && i < 25).filter((v, i, a) => a.indexOf(v) === i);

	db.upsert(ctx.chat.id.toString(), areas);
	return reply(ctx, `Цей канал тепер підписаний на тривоги *${areas.map(a => regions[a]).join('*, *')}*.`);
});

bot.command("unsubscribe", ctx => {
	db.destroy(ctx.chat.id.toString());
	return reply(ctx, 'Цей канал тепер відписаний від сповіщень про тривоги.');
});

bot.command("subscribeall", ctx => {
	db.upsert(ctx.chat.id.toString(), Array.from(Array(25)).map((_, i) => i));
	return reply(ctx, 'Цей канал тепер підписаний на всі тривоги\\.');
});

bot.command("areas", ctx => reply(ctx, `🌍 *__Області:__*\n${regions.map((r, i) => `${monitor.alerts[i].active ? '🔴' : '🟢'} ${i}: *${r}*${monitor.alerts[i].active ? ` - ${getTime(monitor.alerts[i].since, new Date())}`: ''}`).join('\n')}`));
bot.command("alerts", ctx => reply(ctx, `🚨 *__Активні тривоги:__*\n${monitor.alerts.map((a, i) => ({active: a.active, text: '*' + regions[i] + '* (' + getTime(a.since, new Date()) + ')'})).filter(a => a.active).map(a => a.text).join(', ')}`));

bot.command("subscribed", ctx => {
	const areas = db.all[ctx.chat.id.toString()];
	if (!areas) return ctx.reply('Цей канал не підписаний на жодні тривоги.');
	return reply(ctx, `Цей канал підписаний на: *${areas.map(i => regions[i]).join('*, *')}*.`);
}
)

bot.init().then(() => {
	log.info(`Initialized as @${bot.botInfo?.username}. (commit ${Deno.env.get("COMMIT_HASH") || '<unknown>'})`);

	monitor.start().on('update', async (oldAlerts, newAlerts) => {
		const changed: number[] = newAlerts.map((a: {active: boolean}, i: number) => a.active !== oldAlerts[i].active ? i : -1).filter((i: number) => i !== -1);
		log.debug("Changed:", changed);
		if (changed.length === 0) return;

		const queue: { id: string, message: string }[] = [];
		Object.keys(db.all).forEach(id => {
			const relevant = changed.filter((i: number) => db.all[id].includes(i));
			log.debug(`Relevant for ${id}:`, relevant);
			if (relevant.length < 1) return;

			queue.push({id, message: relevant.map((i: number) => `${newAlerts[i].active ? "🚨" : "🟢"} *${regions[i]}*: ${newAlerts[i].active ? "Повітряна тривога!" : `Відбій _(тривала ${getTime(oldAlerts[i].since, newAlerts[i].since)})_`}`).join('\n')});
			log.debug(`Queued message for ${id}.`);
		});

		log.info(`Sending updates to ${queue.length} channels.`);
		for (const { id, message } of queue) await bot.api.sendMessage(id, message.replace(/([().!-])/g, '\\$1'), { parse_mode: 'MarkdownV2' })
			.catch(e => log.error(`Failed to send message to ${id}:`, e))
			.finally(() => log.debug(`Sent update to ${id}.`));
	})
})

bot.start().catch(log.error);
