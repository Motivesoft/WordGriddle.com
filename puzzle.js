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
        // TODO do this better
        alert('This page needs to be launched from the puzzles catalog page.');
    }
});

const currentPuzzle = {
    puzzle: null,
    letterArray: [],
    width: 0,
    height: 0,

    // Transient state variables
    isDrawing: false,
    selectedLetters: [],
    currentTrail: [],
    mostRecentCell: null,

    // Game progress
    foundKeyWords: [],
    foundOtherWords: [],
};

function openPuzzle(puzzle) {
    console.debug(`openPuzzle with ID: ${puzzle.id}, a ${puzzle.size}x${puzzle.size} with title: ${puzzle.title}`);

    // TODO initialise some internals
    currentPuzzle.puzzle = puzzle;
    currentPuzzle.letterArray = Array.from(puzzle.letters);
    currentPuzzle.width = puzzle.size;
    currentPuzzle.height = puzzle.size;

    getPuzzleTitleElement().innerHTML = puzzle.title;

    // Transient variables
    currentPuzzle.isDrawing = false;
    currentPuzzle.selectedLetters = [];
    currentPuzzle.currentTrail = [];
    currentPuzzle.mostRecentCell = null;

    // TODO other setup/state stuff
    currentPuzzle.foundKeyWords.length = 0;
    currentPuzzle.foundOtherWords.length = 0;

    // Initiate things using our 'currentPuzzle' state object
    initialiseGrid();
}

