var game = new Chess();

// =========================
// BOARD
// =========================
var board = null;

// =========================
// STOCKFISH
// =========================
var stockfish = new Worker("./stockfish.js");

// dedicated eval engine
var evalEngine = new Worker("./stockfish.js");

var engineReady = false;
var evalReady = false;
var engineThinking = false;

// =========================
// STATE
// =========================
var playerColor = "w";
var gameStarted = false;

var engineRating = 800;

var candidateMoves = [];
var lastMoveSquares = [];

var isEngineMove = false;

// =========================
// MOVE HISTORY
// =========================
var moveHistory = [];

// =========================
// SNAPSHOTS
// =========================
var moveSnapshots = [];
var currentViewIndex = -1;

// =========================
// EVAL SNAPSHOTS
// =========================
var evalSnapshots = [];

// =========================
// CAPTURE VALUES
// =========================
const pieceValues = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9
};

// ======================================================
// ENGINE SLIDER
// ======================================================
$("#level").on("input change", function () {

    engineRating = parseInt(this.value);

    $("#level-display").text(engineRating);

    if (engineReady) {

        stockfish.postMessage(
            "setoption name UCI_Elo value " + engineRating
        );
    }
});

// ======================================================
// MOVE DOTS
// ======================================================
function showMoves(square) {

    clearMoves();

    var moves = game.moves({
        square: square,
        verbose: true
    });

    moves.forEach(function (m) {

        var el = $("#board .square-" + m.to);

        if (m.captured) {
            el.addClass("capture-dot");
        } else {
            el.addClass("move-dot");
        }
    });
}

function clearMoves() {

    $("#board .square-55d63")
        .removeClass("move-dot capture-dot");
}

// ======================================================
// HISTORY
// ======================================================
function addMoveToHistory() {

    var sanHistory = game.history();

    var lastMove = sanHistory[sanHistory.length - 1];

    var moveNumber = Math.ceil(sanHistory.length / 2);

    if (sanHistory.length % 2 === 1) {

        moveHistory.push(moveNumber + ". " + lastMove + " ");

    } else {

        moveHistory[moveHistory.length - 1] += lastMove;
    }

    renderHistory();
}

function renderHistory() {

    var html = "";

    moveHistory.forEach(function (m) {
        html += "<div class='move-row'>" + m + "</div>";
    });

    $("#moves-list").html(html);

    document.getElementById("moves-list").scrollTop =
        document.getElementById("moves-list").scrollHeight;
}

function renderHistoryFromGame() {

    moveHistory = [];

    const hist = game.history();

    for (let i = 0; i < hist.length; i++) {

        const moveNumber = Math.floor(i / 2) + 1;

        if (i % 2 === 0) {

            moveHistory.push(moveNumber + ". " + hist[i] + " ");

        } else {

            moveHistory[moveHistory.length - 1] += hist[i];
        }
    }

    renderHistory();
}

// ======================================================
// CAPTURES
// ======================================================
function updateCapturedPieces() {

    const history = game.history({ verbose: true });

    let whiteCaptured = [];
    let blackCaptured = [];

    let whiteScore = 0;
    let blackScore = 0;

    history.forEach(move => {

        if (!move.captured) return;

        const value = pieceValues[move.captured] || 0;

        if (move.color === "w") {

            whiteCaptured.push({
                type: move.captured,
                color: "b"
            });

            whiteScore += value;

        } else {

            blackCaptured.push({
                type: move.captured,
                color: "w"
            });

            blackScore += value;
        }
    });

    const advantage = whiteScore - blackScore;

    renderCaptured("#white-captures", whiteCaptured, advantage);
    renderCaptured("#black-captures", blackCaptured, advantage);
}

function renderCaptured(selector, pieces, advantage) {

    let html = "";

    pieces.forEach(p => {

        html += `<img class="captured-piece"
                      src="img/chesspieces/${p.color}${p.type}.png">`;
    });

    if (selector === "#white-captures") {

        if (advantage > 0) {
            html += `<span class="material-score">+${advantage}</span>`;
        }

    } else {

        if (advantage < 0) {
            html += `<span class="material-score">+${Math.abs(advantage)}</span>`;
        }
    }

    $(selector).html(html);
}

// ======================================================
// LAST MOVE HIGHLIGHT
// ======================================================
function setLastMove(from, to) {

    clearLastMove();

    lastMoveSquares = [from, to];

    $("#board .square-" + from).addClass("last-move");
    $("#board .square-" + to).addClass("last-move");
}

function clearLastMove() {

    lastMoveSquares.forEach(sq => {

        $("#board .square-" + sq)
            .removeClass("last-move");
    });

    lastMoveSquares = [];
}

