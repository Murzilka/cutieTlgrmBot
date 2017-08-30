'use strict';

const storage = require('./storage');
const Status = require('./storage').Status;

/**
 * Выбор лапусечки
 *
 * @param {Number} chatId - chat id
 * @param {Date} date - дата
 * @returns {Number} - id лапусечки или null, если список участников пустой,
 * 										 или не удалось сохранить запись
 */
module.exports.electionInChat = function (chatId, date) {
	console.log(`electionInChat ${chatId} on ${date.toString()}`);
	return storage.getPlayers(chatId)
		.then(players => {
			console.log(`players.length is ${players.length}`);
			if (!players.length) {
				return null;
			}
			const cutieId = players[Math.floor(Math.random() * players.length)];
			console.log(`cutieId in ${chatId} is ${cutieId}`);
			return storage.setCutie(chatId, cutieId, date)
				.then(() => cutieId)
				.catch(err => {
					console.log(`err in ${chatId}: ${err.toString()}`);
					return null;
				});
		});
};

/**
 * @deprecated
 * Выборы лапусечки в чате
 * 
 * @param {Number} chatId - chat id
 * @param {Date} date - дата
 * @returns {Object} - объект с полями chatId, userId
 */
function _electionInChat(chatId, date) {
	console.log(`electionInChat ${chatId} on ${date.toString()}`);
	return storage.getPlayers(chatId)
		.then(players => {
			const result = { chatId: chatId, userId: null };
			if (players.length === 0) {
				console.log(`empty players list in ${chatId}`);
				return result;
			} else {
				const cutieId = players[Math.floor(Math.random() * players.length)];
				console.log(`cutieId in ${chatId} is ${cutieId}`);
				return storage.setCutie(chatId, cutieId, date)
					.then(r => {
						result.userId = (r == Status.ok) ? cutieId : null;
						return result;
					});
			}
		});
}

/**
 * @deprecated
 * Выборы лапусечек
 * 
 * @param {Date} date - дата
 * @returns {Object} - объект с полями chatId, userId
 */
module.exports.election = function (date) {
	console.log(`election on ${date.toString()}`);
	return storage.getChats()
		.then(chatsId => {
			console.log(`elections in ${chatsId.length} chats`);
			const promises = chatsId.map(id => _electionInChat(id, date));
			return Promise.all(promises);
		});
};
