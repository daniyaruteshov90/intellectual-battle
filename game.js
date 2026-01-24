// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

const tg = window.Telegram?.WebApp;

const gameState = {
    players: [],
    currentPlayer: null,
    zones: [],
    phase: 'WAITING',
    currentQuestion: null,
    roundNumber: 0,
    attackSequence: [0, 1, 2, 1, 2, 0, 2, 0, 1, 0, 2, 1],
    attackIndex: 0,
    // НОВЫЕ ПОЛЯ
    waitingForZoneSelection: false,
    zonesToSelect: 0,
    selectingPlayer: null,
    waitingForAttackTarget: false,
    currentAttacker: null,
    isCapitalAttack: false,
    capitalAttackQuestionsLeft: 0
};

const PLAYER_COLORS = ['red', 'yellow', 'green'];
const COLOR_NAMES = {
    red: 'Красный',
    yellow: 'Желтый', 
    green: 'Зелёный'
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ ИГРЫ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Игра загружается...');
    
    if (tg) {
        tg.ready();
        tg.expand();
        console.log('✅ Telegram Web App готов');
    }
    
    createMap();
    
    // ПРОВЕРЯЕМ: хотим ли мы многопользовательскую игру
    const urlParams = new URLSearchParams(window.location.search);
    const multiplayer = urlParams.get('multiplayer');
    
    if (multiplayer === 'true' && window.initializeMultiplayer) {
        // Многопользовательская игра
        console.log('🌐 Запуск многопользовательской игры');
        initializeMultiplayer();
    } else {
        // Одиночная игра с ботами
        console.log('🤖 Запуск игры с ботами');
        initializePlayers();
        startGame();
    }
});

// ============================================
// СОЗДАНИЕ КАРТЫ
// ============================================

