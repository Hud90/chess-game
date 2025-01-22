// Setting up and drawing the chess board
const canvas = document.getElementById('board');
const c = canvas.getContext('2d');
const board_size = 8;

const square_size = canvas.width / board_size;

function drawBoard()
{
    for(let row = 0; row < board_size; row++)
    {
        for(let col = 0; col < board_size; col++)
            {
                const x = col * square_size;
                const y = row * square_size;
                // If the square is even, do the first choice, else do the second
                c.fillStyle = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863';
                c.fillRect(x, y, square_size, square_size);
            }        
    }
}

drawBoard();

// Setting up each piece
const pieces = {
    'wp': new Image(),
    'wr': new Image(),
    'wn': new Image(),
    'wb': new Image(),
    'wq': new Image(),
    'wk': new Image(),
    'bp': new Image(),
    'br': new Image(),
    'bn': new Image(),
    'bb': new Image(),
    'bq': new Image(),
    'bk': new Image()
};

// Image source paths
pieces['wp'].src = 'assets/white_pawn.png';
pieces['wr'].src = 'assets/white_rook.png';
pieces['wn'].src = 'assets/white_knight.png';
pieces['wb'].src = 'assets/white_bishop.png';
pieces['wq'].src = 'assets/white_queen.png';
pieces['wk'].src = 'assets/white_king.png';
pieces['bp'].src = 'assets/black_pawn.png';
pieces['br'].src = 'assets/black_rook.png';
pieces['bn'].src = 'assets/black_knight.png';
pieces['bb'].src = 'assets/black_bishop.png';
pieces['bq'].src = 'assets/black_queen.png';
pieces['bk'].src = 'assets/black_king.png';

// Rendering pieces
const startBoard = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

function drawPieces()
{
    for(let row = 0; row < board_size; row++)
    {
        for(let col = 0; col < board_size; col++)
        {
            const piece = startBoard[row][col];
            if(piece)
            {
                const x = col * square_size;
                const y = row * square_size + 2;
                c.drawImage(pieces[piece], x, y, square_size * 0.9, square_size * 0.9);
            }
        }
    }
}

// Highlight Function
function highlightMove(row, col)
{
    const x = col * square_size + square_size / 2;
    const y = row * square_size + square_size / 2;
    c.beginPath();
    c.arc(x, y, square_size * 0.2, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 255, 0, 0.5)';  // Semi-transparent green
    c.fill();
    c.strokeStyle = 'green';
    c.stroke();
}

// Game Piece Logic
function validSquare(row, col)  // Checking to see if the square is within the board
{
    return row >= 0 && row < board_size && col >= 0 && col < board_size;
}

function getPawnMoves(row, col, color)
{
    const moves = [];
    const direction = color === 'w' ? -1 : 1;   //

    if(validSquare(row + direction, col) && !startBoard[row + direction][col])
    {
        moves.push([row + direction, col]);
        
        if((color === 'w' && row === 6) || (color === 'b' && row === 1))
        {
            if (!startBoard[row + 2 * direction][col])
            {
                moves.push([row + 2 * direction, col]);
            }
        }
    }

    for(let i = -1; i <= 1; i += 2) // Loop to check the left and right diagonal squares
    {
        const captureRow = row + direction;
        const captureCol = col + i;

        if(validSquare(captureRow, captureCol))
        {
            const targetPiece = startBoard[captureRow][captureCol];
            if (targetPiece && targetPiece[0] !== color)    // If different color, capture
            {
                moves.push([captureRow, captureCol]);
            }
        }
    }

    return moves;
}

// Images would not load without this pause
let imagesLoaded = 0;
const totalImages = Object.keys(pieces).length;

for (let piece in pieces) {
    pieces[piece].onload = function() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            drawPieces(); // Call drawPieces after all images are loaded
        }
    };
}

let selectedPiece = null;
let selectedSquare = null;

let validMoves = []; // To store valid moves for the selected piece

// Event Listening
canvas.addEventListener('click', (event) => 
{
    const col = Math.floor(event.offsetX / square_size);
    const row = Math.floor(event.offsetY / square_size);

    if(selectedPiece)
    {
        const targetPiece = startBoard[row][col];
        const pieceColor = selectedPiece[0];
        
        // If valid move
        if(validMoves.some(([validRow, validCol]) => validRow === row && validCol === col))
        {
            // If same color return
            if(targetPiece && targetPiece[0] === pieceColor)
            {
                return;
            }
            // Else valid and move the piece
            startBoard[row][col] = selectedPiece;
            startBoard[selectedSquare[0]][selectedSquare[1]] = null;
            selectedPiece = null;
            selectedSquare = null;
            validMoves = [];
            drawBoard();
            drawPieces();
        }
        else
        {
            // Not valid
            selectedPiece = null;
            selectedSquare = null;
            validMoves = [];
            drawBoard();
            drawPieces();
        }
    }
    else
    {
        selectedPiece = startBoard[row][col];
        selectedSquare = [row, col];

        if(selectedPiece)
        {
            validMoves = [];

            drawBoard();
            drawPieces();

            const pieceType = selectedPiece.slice(1);   // Get the piece type
            const pieceColor = selectedPiece[0];        // "w" or "b"

            if(pieceType === 'p')   // If pawn
            {
                validMoves = getPawnMoves(row, col, pieceColor);
                validMoves.forEach(([moveRow, moveCol]) =>
                {
                    highlightMove(moveRow, moveCol);    // Highlight valid squares
                });
            }

            // Add other piece logic here !

        }
    }
});

/*
Piece Movement: Implement piece-specific movement rules (e.g., rooks move in straight lines, knights move in L-shapes).

Valid Move Checking: Check whether the move is valid (e.g., check for obstacles or valid capture conditions).

Game State: Track whose turn it is, and whether the game is over (checkmate or stalemate).

UI Improvements: Add highlights for valid moves, or display captured pieces.
*/