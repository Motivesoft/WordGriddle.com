// Scripting specific to the puzzle.html page

// Assume we will be loaded with a 'file' parameter that points to a puzzle file on the server.
// Load that puzzle and let the user play it
document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const fileUrl = urlParams.get('puzzle');

    // Assuming we have a file, load it and populate the page
    if (fileUrl) {
        fetch(fileUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error status: ${response.status}`);
                }

                return response.json();
            })
            .then(data => {
                if (data.puzzle) {
                    openPuzzle(data.puzzle);
                } else {
                    throw new Error("Missing puzzle information");
                }
            })
            .catch(error => console.error(error));
    } else {
        document.getElementById('puzzleDetails').innerHTML = 'This page needs to be launched from the puzzles catalog page.';
    }
});

const currentPuzzle = {
    puzzle: null,
    letterArray: [],
    width: 0,
    height: 0,
};

function openPuzzle(puzzle) {
    console.info(`Opening puzzle with ID: ${puzzle.id}`);
    console.debug(`Puzzle details ${puzzle.size}x${puzzle.size} with title: ${puzzle.title}`);

    // TODO initialise some internals
    currentPuzzle.puzzle = puzzle;
    currentPuzzle.letterArray = Array.from(puzzle.letters);
    currentPuzzle.width = puzzle.size;
    currentPuzzle.height = puzzle.size;

    document.getElementById('puzzle-title').innerHTML = puzzle.title;

    // Initiate things using our 'currentPuzzle' state object
    initialiseGrid();
}

function initialiseGrid() {
    console.debug(`initializeGrid at ${currentPuzzle.width} ${currentPuzzle.height}`);

    // TODO rename this to gridElement
    const grid = document.getElementById('puzzle-grid');
    
    // Set grid dimensions
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${currentPuzzle.width}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${currentPuzzle.height}, 1fr)`;

    currentPuzzle.letterArray.forEach((letter, index) => {
        // '.' is meaningful in terms of puzzle design, but don't show in the grid
        let displayLetter = letter;
        if (letter === '.') {
            displayLetter = ' ';
        }

        const cell = document.createElement('div');
        cell.className = 'grid-item';
        cell.textContent = displayLetter;
        cell.dataset.letter = letter;
        cell.dataset.index = index;
        cell.dataset.coord = `[${index}]`;

        // Style the unusable parts of the grid so they look and interact as we need them to
        if (letter === '.') {
            cell.classList.add('hidden');
        }

        // Add the cell to the grid
        grid.appendChild(cell);
    });

    handleResize();
}

function handleResize() {
    console.error("TODO: implement handleResize");
}