function createMap() {
    const mapElement = document.getElementById('game-map');
    mapElement.innerHTML = '';
    
    for (let i = 1; i <= 15; i++) {
        const zone = document.createElement('div');
        zone.className = 'zone neutral';
        zone.id = `zone-${i}`;
        zone.textContent = i;
        zone.dataset.zoneId = i;
        
        zone.addEventListener('click', () => handleZoneClick(i));
        
        mapElement.appendChild(zone);
        
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
    
    distributeCapitals();
    updateGameStatus('Раунд 1: Выбор территорий');
    
    gameState.phase = 'TERRITORY_SELECTION';
    gameState.roundNumber = 1;
    
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
    
    while (capitals.length < 3) {
        const randomIndex = Math.floor(Math.random() * availableZones.length);
        const zoneId = availableZones[randomIndex];
        
        const isTooClose = capitals.some(capitalId => {
            return areZonesAdjacent(zoneId, capitalId) || zoneId === capitalId;
        });
        
        if (!isTooClose) {
            capitals.push(zoneId);
        }
    }
    
    gameState.players.forEach((player, index) => {
        const capitalZoneId = capitals[index];
        player.capital = capitalZoneId;
        player.territories.push(capitalZoneId);
        
        // НОВОЕ: Столица даёт 500 очков
        player.score = 500;
        
        const zone = gameState.zones.find(z => z.id === capitalZoneId);
        zone.owner = player.id;
        zone.isCapital = true;
        
        const zoneElement = document.getElementById(`zone-${capitalZoneId}`);
        zoneElement.className = `zone ${player.color} capital`;
    });
    
    updatePlayerDisplay();
    console.log('✅ Столицы распределены:', capitals);
}

// ============================================
// ПРОВЕРКА СОСЕДСТВА ЗОН
// ============================================

function areZonesAdjacent(zone1, zone2) {
    const getRow = (z) => Math.floor((z - 1) / 5);
    const getCol = (z) => (z - 1) % 5;
    
    const row1 = getRow(zone1);
    const col1 = getCol(zone1);
    const row2 = getRow(zone2);
    const col2 = getCol(zone2);
    
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

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
    
    // Проверяем есть ли функция получения вопросов
    let question;
    if (window.getRandomNumericQuestion) {
        question = window.getRandomNumericQuestion();
    } else {
        // Запасной вопрос если questions.js не загрузился
        question = {
            text: 'Сколько областей в Казахстане?',
            answer: 17,
            type: 'numeric'
        };
    }
    
    gameState.currentQuestion = question;
    showQuestion(question);
    
    // ⬇️ ДОБАВЬТЕ ЭТУ СТРОКУ!
    startTimer(7);
    
    setTimeout(() => {
        simulateBotAnswersOld(question);
    }, 3000);


    setTimeout(() => {
        simulateBotAnswersOld(question);
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
        
        document.getElementById('answer-input').value = '';
        
        document.getElementById('submit-answer').onclick = () => {
            const answer = parseInt(document.getElementById('answer-input').value);
            submitAnswerOld(answer);
        };
    } else {
        numericAnswer.classList.add('hidden');
        multipleChoice.classList.remove('hidden');
        
        question.options.forEach((option, index) => {
            const btn = document.querySelectorAll('.option-btn')[index];
            btn.textContent = option;
            btn.onclick = () => submitAnswerOld(String.fromCharCode(65 + index));
        });
    }
}

function hideQuestion() {
    document.getElementById('question-section').classList.add('hidden');
}

// ============================================
// СИМУЛЯЦИЯ ОТВЕТОВ БОТОВ (СТАРАЯ ВЕРСИЯ)
// ============================================

function simulateBotAnswersOld(question) {
    const answers = [];
    
    gameState.players.forEach(player => {
        const deviation = Math.floor(Math.random() * 200) - 100;
        const answer = question.answer + deviation;
        const time = Math.random() * 5000;
        
        answers.push({
            playerId: player.id,
            answer: answer,
            time: time
        });
    });
    
    console.log('🤖 Боты ответили:', answers);
    processTerritoryAnswers(answers, question.answer);
}

function submitAnswerOld(answer) {
    console.log('✅ Ответ отправлен:', answer);
}

// ============================================
// ОБРАБОТКА ОТВЕТОВ НА ВОПРОСЫ О ТЕРРИТОРИИ
// ============================================

function processTerritoryAnswers(answers, correctAnswer) {
    // Сортируем по точности и времени
    answers.sort((a, b) => {
        const diffA = Math.abs(a.answer - correctAnswer);
        const diffB = Math.abs(b.answer - correctAnswer);
        
        if (diffA === diffB) {
            return a.time - b.time;
        }
        return diffA - diffB;
    });
    
    const winner = answers[0];
    const secondPlace = answers[1];
    
    console.log('🏆 Победитель:', winner);
    console.log('🥈 Второе место:', secondPlace);
    
    hideQuestion();
    
    // ПОКАЗЫВАЕМ ЭКРАН РЕЗУЛЬТАТОВ
    showAnswerResults(answers, correctAnswer, winner, secondPlace);
}

function showAnswerResults(answers, correctAnswer, winner, secondPlace) {
    console.log('📊 Показываем результаты:', answers);
    
    // Останавливаем таймер
    stopTimer();
    
    const resultsSection = document.getElementById('answer-results');
    const correctAnswerDiv = document.getElementById('correct-answer');
    const playersAnswersDiv = document.getElementById('players-answers');
    
    // Проверяем что элементы найдены
    if (!resultsSection || !correctAnswerDiv || !playersAnswersDiv) {
        console.error('❌ Элементы для результатов не найдены!');
        console.error('resultsSection:', resultsSection);
        console.error('correctAnswerDiv:', correctAnswerDiv);
        console.error('playersAnswersDiv:', playersAnswersDiv);
        return;
    }
    
    // Показываем правильный ответ
    correctAnswerDiv.innerHTML = `
        <div class="correct-answer-label">Правильный ответ:</div>
        <div class="correct-answer-value">${correctAnswer}</div>
    `;
    
    // Очищаем предыдущие ответы
    playersAnswersDiv.innerHTML = '';
    
    // Показываем ответы игроков
    answers.forEach((answer, index) => {
        // Ищем игрока по ID
        const player = gameState.players.find(p => p.id === answer.playerId);
        
        if (!player) {
            console.error('❌ Игрок не найден:', answer.playerId);
            return;
        }
        
        const difference = Math.abs(answer.answer - correctAnswer);
        const timeSeconds = (answer.time / 1000).toFixed(2);
        
        const rankEmojis = ['🥇', '🥈', '🥉'];
        const cardClass = index === 0 ? 'winner' : (index === 1 ? 'second' : '');
        
        const card = document.createElement('div');
        card.className = `player-answer-card ${cardClass}`;
        card.innerHTML = `
            <div class="player-answer-rank">${rankEmojis[index] || ''}</div>
            <div class="player-answer-info">
                <div class="player-answer-color" style="background: ${player.color};"></div>
                <div class="player-answer-name">${player.name}</div>
            </div>
            <div class="player-answer-value">${answer.answer}</div>
            <div class="player-answer-time">${timeSeconds}с</div>
        `;
        
        playersAnswersDiv.appendChild(card);
    });
    
    // Показываем экран
    console.log('✅ Показываем экран результатов');
    resultsSection.classList.remove('hidden');
    
    // Кнопка продолжить
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.onclick = () => {
            console.log('👆 Нажата кнопка Продолжить');
            resultsSection.classList.add('hidden');
            continueAfterResults(winner, secondPlace);
        };
    } else {
        console.error('❌ Кнопка continue-btn не найдена!');
    }
}

function continueAfterResults(winner, secondPlace) {
    // Продолжаем как раньше
    if (winner.playerId === 0) {
        setTimeout(() => {
            enableZoneSelection(winner.playerId, 2);
        }, 1000);
    } else {
        setTimeout(() => {
            selectTerritory(winner.playerId, 2);
        }, 1000);
    }
    
    if (secondPlace.playerId === 0) {
        setTimeout(() => {
            enableZoneSelection(secondPlace.playerId, 1);
        }, 3000);
    } else {
        setTimeout(() => {
            selectTerritory(secondPlace.playerId, 1);
        }, 3000);
    }
    
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
    
    for (let i = 0; i < count && availableZones.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableZones.length);
        const zoneId = availableZones[randomIndex];
        
        claimZone(playerId, zoneId);
        
        availableZones.splice(randomIndex, 1);
    }
}
// ============================================
// РУЧНОЙ ВЫБОР ЗОН ИГРОКОМ
// ============================================