function updateLastMoveFromSnapshot() {

    clearLastMove();

    if (currentViewIndex <= 0) return;

    const tempGame = new Chess();

    const moves = game.history();

    for (let i = 0; i < currentViewIndex; i++) {
        tempGame.move(moves[i]);
    }

    const hist = tempGame.history({ verbose: true });

    if (!hist.length) return;

    const last = hist[hist.length - 1];

    setLastMove(last.from, last.to);
}

// ======================================================
// EVAL BAR
// ======================================================
function updateEvalBar(score) {

    score = Math.max(-10, Math.min(10, score));

    const percent = ((score + 10) / 20) * 100;

    $("#eval-bar").css("height", percent + "%");

    $("#eval-score").text(
        score > 0
            ? "+" + score.toFixed(1)
            : score.toFixed(1)
    );
}

function requestEvaluation() {

    if (!evalReady) return;

    const fen = moveSnapshots[currentViewIndex];

    evalEngine.postMessage("position fen " + fen);
    evalEngine.postMessage("go depth 16");
}

// ======================================================
// MAIN ENGINE INIT
// ======================================================
stockfish.postMessage("uci");

stockfish.onmessage = function (e) {

    var line = e.data;

    if (line === "uciok") {

        stockfish.postMessage("isready");

        return;
    }

    if (line === "readyok") {

        engineReady = true;

        engineThinking = false;

        stockfish.postMessage("ucinewgame");

        stockfish.postMessage(
            "setoption name Skill Level value 20"
        );

        stockfish.postMessage(
            "setoption name UCI_LimitStrength value true"
        );

        stockfish.postMessage(
            "setoption name UCI_Elo value " + engineRating
        );

        return;
    }

    if (!gameStarted) return;

    if (line.startsWith("bestmove")) {

        handleEngineMove(line);
    }
};

// ======================================================
// EVAL ENGINE INIT
// ======================================================
evalEngine.postMessage("uci");

evalEngine.onmessage = function (e) {

    const line = e.data;

    if (line === "uciok") {

        evalEngine.postMessage("isready");
        return;
    }

    if (line === "readyok") {

        evalReady = true;
        return;
    }

    const match = line.match(/score (cp|mate) (-?\d+)/);

    if (!match) return;

    let type = match[1];
    let value = parseInt(match[2]);

    let score = 0;

    if (type === "cp") {

        score = value / 100;

    } else {

        score = value > 0 ? 10 : -10;
    }

    // convert to White perspective
    const fen = moveSnapshots[currentViewIndex];

    const tempGame = new Chess(fen);

    if (tempGame.turn() === "b") {
        score *= -1;
    }

    evalSnapshots[currentViewIndex] = score;

    updateEvalBar(score);
};

// ======================================================
// ENGINE MOVE
// ======================================================
function handleEngineMove(line) {

    engineThinking = false;

    isEngineMove = true;

    if (!gameStarted || game.game_over()) return;

    var bestMove = line.split(" ")[1];

    playMove(bestMove);

    isEngineMove = false;
}

// ======================================================
// PLAY MOVE
// ======================================================
function playMove(move) {

    var from = move.substring(0, 2);

    var to = move.substring(2, 4);

    var promo = move.length > 4 ? move[4] : "q";

    var result = game.move({
        from,
        to,
        promotion: promo
    });

    if (!result) return;

    board.position(game.fen(), false);

    setLastMove(from, to);

    addMoveToHistory();

    updateCapturedPieces();

    moveSnapshots.push(game.fen());

    evalSnapshots.push(0);

    currentViewIndex = moveSnapshots.length - 1;

    clearMoves();

    requestEvaluation();

    checkGameState();
}

// ======================================================
// ENGINE REQUEST
// ======================================================
function makeEngineMove() {

    if (!gameStarted) return;

    if (!engineReady) return;

    if (game.game_over()) return;

    if (engineThinking) return;

    if (game.turn() === playerColor) return;

    engineThinking = true;

    stockfish.postMessage(
        "position fen " + game.fen()
    );

    stockfish.postMessage(
        "go movetime 600"
    );
}

// ======================================================
// GAME STATE
// ======================================================
function checkGameState() {

    if (!game.game_over()) return;

    let text = "";

    if (game.in_checkmate()) {

        text =
            (game.turn() === "w" ? "Black" : "White") +
            " wins by checkmate";

    } else if (game.in_stalemate()) {

        text = "Stalemate";

    } else if (game.in_draw()) {

        text = "Draw";

    } else {

        text = "Game over";
    }

    $("#game-result").text(text);

    setTimeout(() => {

        $("#game-over").removeClass("hidden");

    }, 250);
}

