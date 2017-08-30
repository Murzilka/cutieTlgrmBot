'use strict';

const util = require('util');

const Telegraf = require('telegraf');
const { Extra, memorySession, reply, Telegram } = require('telegraf');

const election = require('./election');
const UserMessage = require('./message');
const storage = require('./storage');
const Status = require('./storage').Status;
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(memorySession());
bot.telegram.getMe().then(botInfo => bot.options.username = botInfo.username);

bot.filter(({ message }) => {
	let b = true;
	if (message && message.text) {
		b = message.text.length > 2;
	}
	return b;
});

bot.use((ctx, next) => {
	let response = null;
	if (!ctx.from || !ctx.from.username) {
		response = UserMessage.errorEmptyUserName();
	}
	if (!ctx.chat || !ctx.chat.id || (ctx.chat.id == ctx.from.id)) {
		response = UserMessage.errorNoChat();
	}
	if (ctx.from.isbot) {
		response = UserMessage.errorBot();
	}
	if (response) ctx.reply(response, { reply_to_message_id: ctx.message.message_id });
	else next();
});

/** join - Принять участие в розыгрыше */
bot.command('join', ctx => {
	return storage.addPlayer(ctx.chat.id, ctx.chat.title, ctx.from.id)
		.then(result => {
			let response = null;
			if (result === Status.ok) {
				response = UserMessage.join(ctx.from.username);
			} else if (result === Status.exists) {
				response = UserMessage.alreadyJoined();
			} else {
				response = UserMessage.error(ctx.chat.id);
			}
			return ctx.reply(response, { reply_to_message_id: ctx.message.message_id });
		});
});

/** leave - Выйти из розыгрыша */
bot.command('leave', ctx => {
	return storage.removePlayer(ctx.chat.id, ctx.from.id)
		.then(result => {
			let response = null;
			if (result === Status.ok) {
				response = UserMessage.leave(ctx.from.username);
			} else if (result === Status.notExists) {
				response = UserMessage.didNotPlay();
			} else {
				response = UserMessage.error(ctx.chat.id);
			}
			return ctx.reply(response, { reply_to_message_id: ctx.message.message_id });
		});
});

/** get - Узнать текущего лапусечку */
bot.command('get', ctx => {
	let isNewCutie = false;
	const date = new Date();
	return storage.getCutie(ctx.chat.id, date)
		.then(cutieId => {
			if (cutieId) {
				return Promise.resolve(cutieId);
			}
			isNewCutie = true;
			return ctx.reply(UserMessage.startElection())
				.then(() => new Promise((resolve, reject) => {
					setTimeout(() => { resolve(); }, 2000);
				}))
				.then(() => ctx.reply(UserMessage.filterBad()))
				.then(() => new Promise((resolve, reject) => {
					setTimeout(() => { resolve(); }, 3000);
				}))
				.then(() => ctx.reply(UserMessage.filterBad2()))
				.then(() => new Promise((resolve, reject) => {
					setTimeout(() => { resolve(); }, 3000);
				}))
				.then(() => ctx.reply(UserMessage.filterGood()))
				.then(() => new Promise((resolve, reject) => {
					setTimeout(() => { resolve(); }, 1000);
				}))
				.then(() => election.electionInChat(ctx.chat.id, date));
		})
		.then(cutieId => {
			if (!cutieId) {
				return ctx.reply(UserMessage.error(ctx.chat.id)
					, { reply_to_message_id: ctx.message.message_id });
			} 
			return ctx.getChatMember(cutieId)
				.then(member => {
					if (!member || !member.user || !member.user.username) {
						return ctx.reply(UserMessage.error(ctx.chat.id)
							, { reply_to_message_id: ctx.message.message_id });
					}
					const msg = isNewCutie ? UserMessage.newCutie(member.user.username)
						: UserMessage.cutie(member.user.username);
					return ctx.reply(msg, { reply_to_message_id: ctx.message.message_id });
			})
			.catch(err => {
				return ctx.reply(UserMessage.error(ctx.chat.id)
					, { reply_to_message_id: ctx.message.message_id });
			});
		});
});

/** @deprecated */
bot.command('election', ctx => {
	console.log(`command election from ${ctx.from.id}`);
	if (ctx.from.id == process.env.ADMIN_USER_ID) {
		return election.election(new Date())
			.then(results => {
				console.log(`elections took places in ${results.length} chats`);
				const filtered = results.filter(r => r && r.userId);
				console.log(`elections are valid in ${filtered.length} chats`);
				const promises = filtered.map(r => {
					return ctx.telegram.getChatMember(r.chatId, r.userId)
						.then(member => {
							console.log(`cutie ${member.user.username} in ${r.chatId}`);
							r.user = member.user;
							return r;
						})
						.catch(err => {
							console.log(`err (1): ${err.toString()}`);
						});
				});
				return Promise.all(promises);
			})
			.then(members => {
				const msgArr = members.map(r =>
					ctx.telegram.sendMessage(r.chatId, UserMessage.cutie(r.user.username)));
				return Promise.all(msgArr);
			});
	}
});

bot.catch(err => {
	console.log('Ooops', err);
});

bot.startPolling();