function enableZoneSelection(playerId, count) {
    const player = gameState.players[playerId];
    
    gameState.waitingForZoneSelection = true;
    gameState.zonesToSelect = count;
    gameState.selectingPlayer = playerId;
    
    updateGameStatus(`${player.name}: выберите ${count} соседнюю зону`);
    
    // Подсвечиваем доступные зоны
    highlightSelectableZones(playerId);
}

function highlightSelectableZones(playerId) {
    const player = gameState.players[playerId];
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
    
    // Добавляем класс для подсветки
    availableZones.forEach(zoneId => {
        const zoneElement = document.getElementById(`zone-${zoneId}`);
        zoneElement.classList.add('selectable');
    });
    
    console.log('✨ Доступные зоны:', availableZones);
}

function removeZoneHighlights() {
    document.querySelectorAll('.zone').forEach(zone => {
        zone.classList.remove('selectable');
    });
}
function claimZone(playerId, zoneId) {
    const player = gameState.players[playerId];
    const zone = gameState.zones.find(z => z.id === zoneId);
    
    zone.owner = playerId;
    player.territories.push(zoneId);
    
    // НОВОЕ: Обычная клетка даёт 100 очков
    player.score += 100;
    
    const zoneElement = document.getElementById(`zone-${zoneId}`);
    zoneElement.className = `zone ${player.color}`;
    
    updatePlayerDisplay();
    console.log(`✅ ${player.name} захватил зону ${zoneId}, +100 очков`);
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
    
    // Если атакующий - игрок (ID 0), даём ему выбрать цель
    if (attackerIndex === 0) {
        enableAttackTargetSelection(attacker);
    } else {
        // Бот выбирает автоматически
        const targetZone = selectAttackTarget(attacker);
        
        if (!targetZone) {
            gameState.attackIndex++;
            performAttack();
            return;
        }
        
        executeAttack(attacker, targetZone);
    }
}
// ============================================
// ВЫБОР ЦЕЛИ АТАКИ ИГРОКОМ
// ============================================

