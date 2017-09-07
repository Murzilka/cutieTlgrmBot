'use strict';

const storage = require('./storage');
const Status = require('./storage').Status;

module.exports.electNow = arr => arr[Math.floor(Math.random() * arr.length)];

module.exports.cutArrayNow = arr => {
	return (arr.lengh < 4) ? arr : arr.slice(0, 3 + Math.floor(Math.random() * 2));
};

module.exports.selectFiveFromChat = function (chatId, date) {
	console.log(`electionInChat ${chatId} on ${date.toString()}`);
	return storage.getPlayers(chatId)
		.then(players => {
			console.log(`players.length is ${players.length}`);
			for (let i = players.length; i; --i) {
				const j = Math.floor(Math.random() * i);
				[players[i - 1], players[j]] = [players[j], players[i - 1]];
			}
			console.log(`cutieId in ${chatId} is ${players}`);
			return (players.length > 3) ? players.slice(0, 5) : players;
		});
};
