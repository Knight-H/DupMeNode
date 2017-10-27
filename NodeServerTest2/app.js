
const uuid = require('uuid');
const server = require('http').createServer();
const io = require('socket.io')(server, {
    path: '/',
    serveClient: false,
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false
});

//number of total clients
var connections = [];

//dictionary of socket.id : userName
var userName = {};

//games that are currently playing
let gameDict = {};

//notes in the first game
var gamesNotes = [];

const PORT = 3000;

server.listen(PORT, function () {
    console.log(`Server listening at port ${PORT}`);
});

// On first connect
io.sockets.on('connection', function (socket) {

//    socket.sendBuffer = []; // clear buffers
    connections.push(socket); // Add client to the connections list

    console.log(`${socket.id} ${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort} connected`);

    // Add new function
    // socket.on("EVENT NAME", FUNCTION_TO_RUN_WHEN_EVENT_IS_CALLED);

    /**
     * event 'nameIsAvailable'
     * @param {string} nameStr 
     * emit 'nameIsAvailable'
     * emitObject bool, true if the name is available
     */
    socket.on('nameIsAvailable', (nameStr) => {
        // Simply check if namespace is available
        let isDup = isNameDuplicate(nameStr);
        socket.emit('nameIsAvailable', isDup);
    }); // Works

    /**
     * Apply and Lock the name for the client
     * 
     * event 'nameSubscribe'
     * @param {string} nameStr The name that user wants 
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
    }); // Works

    /**
     * Get the available/on going rooms
     * 
     * event 'getAllRooms'
     * emit 'getAllRooms'
     * emitObject dict{"gameRooms": array[string roomUUID]}
     */
    socket.on('getAllRooms', () => {
        let json = {
            "gameRooms": getAllRooms()
        };
        socket.emit('getAllRooms', json);
    });

    /**
     * Get all the connected player
     * 
     * event 'getAllPlayers'
     * emit 'getAllPlayers'
     * emitObject dict{"clients": array[string playerName]}
     */
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
            json = JSON.stringify({
                "clients": getRoomAllClients(roomUUIDStr)
            });
        }
        socket.emit('getRoomAllClients', json);
    });




    socket.on('new message', function (data) {
        console.log("message: %s", data);
    });

    socket.on('note', function (data) {
        console.log("note: %s", data);
    });

    socket.on('note first', function (data) {
        console.log("%s> %s", userName[socket.id], data);

        var room = -1;
        for (var i = 0; i < games.length; i++) {
            for (var j = 0; j < games[i].length; j++) {
                if (games[i][j].id === userName[socket.id]) {
                    room = i;
                }
            }
        }

        if (typeof (gamesNotes[room]) === 'undefined') {
            gamesNotes[room] = [];
        }

        // Save the note to the gamesNotes[room]
        // Used to verify score later
        if (data.state === true) {
            gamesNotes[room].push([data.time, data.note]);
        }

        // Emit to everyone in the room but itself
        socket.boardcast.emit('note first', data);
    });

    /*
     //NAME HANDLING
     socket.on('name', function (name) {
     var isDup = false;
     for (var key in userName) {
     if (key !== socket.id && userName[key] === name) {
     isDup = true;
     }
     }
     if (!isDup) {
     userName[socket.id] = name;
     socket.emit('name', 'OK');
     console.log("%s is named %s", socket.id, name);
     } else {
     socket.emit('name', 'NO');
     console.log("%s is unable to name to %s", socket.id, name);
     }
     });
     */

    //get all clients
    socket.on('get clients', function () {
        // Respond to the client of the available ppl
        socket.emit('get clients', JSON.stringify({
            clientNames: getClientNames(),
            games: getClientGames(),
            clientIpPort: getClientIpPort()
        }));
        //console.log(getClientNames().toString());
    });

    //when person challenges another person -> redirect message
    socket.on('challenge', function (name) {
        console.log("%s challenges %s", userName[socket.id], name);
        getClientWithName(name).emit('challenge', userName[socket.id]);
    });
    //when person declines another person -> redirect message
    socket.on('decline', function (name) {
        console.log("%s declines %s challenge...", userName[socket.id], name);
        getClientWithName(name).emit('decline', userName[socket.id]);
    });
    //when person accepts another person -> redirect message
    socket.on('accept', function (name) {
        console.log("%s accepts %s", userName[socket.id], name);
        getClientWithName(name).emit('accept', userName[socket.id]);
    });
    //when person accepts a challenge
    socket.on('accept', function (name) {

        let game = []; // array for a single room
        let roomUUID = uuid.v4(); // Room Identifier

        //push current player and challenger
        game.push(socket); // socket of the accepter
        game.push(getClientWithName(name)); // socket of the challenger

        gameDict[roomUUID] = game;

        // Send UUID of the room they are in
        for (let tmpClient in game) {
            tmpClient.emit("gameRoomUUID", roomUUID);
        }
    });
    // When a player in a room send a note
    socket.on('note', (noteStructure) => {
        let game = gameDict[noteStructure.roomUUID];

        // Send the client to all other client
        for (let tmpClient in game) {
            if (tmpClient.id === socket.id) {
                continue;
            }
            tmpClient.send(noteStructure);
        }
    });

    function gameRealTime() {

    }

    function gameTakeTurn() {

    }

    // Accept game
    // Create room and push both client
    // Randomly choose a client as MAIN to fire notes
    // MAIN client notified as MAIN client
    // Other client notified as NOT main client

    // - Real Time Mode - (using room;)
    // MAIN client notify server to start
    // server notify all client in the room to start
    // (Client side) MAIN client count down 10s
    // (Client side) other client count down 20s
    // MAIN fire note at server
    // server propragate note to other client
    // Other client fire back notes at server
    // server calculate score
    // server determine winner

    // - Non-Real Time Mode - (using room;)
    // MAIN client notify server to start
    // server notify Other client to wait
    // (Client side) MAIN client count down 10s
    // (Client side) MAIN fire note at server
    // server enqueue the notes
    // (Client side) Other client wait for server to notify MAIN is done
    // Once MAIN 10s run out, notify server 10s run out
    // server notify other client to get ready
    // server dequeue to all client but MAIN
    // client calculate score and determine winner

    // when the user disconnects
    socket.on('disconnect', function () {
        console.log("%s left", socket.id);
        //remove name
        delete userName[socket.id];
        //remove from connections
        var index = 0;
        for (; index < connections.length; index++) {
            if (connections[index].id === socket.id) {
                break;
            }
        }
        connections.splice(index, 1);
    });

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

    function getAllPlayers() {
        // Get the Player name
        let arrPlayers = [];
        for (var i = 0; i < connections.length; i++) {
            arrPlayers.push(userName[connections[i].id]);
        }
        return arrPlayers;
    }

    function getAllRooms() {
        // Get all UUID of all rooms
        let arrRoom = [];
        for (let roomUUID in gameDict) {
            arrRoom.push(roomUUID);
        }
        return arrRoom;
    }

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

    function getClientIpPort() {
        var arr = [];
        for (var i = 0; i < connections.length; i++) {
            arr.push(connections[i].request.connection.remoteAddress + ":" + connections[i].request.connection.remotePort);
        }
        return arr;
    }

    function getClientGames() {
        var arr = [];
        for (var i = 0; i < games.length; i++) {
            var arr2 = [];
            for (var j = 0; j < games[i].length; j++) {
                arr2.push(userName[game[i][j].id]);
            }
            arr.push(arr2);
        }

        return arr;
    }
    function getClientWithName(name) {
        for (var i = 0; i < connections.length; i++) {
            if (name === userName[connections[i].id]) {
                return connections[i];
            }
        }
    }
    function isNameDuplicate(nameStr) {
        var isDup = false;
        for (var key in userName) {
            if (key !== socket.id && userName[key] === nameStr) {
                isDup = true;
            }
        }
        return isDup;
    }
});