function enableAttackTargetSelection(attacker) {
    gameState.waitingForAttackTarget = true;
    gameState.currentAttacker = attacker;
    
    updateGameStatus(`${attacker.name}: выберите зону для атаки`);
    
    // Подсвечиваем вражеские зоны
    highlightAttackableZones(attacker);
}

function highlightAttackableZones(attacker) {
    const possibleTargets = [];
    
    attacker.territories.forEach(terrId => {
        const adjacent = getAdjacentZones(terrId);
        adjacent.forEach(zoneId => {
            const zone = gameState.zones.find(z => z.id === zoneId);
            if (zone.owner !== null && zone.owner !== attacker.id) {
                if (!possibleTargets.includes(zoneId)) {
                    possibleTargets.push(zoneId);
                }
            }
        });
    });
    
    // Подсвечиваем доступные цели
    possibleTargets.forEach(zoneId => {
        const zoneElement = document.getElementById(`zone-${zoneId}`);
        zoneElement.classList.add('under-attack');
    });
    
    console.log('🎯 Доступные цели:', possibleTargets);
}

function handleAttackTargetSelection(zoneId) {
    const zone = gameState.zones.find(z => z.id === zoneId);
    const attacker = gameState.currentAttacker;
    
    // Проверяем что цель валидная
    if (zone.owner === null || zone.owner === attacker.id) {
        console.log('❌ Неверная цель');
        return;
    }
    
    // Проверяем что цель соседняя или это столица
    const isAdjacent = attacker.territories.some(terrId => 
        areZonesAdjacent(terrId, zoneId)
    );
    
    if (isAdjacent || zone.isCapital) {
        // Убираем подсветку
        removeAttackHighlights();
        gameState.waitingForAttackTarget = false;
        
        // Если это столица - специальная атака
        if (zone.isCapital) {
            startCapitalAttack(attacker, zone);
        } else {
            executeAttack(attacker, zone);
        }
    } else {
        console.log('❌ Цель должна быть соседней или столицей');
    }
}

function removeAttackHighlights() {
    document.querySelectorAll('.zone').forEach(zone => {
        zone.classList.remove('under-attack');
    });
}

function executeAttack(attacker, targetZone) {
    const defender = gameState.players[targetZone.owner];
    
    console.log(`⚔️ ${attacker.name} атакует ${defender.name}, зона ${targetZone.id}`);
    
    updateGameStatus(`${attacker.name} атакует ${defender.name}`);
    showBattleIndicator(attacker, defender);
    
    setTimeout(() => {
        showBattleQuestion(attacker, defender, targetZone);
    }, 1500);
}

// ============================================
// АТАКА НА СТОЛИЦУ
// ============================================

function startCapitalAttack(attacker, capitalZone) {
    const defender = gameState.players[capitalZone.owner];
    
    gameState.isCapitalAttack = true;
    gameState.capitalAttackQuestionsLeft = 3;
    
    updateGameStatus(`⚠️ АТАКА НА СТОЛИЦУ! ${attacker.name} → ${defender.name}`);
    
    const indicator = document.getElementById('battle-indicator');
    const text = document.getElementById('battle-text');
    text.textContent = `⚠️ АТАКА НА СТОЛИЦУ! ${COLOR_NAMES[attacker.color]} → ⭐${COLOR_NAMES[defender.color]}`;
    indicator.style.background = 'rgba(231, 76, 60, 0.95)';
    indicator.classList.remove('hidden');
    
    setTimeout(() => {
        continueCapitalAttack(attacker, defender, capitalZone);
    }, 2000);
}