// ======================================================
// BOARD INIT
// ======================================================
board = Chessboard("board", {

    draggable: true,

    position: "start",

    pieceTheme: "img/chesspieces/{piece}.png",

    onDragStart: function (source, piece) {

        if (!gameStarted) return false;

        if (game.game_over()) return false;

        if (engineThinking) return false;

        if (currentViewIndex !== moveSnapshots.length - 1) {
            return false;
        }

        if (
            (game.turn() === "w" && piece.startsWith("b")) ||
            (game.turn() === "b" && piece.startsWith("w"))
        ) {
            return false;
        }

        showMoves(source);

        return true;
    },

    onDrop: function (source, target) {

        var move = game.move({
            from: source,
            to: target,
            promotion: "q"
        });

        if (!move) return "snapback";

        setLastMove(source, target);

        addMoveToHistory();

        updateCapturedPieces();

        moveSnapshots.push(game.fen());

        evalSnapshots.push(0);

        currentViewIndex = moveSnapshots.length - 1;

        board.position(game.fen(), false);

        clearMoves();

        requestEvaluation();

        checkGameState();

        setTimeout(makeEngineMove, 200);
    },

    onSnapEnd: function () {

        board.position(game.fen());
    }
});

// ======================================================
// START GAME
// ======================================================
window.chooseSide = function (color) {

    playerColor = color;

    game.reset();

    board.position("start", false);

    clearLastMove();

    engineThinking = false;

    gameStarted = true;

    moveHistory = [];

    moveSnapshots = [game.fen()];

    evalSnapshots = [0];

    currentViewIndex = 0;

    $("#start-screen").hide();

    $("#moves-list").html("");

    $("#white-captures").html("");

    $("#black-captures").html("");

    $("#game-over").addClass("hidden");

    board.orientation(
        color === "b" ? "black" : "white"
    );

    updateEvalBar(0);

    requestEvaluation();

    if (playerColor === "b") {

        setTimeout(makeEngineMove, 500);
    }
};

// ======================================================
// MOVE NAVIGATION
// ======================================================
$("#back-btn").on("click", function () {

    if (currentViewIndex <= 0) return;

    currentViewIndex--;

    board.position(
        moveSnapshots[currentViewIndex],
        false
    );

    clearMoves();

    updateLastMoveFromSnapshot();

    requestEvaluation();
});

$("#forward-btn").on("click", function () {

    if (currentViewIndex >= moveSnapshots.length - 1) {
        return;
    }

    currentViewIndex++;

    board.position(
        moveSnapshots[currentViewIndex],
        false
    );

    clearMoves();

    updateLastMoveFromSnapshot();

    requestEvaluation();
});

// ======================================================
// SAVE
// ======================================================
$("#save-game-btn").on("click", function () {

    localStorage.setItem(
        "saved_pgn",
        game.pgn()
    );

    alert("Game saved");
});

// ======================================================
// LOAD
// ======================================================
$("#load-last-btn").on("click", function () {

    const pgn =
        localStorage.getItem("saved_pgn");

    if (!pgn) {
        return alert("No saved game");
    }

    loadPGN(pgn);
});

// ======================================================
// SHARE
// ======================================================
$("#share-btn").on("click", function () {

    const pgn = game.pgn();

    const encoded =
        encodeURIComponent(pgn);

    const url =
        `${location.origin}${location.pathname}?pgn=${encoded}`;

    navigator.clipboard.writeText(url);

    alert("Share link copied");
});

// ======================================================
// SNAPSHOTS
// ======================================================
function rebuildSnapshotsFromGame() {

    moveSnapshots = [];

    evalSnapshots = [];

    const tempGame = new Chess();

    moveSnapshots.push(tempGame.fen());

    evalSnapshots.push(0);

    const moves = game.history();

    for (let i = 0; i < moves.length; i++) {

        tempGame.move(moves[i]);

        moveSnapshots.push(tempGame.fen());

        evalSnapshots.push(0);
    }

    currentViewIndex =
        moveSnapshots.length - 1;
}

// ======================================================
// PGN LOAD
// ======================================================
function loadPGN(pgn) {

    game.reset();

    const ok = game.load_pgn(pgn);

    if (!ok) {
        return alert("Invalid PGN");
    }

    board.position(game.fen(), false);

    renderHistoryFromGame();

    updateCapturedPieces();

    rebuildSnapshotsFromGame();

    clearMoves();

    updateLastMoveFromSnapshot();

    gameStarted = true;

    requestEvaluation();
}

// ======================================================
// RESTART
// ======================================================
function restartGame() {

    game.reset();

    board.position("start", false);

    clearLastMove();

    gameStarted = false;

    engineThinking = false;

    moveHistory = [];

    moveSnapshots = [];

    evalSnapshots = [];

    currentViewIndex = -1;

    $("#moves-list").html("");

    $("#white-captures").html("");

    $("#black-captures").html("");

    $("#start-screen").show();

    $("#game-over").addClass("hidden");

    updateEvalBar(0);
}