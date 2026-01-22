// ============================================
// FIREBASE КОНФИГУРАЦИЯ
// ============================================

// ВСТАВЬТЕ СЮДА ВАШ firebaseConfig!
const firebaseConfig = {
  apiKey: "AIzaSyBW2vBhANUMAFsBd6V1Nxn-vHMzSMkwz8s",
  authDomain: "intellectual-battle.firebaseapp.com",
  databaseURL: "https://intellectual-battle-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "intellectual-battle",
  storageBucket: "intellectual-battle.firebasestorage.app",
  messagingSenderId: "546361145101",
  appId: "1:546361145101:web:6a43c80cf074da8e586244"
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ FIREBASE
// ============================================

let database;
let currentRoomId = null;
let currentPlayerId = null;

function initializeMultiplayer() {
    // Инициализируем Firebase
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    
    console.log('✅ Firebase инициализирован');
    
    // Генерируем ID игрока
    currentPlayerId = generatePlayerId();
    
    // Ищем или создаём комнату
    findOrCreateRoom();
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// ============================================
// ПОИСК И СОЗДАНИЕ КОМНАТЫ
// ============================================

function findOrCreateRoom() {
    const roomsRef = database.ref('rooms');
    
    // Ищем комнату с меньше чем 3 игрока
    roomsRef.orderByChild('playerCount').limitToFirst(10).once('value', (snapshot) => {
        let foundRoom = null;
        
        snapshot.forEach((childSnapshot) => {
            const room = childSnapshot.val();
            if (room.playerCount < 3 && room.status === 'waiting') {
                foundRoom = {
                    id: childSnapshot.key,
                    data: room
                };
                return true; // Прерываем forEach
            }
        });
        
        if (foundRoom) {
            joinRoom(foundRoom.id);
        } else {
            createRoom();
        }
    });
}

function createRoom() {
    const roomsRef = database.ref('rooms');
    const newRoomRef = roomsRef.push();
    
    currentRoomId = newRoomRef.key;
    
    newRoomRef.set({
        status: 'waiting',
        playerCount: 1,
        players: {
            [currentPlayerId]: {
                id: currentPlayerId,
                name: 'Игрок ' + Math.floor(Math.random() * 1000),
                ready: false,
                joinedAt: Date.now()
            }
        },
        createdAt: Date.now()
    });
    
    console.log('🎮 Комната создана:', currentRoomId);
    updateGameStatus('Ожидание других игроков... (1/3)');
    
    listenToRoomUpdates();
}

function joinRoom(roomId) {
    currentRoomId = roomId;
    
    const roomRef = database.ref('rooms/' + roomId);
    
    // Добавляем себя в комнату
    roomRef.child('players/' + currentPlayerId).set({
        id: currentPlayerId,
        name: 'Игрок ' + Math.floor(Math.random() * 1000),
        ready: false,
        joinedAt: Date.now()
    });
    
    // Увеличиваем счётчик игроков
    roomRef.child('playerCount').transaction((current) => {
        return (current || 0) + 1;
    });
    
    console.log('🎮 Присоединились к комнате:', roomId);
    
    listenToRoomUpdates();
}

// ============================================
// СЛУШАЕМ ОБНОВЛЕНИЯ КОМНАТЫ
// ============================================

function listenToRoomUpdates() {
    const roomRef = database.ref('rooms/' + currentRoomId);
    
    // Слушаем изменения игроков
    roomRef.child('players').on('value', (snapshot) => {
        const players = snapshot.val();
        const playerCount = Object.keys(players || {}).length;
        
        updateGameStatus(`Игроков в комнате: ${playerCount}/3`);
        
        if (playerCount === 3) {
            // Все игроки на месте - начинаем игру!
            roomRef.child('status').set('playing');
            startMultiplayerGame(players);
        }
    });
    
    // Слушаем статус игры
    roomRef.child('status').on('value', (snapshot) => {
        const status = snapshot.val();
        if (status === 'playing') {
            console.log('🎮 Игра началась!');
        }
    });
}

// ============================================
// ЗАПУСК МНОГОПОЛЬЗОВАТЕЛЬСКОЙ ИГРЫ
// ============================================

function startMultiplayerGame(players) {
    console.log('🎮 Начинаем игру с игроками:', players);
    
    // Конвертируем Firebase игроков в формат игры
    const playerIds = Object.keys(players);
    
    gameState.players = playerIds.map((id, index) => ({
        id: index,
        firebaseId: id,
        name: players[id].name,
        color: PLAYER_COLORS[index],
        score: 0,
        territories: [],
        capital: null,
        isEliminated: false,
        isCurrentPlayer: id === currentPlayerId
    }));
    
    updatePlayerDisplay();
    
    // Начинаем игру как обычно
    distributeCapitals();
    updateGameStatus('Игра началась!');
    
    gameState.phase = 'TERRITORY_SELECTION';
    
    setTimeout(() => {
        showTerritoryQuestion();
    }, 2000);
}

// ============================================
// СИНХРОНИЗАЦИЯ ОТВЕТОВ
// ============================================

function submitMultiplayerAnswer(answer) {
    const roomRef = database.ref('rooms/' + currentRoomId);
    
    // Сохраняем ответ в Firebase
    roomRef.child('answers/' + currentPlayerId).set({
        answer: answer,
        timestamp: Date.now()
    });
    
    console.log('✅ Ответ отправлен в Firebase');
    
    // Слушаем когда все ответят
    listenForAllAnswers();
}

function listenForAllAnswers() {
    const answersRef = database.ref('rooms/' + currentRoomId + '/answers');
    
    answersRef.on('value', (snapshot) => {
        const answers = snapshot.val();
        const answerCount = Object.keys(answers || {}).length;
        
        if (answerCount === 3) {
            // Все ответили - обрабатываем
            processMultiplayerAnswers(answers);
            
            // Очищаем ответы для следующего раунда
            answersRef.remove();
        }
    });
}

function processMultiplayerAnswers(answers) {
    const answerArray = Object.keys(answers).map(playerId => ({
        playerId: playerId,
        answer: answers[playerId].answer,
        time: answers[playerId].timestamp
    }));
    
    // Обрабатываем как обычно
    processTerritoryAnswers(answerArray, gameState.currentQuestion.answer);
}

// ============================================
// СИНХРОНИЗАЦИЯ ЗАХВАТА ЗОН
// ============================================

function syncZoneCapture(playerId, zoneId) {
    const roomRef = database.ref('rooms/' + currentRoomId);
    
    roomRef.child('gameState/zones/' + zoneId).set({
        owner: playerId,
        capturedAt: Date.now()
    });
}

function listenToZoneCaptures() {
    const zonesRef = database.ref('rooms/' + currentRoomId + '/gameState/zones');
    
    zonesRef.on('child_changed', (snapshot) => {
        const zoneId = parseInt(snapshot.key);
        const zoneData = snapshot.val();
        
        // Обновляем зону локально
        updateZoneVisually(zoneId, zoneData.owner);
    });
}

// ============================================
// ЭКСПОРТ
// ============================================

window.initializeMultiplayer = initializeMultiplayer;
window.submitMultiplayerAnswer = submitMultiplayerAnswer;

console.log('✅ multiplayer.js загружен');