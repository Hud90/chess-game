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
var pendingPromotion = null;

var gameMode = "new"; // or "pgn"

var engineRating = 800;

var candidateMoves = [];
var lastMoveSquares = [];

var isEngineMove = false;

// =========================
// REVIEW MODE
// =========================
var reviewMode = false;
var reviewGame = null;

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

    const raw = parseInt(this.value);

    engineRating = mapElo(raw);

    $("#level-display").text(raw);

    if (engineReady) {
        applyEngineSettings();
    }
});

// ======================================================
// MOVE DOTS
// ======================================================
function getActiveGame() {
    return reviewMode ? reviewGame : game;
}

function showMoves(square) {

    clearMoves();

    const activeGame = getActiveGame();

    var moves = activeGame.moves({
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

    let fen;

    if (reviewMode) {
        fen = reviewGame.fen();
    } else {
        fen = moveSnapshots[currentViewIndex];
    }

    evalEngine.postMessage("position fen " + fen);
    evalEngine.postMessage("go depth 16");
}

function mapElo(x) {

    const t = x / 1000;

    const curved = Math.pow(t, 1.6);

    return Math.round(300 + curved * (2000 - 300));
}

function getBlunderChance(rawSlider) {

    if (rawSlider < 150) return 0.45;
    if (rawSlider < 300) return 0.30;
    if (rawSlider < 500) return 0.18;
    if (rawSlider < 700) return 0.10;
    if (rawSlider < 850) return 0.04;
    return 0.01;
}

function applyEngineSettings() {

    const slider = parseInt($("#level").val());

    let skill = 20;

    if (slider < 100) skill = 0;
    else if (slider < 250) skill = 3;
    else if (slider < 400) skill = 6;
    else if (slider < 600) skill = 10;
    else if (slider < 800) skill = 16;

    stockfish.postMessage(
        "setoption name UCI_LimitStrength value true"
    );

    stockfish.postMessage(
        "setoption name Skill Level value " + skill
    );

    stockfish.postMessage(
        "setoption name UCI_Elo value " + engineRating
    );
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

        applyEngineSettings();

        return;
    }

    if (!gameStarted && !reviewMode) return;

    if (line.startsWith("bestmove")) {

        const move = line.split(" ")[1];

        if (hintActive) {

            hintActive = false;
            engineThinking = false;

            showHint(move);
            return;
        }

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

    let tempGame;

    if (reviewMode) {
        tempGame = reviewGame;
    } else {
        const fen = moveSnapshots[currentViewIndex];
        tempGame = new Chess(fen);
    }

    if (tempGame.turn() === "b") {
        score *= -1;
    }

    updateEvalBar(score);
};

// ======================================================
// ENGINE MOVE
// ======================================================
function handleEngineMove(line) {

    engineThinking = false;

    if (!gameStarted || game.game_over()) return;

    let bestMove = line.split(" ")[1];

    const slider = parseInt($("#level").val());

    const moves = game.moves({ verbose: true });

    if (slider < 100) {

        if (Math.random() < 0.70) {

            const random =
                moves[Math.floor(Math.random() * moves.length)];

            bestMove =
                random.from +
                random.to +
                (random.promotion || "");
        }
    }

    else if (slider < 300) {

        if (Math.random() < 0.45) {

            const random =
                moves[Math.floor(Math.random() * moves.length)];

            bestMove =
                random.from +
                random.to +
                (random.promotion || "");
        }
    }

    else if (slider < 600) {

        if (Math.random() < 0.20) {

            const random =
                moves[Math.floor(Math.random() * moves.length)];

            bestMove =
                random.from +
                random.to +
                (random.promotion || "");
        }
    }

    else if (slider < 850) {

        if (Math.random() < 0.08) {

            const random =
                moves[Math.floor(Math.random() * moves.length)];

            bestMove =
                random.from +
                random.to +
                (random.promotion || "");
        }
    }

    playMove(bestMove);
}

// ======================================================
// PLAY MOVE
// ======================================================
function playMove(move) {
    clearHintUI();

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

    if (reviewMode) return;

    if (!gameStarted) return;
    if (!engineReady) return;
    if (game.game_over()) return;
    if (engineThinking) return;
    if (game.turn() === playerColor) return;

    engineThinking = true;

    stockfish.postMessage(
        "position fen " + game.fen()
    );

    const slider = parseInt($("#level").val());

    let moveTime = 50;

    if (slider < 100) moveTime = 25;
    else if (slider < 250) moveTime = 40;
    else if (slider < 400) moveTime = 70;
    else if (slider < 600) moveTime = 120;
    else if (slider < 800) moveTime = 250;
    else moveTime = 500;

    stockfish.postMessage(
        "go movetime " + moveTime
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

function showPromotionPopup(color, callback) {

    const promo = $("#promo");

    const pieces = {
        q: color === "w" ? "♕" : "♛",
        r: color === "w" ? "♖" : "♜",
        b: color === "w" ? "♗" : "♝",
        n: color === "w" ? "♘" : "♞"
    };

    promo.find("button").each(function () {

        const piece = $(this).data("piece");

        $(this).text(pieces[piece]);
    });

    promo.removeClass("hidden");

    $("#promo button")
        .off("click")
        .on("click", function () {

            const piece = $(this).data("piece");

            promo.addClass("hidden");

            callback(piece);
        });
}

// ======================================================
// BOARD INIT
// ======================================================
board = Chessboard("board", {

    draggable: true,

    position: "start",

    pieceTheme: "img/chesspieces/{piece}.png",

    onDragStart: function (source, piece) {

        const activeGame = getActiveGame();

        if (!gameStarted && !reviewMode) return false;

        if (!reviewMode) {

            if (activeGame.game_over()) return false;

            if (engineThinking) return false;

            if (currentViewIndex !== moveSnapshots.length - 1) {
                return false;
            }

            if (activeGame.turn() !== playerColor) {
                return false;
            }
        }

        if (
            (activeGame.turn() === "w" && piece.startsWith("b")) ||
            (activeGame.turn() === "b" && piece.startsWith("w"))
        ) {
            return false;
        }

        showMoves(source);

        return true;
    },

    onDrop: function (source, target) {

        const activeGame = getActiveGame();

        const piece = activeGame.get(source);

        // =========================================
        // PLAYER PROMOTION
        // =========================================

        if (
            piece &&
            piece.type === "p" &&
            (
                (piece.color === "w" && target[1] === "8") ||
                (piece.color === "b" && target[1] === "1")
            )
        ) {

            const legalMoves = activeGame.moves({
                square: source,
                verbose: true
            });

            const isLegalPromotion = legalMoves.some(m =>
                m.to === target && m.promotion
            );

            if (!isLegalPromotion) {
                return "snapback";
            }

            const currentPos = board.position();

            delete currentPos[source];

            currentPos[target] =
                piece.color + "P";

            setTimeout(function () {

                board.position(currentPos, false);

            }, 0);

            showPromotionPopup(piece.color, function (promotionPiece) {

                const move = activeGame.move({
                    from: source,
                    to: target,
                    promotion: promotionPiece
                });

                if (!move) {

                    board.position(activeGame.fen(), false);

                    return;
                }

                if (reviewMode) {

                    clearHintUI();
                    hintActive = false;

                    board.position(reviewGame.fen(), false);

                    setLastMove(source, target);

                    clearMoves();

                    requestEvaluation();

                } else {

                    finishPlayerMove(source, target);
                }
            });

            return "trash";
        }

        // =========================================
        // NORMAL MOVE
        // =========================================

        var move = activeGame.move({
            from: source,
            to: target,
            promotion: "q"
        });

        if (!move) return "snapback";

        if (reviewMode) {

            clearHintUI();
            hintActive = false;

            board.position(reviewGame.fen(), false);

            setLastMove(source, target);

            clearMoves();

            requestEvaluation();

            return;
        }

        finishPlayerMove(source, target);
    },

    onSnapEnd: function () {

        const activeGame = getActiveGame();

        board.position(activeGame.fen());
    }
});

function finishPlayerMove(source, target) {
    clearHintUI();

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
}

// ======================================================
// REVIEW MODE
// ======================================================
function enterReviewMode() {

    reviewMode = true;

    reviewGame = new Chess();

    const moves = game.history();

    for (let i = 0; i < currentViewIndex; i++) {
        reviewGame.move(moves[i]);
    }

    board.position(reviewGame.fen(), false);

    clearMoves();

    updateLastMoveFromSnapshot();

    requestEvaluation();

    $("#game-over").addClass("hidden");
}

function exitReviewMode() {

    reviewMode = false;

    reviewGame = null;

    board.position(
        moveSnapshots[currentViewIndex],
        false
    );

    clearMoves();

    updateLastMoveFromSnapshot();

    requestEvaluation();
}

// ======================================================
// START GAME
// ======================================================
window.chooseSide = function (color) {

    playerColor = color;

    reviewMode = false;
    reviewGame = null;

    if (gameMode === "new") {

        game.reset();

        moveSnapshots = [game.fen()];
        evalSnapshots = [0];
        currentViewIndex = 0;

        board.position("start", false);
    }

    if (gameMode === "pgn") {

        board.position(game.fen(), false);

        rebuildSnapshotsFromGame();

        renderHistoryFromGame();

        currentViewIndex = moveSnapshots.length - 1;
    }

    clearLastMove();
    engineThinking = false;
    gameStarted = true;

    $("#start-screen").hide();

    $("#game-over").addClass("hidden");

    // IMPORTANT FIX:
    // restore captures from current game position
    updateCapturedPieces();

    board.orientation(color === "b" ? "black" : "white");

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
    clearHintUI();

    if (currentViewIndex <= 0) return;

    currentViewIndex--;

    if (reviewMode) {

        reviewGame = new Chess();

        const moves = game.history();

        for (let i = 0; i < currentViewIndex; i++) {
            reviewGame.move(moves[i]);
        }

        board.position(reviewGame.fen(), false);

    } else {

        board.position(
            moveSnapshots[currentViewIndex],
            false
        );
    }

    clearMoves();

    updateLastMoveFromSnapshot();

    requestEvaluation();
});

$("#forward-btn").on("click", function () {
    clearHintUI();

    if (currentViewIndex >= moveSnapshots.length - 1) {
        return;
    }

    currentViewIndex++;

    if (reviewMode) {

        reviewGame = new Chess();

        const moves = game.history();

        for (let i = 0; i < currentViewIndex; i++) {
            reviewGame.move(moves[i]);
        }

        board.position(reviewGame.fen(), false);

    } else {

        board.position(
            moveSnapshots[currentViewIndex],
            false
        );
    }

    clearMoves();

    updateLastMoveFromSnapshot();

    requestEvaluation();
});

// ======================================================
// SAVE
// ======================================================
$("#save-game-btn").on("click", function () {
    clearHintUI();

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
    clearHintUI();

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
    clearHintUI();

    const pgn = game.pgn();

    const encodedPGN =
        encodeURIComponent(pgn);

    const url =
        `${location.origin}${location.pathname}` +
        `?pgn=${encodedPGN}` +
        `&color=${playerColor}`;

    navigator.clipboard.writeText(url);

    alert("Share link copied");
});

$("#export-pgn-btn").on("click", function () {
    clearHintUI();

    const pgn = game.pgn();

    const blob = new Blob([pgn], { type: "text/plain" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "game.pgn";

    a.click();

    URL.revokeObjectURL(url);
});

$("#new-game-btn").on("click", function () {
    clearHintUI();

    restartGame();
});

// ======================================================
// HINT SYSTEM
// ======================================================
var hintActive = false;
var hintMove = null;

$("#hint-btn").on("click", function () {

    const activeGame = getActiveGame();

    if (!gameStarted) return;
    if (!engineReady) return;
    if (activeGame.game_over()) return;
    if (engineThinking) return;

    engineThinking = true;
    hintActive = true;
    hintMove = null;

    // use CURRENT active position
    stockfish.postMessage(
        "position fen " + activeGame.fen()
    );

    stockfish.postMessage("go depth 16");

    clearHintUI();
});

function showHint(move) {

    const from = move.substring(0, 2);
    const to = move.substring(2, 4);

    hintMove = { from, to };

    clearHintUI();

    // FULL GREEN OUTLINE ON PIECE TO MOVE
    $("#board .square-" + from).addClass("hint-outline");

    // optional: subtle target highlight (not required)
    $("#board .square-" + to).addClass("hint-target");
}

function clearHintUI() {

    $("#board .square-55d63")
        .removeClass("hint-outline hint-target");
}

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

    updateCapturedPieces();

    gameStarted = true;

    reviewMode = false;
    reviewGame = null;

    requestEvaluation();

    if (game.turn() !== playerColor) {
        setTimeout(makeEngineMove, 300);
    }
}

// ======================================================
// LOAD SHARED PGN FROM URL
// ======================================================

const params = new URLSearchParams(window.location.search);

const sharedPGN = params.get("pgn");

const sharedColor = params.get("color");

if (sharedColor === "b") {

    playerColor = "b";

    board.orientation("black");

} else {

    playerColor = "w";

    board.orientation("white");
}

if (sharedPGN) {

    try {
        gameMode = "pgn";
        loadPGN(decodeURIComponent(sharedPGN));
        updateCapturedPieces();

        $("#start-screen").show();

    } catch (e) {

        console.error("Failed to load shared PGN", e);
    }
}

// ======================================================
// RESTART
// ======================================================
function restartGame() {

    game.reset();

    reviewMode = false;
    reviewGame = null;

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