function continueCapitalAttack(attacker, defender, capitalZone) {
    if (gameState.capitalAttackQuestionsLeft <= 0) {
        // Атакующий выиграл все 3 вопроса - столица захвачена!
        captureCapital(attacker, defender, capitalZone);
        return;
    }
    
    updateGameStatus(`Вопрос ${4 - gameState.capitalAttackQuestionsLeft}/3`);
    
    setTimeout(() => {
        showCapitalAttackQuestion(attacker, defender, capitalZone);
    }, 1000);
}

function showCapitalAttackQuestion(attacker, defender, capitalZone) {
    let question;
    if (window.getRandomMultipleChoiceQuestion) {
        question = window.getRandomMultipleChoiceQuestion();
    } else {
        question = {
            text: 'Вопрос для атаки на столицу?',
            options: ['А) Вариант 1', 'Б) Вариант 2', 'В) Вариант 3'],
            correctAnswer: 1,
            type: 'choice'
        };
    }
    
    gameState.currentQuestion = question;
    gameState.currentCapitalAttackData = { attacker, defender, capitalZone };
    
    showQuestion(question);
    
    setTimeout(() => {
        simulateCapitalAttackAnswers();
    }, 3000);
}

function simulateCapitalAttackAnswers() {
    const { attacker, defender, capitalZone } = gameState.currentCapitalAttackData;
    const question = gameState.currentQuestion;
    
    const answers = ['A', 'B', 'C'];
    const attackerAnswer = answers[Math.floor(Math.random() * 3)];
    const defenderAnswer = answers[Math.floor(Math.random() * 3)];
    
    hideQuestion();
    
    const correctLetter = String.fromCharCode(65 + question.correctAnswer);
    const attackerCorrect = attackerAnswer === correctLetter;
    const defenderCorrect = defenderAnswer === correctLetter;
    
    if (attackerCorrect && !defenderCorrect) {
        // Атакующий выиграл вопрос
        gameState.capitalAttackQuestionsLeft--;
        updateGameStatus(`${attacker.name} выиграл вопрос! Осталось: ${gameState.capitalAttackQuestionsLeft}`);
        
        setTimeout(() => {
            if (gameState.capitalAttackQuestionsLeft > 0) {
                continueCapitalAttack(attacker, defender, capitalZone);
            } else {
                captureCapital(attacker, defender, capitalZone);
            }
        }, 2000);
    } else {
        // Защитник выиграл или ничья - столица защищена
        defender.score += 100;
        gameState.isCapitalAttack = false;
        updateGameStatus(`${defender.name} защитил столицу!`);
        hideBattleIndicator();
        updatePlayerDisplay();
        
        gameState.attackIndex++;
        setTimeout(() => {
            performAttack();
        }, 2000);
    }
}

function captureCapital(attacker, defender, capitalZone) {
    updateGameStatus(`🏆 ${attacker.name} ЗАХВАТИЛ СТОЛИЦУ ${defender.name}!`);
    
    // Считаем очки защитника
    const defenderTerritories = defender.territories.length - 1; // -1 это столица
    const pointsGained = 800 + (defenderTerritories * 100);
    
    console.log(`💰 ${attacker.name} получает ${pointsGained} очков (800 за столицу + ${defenderTerritories} × 100)`);
    
    // Защитник проигрывает все очки
    defender.score = 0;
    defender.isEliminated = true;
    
    // Атакующий получает все территории и очки
    defender.territories.forEach(terrId => {
        const zone = gameState.zones.find(z => z.id === terrId);
        zone.owner = attacker.id;
        attacker.territories.push(terrId);
        
        const zoneElement = document.getElementById(`zone-${terrId}`);
        zoneElement.className = `zone ${attacker.color}`;
        if (zone.isCapital) {
            zoneElement.classList.add('capital');
        }
    });
    
    defender.territories = [];
    
    // Добавляем очки атакующему
    attacker.score += pointsGained;
    
    gameState.isCapitalAttack = false;
    hideBattleIndicator();
    updatePlayerDisplay();
    
    updateGameStatus(`${defender.name} выбыл из игры. ${attacker.name} получил +${pointsGained} очков`);
    
    gameState.attackIndex++;
    setTimeout(() => {
        performAttack();
    }, 3000);
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
    let question;
    if (window.getRandomMultipleChoiceQuestion) {
        question = window.getRandomMultipleChoiceQuestion();
    } else {
        question = {
            text: 'В каком году Казахстан получил независимость?',
            options: ['А) 1990', 'Б) 1991', 'В) 1992'],
            correctAnswer: 1,
            type: 'choice'
        };
    }
    
    gameState.currentQuestion = question;
    showQuestion(question);
    
    setTimeout(() => {
        simulateBattleAnswers(attacker, defender, targetZone, question);
    }, 3000);
}