function initialiseGrid() {
    console.debug(`initializeGrid at ${currentPuzzle.width} ${currentPuzzle.height}`);

    const gridElement = getGridElement();

    // Set grid dimensions
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${currentPuzzle.width}, 1fr)`;
    gridElement.style.gridTemplateRows = `repeat(${currentPuzzle.height}, 1fr)`;

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
        gridElement.appendChild(cell);
    });

    handleResize();
}

// Trail stuff

// Start a new drag operation
function startDragGesture(e) {
    // React to a click or touch, unless on a 'hidden' square
    const cell = e.target;
    if (cell.classList.contains('grid-item')) {
        currentPuzzle.isDrawing = true;
        currentPuzzle.selectedLetters = [{
            letter: cell.dataset.letter,
            index: parseInt(cell.dataset.index)
        }];

        // Mark the cell as selected
        cell.classList.add('selected');

        // Record the movement
        currentPuzzle.currentTrail.push(cell);

        // Draw the start of a new trail
        redrawTrail();

        // Remember where we are for backtracking
        currentPuzzle.mostRecentCell = cell;
    }
}

// Continue a drag operation
// This takes a target HTML element and mouse/touch x,y coordinates 
function continueDragGesture(cell, clientX, clientY) {
    // Drop out if we're not currently in a drag operation
    if (!currentPuzzle.isDrawing) {
        return;
    }

    // If we're on a cell in the grid and have moved from the previous cell, treat this as a drag gesture
    // unless the cell contains a space, intended to mean a gap in the layout that the user may not select
    if (cell.classList.contains('grid-item') && cell !== currentPuzzle.mostRecentCell && cell.dataset.letter !== ' ') {
        // Reject points too close to the edge sto avoid false positives
        const cellRect = cell.getBoundingClientRect();
        const cellCentreX = cellRect.left + (cellRect.width / 2);
        const cellCentreY = cellRect.top + (cellRect.height / 2);
        const xDistanceToCentre = Math.abs(cellCentreX - clientX);
        const yDistanceToCentre = Math.abs(cellCentreY - clientY);

        // If we are within this distance of the centre, accept that we are selecting this cell
        // Another way to put this is to use the middle 70% as the target area 
        const proximityMeasure = 0.35;
        if (xDistanceToCentre > cellRect.width * proximityMeasure || yDistanceToCentre > cellRect.height * proximityMeasure) {
            return;
        }

        // Where are we?
        const cellIndex = parseInt(cell.dataset.index);
        const cellCol = cellIndex % currentPuzzle.width;
        const cellRow = (cellIndex - cellCol) / currentPuzzle.width;

        // Where have we come from?
        const prevIndex = currentPuzzle.selectedLetters[currentPuzzle.selectedLetters.length - 1].index;
        const prevCol = prevIndex % currentPuzzle.width;
        const prevRow = (prevIndex - prevCol) / currentPuzzle.width;

        // What will help us work out if this is a valid move - valid being -1 and 1 respectively
        const lastSelectedIndex = currentPuzzle.selectedLetters.findIndex(item => item.index === cellIndex);
        const distance = Math.max(Math.abs(cellCol - prevCol), Math.abs(cellRow - prevRow));

        // lastSelectedIndex = -1 iff cell is not part of the current selection
        // distance = 1 if the origin and new cell are adjacent

        // if a valid move, select the square
        if (lastSelectedIndex === -1 && distance === 1) {
            // Add new cell to selection
            currentPuzzle.selectedLetters.push({
                letter: cell.dataset.letter,
                index: cellIndex
            });

            // Mark the cell as selected
            cell.classList.add('selected');

            // Record the movement
            currentPuzzle.currentTrail.push(cell);

            // Remember this step for backtracking
            currentPuzzle.mostRecentCell = cell;
        } else if (lastSelectedIndex !== -1) {
            // Encountered an already selected cell. Is this a step backwards
            if (cellIndex === currentPuzzle.selectedLetters[currentPuzzle.selectedLetters.length - 2]?.index) {
                const gridElement = getGridElement();

                // Pop the last selected letter and deselect its cell

                const prevIndex = currentPuzzle.selectedLetters[currentPuzzle.selectedLetters.length - 1].index;
                const prevCell = gridElement.childNodes[prevIndex];
                prevCell.classList.remove('selected');

                // Remove the step
                currentPuzzle.currentTrail.pop();

                // Remove the last letter
                currentPuzzle.selectedLetters.pop();

                // Reset where we are for further backtracking
                currentPuzzle.mostRecentCell = cell;
            }
        }

        // Draw the updated trail
        redrawTrail();
    }
}

// Stop a drag operation and process the outcome
function stopDragGesture() {
    if (currentPuzzle.isDrawing) {
        currentPuzzle.isDrawing = false;

        // TODO do word finding logic here
        const selectedWord = currentPuzzle.selectedLetters.map(item => item.letter).join('').toLowerCase();
        const selectedPath = currentPuzzle.selectedLetters.map(item => `[${item.index}]`).join('');

        if (currentPuzzle.puzzle.keyWords) {
            currentPuzzle.puzzle.keyWords.forEach(([word, path]) => {
                if (word === selectedWord) {
                    console.log(`Found key word: ${word}`);
    
                    // TODO add to found key words list (and save)
                    // TODO reduce red/grey scores and see if we're finished
                    currentPuzzle.foundKeyWords.push(word);
    
                    if (currentPuzzle.foundKeyWords.length == currentPuzzle.puzzle.keyWords.length) {
                        alert( "Congratulations. You've found all of the key words!");
                    }
                }
            });
        }

        if (currentPuzzle.puzzle.otherWords) {
            currentPuzzle.puzzle.otherWords.forEach(([word, path]) => {
                if (word == selectedWord) {
                    console.log(`Found other word: ${word}`);
    
                    // TODO add to found other words list (and save)
                    currentPuzzle.foundOtherWords.push(word);
                }
            });
        }

        // Clear any selection decorations
        clearTrail();

        document.querySelectorAll('.grid-item').forEach(item => {
            item.classList.remove('selected');
        });
    };
}

function redrawTrail() {
    // Draw the train onto a canvas floating above the grid
    const trailCanvas = getTrailCanvas();
    const ctx = trailCanvas.getContext('2d');
    
    // Actually, draw to an offscreen, replica canvas first
    const offscreenCanvas = document.createElement("canvas");
    const offscreenCtx = offscreenCanvas.getContext("2d");

    offscreenCanvas.width = trailCanvas.width;
    offscreenCanvas.height = trailCanvas.height;

    // Use a CSS variable for the color of the trail so it can be modified by themes
    const color = getComputedStyle(document.documentElement).getPropertyValue('--trail-color');

    let cells = currentPuzzle.currentTrail.length;
    if (cells > 0) {
        let from = currentPuzzle.currentTrail[0];

        // Start the trail with a blob
        canvasDrawBlob(offscreenCtx, color, from);

        let index = 1;
        while (index < cells) {
            let to = currentPuzzle.currentTrail[index++];

            // Continue the trail from cell to cell
            canvasDrawLine(offscreenCtx, color, from, to);

            // Step forward
            from = to;
        }
    }

    // Use globalCompositeOperation to apply transparency when drawing onto the main canvas
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.4; // Set transparency

    ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
}

// Draw a line between cells to indicate the selection
function canvasDrawLine(ctx, color, from, to) {
    // TODO confirm whether we need this in the calculations below
    const gridElement = getGridElement();

    // Begin a new path
    ctx.beginPath();

    ctx.strokeStyle = color;
    ctx.lineWidth = 15;
    ctx.lineCap = 'round'; // Rounded line ends

    const fromXCentre = (from.offsetLeft - gridElement.offsetLeft) + from.offsetWidth / 2;
    const fromYCentre = (from.offsetTop - gridElement.offsetTop) + from.offsetHeight / 2;

    const toXCentre = (to.offsetLeft - gridElement.offsetLeft) + to.offsetWidth / 2;
    const toYCentre = (to.offsetTop - gridElement.offsetTop) + to.offsetHeight / 2;

    ctx.moveTo(fromXCentre, fromYCentre);
    ctx.lineTo(toXCentre, toYCentre);
    ctx.stroke();
}

// Draw a blob on the first cell of a selection
function canvasDrawBlob(ctx, color, cell) {
    // TODO confirm whether we need this in the calculations below
    const gridElement = getGridElement();

    // Begin a new path
    ctx.beginPath();

    ctx.fillStyle = color;

    // Draw a circle
    const radius = 24;
    const xCentre = (cell.offsetLeft - gridElement.offsetLeft) + cell.offsetWidth / 2;
    const yCentre = (cell.offsetTop - gridElement.offsetTop) + cell.offsetHeight / 2;
    ctx.arc(xCentre, yCentre, radius, 0, 2 * Math.PI);

    // Fill the circle to create the blob
    ctx.fill();
}

// Done with the current drag, clean up the trails
function clearTrail() {
    const trailCanvas = getTrailCanvas();
    const ctx = trailCanvas.getContext('2d');
    ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);

    // Reset the trail
    currentPuzzle.currentTrail.length = 0;
}

// Event handlers


// Event handler logic

function attachEventListeners() {
    const gridElement = getGridElement();
    gridElement.addEventListener('mousedown', handleMouseStart);
    gridElement.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseEnd);

    gridElement.addEventListener('touchstart', handleTouchStart);
    gridElement.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    // Make sure our canvas for drawing selection lines is always the right size
    window.addEventListener('resize', handleResize);
}

// Mouse handlers

function handleMouseStart(e) {
    startDragGesture(e);
}

function handleMouseMove(e) {
    // Extract the mouse target and process it
    // Pass in the individual elements rather than the event as 'draw()'
    // needs to service mouse and touch events and has a signature to suit
    continueDragGesture(e.target, e.clientX, e.clientY);
}

function handleMouseEnd(e) {
    stopDragGesture();
}

// Touch handlers

function handleTouchStart(e) {
    startDragGesture(e);
}

function handleTouchMove(e) {
    // Work out where we have dragged to and process it
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element) {
        continueDragGesture(element, touch.clientX, touch.clientY);
    }
}

function handleTouchEnd(e) {
    stopDragGesture();
}

function handleResize() {
    // Make sure the canvas stays resized to the grid
    const gridElement = getGridElement();

    const trailCanvas = getTrailCanvas();
    trailCanvas.style.left = `${gridElement.offsetLeft}px`;
    trailCanvas.style.top = `${gridElement.offsetTop}px`;
    trailCanvas.width = gridElement.offsetWidth;
    trailCanvas.height = gridElement.offsetHeight;

    // TODO do we need to redraw any active trail here?
}

// Helpers

function getGridElement() {
    return document.getElementById('puzzle-grid');
}

function getTrailCanvas() {
    return document.getElementById('trail-canvas');
}

function getPuzzleTitleElement() {
    return document.getElementById('puzzle-title');
}

// Get ready

attachEventListeners();