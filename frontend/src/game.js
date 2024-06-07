//var hostAddress = 'http://localhost:5000';
//var hostAddress = 'http://localhost:8080';
//var hostAddress = 'http://rottj.us-east-1.elasticbeanstalk.com:8080';

var url = window.location.href;
var urlParts = url.split(':');
var hostAddress = urlParts[0] + ':' + urlParts[1] + ':8080';
var API_URL = "API_GATEWAY_URL";
var sendLambda = false;

var yourNick = localStorage.getItem('nick');
document.getElementById('yourNick').innerHTML = 'Your nick: ' + yourNick;

var playerImageAppended = false;
var opponentImageAppended = false;

function getOpponent() {
    var xhr = new XMLHttpRequest();
    //xhr.open('GET', 'http://localhost:5000/get_players', true);
    xhr.open('GET', hostAddress + '/get_players', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                var players = data.players;
                if (players.player1 == yourNick || players.player2 == yourNick) {
                    if(players.player1 === null || players.player2 === null){
                        document.getElementById('opponent').innerHTML = 'Waiting for second player...';
                        setPlayerImage(players.player1);
                    }
                    else if (players.player1 === yourNick){
                        document.getElementById('opponent').innerHTML = 'Opponents nick: ' + players.player2;
                        document.getElementById('yourSymbol').innerHTML = 'Your symbol: X ';       
                        setPlayerImage(players.player1);
                        setOpponentImage(players.player2);
                    }
                    else if (players.player2 === yourNick){
                        document.getElementById('opponent').innerHTML = 'Opponents nick: ' + players.player1;
                        document.getElementById('yourSymbol').innerHTML = 'Your symbol: O ';    
                        setPlayerImage(players.player2);
                        setOpponentImage(players.player1);
                    }
                } else {
                console.error('Error getting players');
                }
            }
            else{
                alert("You are not authorized")
            }
        }
    };

    xhr.send();
}

function setOpponentImage(opponentNick) {
    if (!opponentImageAppended) {
        var opponentImage = new Image();
        opponentImage.src = hostAddress + '/image/' + opponentNick;
        opponentImage.style.maxWidth = '200px';
        opponentImage.style.maxHeight = '200px';
        opponentImage.onload = function () {
            document.getElementById('opponent_image').appendChild(opponentImage);
        };
        opponentImageAppended = true;
    }
}

function setPlayerImage(playerNick) {
    if (!playerImageAppended) {
        var playerImage = new Image();
        playerImage.src = hostAddress + '/image/' + playerNick;
        playerImage.style.maxWidth = '200px';
        playerImage.style.maxHeight = '200px';
        playerImage.onload = function () {
            document.getElementById('player_image').appendChild(playerImage);
        };
        playerImageAppended = true;
    }
}

function makeMove(move) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress +'/send_move', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                updateBoard();
            } else {
                console.error('Error making move');
                alert("You are not authorized")
            }
        }
    };
    xhr.send(JSON.stringify({move: move, yourNick: yourNick}));       
}

function updateBoard() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress +'/get_board', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                var board = data.board;
                renderBoard(board);
            } else {
                console.error('Error getting board');
                alert("You are not authorized")
            }
        }
    };

    xhr.send();
}

function renderBoard(board) {
    var cells = document.getElementsByClassName('box');
    for (var i = 0; i < cells.length; i++) {
        if (board[i] === 'n') {
            cells[i].textContent = '';
            cells[i].setAttribute('onclick', 'makeMove(' + i + ')');
        } else if (board[i] === 'x') {
            cells[i].textContent = 'X';
        } else if (board[i] === 'o') {
            cells[i].textContent = 'O';
        }
    }
}

function checkWin() {
    if (sendLambda){
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress +'/get_winner', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                var winner = data.winner;
                if (winner == yourNick || (winner == 'pat' && data.p1 == yourNick)){
                    sendResultToLambda(data.p1, data.p2, data.winner);
                }
                if(winner == yourNick){
                    document.getElementById('winner').innerHTML = 'You won!';
                }
                else if(winner == 'pat'){
                    document.getElementById('winner').innerHTML = 'Pat!';
                }
                else if(winner != 'None'){
                    document.getElementById('winner').innerHTML = 'You lost!';
                }
            } else {
                console.error('Error getting winner');
                alert("You are not authorized")
            }
        }
    };

    xhr.send();
}

function sendResultToLambda(player1nick, player2nick, result){
    sendLambda = true;
    var xhrLambda = new XMLHttpRequest();
    xhrLambda.open('POST', API_URL + '/game_ended', true);
    xhrLambda.setRequestHeader('Content-Type', 'application/json');
    console.debug("API_URL" + API_URL);
    var data = JSON.stringify({
        "player_1": player1nick,
        "player_2": player2nick,
        "result": result
    });

    xhrLambda.send(data);

    xhrLambda.onreadystatechange = function () {
        if (xhrLambda.readyState === XMLHttpRequest.DONE) {
            if (xhrLambda.status !== 200) {
                console.error('Error sending result.');
                return;
            }
            console.log('Result sent successfully');
        }
    };
}

function endGame(){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', hostAddress + '/end_game', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                checkEndGame();
            } else {
                console.error('Error ending game');
                alert("You are not authorized")
            }
        }
    };
    xhr.send();       
}

function checkEndGame(){
    var xhr = new XMLHttpRequest();
    xhr.open('GET', hostAddress +'/get_end', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    var accessToken = localStorage.getItem('accessToken');
    xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                var data = JSON.parse(xhr.responseText);
                var gameRunning = data.gameRunning;
                if (gameRunning == false) {
                    window.location = "index.html";
                }

            }       
            else{
                alert("You are not authorized")
            }
        }
    };

    xhr.send();
}

setInterval(checkWin, 1000);
setInterval(getOpponent, 1000);
setInterval(updateBoard, 1000);
setInterval(checkEndGame, 1000);

