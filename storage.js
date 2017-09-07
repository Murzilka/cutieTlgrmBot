'use strict';

const Sequelize = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL);

const Chat = sequelize.define('chat', {
	chatId: {
		type: Sequelize.BIGINT,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: true
	},
	title: {
		type: Sequelize.STRING,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: false
	},
	error: {
		type: Sequelize.INTEGER,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: true
	}
});

const Player = sequelize.define('player', {
	chatId: {
		type: Sequelize.BIGINT,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: false,
		unique: 'uniquePlayerOnChat'
		// , references: {
		// 	model: Chat,
		// 	key: 'chatId'
		// 	//, deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
		// }
	},
	userId: {
		type: Sequelize.INTEGER,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: false,
		unique: 'uniquePlayerOnChat'
	}
});

const Cutie = sequelize.define('cutie', {
	chatId: {
		type: Sequelize.BIGINT,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: false,
		unique: 'uniqueCutieOnChat'
		// , references: {
		// 	model: Chat,
		// 	key: 'chatId'
		// 	//, deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
		// }
	},
	userId: {
		type: Sequelize.INTEGER,
		allowNull: false,
		defaultValue: null,
		special: [],
		primaryKey: false
	},
	date: {
		type: Sequelize.DATEONLY,
		allowNull: false,
		defaultValue: null,
		special: [],
		unique: 'uniqueCutieOnChat'
	}
});

sequelize
.authenticate()
.then(() => {
	console.log('sync Chat');
	return Chat.sync();
})	
.then(() => {
	console.log('sync Player');
	return Player.sync();
})
.then(() => {
	console.log('sync Cutie');
	return Cutie.sync();
})
.catch(err => {
	console.error('Unable to connect to the database:', err);
});

module.exports.Status = {
	ok: 1
	, exists: 2
	, notExists: 3
	, empty: 4
	, error: 100
};

function addChat(chatId, title) {
	return Chat.create({ chatId: chatId, title: title, error: 0 })
	.catch(err => {
		let result = module.exports.Status.exists;
		if (err.name !== 'SequelizeUniqueConstraintError') {
			console.error(err);
			result = module.exports.Status.error;
		}
		return result;
	});
}

module.exports.getChats = function () {
	return Chat.findAll()
	.then(result => result.map(r => r.chatId))
	.catch(err => {
		console.error(err);
		return [];
	});
};

module.exports.addPlayer = function (chatId, title, userId) {
	return addChat(chatId, title)
	.then(result => {
		return Player.create({ chatId: chatId, userId: userId })
		.then(player => module.exports.Status.ok)
		.catch(err => {
			let result = module.exports.Status.exists;
			if (err.name !== 'SequelizeUniqueConstraintError') {
				console.error(err);
				result = module.exports.Status.error;
			}
			return result;
		});
	});
};

module.exports.removePlayer = function (chatId, userId) {
	return Player.destroy({ where: { chatId: chatId, userId: userId } })
		.then(result => (result > 0) ? module.exports.Status.ok : module.exports.Status.notExists)
		.catch(err => {
			console.error(err);
			return module.exports.Status.error;
		});
};

module.exports.getPlayers = function (chatId) {
	return Player.findAll({ where: { chatId: chatId } })
	.then(result => result.map(r => r.userId))
	.catch(err => {
		console.error(err);
		return [];
	});
};

module.exports.getCutie = function (chatId, date) {
	return Cutie.findAll({ where: { chatId: chatId, date: date } })
	.then(result => result.length ? result[0].userId : null)
	.catch(err => {
		console.error(err);
		return module.exports.Status.error;
	});
};

module.exports.setCutie = function (chatId, userId, date) {
	return Cutie.create({ chatId: chatId, userId: userId, date: date })
	.then(cutie => module.exports.Status.ok)
	.catch(err => {
		let result = module.exports.Status.exists;
		if (err.name !== 'SequelizeUniqueConstraintError') {
			console.error(err);
			result = module.exports.Status.error;
		}
		return result;
	});
};

module.exports.getStats = function (chatId) {
	const date = new Date();
	return Cutie.findAll({ where: { chatId: chatId } })
		.then(arr => {
			let stats = {};
			for (let i in arr) {
				if (!stats[arr[i].userId]) stats[arr[i].userId] = 1;
				else ++stats[arr[i].userId];
			}
			let compressedArr = [];
			for (let i in stats) compressedArr.push({ userId: i, count: stats[i] });
			return compressedArr.sort((a, b) => b.count - a.count);
		});
};

module.exports.migrate = function (newId, oldId) {
	return sequelize.transaction()
		.then(t => Chat.update({ chatId: newId }, { where: { chatId: oldId } }, { transaction: t })
			.then(() => Player.update({ chatId: newId }, { where: { chatId: oldId } }, { transaction: t }))
			.then(() => Cutie.update({ chatId: newId }, { where: { chatId: oldId } }, { transaction: t }))
			.then(() => t.commit())
			.catch(err => {
				console.log(err);
				t.rollback();
				throw err;
			})
	);
};
