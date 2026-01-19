// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

// Telegram Web App
const tg = window.Telegram?.WebApp;

// Игровое состояние
const gameState = {
    players: [],
    currentPlayer: null,
    zones: [],
    phase: 'WAITING', // WAITING, TERRITORY_SELECTION, BATTLE, FINISHED
    currentQuestion: null,
    roundNumber: 0,
    attackSequence: [0, 1, 2, 1, 2, 0, 2, 0, 1, 0, 2, 1], // Порядок атак
    attackIndex: 0
};

// Цвета игроков
const PLAYER_COLORS = ['red', 'yellow', 'green'];
const COLOR_NAMES = {
    red: 'Красный',
    yellow: 'Желтый', 
    green: 'Зелёный'
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ ИГРЫ
// ============================================

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Игра загружается...');
    
    // Настройка Telegram Web App
    if (tg) {
        tg.ready();
        tg.expand();
        console.log('✅ Telegram Web App готов');
    }
    
    // Создаем карту
    createMap();
    
    // Инициализируем игроков (для теста - 3 бота)
    initializePlayers();
    
    // Начинаем игру
    startGame();
});

// ============================================
// СОЗДАНИЕ КАРТЫ
// ============================================

function createMap() {
    const mapElement = document.getElementById('game-map');
    mapElement.innerHTML = '';
    
    // Создаем 15 зон
    for (let i = 1; i <= 15; i++) {
        const zone = document.createElement('div');
        zone.className = 'zone neutral';
        zone.id = `zone-${i}`;
        zone.textContent = i;
        zone.dataset.zoneId = i;
        
        // Добавляем обработчик клика
        zone.addEventListener('click', () => handleZoneClick(i));
        
        mapElement.appendChild(zone);
        
        // Сохраняем в состоянии
        gameState.zones.push({
            id: i,
            owner: null,
            isCapital: false
        });
    }
    
    console.log('✅ Карта создана: 15 зон');
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ИГРОКОВ
// ============================================

function initializePlayers() {
    // Создаем 3 игроков для теста
    const playerNames = ['Игрок 1', 'Игрок 2', 'Игрок 3'];
    
    for (let i = 0; i < 3; i++) {
        gameState.players.push({
            id: i,
            name: playerNames[i],
            color: PLAYER_COLORS[i],
            score: 0,
            territories: [],
            capital: null,
            isEliminated: false
        });
    }
    
    // Отображаем игроков в шапке
    updatePlayerDisplay();
    
    console.log('✅ Игроки созданы:', gameState.players);
}

function updatePlayerDisplay() {
    const container = document.getElementById('player-info-container');
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.innerHTML = `
            <div class="player-color" style="background: ${player.color};"></div>
            <div>
                <div class="player-name">${player.name}</div>
                <div class="player-score">${player.score} баллов</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ============================================
// НАЧАЛО ИГРЫ
// ============================================

function startGame() {
    console.log('🎮 Начинаем игру!');
    
    // Распределяем столицы
    distributeCapitals();
    
    // Обновляем статус
    updateGameStatus('Раунд 1: Выбор территорий');
    
    // Переходим к первому раунду
    gameState.phase = 'TERRITORY_SELECTION';
    gameState.roundNumber = 1;
    
    // Показываем первый вопрос через 2 секунды
    setTimeout(() => {
        showTerritoryQuestion();
    }, 2000);
}

// ============================================
// РАСПРЕДЕЛЕНИЕ СТОЛИЦ
// ============================================

function distributeCapitals() {
    const availableZones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const capitals = [];
    
    // Выбираем 3 столицы так, чтобы между ними была минимум 1 зона
    while (capitals.length < 3) {
        const randomIndex = Math.floor(Math.random() * availableZones.length);
        const zoneId = availableZones[randomIndex];
        
        // Проверяем, не слишком ли близко к другим столицам
        const isTooClose = capitals.some(capitalId => {
            return areZonesAdjacent(zoneId, capitalId) || zoneId === capitalId;
        });
        
        if (!isTooClose) {
            capitals.push(zoneId);
        }
    }
    
    // Назначаем столицы игрокам
    gameState.players.forEach((player, index) => {
        const capitalZoneId = capitals[index];
        player.capital = capitalZoneId;
        player.territories.push(capitalZoneId);
        
        // Обновляем зону
        const zone = gameState.zones.find(z => z.id === capitalZoneId);
        zone.owner = player.id;
        zone.isCapital = true;
        
        // Визуально обновляем
        const zoneElement = document.getElementById(`zone-${capitalZoneId}`);
        zoneElement.className = `zone ${player.color} capital`;
    });
    
    console.log('✅ Столицы распределены:', capitals);
}

// ============================================
// ПРОВЕРКА СОСЕДСТВА ЗОН
// ============================================

function areZonesAdjacent(zone1, zone2) {
    // Карта 5x3, проверяем соседство
    const getRow = (z) => Math.floor((z - 1) / 5);
    const getCol = (z) => (z - 1) % 5;
    
    const row1 = getRow(zone1);
    const col1 = getCol(zone1);
    const row2 = getRow(zone2);
    const col2 = getCol(zone2);
    
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    
    // Соседи если разница 1 по строке ИЛИ столбцу (но не по диагонали)
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Получить соседние зоны
function getAdjacentZones(zoneId) {
    return gameState.zones
        .filter(zone => areZonesAdjacent(zoneId, zone.id))
        .map(zone => zone.id);
}

// ============================================
// ОБНОВЛЕНИЕ СТАТУСА ИГРЫ
// ============================================

function updateGameStatus(message) {
    document.getElementById('game-status').textContent = message;
}

// ============================================
// ЭТАП ВЫБОРА ТЕРРИТОРИЙ
// ============================================

function showTerritoryQuestion() {
    console.log('❓ Показываем вопрос на выбор территории');
    
    // Пример цифрового вопроса
    const question = {
        text: 'Сколько километров составляет длина реки Урал на территории Казахстана?',
        correctAnswer: 1084,
        type: 'numeric'
    };
    
    gameState.currentQuestion = question;
    
    // Показываем вопрос
    showQuestion(question);
    
    // Автоматически отвечаем за ботов (для теста)
    setTimeout(() => {
        simulateBotAnswers(question);
    }, 3000);
}

function showQuestion(question) {
    const questionSection = document.getElementById('question-section');
    const questionText = document.getElementById('question-text');
    const numericAnswer = document.getElementById('numeric-answer');
    const multipleChoice = document.getElementById('multiple-choice');
    
    questionText.textContent = question.text;
    questionSection.classList.remove('hidden');
    
    if (question.type === 'numeric') {
        numericAnswer.classList.remove('hidden');
        multipleChoice.classList.add('hidden');
        
        // Очищаем поле ввода
        document.getElementById('answer-input').value = '';
        
        // Обработчик отправки
        document.getElementById('submit-answer').onclick = () => {
            const answer = parseInt(document.getElementById('answer-input').value);
            submitAnswer(answer);
        };
    } else {
        numericAnswer.classList.add('hidden');
        multipleChoice.classList.remove('hidden');
        
        // Заполняем варианты
        question.options.forEach((option, index) => {
            const btn = document.querySelectorAll('.option-btn')[index];
            btn.textContent = option;
            btn.onclick = () => submitAnswer(String.fromCharCode(65 + index));
        });
    }
}

function hideQuestion() {
    document.getElementById('question-section').classList.add('hidden');
}

// ============================================
// СИМУЛЯЦИЯ ОТВЕТОВ БОТОВ (ДЛЯ ТЕСТА)
// ============================================

function simulateBotAnswers(question) {
    const answers = [];
    
    gameState.players.forEach(player => {
        // Генерируем случайный ответ близкий к правильному
        const deviation = Math.floor(Math.random() * 200) - 100;
        const answer = question.correctAnswer + deviation;
        const time = Math.random() * 5000; // 0-5 секунд
        
        answers.push({
            playerId: player.id,
            answer: answer,
            time: time
        });
    });
    
    console.log('🤖 Боты ответили:', answers);
    
    // Определяем победителей
    processTerritoryAnswers(answers, question.correctAnswer);
}

function submitAnswer(answer) {
    console.log('✅ Ответ отправлен:', answer);
    // Здесь будет логика для реального игрока
}

// ============================================
// ОБРАБОТКА ОТВЕТОВ НА ВОПРОСЫ О ТЕРРИТОРИИ
// ============================================

function processTerritoryAnswers(answers, correctAnswer) {
    // Сортируем по близости к правильному ответу
    answers.sort((a, b) => {
        const diffA = Math.abs(a.answer - correctAnswer);
        const diffB = Math.abs(b.answer - correctAnswer);
        
        if (diffA === diffB) {
            return a.time - b.time; // Если одинаково - по времени
        }
        return diffA - diffB;
    });
    
    const winner = answers[0];
    const secondPlace = answers[1];
    
    console.log('🏆 Победитель:', winner);
    console.log('🥈 Второе место:', secondPlace);
    
    hideQuestion();
    
    // Победитель выбирает 2 зоны
    setTimeout(() => {
        selectTerritory(winner.playerId, 2);
    }, 1000);
    
    // Второй выбирает 1 зону
    setTimeout(() => {
        selectTerritory(secondPlace.playerId, 1);
    }, 3000);
    
    // Следующий вопрос или переход к битве
    setTimeout(() => {
        if (gameState.zones.every(z => z.owner !== null)) {
            startBattlePhase();
        } else {
            showTerritoryQuestion();
        }
    }, 5000);
}

// ============================================
// ВЫБОР ТЕРРИТОРИИ
// ============================================

function selectTerritory(playerId, count) {
    const player = gameState.players[playerId];
    updateGameStatus(`${player.name} (${COLOR_NAMES[player.color]}) выбирает ${count} территорию`);
    
    // Получаем доступные зоны (соседние с территориями игрока)
    const availableZones = [];
    player.territories.forEach(terrId => {
        const adjacent = getAdjacentZones(terrId);
        adjacent.forEach(zoneId => {
            const zone = gameState.zones.find(z => z.id === zoneId);
            if (zone.owner === null && !availableZones.includes(zoneId)) {
                availableZones.push(zoneId);
            }
        });
    });
    
    // Автоматически выбираем случайные зоны (для ботов)
    for (let i = 0; i < count && availableZones.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableZones.length);
        const zoneId = availableZones[randomIndex];
        
        claimZone(playerId, zoneId);
        
        availableZones.splice(randomIndex, 1);
    }
}

function claimZone(playerId, zoneId) {
    const player = gameState.players[playerId];
    const zone = gameState.zones.find(z => z.id === zoneId);
    
    zone.owner = playerId;
    player.territories.push(zoneId);
    
    // Визуально обновляем
    const zoneElement = document.getElementById(`zone-${zoneId}`);
    zoneElement.className = `zone ${player.color}`;
    
    console.log(`✅ ${player.name} захватил зону ${zoneId}`);
}

// ============================================
// ЭТАП БИТВЫ
// ============================================

function startBattlePhase() {
    console.log('⚔️ Начинается этап битвы!');
    gameState.phase = 'BATTLE';
    gameState.attackIndex = 0;
    updateGameStatus('Раунд 2: Битва за территории');
    
    setTimeout(() => {
        performAttack();
    }, 2000);
}

function performAttack() {
    if (gameState.attackIndex >= gameState.attackSequence.length) {
        endGame();
        return;
    }
    
    const attackerIndex = gameState.attackSequence[gameState.attackIndex];
    const attacker = gameState.players[attackerIndex];
    
    if (attacker.isEliminated) {
        gameState.attackIndex++;
        performAttack();
        return;
    }
    
    // Выбираем случайную соседнюю вражескую зону
    const targetZone = selectAttackTarget(attacker);
    
    if (!targetZone) {
        gameState.attackIndex++;
        performAttack();
        return;
    }
    
    const defender = gameState.players[targetZone.owner];
    
    console.log(`⚔️ ${attacker.name} атакует ${defender.name}, зона ${targetZone.id}`);
    
    updateGameStatus(`${attacker.name} атакует ${defender.name}`);
    showBattleIndicator(attacker, defender);
    
    // Показываем вопрос с вариантами
    setTimeout(() => {
        showBattleQuestion(attacker, defender, targetZone);
    }, 1500);
}

function selectAttackTarget(attacker) {
    const possibleTargets = [];
    
    attacker.territories.forEach(terrId => {
        const adjacent = getAdjacentZones(terrId);
        adjacent.forEach(zoneId => {
            const zone = gameState.zones.find(z => z.id === zoneId);
            if (zone.owner !== null && zone.owner !== attacker.id) {
                possibleTargets.push(zone);
            }
        });
    });
    
    if (possibleTargets.length === 0) return null;
    
    return possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
}

function showBattleIndicator(attacker, defender) {
    const indicator = document.getElementById('battle-indicator');
    const text = document.getElementById('battle-text');
    
    text.textContent = `🔴 ${COLOR_NAMES[attacker.color]} ⚔️ ${COLOR_NAMES[defender.color]}`;
    indicator.classList.remove('hidden');
}

function hideBattleIndicator() {
    document.getElementById('battle-indicator').classList.add('hidden');
}

function showBattleQuestion(attacker, defender, targetZone) {
    const question = {
        text: 'В каком году Казахстан получил независимость?',
        options: ['А) 1990', 'Б) 1991', 'В) 1992'],
        correctAnswer: 'B',
        type: 'choice'
    };
    
    gameState.currentQuestion = question;
    showQuestion(question);
    
    // Симулируем ответы
    setTimeout(() => {
        simulateBattleAnswers(attacker, defender, targetZone, question);
    }, 3000);
}

function simulateBattleAnswers(attacker, defender, targetZone, question) {
    // Случайные ответы
    const answers = ['A', 'B', 'C'];
    const attackerAnswer = answers[Math.floor(Math.random() * 3)];
    const defenderAnswer = answers[Math.floor(Math.random() * 3)];
    
    console.log(`Ответы: ${attacker.name}=${attackerAnswer}, ${defender.name}=${defenderAnswer}`);
    
    hideQuestion();
    hideBattleIndicator();
    
    const attackerCorrect = attackerAnswer === question.correctAnswer;
    const defenderCorrect = defenderAnswer === question.correctAnswer;
    
    if (attackerCorrect && !defenderCorrect) {
        // Атакующий выиграл
        transferZone(targetZone.id, attacker.id);
        attacker.score += 200;
        updateGameStatus(`${attacker.name} захватил зону!`);
    } else if (!attackerCorrect && defenderCorrect) {
        // Защитник выиграл
        defender.score += 100;
        updateGameStatus(`${defender.name} защитил зону!`);
    } else {
        // Ничья - зона остается у защитника
        updateGameStatus(`Ничья! Зона остается у ${defender.name}`);
    }
    
    updatePlayerDisplay();
    
    // Следующая атака
    gameState.attackIndex++;
    setTimeout(() => {
        performAttack();
    }, 2000);
}

function transferZone(zoneId, newOwnerId) {
    const zone = gameState.zones.find(z => z.id === zoneId);
    const oldOwner = gameState.players[zone.owner];
    const newOwner = gameState.players[newOwnerId];
    
    // Удаляем у старого владельца
    oldOwner.territories = oldOwner.territories.filter(id => id !== zoneId);
    
    // Добавляем новому
    newOwner.territories.push(zoneId);
    zone.owner = newOwnerId;
    
    // Визуально обновляем
    const zoneElement = document.getElementById(`zone-${zoneId}`);
    zoneElement.className = `zone ${newOwner.color}`;
    if (zone.isCapital) {
        zoneElement.classList.add('capital');
    }
}

// ============================================
// ЗАВЕРШЕНИЕ ИГРЫ
// ============================================

function endGame() {
    console.log('🏁 Игра завершена!');
    gameState.phase = 'FINISHED';
    
    showResults();
}

function showResults() {
    // Сортируем игроков по баллам
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    const resultsSection = document.getElementById('results-section');
    const resultsTable = document.getElementById('results-table');
    
    resultsTable.innerHTML = '';
    
    // Заголовок
    const header = document.createElement('div');
    header.className = 'results-row header';
    header.innerHTML = `
        <div>Место</div>
        <div></div>
        <div>Игрок</div>
        <div style="text-align: right;">Баллы</div>
    `;
    resultsTable.appendChild(header);
    
    // Игроки
    sortedPlayers.forEach((player, index) => {
        const places = ['first', 'second', 'third'];
        const medals = ['🥇', '🥈', '🥉'];
        
        const row = document.createElement('div');
        row.className = 'results-row';
        row.innerHTML = `
            <div class="place ${places[index]}">${medals[index]}</div>
            <div class="player-color" style="background: ${player.color}; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white;"></div>
            <div>${player.name} (${COLOR_NAMES[player.color]})</div>
            <div style="text-align: right; color: #2ecc71; font-weight: bold; font-size: 18px;">${player.score}</div>
        `;
        resultsTable.appendChild(row);
    });
    
    resultsSection.classList.remove('hidden');
    
    // Кнопка новой игры
    document.getElementById('new-game-btn').onclick = () => {
        location.reload();
    };
}

// ============================================
// ОБРАБОТЧИК КЛИКОВ ПО ЗОНАМ
// ============================================

function handleZoneClick(zoneId) {
    console.log(`Клик по зоне ${zoneId}`);
    // Здесь будет логика для выбора зон игроком
}

console.log('✅ game.js загружен');