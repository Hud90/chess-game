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

// promotion state
var pendingPromotion = null;

// =========================
// PROMOTION UI (FIXED)
// =========================
function showPromotion(from, to) {

    pendingPromotion = { from, to };

    $("#promo").removeClass("hidden");

    $("#promo button").off("click").on("click", function () {

        var piece = $(this).data("piece");

        game.move({
            from,
            to,
            promotion: piece
        });

        board.position(game.fen(), false);
        setLastMove(from, to);

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
    console.log("SF:", line);

    if (line === "uciok") {
        stockfish.postMessage("isready");
    }

    if (line === "readyok") {
        engineReady = true;

        stockfish.postMessage("ucinewgame");

        // ⭐ IMPORTANT: REAL WEAKENING METHOD
        stockfish.postMessage("setoption name UCI_LimitStrength value true");
        stockfish.postMessage("setoption name UCI_Elo value " + engineRating);

        stockfish.postMessage("setoption name MultiPV value 3");
    }

    if (!gameStarted) return;

    if (line.startsWith("info") && line.includes(" pv ")) {
        var match = line.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
        if (match) candidateMoves.push(match[1]);
    }

    if (line.startsWith("bestmove")) {
        handleEngineMove(line);
    }
};

// =========================
// UPDATE ENGINE STRENGTH LIVE
// =========================
function updateEngineStrength() {

    if (!engineReady) return;

    stockfish.postMessage("setoption name UCI_Elo value " + engineRating);
}

// =========================
// ENGINE MOVE LOGIC
// =========================
function handleEngineMove(line) {

    engineThinking = false;

    if (game.game_over()) return;

    var bestMove = line.split(" ")[1];
    if (!bestMove || bestMove === "(none)") return;

    var legalMoves = game.moves({ verbose: true });

    var chosen = bestMove;

    // ====================================
    // EXTREME LOW-ELO BLUNDER SYSTEM
    // ====================================

    // rating 0-2000 → blunder %
    var blunderChance = 1 - (engineRating / 2000);

    // rating 0 = 100% blunder
    // rating 1000 = 50%
    // rating 2000 = 0%

    // massive scaling for very weak bots
    if (engineRating < 300) {
        blunderChance = 0.95;
    }

    if (engineRating < 150) {
        blunderChance = 0.98;
    }

    // ====================================
    // PICK RANDOM BAD MOVE
    // ====================================

    if (Math.random() < blunderChance) {

        // prioritize terrible moves
        var badMoves = [];

        legalMoves.forEach(function(m) {

            // avoid checks/captures for weak play
            if (
                !m.captured &&
                !m.san.includes("+") &&
                !m.san.includes("#")
            ) {
                badMoves.push(m);
            }
        });

        if (badMoves.length > 0) {

            var rand =
                badMoves[Math.floor(Math.random() * badMoves.length)];

            chosen =
                rand.from +
                rand.to +
                (rand.promotion || "");

        } else {

            var rand =
                legalMoves[Math.floor(Math.random() * legalMoves.length)];

            chosen =
                rand.from +
                rand.to +
                (rand.promotion || "");
        }
    }

    playMove(chosen);
}

// =========================
// PLAY MOVE (WITH PROPER PROMOTION)
// =========================
function playMove(move) {

    var from = move.substring(0, 2);
    var to = move.substring(2, 4);
    var promo = move.length > 4 ? move[4] : "q";

    var piece = game.get(from);

    // ✅ REAL PROMOTION FIX
    if (
        piece &&
        piece.type === "p" &&
        ((piece.color === "w" && to[1] === "8") ||
         (piece.color === "b" && to[1] === "1"))
    ) {
        showPromotion(from, to);
        return;
    }

    game.move({ from, to, promotion: promo });

    board.position(game.fen(), false);
    setLastMove(from, to);

    checkGameState();
}

// =========================
// ENGINE MOVE REQUEST
// =========================
function makeEngineMove() {

    if (!gameStarted) return;
    if (game.game_over()) return;
    if (engineThinking) return;

    if (game.turn() === playerColor) return;

    engineThinking = true;

    candidateMoves = [];

    updateEngineStrength();

    stockfish.postMessage(
        "position fen " + game.fen()
    );

    // ====================================
    // REAL THINKING TIME SCALING
    // ====================================

    var thinkTime = 50;

    if (engineRating > 200) thinkTime = 100;
    if (engineRating > 600) thinkTime = 150;
    if (engineRating > 1000) thinkTime = 250;
    if (engineRating > 1500) thinkTime = 400;

    stockfish.postMessage(
        "go movetime " + thinkTime
    );
}

// =========================
// BOARD INIT
// =========================
board = Chessboard("board", {
    draggable: true,
    position: "start",
    pieceTheme: "img/chesspieces/{piece}.png",

    onDragStart,
    onDrop,
    onSnapEnd: function () {
        board.position(game.fen());
    }
});

window.chooseSide = chooseSide;

// =========================
// START GAME
// =========================
function chooseSide(color) {

    playerColor = color;
    gameStarted = true;

    board.orientation(color === "b" ? "black" : "white");

    game.reset();
    clearAllUI();
    board.position(game.fen(), false);

    $("#start-screen").fadeOut(200);

    if (playerColor === "b") {
        setTimeout(makeEngineMove, 500);
    }
}

// =========================
// SLIDER (0–2000 ELO)
// =========================
$("#level").on("input", function () {

    engineRating = parseInt(this.value);
    $("#level-display").text(engineRating);

    updateEngineStrength();
});

// =========================
// PLAYER MOVE
// =========================
function onDragStart(source, piece) {

    if (!gameStarted) return false;
    if (game.game_over()) return false;
    if (engineThinking) return false;

    clearMoves();

    if (
        (game.turn() === "w" && piece.startsWith("b")) ||
        (game.turn() === "b" && piece.startsWith("w"))
    ) return false;

    showMoves(source);
}

function onDrop(source, target) {

    clearMoves();

    var piece = game.get(source);

    var isPromotion =
        piece &&
        piece.type === "p" &&
        (
            (piece.color === "w" && target[1] === "8") ||
            (piece.color === "b" && target[1] === "1")
        );

    if (isPromotion) {

        pendingPromotion = { from: source, to: target };

        // ==============================
        // 1. CREATE TEMP VISUAL STATE
        // ==============================
        var tempGame = new Chess(game.fen());

        // DO NOT promote yet — force pawn move only
        tempGame.remove(source);
        tempGame.put(
            piece,
            target
        );

        // show pawn on promotion square
        board.position(tempGame.fen(), false);

        // ==============================
        // 2. SHOW PROMOTION UI
        // ==============================
        $("#promo").removeClass("hidden");

        $("#promo button")
            .off("click")
            .on("click", function () {

                var promoPiece = $(this).data("piece");

                // NOW commit real move
                var move = game.move({
                    from: source,
                    to: target,
                    promotion: promoPiece
                });

                if (!move) {
                    $("#promo").addClass("hidden");
                    board.position(game.fen(), false);
                    return;
                }

                // final correct board
                board.position(game.fen(), false);

                setLastMove(source, target);

                $("#promo").addClass("hidden");

                checkGameState();

                setTimeout(makeEngineMove, 200);
            });

        return "snapback";
    }

    // =========================
    // NORMAL MOVE
    // =========================
    var move = game.move({
        from: source,
        to: target
    });

    if (!move) return "snapback";

    setLastMove(source, target);

    board.position(game.fen(), false);

    checkGameState();

    setTimeout(makeEngineMove, 200);
}

// =========================
// GAME STATE
// =========================
function restartGame() {

    game.reset();
    board.position(game.fen(), false);

    engineThinking = false;
    gameStarted = false;

    candidateMoves = [];
    lastMoveSquares = [];

    $("#game-over").addClass("hidden");
    $("#start-screen").fadeIn(200);
}

function checkGameState() {

    if (!game.game_over()) return false;

    let text = "";

    if (game.in_checkmate()) {
        text = "Checkmate!";
    }
    else if (game.in_stalemate()) {
        text = "Stalemate!";
    }
    else if (game.in_threefold_repetition()) {
        text = "Draw (Repetition)!";
    }
    else if (game.in_draw()) {
        text = "Draw!";
    }
    else {
        text = "Game Over";
    }

    $("#game-result").text(text);
    $("#game-over").removeClass("hidden");

    return true;
}

// =========================
// UI HELPERS
// =========================
function showMoves(square) {

    clearMoves();

    game.moves({ square, verbose: true }).forEach(m => {
        $("#board .square-" + m.to)
            .addClass(m.captured ? "capture-dot" : "move-dot");
    });
}

function clearMoves() {
    $("#board .square-55d63")
        .removeClass("move-dot capture-dot");
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

    lastMoveSquares.forEach(sq => {
        $("#board .square-" + sq).removeClass("last-move");
    });

    lastMoveSquares = [];
}

// =========================
// RESET UI
// =========================
function clearAllUI() {
    clearMoves();
    clearLastMove();
}