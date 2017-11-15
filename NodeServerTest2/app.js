
const uuid = require('uuid');
const server = require('http').createServer();
const io = require('socket.io')(server, {
    path: '/',
    serveClient: false,
    pingInterval: 5000,
    pingTimeout: 30000,
    cookie: false
});
const PORT = 9357;
server.listen(PORT, function () {
    console.log(`Server listening at port ${PORT}`);
});

var exec = require('child_process').execFile;
var broadcaster = function () {
    exec('broadcast/Broadcaster.exe', function (err, data) {
        console.log('Broadcaster program is missing');
        process.exit(1);
    });
    console.log('Broadcasting...');
};
broadcaster();

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    console.log(`Received: ${input}`);
    if (line === "kickall") {
        // Disconnect all the connected clients
        for (let conn in connections) {
            conn.disconnect();
        }
        userName = {};
        gameDict = {};
        scoreDict = {};
    }
    if (line === "show") {
        console.log(`Currently ${connections.length} client(s) connected`);
    }
});


// The list of all client currently connected
var connections = [];

// dictionary, key:value pair
// socket.id (str) : userName (str)
var userName = {};

// Games that are currently playing
// dictionary, key:value pair
// UUID (str) : sockets for/in the room (socket.id)
let gameDict = {};

// scores that players are currently holding
// dictionary, key:value pair
// socket.id(str) : score (int)
let scoreDict = {};

