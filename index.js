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


const kMoscowTimeOffset = 3;
bot.use((ctx, next) => {
	const d = new Date();
	const utc = d.getTime() - (d.getTimezoneOffset() * 60000);
	ctx.date = new Date(utc + (3600000 * kMoscowTimeOffset));
	next();
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

let kGetLock = {};
	
/** get - Узнать текущего лапусечку */
bot.command('get', ctx => {
	let isNewCutie = false;
	return storage.getCutie(ctx.chat.id, ctx.date)
		.then(cutieId => {
			if (cutieId) {
				return ctx.getChatMember(cutieId)
					.then(member => {
						ctx.cutie = { id: cutieId, username: member.user.username };
						return Promise.resolve();
					}, err => {
						return ctx.reply(UserMessage.error(ctx.chat.id)
							, { reply_to_message_id: ctx.message.message_id });
					});
			}
			return storage.getPlayers(ctx.chat.id)
				.then(players => {
					if (players.length < 2) {
						return ctx.reply(UserMessage.emptyPlayers()
							, { reply_to_message_id: ctx.message.message_id });
					}
					if (kGetLock['' + ctx.chat.id]) {
						return ctx.reply(UserMessage.process()
						, { reply_to_message_id: ctx.message.message_id });
					}
					kGetLock['' + ctx.chat.id] = true;
					isNewCutie = true;
					return ctx.reply(UserMessage.startElection())
						.then(() => new Promise((resolve, reject) => {
							setTimeout(() => { resolve(); }, 2000);
						}))
						.then(() => clean(ctx, false))
						.then(() => new Promise((resolve, reject) => {
							setTimeout(() => { resolve(); }, 2000);
						}))
						.then(() => ctx.reply(UserMessage.filterBad(1)))
						.then(() => new Promise((resolve, reject) => {
							setTimeout(() => { resolve(); }, 5000);
						}))
						.then(() => ctx.reply(UserMessage.filterBad(2)))
						.then(() => new Promise((resolve, reject) => {
							setTimeout(() => { resolve(); }, 3000);
						}))
						.then(() => election.selectFiveFromChat(ctx.chat.id, ctx.date))
						.then(arr => {
							arr = election.cutArrayNow(arr);
							arr = arr.map(id => ctx.getChatMember(id)
								.then(member => { return { id: id, username: member.user.username }; }, err => null));
							return Promise.all(arr);
						})
						.then(arr => {
							arr = arr.filter(o => o);
							ctx.cutie = election.electNow(arr);
							return ctx.reply(UserMessage.filterGood(arr.map(o => o.username)));
						})
						.then(() => new Promise((resolve, reject) => {
							setTimeout(() => { resolve(); }, 2000);
						}))
						.then(() => ctx.reply(UserMessage.filterGood()))
						.then(() => {
							kGetLock['' + ctx.chat.id] = false;
							return storage.setCutie(ctx.chat.id, ctx.cutie.id, ctx.date)
								.then(() => new Promise((resolve, reject) => {
									setTimeout(() => { resolve(); }, 2000);
								}), err => {
									kGetLock['' + ctx.chat.id] = false;
									return ctx.reply(UserMessage.error(ctx.chat.id)
									, { reply_to_message_id: ctx.message.message_id });
								});
						});
				});
		})
		.then(() => {
			if (!ctx.cutie) return;
			return ctx.replyWithMarkdown(
				isNewCutie ? UserMessage.newCutieWithoutPing(ctx.cutie.username)
					: UserMessage.cutie(ctx.cutie.username)
				, { reply_to_message_id: ctx.message.message_id });
		});
});

/** stats - Посмотреть статистику */
bot.command('stats', ctx => {
	return storage.getCutie(ctx.chat.id, ctx.date)
		.then(cutieId => {
			ctx.cutie = { id: cutieId };
			return storage.getPlayers(ctx.chat.id);
		})
		.then(players => {
			ctx.playersCount = players.length;
			return storage.getStats(ctx.chat.id)
				.then(statArr => {
					const arr = statArr.map(o => ctx.getChatMember(o.userId)
						.then(member => { return { user: member.user, count: o.count }; }, err => null));
					return Promise.all(arr);
			});
		})
		.then(arr => {
			arr = arr.filter(o => o);
			/** @todo возможно превышение максимальной длины */
			let str = `Всего участников: ${ctx.playersCount}` + "\n";
			for (let i in arr) {
				const isCurrent = ctx.cutie.id === arr[i].user.id;
				str += "\n" + (isCurrent ? '*' : '') + arr[i].user.username + (isCurrent ? '*' : '')
					+ ': ' + arr[i].count;
			}
			return ctx.replyWithMarkdown(str, { reply_to_message_id: ctx.message.message_id });
		});
});

/** clean - удалить пользователей, которые не состоят в группе */
bot.command('clean', ctx => {
	return ctx.getChatMember(ctx.from.id)
		.then(chatMember => {
			if (chatMember.status !== 'creator') {
				return;
			}
			return clean(ctx, true);
		}, err => ctx.reply(UserMessage.error(ctx.chat.id)
			, { reply_to_message_id: ctx.message.message_id }));
});

// Handle message update
bot.on('message', ctx => {
	if (ctx.message.migrate_from_chat_id) return migrate(ctx);
	if (ctx.message.left_chat_member) return userLeft(ctx);
});


bot.catch(err => {
	console.log('Ooops', err);
});

bot.startPolling();

function migrate(ctx) {
	return storage.migrate(ctx.message.chat.id, ctx.message.migrate_from_chat_id)
		.then(() => {
			return ctx.reply(UserMessage.migrate(), { reply_to_message_id: ctx.message.message_id });
		}, err => {
			return ctx.reply(UserMessage.error(ctx.chat.id)
			, { reply_to_message_id: ctx.message.message_id });
		});
}

function userLeft(ctx) {
	return storage.removePlayer(ctx.chat.id, ctx.message.left_chat_member.id)
	.then(result => {
		let response = null;
		if (result === Status.ok) {
			if (ctx.message.left_chat_member.id === ctx.from.id) {
				response = UserMessage.out(ctx.message.left_chat_member.username);
			} else {
				response = UserMessage.ban(ctx.message.left_chat_member.username, ctx.from.username);
			}
		} else if (result === Status.error) {
			response = UserMessage.error(ctx.chat.id);
		}
		if (response) return ctx.reply(response);
	});
}

function clean(ctx, replay) {
	return storage.getPlayers(ctx.chat.id)
		.then(players => {
			let arr = players.map(id => ctx.getChatMember(id)
				.then(member => {
					member.storedId = id;
					return member;
				}, err => null));
			return Promise.all(arr);
		})
		.then(members => {
			members = members.filter(m => {
				let r = false;
				if (!m || !m.user || !m.user.id || m.user.id === 'deleted'
					|| m.status === 'left' || m.status === 'kicked') r = true;
				return r;
			});
			let arr = members.map(m => storage.removePlayer(ctx.chat.id, m.storedId)
				.then(status => {
					console.log(`remove ${m.storedId} status is ${status}`);
					m.removeStatus = status;
					return m;
				}));
			return Promise.all(arr);
		})
		.then(members => {
			members = members.filter(o => o.removeStatus === Status.ok);
			const usernames = members.map(m => m.user.username);
			return ctx.reply(UserMessage.clean(usernames)
				, replay ? { reply_to_message_id: ctx.message.message_id } : null);
		});
}
