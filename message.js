'use strict';

class Message {

	error(code) {
		return `Что-то пошло не так, пинганите @${process.env.ADMIN_USERNAME} и скажите, что ${code}`;
	}

	errorEmptyUserName() {
		return 'Ты странный, с тобой не получится играть';
	}

	errorNoChat() {
		return 'Бот работает только в чате';
	}

	errorBot() {
		return '01001010010001010101';
	}

	join(username) {
		return `@${username}, теперь ты в игре!`;
	}

	alreadyJoined() {
		return 'Уже играшь, ага';
	}

	leave(username) {
		return `@${username}, теперь ты вне игры!`;
	}

	didNotPlay() {
		return 'А ты и не играл';
	}

	emptyCutie() {
		return 'Лапусечка ещё не выбран';
	}

	startElection() {
		return 'А лапусечка ещё не выбран. Запускаю процедуру выбора';
	}

	filterBad() {
		return 'Отсеиваем гавнюков...';
	}

	filterBad2() {
		return 'Отсеиваем тех, кто недостоин...';
	}

	filterGood() {
		return 'Выбираем из оставшейся пары...';
	}

	newCutie(username) {
		return `Готово! Лапусечка дня @${username}!`;
	}

	cutie(username) {
		return `Лапусечка дня @${username}`;
	}

}

module.exports = new Message();