// On first connect
io.sockets.on('connection', function (socket) {

    //    socket.sendBuffer = []; // clear buffers
    connections.push(socket); // Add client to the connections list

    console.log("%s %s:%s connected".green,
        socket.id,
        socket.request.connection.remoteAddress,
        socket.request.connection.remotePort
    );

    /**
     * event 'nameIsAvailable'
     * @param {string} nameStr
     * 
     * emit 'nameIsAvailable'
     * emitObject bool, true if the name is available
     */
    socket.on('nameIsAvailable', (nameStr) => {
        // Simply check if namespace is available
        let isDup = isNameDuplicate(nameStr);
        socket.emit('nameIsAvailable', isDup);
    });

    /**
     * Apply and Lock the name for the client
     * 
     * event 'nameSubscribe'
     * @param {string} nameStr The name that user wants 
     * 
     * emit 'nameSubscribe'
     * emitObject true if the name is successfully locked
     */
    socket.on('nameSubscribe', (nameStr) => {
        // Lock the name to the client
        let isDup = isNameDuplicate(nameStr);
        if (!isDup) {
            userName[socket.id] = nameStr;
        }
        let subscribed = !isDup;
        socket.emit('nameSubscribe', subscribed);

        if (subscribed) console.log((socket.id + " is now named " + nameStr).cyan);
        else console.log((socket.id + " is unable to name " + nameStr).cyan);
    });

    socket.on('getAllRooms', () => {
        let json = {
            "gameRooms": getAllRooms()
        };
        socket.emit('getAllRooms', json);
    });

    socket.on('getAllPlayers', () => {
        let json = {
            "clients": getAllPlayers()
        };
        socket.emit('getAllPlayers', json);
    });

    /**
     * Get the name of all players in a room
     * 
     * event 'getRoomAllClients'
     * @param {string} roomUUIDStr the UUID of the room to request
     * 
     * emit 'getRoomAllClients'
     * 
     * if roomUUIDStr is not null
     * emitObject dict{"clients": array[string playerNameInRoom]}
     * 
     * if roomUUIDStr is null
     * emitObject null
     */
    socket.on('getRoomAllClients', (roomUUIDStr) => {
        let json = null;
        if (roomUUIDStr !== null) {
            json = {
                "clients": getRoomAllClients(roomUUIDStr)
            };
        }
        socket.emit('getRoomAllClients', json);
    });
    socket.on('get clients', () => {
        gameDictTmp = {};
        for (let key in gameDict) {
            let tmpArr = [];
            for (var i = 0; i < gameDict[key].length; i++) {
                tmpArr.push(userName[gameDict[key][i].id]);
            }
            gameDictTmp[key] = tmpArr;
        }

        socket.emit('get clients', JSON.stringify(
            {
                "clientNames": getAllPlayers(),
                "games": gameDictTmp,
                "clientIpPort": getClientIpPort()
            }
        ));

    });

    /**
     * User challenge another user
     * 
     * event 'challenge'
     * @param {string} name of who to be challenged
     * 
     * emit 'challenge'
     * - to one who is being challenged
     * emitObject {string} name of the challenger
     */
    socket.on('challenge', function (name) {
        //when person challenges another person -> redirect message
        console.log("%s challenges %s", userName[socket.id], name);
        getClientWithName(name).emit('challenge', userName[socket.id]);
    });

    /**
     * Create a room when a challenge is accepted
     * 
     * event 'accept'
     * @param {string} challengerName The name of the challenger
     * 
     * emit 'gameRoomUUID' to both challenger and acceptor
     * emitObject {RoomAndOrder} 
     * - {"roomUUID": roomUUID, "startPlayer": nameOfStartingPlayer}
     */
    socket.on('accept', (challengerName) => {

        console.log("%s accepts %s", userName[socket.id], challengerName);
        getClientWithName(challengerName).emit('accept', userName[socket.id]);

        let game = []; // array for a single room
        let roomUUID = uuid.v4(); // Room Identifier

        //push current player and challenger
        game.push(socket); // socket of the accepter
        game.push(getClientWithName(challengerName)); // socket of the challenger

        // key UUID: game ARRAY
        gameDict[roomUUID] = game;
        console.log(roomUUID + " room created");


        let starterSocket = chooseRandomElement(game);
        let roomAndOrder = {
            "roomUUID": roomUUID,
            "startPlayer": userName[starterSocket.id]
        };
        // Send UUID of the room they are in
        for (let i = 0; i < game.length; i++) {
            //console.log(game[i] + " is being sent");
            // Emit to all socket in the room
            game[i].emit("gameRoomUUID", roomAndOrder);
        }
    });
    /**
     * New round event received from following person (!isFirst) and need new first player
     * 
     * event 'new round'
    * @param {string} roomUUID The name of the challenger
     * 
     * emit 'new round' to all people in room
     * emitObject {RoomAndOrder}     -> NO IT DOESNT MAKE SENSE!
     * - {"roomUUID": roomUUID, "startPlayer": nameOfStartingPlayer}
     */
    socket.on("new round", (room) => {
        console.log("new round received from " + userName[socket.id]);
    });


    /**
     * Decline challenger from the challenge
     * 
     * event 'decline'
     * @param {string} challengerName The name of the challenger
     * 
     * emit 'gameRoomUUID' to both challenger and acceptor
     * emitObject {string} roomUUID the name of the room
     */
    socket.on('decline', function (challengerName) {
        //when person declines another person -> redirect message
        console.log("%s declines %s challenge...", userName[socket.id], challengerName);
        getClientWithName(challengerName).emit('decline', userName[socket.id]);
    });

    /**
     * Timeout handling
     * 
     * event 'timeout'
     * @param {string} roomUUID the room UUID to emit to
     * 
     * emit 'timeout' to all clients in room except the one who emit
     */
    socket.on('timeout', function (room) {
        console.log(userName[socket.id] + " timed out");

        let game = gameDict[room];
        for (let i = 0; i < game.length; i++) {
            if (game[i].id === socket.id)
                continue;
            game[i].emit('timeout');
        }
    });
    /**
    * Score handling
    * 
    * event 'score'
    * @param {int} score 
    * 
    */
    socket.on('score', function (score) {
        console.log((userName[socket.id] + " got the score of " + score).yellow);

        if (socket.id in scoreDict) {
            scoreDict[socket.id] += score;
        } else {
            scoreDict[socket.id] = score;
        }


    });
    /**
    * Game end handling
    * 
    * event 'game end' -> from the !isFirst
    * @param {string} roomUUID the room UUID to emit to
    *
    * emit 'game end' to all clients in room 
    * emitObject {ScoreStructure}
    *           { username : score}
    */
    socket.on('game end', function (room) {
        console.log(userName[socket.id] + " says game has ended in room " + room);

        let ScoreStructure = {};
        for (let key in scoreDict) {
            ScoreStructure[userName[key]] = scoreDict[key];
        }
        let game = gameDict[room];
        for (let i = 0; i < game.length; i++) {
            game[i].emit('game end', {
                scores: ScoreStructure
            });
        }

    });

    /**
     * Send note information to other in the same room
     * 
     * Send a note one pressed to other player in the same room
     * 
     * event 'note'
     * @param noteStructure The dictionary agreed upon
     * 
     * emit 'note' to all but sender
     * emitObject {NoteStructure} noteStructure of a note
     */
    socket.on('note', (noteStructure) => {

        console.log(noteStructure.gray);

        let note = JSON.parse(noteStructure);

        // When a player in a room send a note
        let game = gameDict[note.roomUUID];

        // Send to all client/socket but the sender
        for (let i = 0; i < game.length; i++) {
            if (game[i].id === socket.id) {
                continue;
            }
            game[i].emit("note", noteStructure);
        }
    });
    socket.on('disconnect', function (reason) {
        // when the user disconnects

        console.log(("%s left because of " + reason).red, socket.id);

        // Remove an element from list
        delete userName[socket.id];
        // Not the right way to remove element
        //delete userName[socket.id];
        // Source
        // https://stackoverflow.com/questions/5767325/how-do-i-remove-a-particular-element-from-an-array-in-javascript

        // Remove from connections
        var index = 0;
        while (index < connections.length) {
            if (connections[index].id === socket.id) {
                break;
            }
            index++;
        }
        connections.splice(index, 1);

        let keyToRemove = "";
        //remove from games
        for (let key in gameDict) {

            for (let j = 0; j < gameDict[key].length; j++) {
                //console.log("checking if " + gameDict[key][j].id + " is equal to " + socket.id + " " + (gameDict[key][j].id === socket.id));
                if (gameDict[key][j].id === socket.id) {
                    keyToRemove = key;
                    break;
                }
            }
        }
        console.log(" I am removing the room " + keyToRemove);
        delete gameDict[keyToRemove];

        //remove from scores
        delete scoreDict[socket.id];
    });

    /**
     * When player disconnect from room
     * 
     * event 'playerDisconnectFromRoom'
     * @param {string} roomUUID the room player is disconnecting from
     * 
     * emit 'playerDisconnectFromRoom' to all but sender
     * emitObject {string} player name of who is disconnecting
     */
    socket.on("playerDisconnectFromRoom", (roomUUID) => {
        // when the user disconnects

        console.log("%s %s left from room %s", socket.id, userName[socket.id], roomUUID);

        // When a player in a room send a note
        let game = gameDict[roomUUID];

        // Send to all client/socket but the sender
        for (let tmpClient in game) {
            if (tmpClient.id === socket.id) {
                continue;
            }
            tmpClient.emit("playerDisconnectFromRoom", userName[socket.id]);
        }

        // Remove an element from list
        let idxUserName = userName.indexOf(socket.id);
        if (idxUserName > -1) {
            userName.splice(idxUserName, 1);
        }

        // Remove from connections
        var index = 0;
        while (index < connections.length) {
            if (connections[index].id === socket.id) {
                break;
            }
            index++;
        }
        connections.splice(index, 1);
    });

    /**
     * When game end
     * 
     * event 'game end'
     * @param {string} roomUUID the room uuid
     * 
     */
    socket.on('game end', function (roomUUID) {
        delete gameDict[roomUUID];
    });

    socket.on('pong', function (data) {
        //console.log(("Pong received from client "+socket.id).gray);
    });

    /**
     * Choose a random element from a list
     * 
     * @param {array} arrList
     * return {object} random element from the list
     */
    function chooseRandomElement(arrList) {
        return arrList[Math.floor(Math.random() * arrList.length)];
    }

    /**
     * Get all players currectly connected
     * 
     * @returns {Array} List of player names
     */
    function getAllPlayers() {
        // Get the Player name
        let arrPlayers = [];
        for (var i = 0; i < connections.length; i++) {
            arrPlayers.push(userName[connections[i].id]);
        }
        return arrPlayers;
    }

    /**
     * Get all room currently on-going
     * 
     * @returns {Array} UUIDs of all the rooms
     */
    function getAllRooms() {
        // Get all UUID of all rooms
        let arrRoom = [];
        for (let roomUUID in gameDict) {
            arrRoom.push(roomUUID);
        }
        return arrRoom;
    }

    /**
     * Get player names in a given room
     * 
     * @param {string} roomUUID The name of the room
     * @returns {Array} array of PlayerName in the room
     */
    function getRoomAllClients(roomUUID) {
        // Get all player names in a room
        let arrRoom = [];
        for (let rUUID in gameDict) {
            if (rUUID === roomUUID) {
                let game = gameDict[roomUUID];
                for (let socket in game) {
                    arrRoom.push(userName[socket.id]);
                }
                break;
            }
        }
        return arrRoom;
    }

    /*
     * Get Socket/Client with the name
     * 
     * @param {string} name Player name associate with socket
     * @returns {socket, null} socket if it exist, null otherwise
     */
    function getClientWithName(name) {
        for (var i = 0; i < connections.length; i++) {
            if (name === userName[connections[i].id]) {
                return connections[i];
            }
        }
        return null;
    }
    /**
     * Check if a nameString is duplicate
     * 
     * @param {string} nameStr of the name to check
     * @returns {Boolean}
     */
    function isNameDuplicate(nameStr) {
        var isDup = false;
        for (var key in userName) {
            if (key !== socket.id && userName[key].toLowerCase() === nameStr.toLowerCase()) {
                isDup = true;
            }
        }
        return isDup;
    }

    function getClientIpPort() {
        var arr = [];
        for (var i = 0; i < connections.length; i++) {
            arr.push(connections[i].request.connection.remoteAddress + ":" + connections[i].request.connection.remotePort);
        }
        return arr;
    }
    socket.on('error', function () {
        console.log("%s connection error", socket.id);
    });
    socket.on('reconnecting', function (Number) {
        console.log("%s attempts to reconnect number %s", socket.id, Number);
    });
    socket.on('reconnect', function (Number) {
        console.log("%s successful reconnection after %s attempts", socket.id, Number);
    });
    socket.on('reconnect_error', function () {
        console.log("%s reconnection error", socket.id);
    });
    socket.on('new message', function (data) {
        console.log("message: %s", data);
    });
});

function sendHeartbeat() {
    io.sockets.emit('ping', { beat: 1 });
}
setInterval(sendHeartbeat, 5000);