function simulateBattleAnswers(attacker, defender, targetZone, question) {
    const answers = ['A', 'B', 'C'];
    const attackerAnswer = answers[Math.floor(Math.random() * 3)];
    const defenderAnswer = answers[Math.floor(Math.random() * 3)];
    
    console.log(`Ответы: ${attacker.name}=${attackerAnswer}, ${defender.name}=${defenderAnswer}`);
    
    hideQuestion();
    hideBattleIndicator();
    
    const correctLetter = String.fromCharCode(65 + question.correctAnswer);
    const attackerCorrect = attackerAnswer === correctLetter;
    const defenderCorrect = defenderAnswer === correctLetter;
    
    // НОВАЯ ЛОГИКА: если оба ответили одинаково
    if (attackerAnswer === defenderAnswer) {
        updateGameStatus('Одинаковые ответы! Решающий вопрос...');
        
        setTimeout(() => {
            showTieBreaker(attacker, defender, targetZone);
        }, 2000);
        return;
    }
    
    if (attackerCorrect && !defenderCorrect) {
        // Атакующий выиграл - захват территории
        transferZoneWithPoints(targetZone.id, attacker.id, defender.id);
        updateGameStatus(`${attacker.name} захватил зону!`);
    } else if (!attackerCorrect && defenderCorrect) {
        // Защитник выиграл - защита
        defender.score += 100;
        updateGameStatus(`${defender.name} защитил зону!`);
    } else {
        // Ничья - зона остаётся
        updateGameStatus(`Ничья! Зона остаётся у ${defender.name}`);
    }
    
    updatePlayerDisplay();
    
    gameState.attackIndex++;
    setTimeout(() => {
        performAttack();
    }, 2000);
}

function showTieBreaker(attacker, defender, targetZone) {
    updateGameStatus('Решающий вопрос на время и точность!');
    
    // Получаем цифровой вопрос
    let question;
    if (window.getRandomNumericQuestion) {
        question = window.getRandomNumericQuestion();
    } else {
        question = {
            text: 'Решающий вопрос: Сколько областей в Казахстане?',
            answer: 17,
            type: 'numeric'
        };
    }
    
    gameState.currentQuestion = question;
    gameState.tieBreakerData = { attacker, defender, targetZone };
    
    showQuestion(question);
    startTimer(7);
    
    setTimeout(() => {
        processTieBreaker();
    }, 8000);
}

function processTieBreaker() {
    const { attacker, defender, targetZone } = gameState.tieBreakerData;
    const question = gameState.currentQuestion;
    
    // Генерируем ответы
    const answers = [
        {
            playerId: attacker.id,
            answer: question.answer + (Math.random() * 100 - 50),
            time: Math.random() * 5000
        },
        {
            playerId: defender.id,
            answer: question.answer + (Math.random() * 100 - 50),
            time: Math.random() * 5000
        }
    ];
    
    // Сортируем по точности
    answers.sort((a, b) => {
        const diffA = Math.abs(a.answer - question.answer);
        const diffB = Math.abs(b.answer - question.answer);
        
        if (diffA === diffB) {
            return a.time - b.time;
        }
        return diffA - diffB;
    });
    
    hideQuestion();
    
    const winner = answers[0].playerId;
    
    if (winner === attacker.id) {
        // Атакующий выиграл
        transferZoneWithPoints(targetZone.id, attacker.id, defender.id);
        updateGameStatus(`${attacker.name} выиграл решающий вопрос!`);
    } else {
        // Защитник выиграл
        defender.score += 100;
        updateGameStatus(`${defender.name} защитил зону!`);
    }
    
    updatePlayerDisplay();
    
    gameState.attackIndex++;
    setTimeout(() => {
        performAttack();
    }, 2000);
}

