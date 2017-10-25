var colors = require("colors");
const server = require('http').createServer();

const io = require('socket.io')(server, {
    path: '/',
    serveClient: false,
    // below are engine.IO options
    pingInterval: 10000,
    pingTimeout: 5000,
    cookie: false
});

//number of total clients
var connections = [];

//dictionary of socket.id : userName
var userName = {};

//games that are currently playing
var games = [];

//notes in the first game
var gamesNotes = [];

var port = 9000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});


io.sockets.on('connection', function (socket) {
    socket.sendBuffer = []; // clear buffers
    connections.push(socket);

    console.log("%s %s:%s connected".green, socket.id, socket.request.connection.remoteAddress, socket.request.connection.remotePort);
    

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
        console.log("message: %s".yellow, data);
        
    });
    socket.on('note', function (data) {
        console.log("note: %s".yellow, data);
    });

    socket.on('note first', function (data) {
        console.log("%s> %s".yellow, userName[socket.id], data);

        var room = -1;
        for (var i = 0; i < games.length; i++) {
            for (var j = 0; j < games[i].length; j++) {
                if (games[i][j].id === userName[socket.id]) {
                    room = i;
                }
            }
        }
        

        if (typeof gamesNotes[room] === 'undefined') {
            gamesNotes[room] = [];
        }
        //save to gamesNotes[room]
        if (data.state === true) {
            gamesNote[room].push([data.time, data.note]); 
        }
        

        //emit to ppl in the room
        for (var i = 0; i < games[room].length; i++) {
            if (games[room][i].id !== userName[socket.id]) {
                games[room][i].emit('note first', data);
            }
        }
        

    });

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

    //get all clients
    socket.on('get clients', function () {

        socket.emit('get clients', JSON.stringify({
            clientNames: getClientNames(),
            games: getClientGames(),
            clientIpPort: getClientIpPort()
        }));
        //console.log(getClientNames().toString());
        
    });
    
    //when person declines another person -> redirect message
    socket.on('decline', function (name) {
        console.log("%s declines %s", userName[socket.id], name);
        getClientWithName(name).emit('decline', userName[socket.id]);
    });
    //when person challenges another person -> redirect message
    socket.on('challenge', function (name) {
        console.log("%s challenges %s!", userName[socket.id], name);
        getClientWithName(name).emit('challenge', userName[socket.id]);
      
    });

    //when person accepts a challenge
    socket.on('accept', function (name) {
        //when person accepts another person -> redirect message
        console.log("%s accepts %s", userName[socket.id], name);
        getClientWithName(name).emit('accept', userName[socket.id]);

        //array of a single game
        game = [];
        //push current player and challenger
        game.push(socket);
        game.push(getClientWithName(name));
        //push to games array
        games.push(game);

    });



    // when the user disconnects
    socket.on('disconnect', function () {
        console.log("%s left".red, socket.id);
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
        console.log("%s connection error".red, socket.id);
    });

    socket.on('reconnecting', function (Number) {
        console.log("%s attempts to reconnect number %s".red, socket.id, Number);
    });
    socket.on('reconnect', function (Number) {
        console.log("%s successful reconnection after %s attempts".green, socket.id, Number);
    });
    socket.on('reconnect_error', function () {
        console.log("%s reconnection error".red, socket.id);
    });

    function getClientNames() {
        var arr = [];
        for (var i = 0; i < connections.length; i++) {
            arr.push(userName[connections[i].id]);
        }
        return arr;
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
    function getClientGamesString() {
        var arr = [];
        for (var i = 0; i < games.length; i++) {
            var arr2 = [];
            for (var j = 0; j < games[i].length; j++) {
                arr2.push(userName[game[i][j].id]);
            }
            arr.push("[" + arr2.join(',') + "]");
        }
        return "[" + arr.join(',') + "]";
    }
    function getClientWithName(name) {
        for (var i = 0; i < connections.length; i++) {
            if (name === userName[connections[i].id]) {
                return connections[i];
            }
        }
        
        
    }
});