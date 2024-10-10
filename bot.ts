import { Bot } from 'grammy';
import createLogger from 'logging';
import { Monitor } from './monitor';

const log = createLogger('Bot');

if (!process.env.BOT_TOKEN || !process.env.ALERTS_TOKEN) {
	log.error('Bot and/or API token is not set!');
	process.exit(1);
}

const monitor = new Monitor(process.env.ALERTS_TOKEN);
const bot = new Bot(process.env.BOT_TOKEN);

bot.command("getchannel", ctx => ctx.reply(`Chat ID: \`${ctx.chat.id}\``, { parse_mode: 'MarkdownV2' }));
bot.command("testsend", ctx => bot.api.sendMessage('', 'i will take over the world'));

bot.start().catch(log.error);
//log.info(`Logged in as @${bot.botInfo?.username}.`);