function transferZone(zoneId, newOwnerId) {
    const zone = gameState.zones.find(z => z.id === zoneId);
    const oldOwner = gameState.players[zone.owner];
    const newOwner = gameState.players[newOwnerId];
    
    oldOwner.territories = oldOwner.territories.filter(id => id !== zoneId);
    newOwner.territories.push(zoneId);
    zone.owner = newOwnerId;
    
    const zoneElement = document.getElementById(`zone-${zoneId}`);
    zoneElement.className = `zone ${newOwner.color}`;
    if (zone.isCapital) {
        zoneElement.classList.add('capital');
    }
}
function transferZoneWithPoints(zoneId, newOwnerId, oldOwnerId) {
    const zone = gameState.zones.find(z => z.id === zoneId);
    const oldOwner = gameState.players[oldOwnerId];
    const newOwner = gameState.players[newOwnerId];
    
    // Удаляем у старого владельца
    oldOwner.territories = oldOwner.territories.filter(id => id !== zoneId);
    
    // НОВОЕ: Старый владелец теряет 100 очков
    oldOwner.score -= 100;
    if (oldOwner.score < 0) oldOwner.score = 0;
    
    // Добавляем новому
    newOwner.territories.push(zoneId);
    zone.owner = newOwnerId;
    
    // НОВОЕ: Новый владелец получает 200 очков за захват
    newOwner.score += 200;
    
    // Визуально обновляем
    const zoneElement = document.getElementById(`zone-${zoneId}`);
    zoneElement.className = `zone ${newOwner.color}`;
    if (zone.isCapital) {
        zoneElement.classList.add('capital');
    }
    
    console.log(`✅ ${newOwner.name} захватил зону ${zoneId}: +200, ${oldOwner.name}: -100`);
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
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    const resultsSection = document.getElementById('results-section');
    const resultsTable = document.getElementById('results-table');
    
    resultsTable.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'results-row header';
    header.innerHTML = `
        <div>Место</div>
        <div></div>
        <div>Игрок</div>
        <div style="text-align: right;">Баллы</div>
    `;
    resultsTable.appendChild(header);
    
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
    
    document.getElementById('new-game-btn').onclick = () => {
        location.reload();
    };
}

// ============================================
// ОБРАБОТЧИК КЛИКОВ ПО ЗОНАМ
// ============================================

function handleZoneClick(zoneId) {
    console.log(`Клик по зоне ${zoneId}`);
    
    // Если ждём выбора зоны
    if (gameState.waitingForZoneSelection) {
        const zone = gameState.zones.find(z => z.id === zoneId);
        const player = gameState.players[gameState.selectingPlayer];
        
        // Проверяем что зона доступна для выбора
        const isAdjacent = player.territories.some(terrId => 
            areZonesAdjacent(terrId, zoneId)
        );
        
        if (zone.owner === null && isAdjacent) {
            // Захватываем зону
            claimZone(gameState.selectingPlayer, zoneId);
            gameState.zonesToSelect--;
            
            if (gameState.zonesToSelect <= 0) {
                // Все зоны выбраны
                gameState.waitingForZoneSelection = false;
                removeZoneHighlights();
                updateGameStatus('Выбор завершён');
            } else {
                // Обновляем подсветку
                removeZoneHighlights();
                highlightSelectableZones(gameState.selectingPlayer);
                updateGameStatus(`${player.name}: выберите ещё ${gameState.zonesToSelect} зону`);
            }
        } else {
            console.log('❌ Эта зона недоступна');
        }
    }
    
    // Если ждём выбора цели для атаки
    if (gameState.waitingForAttackTarget) {
        handleAttackTargetSelection(zoneId);
    }
}

console.log('✅ game.js загружен');