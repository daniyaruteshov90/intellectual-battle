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
    initializePlayers();
    startGame();
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
        
        const zone = gameState.zones.find(z => z.id === capitalZoneId);
        zone.owner = player.id;
        zone.isCapital = true;
        
        const zoneElement = document.getElementById(`zone-${capitalZoneId}`);
        zoneElement.className = `zone ${player.color} capital`;
    });
    
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
    
    // НОВАЯ ЛОГИКА: если победитель - игрок (ID 0), даём ему выбрать зоны
    if (winner.playerId === 0) {
        // Игрок выбирает 2 зоны
        setTimeout(() => {
            enableZoneSelection(winner.playerId, 2);
        }, 1000);
    } else {
        // Бот выбирает автоматически
        setTimeout(() => {
            selectTerritory(winner.playerId, 2);
        }, 1000);
    }
    
    // Второй выбирает 1 зону
    if (secondPlace.playerId === 0) {
        // Игрок выбирает 1 зону
        setTimeout(() => {
            enableZoneSelection(secondPlace.playerId, 1);
        }, 3000);
    } else {
        // Бот выбирает автоматически
        setTimeout(() => {
            selectTerritory(secondPlace.playerId, 1);
        }, 3000);
    }
    
    // Проверяем заполнена ли карта
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
    
    if (attackerCorrect && !defenderCorrect) {
        transferZone(targetZone.id, attacker.id);
        attacker.score += 200;
        updateGameStatus(`${attacker.name} захватил зону!`);
    } else if (!attackerCorrect && defenderCorrect) {
        defender.score += 100;
        updateGameStatus(`${defender.name} защитил зону!`);
    } else {
        updateGameStatus(`Ничья! Зона остается у ${defender.name}`);
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