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
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr'],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br']
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

canvas.addEventListener('click', (event) => 
{
    const col = Math.floor(event.offsetX / square_size);
    const row = Math.floor(event.offsetY / square_size);

    if(selectedPiece)
    {
        startBoard[row][col] = selectedPiece;
        startBoard[selectedSquare[0]][selectedSquare[1]] = null;
        selectedPiece = null;
        drawBoard();
        drawPieces();
    }
    else
    {
        selectedPiece = startBoard[row][col];
        selectedSquare = [row, col];
    }
});