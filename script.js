var game = new Chess();

// =========================
// BOARD
// =========================
var board = null;

// =========================
// STOCKFISH
// =========================
var stockfish = new Worker("./stockfish.js");

var engineReady = false;
var engineThinking = false;

// =========================
// STATE
// =========================
var playerColor = "w";
var gameStarted = false;

var engineRating = 800;

var candidateMoves = [];
var lastMoveSquares = [];

var pendingPromotion = null;

// engine move flag (IMPORTANT FIX)
var isEngineMove = false;

// =========================
// MOVE HISTORY
// =========================
var moveHistory = [];

// =========================
// SLIDER FIX (IMPORTANT)
// =========================
$("#level").on("input change", function () {

    engineRating = parseInt(this.value, 10);
    $("#level-display").text(engineRating);

    if (engineReady) {
        stockfish.postMessage(
            "setoption name UCI_Elo value " + engineRating
        );
    }
});

// =========================
// MOVE HISTORY UI
// =========================
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

    var el = document.getElementById("move-history");
    el.scrollTop = el.scrollHeight;
}

// =========================
// MOVE DOTS
// =========================
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
    $("#board .square-55d63").removeClass("move-dot capture-dot");
}

// =========================
// LAST MOVE
// =========================
function setLastMove(from, to) {

    clearLastMove();

    lastMoveSquares = [from, to];

    $("#board .square-" + from).addClass("last-move");
    $("#board .square-" + to).addClass("last-move");
}

function clearLastMove() {

    lastMoveSquares.forEach(function (sq) {
        $("#board .square-" + sq).removeClass("last-move");
    });

    lastMoveSquares = [];
}

// =========================
// PROMOTION UI (PLAYER ONLY)
// =========================
function showPromotion(from, to) {

    pendingPromotion = { from, to };

    $("#promo").removeClass("hidden");

    $("#promo button")
        .off("click")
        .on("click", function () {

            var piece = $(this).data("piece");

            game.move({ from, to, promotion: piece });

            board.position(game.fen(), false);

            setLastMove(from, to);

            addMoveToHistory();

            $("#promo").addClass("hidden");

            checkGameState();

            setTimeout(makeEngineMove, 200);
        });
}

// =========================
// ENGINE INIT
// =========================
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

        stockfish.postMessage("setoption name Skill Level value 20");
        stockfish.postMessage("setoption name UCI_LimitStrength value true");
        stockfish.postMessage("setoption name UCI_Elo value " + engineRating);
        stockfish.postMessage("setoption name MultiPV value 8");

        return;
    }

    if (!gameStarted) return;

    if (line.startsWith("info") && line.includes(" pv ")) {

        var match = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);

        if (match) {
            var move = match[1];
            if (!candidateMoves.includes(move)) {
                candidateMoves.push(move);
            }
        }
    }

    if (line.startsWith("bestmove")) {
        handleEngineMove(line);
    }
};

// =========================
// ENGINE MOVE
// =========================
function handleEngineMove(line) {

    engineThinking = false;
    isEngineMove = true;

    if (!gameStarted) return;
    if (game.game_over()) return;

    var bestMove = line.split(" ")[1];

    playMove(bestMove);

    isEngineMove = false;
}

// =========================
// PLAY MOVE
// =========================
function playMove(move) {

    var from = move.substring(0, 2);
    var to = move.substring(2, 4);
    var promo = move.length > 4 ? move[4] : "q";

    var piece = game.get(from);

    // PROMOTION FIX
    if (
        piece &&
        piece.type === "p" &&
        ((piece.color === "w" && to[1] === "8") ||
         (piece.color === "b" && to[1] === "1"))
    ) {
        if (!isEngineMove) {
            showPromotion(from, to);
            return;
        }
    }

    var result = game.move({
        from,
        to,
        promotion: promo
    });

    if (!result) return;

    board.position(game.fen(), false);

    setLastMove(from, to);

    addMoveToHistory();

    clearMoves();

    checkGameState();
}

// =========================
// ENGINE REQUEST
// =========================
function makeEngineMove() {

    if (!gameStarted) return;
    if (!engineReady) return;
    if (game.game_over()) return;
    if (engineThinking) return;
    if (game.turn() === playerColor) return;

    engineThinking = true;
    candidateMoves = [];

    stockfish.postMessage("position fen " + game.fen());
    stockfish.postMessage("go movetime 600");
}

// =========================
// GAME STATE (FIXED)
// =========================
function checkGameState() {

    if (!game.game_over()) return;

    let text = "";

    if (game.in_checkmate()) {
        text = (game.turn() === "w" ? "Black" : "White") + " wins by checkmate";
    } else if (game.in_stalemate()) {
        text = "Stalemate";
    } else if (game.in_draw()) {
        text = "Draw";
    } else {
        text = "Game over";
    }

    $("#game-result").text(text);

    // IMPORTANT: delay popup so board finishes rendering move
    setTimeout(() => {
        $("#game-over").removeClass("hidden");
    }, 250);

    engineThinking = false;
}

// =========================
// BOARD INIT
// =========================
board = Chessboard("board", {

    draggable: true,
    position: "start",
    pieceTheme: "img/chesspieces/{piece}.png",

    onDragStart: function (source, piece) {

        if (!gameStarted) return false;
        if (game.game_over()) return false;
        if (engineThinking) return false;

        if (
            (game.turn() === "w" && piece.startsWith("b")) ||
            (game.turn() === "b" && piece.startsWith("w"))
        ) return false;

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

        clearMoves();

        board.position(game.fen(), false);

        checkGameState();

        setTimeout(makeEngineMove, 200);
    },

    onSnapEnd: function () {
        board.position(game.fen());
    }
});

// =========================
// START GAME
// =========================
window.chooseSide = chooseSide;

function chooseSide(color) {

    playerColor = color;

    game.reset();
    board.position("start", false);

    engineThinking = false;
    candidateMoves = [];
    moveHistory = [];
    pendingPromotion = null;

    gameStarted = true;

    board.orientation(color === "b" ? "black" : "white");

    $("#start-screen").hide();

    $("#moves-list").html("");
    $("#game-over").addClass("hidden");

    if (playerColor === "b") {
        setTimeout(makeEngineMove, 500);
    }
}

// =========================
// STUB
// =========================
function clearLastMove() {
    lastMoveSquares.forEach(function (sq) {
        $("#board .square-" + sq).removeClass("last-move");
    });
    lastMoveSquares = [];
}

function restartGame() {

    game.reset();
    board.position("start", false);

    engineThinking = false;
    candidateMoves = [];
    moveHistory = [];
    pendingPromotion = null;
    isEngineMove = false;

    lastMoveSquares = [];

    $("#moves-list").html("");
    $("#game-over").addClass("hidden");

    board.orientation(playerColor === "b" ? "black" : "white");

    if (playerColor === "b") {
        setTimeout(makeEngineMove, 500);
    }
}