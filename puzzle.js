// Scripting specific to the puzzle.html page

// Enums
const FoundMoveSortOrder = Object.freeze({
    FOUND_ORDER: "FOUND_ORDER",
    ALPHABETICAL: "ALPHABETICAL",
    WORD_LENGTH: "WORD_LENGTH"
});

// Constants for local storage keys
const PuzzleLocalStorageKeys = Object.freeze({
    FOUND_WORD_ORDERING: "foundWordOrdering",
    SHOW_EXTRA_WORDS: "showExtraWords",
    PROGRESS_STORAGE: "puzzle-%id.progress",

    // TODO delete these three when finally obsolete
    KEY_WORD_STORAGE: "puzzle-%id.keyWords",
    EXTRA_WORD_STORAGE: "puzzle-%id.extraWords",
    NON_WORD_STORAGE: "puzzle-%id.nonWords",
});

// State
const currentPuzzle = {
    puzzle: null,
    letterArray: [],
    size: 0,

    // Transient state variables
    isDrawing: false,
    selectedLetters: [],
    currentTrail: [],
    mostRecentCell: null,

    // Game progress
    foundKeyWords: new Set(),
    foundExtraWords: new Set(),
    foundNonWords: 0,
    completed: false,
};

// Assume we will be loaded with a 'file' parameter that points to a puzzle file on the server.
// Load that puzzle and let the user play it
document.addEventListener('DOMContentLoaded', async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleFile = urlParams.get('puzzle');
    const puzzleRepo = urlParams.get(`repo`) || `puzzles`;

    // Assuming we have a file, load it and populate the page
    if (puzzleFile) {
        fetch(`/${puzzleRepo}/${puzzleFile}.json`)
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
            .catch(async error => {
                console.error("Failed to load puzzle", error);
                await openMessageBox(`Failed to load puzzle '${puzzleFile}'.`, 'error');
            });
    } else {
        await openMessageBox('This page needs to be launched from the puzzles catalog page.', 'error');
    }
});

function openPuzzle(puzzle) {
    // TODO initialise some internals
    currentPuzzle.puzzle = puzzle;
    currentPuzzle.letterArray = Array.from(puzzle.letters);
    currentPuzzle.size = puzzle.size;

    getPuzzleTitleElement().innerHTML = puzzle.title;

    // Transient variables
    currentPuzzle.isDrawing = false;
    currentPuzzle.selectedLetters = [];
    currentPuzzle.currentTrail = [];
    currentPuzzle.mostRecentCell = null;

    // TODO other setup/state stuff
    currentPuzzle.foundKeyWords.clear();
    currentPuzzle.foundExtraWords.clear();
    currentPuzzle.foundNonWords = 0;
    currentPuzzle.completed = false;

    // Initiate things using our 'currentPuzzle' state object
    initialiseGrid();

    // We are using local storage for progress, so let's check
    restoreProgress();

    // Update the other parts of the display
    updatePuzzleProgressMessage();
    updateSelectedLettersDisplay();
    updateRedGreyDisplay();
    updateWordsFound();
    updateExtraWordsFound();
}

function initialiseGrid() {
    const gridElement = getGridElement();

    // Set grid dimensions
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${currentPuzzle.size}, 1fr)`;
    gridElement.style.gridTemplateRows = `repeat(${currentPuzzle.size}, 1fr)`;

    // Test for a gap (empty cell, a hole) in the puzzle
    const isEmptyCell = (char) => char === ' ' || char === '-' || char === '.';

    currentPuzzle.letterArray.forEach((letter, index) => {
        const cell = document.createElement('div');
        cell.className = 'grid-item';
        cell.textContent = letter;
        cell.dataset.letter = letter;
        cell.dataset.index = index;
        cell.dataset.coord = `[${index}]`;
        cell.dataset.red = 0;
        cell.dataset.grey = 0;

        // '.' is meaningful in terms of puzzle design, but don't show in the grid
        // Style the unusable parts of the grid so they look and interact as we need them to
        if (isEmptyCell(letter)) {
            cell.classList.add('hidden');
            cell.textContent = ' ';
        } else {
            currentPuzzle.puzzle.keyWords.forEach(([_, path]) => {
                if (path.startsWith(cell.dataset.coord)) {
                    cell.dataset.red++;
                }

                if (path.includes(cell.dataset.coord)) {
                    cell.dataset.grey++;
                }
            });

            if (cell.dataset.grey == 0) {
                cell.classList.add('zerozero');
            }
        }

        // Add the cell to the grid
        gridElement.appendChild(cell);
    });

    // This can be done whenever it seems like a useful idea 
    prepareCanvas();

    scaleGrid();
}

function scaleGrid() {
    // Work out screen size and orientation and set things like grid gap and font size
    const size = currentPuzzle.size;

    // Get a rough idea of what type of device we are on
    const smallLandscape = window.matchMedia("(orientation: landscape) and (max-width: 1023px)");
    const largeLandscape = window.matchMedia("(orientation: landscape) and (min-width: 1024px)");
    const smallPortrait = window.matchMedia("(orientation: portrait) and (max-width: 499px)");
    const largePortrait = window.matchMedia("(orientation: portrait) and (min-width: 500px)");

    // Start with some defaults and then adjust them
    let maxDimension = `360px`;
    let gap = `10px`;
    let fontSize = `24px`;

    if (smallPortrait.matches) {
        maxDimension = `322px`;
        gap = `${size < 7 ? 11 : 4}px`;
        fontSize = `${Math.min(40, 160 / size)}px`;
    } else if (largePortrait.matches) {
        maxDimension = `330px`;
        gap = `${size < 7 ? 11 : 5}px`;
        fontSize = `${170 / size}px`;
    } else if (smallLandscape.matches) {
        maxDimension = `223px`;
        gap = `${size < 7 ? 7 : 3}px`;
        fontSize = `${114 / size}px`;
    } else if (largeLandscape.matches) {
        maxDimension = `402px`;
        gap = `${size < 7 ? 14 : 6}px`;
        fontSize = `${210 / size}px`;
    } else {
        // Unknown scenario according to our rules - not much we can do but allow our default behaviour to do the right thing 
        return;
    }

    // Apply the calculated size, font size and gap
    const gridElement = getGridElement();
    gridElement.style.width = maxDimension;
    gridElement.style.height = maxDimension;

    document.documentElement.style.setProperty('--grid-cell-gap', gap);
    document.documentElement.style.setProperty('--grid-cell-font-size', fontSize);
}

// Trail stuff

// Start a new drag operation
function startDragGesture(e) {
    // Make sure our canvas is in the right place
    prepareCanvas();

    // React to a click or touch, unless on a 'hidden' square
    const cell = e.target;
    if (cell.classList.contains('grid-item') && !cell.classList.contains('hidden')) {
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
        updateOutcomeDisplay();
        updateSelectedLettersDisplay();

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
    if (cell.classList.contains('grid-item') && !cell.classList.contains('hidden') && cell !== currentPuzzle.mostRecentCell) {
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
        const cellCol = cellIndex % currentPuzzle.size;
        const cellRow = (cellIndex - cellCol) / currentPuzzle.size;

        // Where have we come from?
        const prevIndex = currentPuzzle.selectedLetters[currentPuzzle.selectedLetters.length - 1].index;
        const prevCol = prevIndex % currentPuzzle.size;
        const prevRow = (prevIndex - prevCol) / currentPuzzle.size;

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
                const prevCell = gridElement.children[prevIndex];
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
        updateSelectedLettersDisplay();
    }
}

// End a drag operation and process the outcome
async function endDragGesture() {
    if (currentPuzzle.isDrawing) {
        currentPuzzle.isDrawing = false;

        const selectedWordUpper = currentPuzzle.selectedLetters.map(item => item.letter).join('').toUpperCase();
        const selectedWordLower = selectedWordUpper.toLowerCase();

        // TODO Not needed right now: 
        //   const selectedPath = currentPuzzle.selectedLetters.map(item => `[${item.index}]`).join('');

        // Check for the selected word being either:
        // - too short
        // - a key word (that may or may not have already been found)
        // - an extra word (that may or may not have already been found)
        // - not a word at all
        if (selectedWordUpper.length < 4) {
            if (selectedWordUpper.length > 1) {
                updateOutcomeDisplay(`Word too short`);
            } else {
                updateOutcomeDisplay();
            }
        } else if (currentPuzzle.puzzle.keyWords?.some(([word, _]) => word === selectedWordLower)) {
            if (currentPuzzle.foundKeyWords.has(selectedWordLower)) {
                updateOutcomeDisplay(`Key word already found: ${selectedWordUpper}`);
            } else {
                currentPuzzle.foundKeyWords.add(selectedWordLower);

                decrementRedGrey(selectedWordLower);

                updateOutcomeDisplay(`Key word found: ${selectedWordUpper}`);
                updateRedGreyDisplay();
                updateWordsFound();
                updateProgress();

                if (currentPuzzle.foundKeyWords.size == currentPuzzle.puzzle.keyWords.length) {
                    currentPuzzle.completed = true;

                    // Tidy up before showing the finished message
                    updatePuzzleProgressMessage();
                    clearTrail();

                    await openMessageBox(`Congratulations. You have found all of the key words!<br/><br/>You achieved a ${getAccuracy()}% accuracy`, 'info');
                }
            }
        } else if (currentPuzzle.puzzle.extraWords?.some(([word, _]) => word === selectedWordLower)) {
            if (currentPuzzle.foundExtraWords.has(selectedWordLower)) {
                updateOutcomeDisplay(`Extra word already found: ${selectedWordUpper}`);
            } else {
                currentPuzzle.foundExtraWords.add(selectedWordLower);

                updateOutcomeDisplay(`Extra word found: ${selectedWordUpper}`);
                updateExtraWordsFound();
                updateProgress();
            }
        } else {
            updateOutcomeDisplay(`Not a recognised word: ${selectedWordUpper}`);

            // Stop counting non-words when the puzzle is finished so that the accuracy stays fixed
            // to completing the main word search
            if (!currentPuzzle.completed) {
                currentPuzzle.foundNonWords++;

                updateProgress();
            }
        }

        // Clear any selection decorations
        clearTrail();

        document.querySelectorAll('.grid-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Update progress
        updatePuzzleProgressMessage();
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
    const transparency = getComputedStyle(document.documentElement).getPropertyValue('--trail-transparency');

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
    ctx.globalAlpha = Number.parseFloat(transparency); // Set transparency

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
    const radius = 16;
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
    gridElement.addEventListener('mousedown', handleMouseStart, { passive: true });
    gridElement.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseEnd, { passive: true });

    gridElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    gridElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Listen to, and populate, the found word ordering combo
    const combobox = document.getElementById('found-order-selection');

    // Load the saved option from localStorage or use a default
    const savedOption = localStorage.getItem(PuzzleLocalStorageKeys.FOUND_WORD_ORDERING);
    if (savedOption) {
        combobox.value = savedOption;
    } else {
        combobox.value = FoundMoveSortOrder.FOUND_ORDER;
    }

    // Handle change event
    combobox.addEventListener('change', function () {
        const selectedValue = this.value;

        // Save to localStorage
        localStorage.setItem(PuzzleLocalStorageKeys.FOUND_WORD_ORDERING, selectedValue);

        // Apply the change
        updateWordsFound();
        updateExtraWordsFound();
    });

    // Show extra words

    // Load state from localStorage
    const checkbox = getShowExtraWordsElement();
    checkbox.checked = localStorage.getItem(PuzzleLocalStorageKeys.SHOW_EXTRA_WORDS) === 'true';

    // Handle state changes
    checkbox.addEventListener('change', function () {
        localStorage.setItem(PuzzleLocalStorageKeys.SHOW_EXTRA_WORDS, this.checked ? 'true' : 'false');

        updateExtraWordsFound();
    });

    // Share

    document.getElementById("shareResultsButton").addEventListener('click', () => {
        shareProgress();
    });

    // Resize and device orientation changes
    window.addEventListener('resize', () => {
        scaleGrid();
    });

    screen.orientation.addEventListener('change', () => {
        scaleGrid();
    });
}

function shareProgress() {
    const accuracyText = ``;

    let shareText = '';
    shareText += `I have been playing WordGriddle '${currentPuzzle.puzzle.title}'\n`;
    shareText += `${currentPuzzle.foundKeyWords.size}/${currentPuzzle.puzzle.keyWords.length} key words found, with ${getAccuracy()}% accuracy.\n`;
    shareText += `${currentPuzzle.foundExtraWords.size}/${currentPuzzle.puzzle.extraWords.length} extra words found.\n`;
    shareText += `Play this puzzle: ${window.location.href}`;

    // Copy to clipboard
    navigator.clipboard
        .writeText(shareText)
        .then(async () => {
            await openMessageBox('Puzzle progress copied to the clipboard.', 'info');
        })
        .catch(async (err) => {
            await openMessageBox('Failed to copy progress information to the clipboard.', 'info');
        });
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
    endDragGesture();
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
    endDragGesture();
}

function prepareCanvas() {
    // Make sure the canvas is sized to the grid
    const gridElement = getGridElement();
    const trailCanvas = getTrailCanvas();

    trailCanvas.style.left = `${gridElement.offsetLeft}px`;
    trailCanvas.style.top = `${gridElement.offsetTop}px`;
    trailCanvas.width = gridElement.offsetWidth;
    trailCanvas.height = gridElement.offsetHeight;
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

function getWordsFoundElement() {
    return document.getElementById('words-found');
}

function getShowExtraWordsElement() {
    return document.getElementById('show-extra-words');
}

function getExtraWordsFoundElement() {
    return document.getElementById('extra-words-found');
}

function updateSelectedLettersDisplay() {
    if (currentPuzzle.selectedLetters?.length) {
        updateOutcomeMessage(currentPuzzle.selectedLetters.map((item) => item.letter).join(''), true);
    } else {
        updateOutcomeMessage();
    }
}

function updateOutcomeDisplay(message) {
    updateOutcomeMessage(message || '');
}

// Function to update the content
function updateOutcomeMessage(message, isStyled = false) {
    const container = document.getElementById("outcome-message");

    container.textContent = message || '';

    // Apply or remove the styledText class
    if (isStyled) {
        container.classList.add("styledText");
    } else {
        container.classList.remove("styledText");
    }
}

function decrementRedGrey(foundWord) {
    currentPuzzle.puzzle.keyWords.forEach(([word, path]) => {
        if (foundWord === word) {
            const gridElement = getGridElement();
            for (let i = 0; i < gridElement.children.length; i++) {
                const cell = gridElement.children[i];

                if (path.startsWith(cell.dataset.coord)) {
                    cell.dataset.red--;
                }

                if (path.includes(cell.dataset.coord)) {
                    cell.dataset.grey--;

                    if (cell.dataset.grey == 0) {
                        cell.classList.add('zerozero');
                    }
                }

                var attr = '';
                if (cell.dataset.red > 9) {
                    attr = '+';
                } else if (cell.dataset.red > 0) {
                    attr = `${cell.dataset.red}`;
                }

                cell.setAttribute('red-counter', attr);

                var attr = '';
                if (cell.dataset.grey > 9) {
                    attr = '+';
                } else if (cell.dataset.grey > 0) {
                    attr = `${cell.dataset.grid}`;
                }

                cell.setAttribute('grey-counter', attr);
            }
        }
    });
}

function updateWordsFound() {
    const wordsFoundElement = getWordsFoundElement();
    if (currentPuzzle.foundKeyWords.size == 0) {
        wordsFoundElement.innerHTML = `<div class="no-words-message">No words found</div>`;
        return;
    }

    wordsFoundElement.innerHTML = buildWordListHtml(currentPuzzle.foundKeyWords);
}

function updateExtraWordsFound() {
    const wordsFoundElement = getExtraWordsFoundElement();

    // Don't display anything if the checkbox is unchecked
    if (localStorage.getItem(PuzzleLocalStorageKeys.SHOW_EXTRA_WORDS) !== 'true') {
        wordsFoundElement.innerHTML = ``;
        return;
    }

    if (currentPuzzle.foundExtraWords.size == 0) {
        wordsFoundElement.innerHTML = `<div class="no-words-message">No extra words found</div>`;
        return;
    }

    wordsFoundElement.innerHTML = buildWordListHtml(currentPuzzle.foundExtraWords);
}

// Given a word collection, return it as a columnar list in HTML 
function buildWordListHtml(foundWords) {
    const foundWordOrdering = localStorage.getItem(PuzzleLocalStorageKeys.FOUND_WORD_ORDERING);

    // Copy the array so we can sort the copy and leave the original untouched
    const wordList = [];
    foundWords.forEach((word) => {
        wordList.push(word);
    });

    switch (foundWordOrdering) {
        default:
        case FoundMoveSortOrder.FOUND_ORDER:
            // The order in which the user discovered them
            // Nothing to do here as the list will already be in this order
            break;

        case FoundMoveSortOrder.ALPHABETICAL:
            // Alphabetically
            wordList.sort();
            break;

        case FoundMoveSortOrder.WORD_LENGTH:
            // By length, then alphabetical
            wordList.sort((a, b) => {
                if (a.length === b.length) {
                    return a.localeCompare(b);
                }
                return a.length - b.length;
            });
            break;
    }

    let html = `<div class="found-word-list">`;

    wordList.forEach((word) => {
        html += `<div>${word}</div>`;
    });

    html += `</div>`;

    return html;
}

function updateRedGreyDisplay() {
    const gridElement = getGridElement();
    for (let i = 0; i < gridElement.children.length; i++) {
        const cell = gridElement.children[i];

        if (cell.classList.contains('hidden')) {
            continue;
        }

        if (cell.dataset.grey == 0) {
            cell.classList.add('zerozero');
        }

        var attr = '';
        if (cell.dataset.red > 9) {
            attr = '+';
        } else if (cell.dataset.red > 0) {
            attr = `${cell.dataset.red}`;
        }

        cell.setAttribute('red-counter', attr);

        var attr = '';
        if (cell.dataset.grey > 9) {
            attr = '+';
        } else if (cell.dataset.grey > 0) {
            attr = `${cell.dataset.grey}`;
        }

        cell.setAttribute('grey-counter', attr);
    }
}

function getAccuracy() {
    // Calculate a 0-1 number and then take the floor of that number multiplied by 100
    let accuracyPercentage = 1;
    if (currentPuzzle.foundNonWords) {
        if (currentPuzzle.foundKeyWords.size) {
            accuracyPercentage = (currentPuzzle.foundKeyWords.size / (currentPuzzle.foundNonWords + currentPuzzle.foundKeyWords.size));
        } else {
            accuracyPercentage = 0;
        }
    }

    return Math.floor(accuracyPercentage * 100);
}

function updatePuzzleProgressMessage() {
    const progressMessageElement = document.getElementById('progress-message');
    const countsMessageElement = document.getElementById('counts-message');

    if (currentPuzzle.puzzle) {
        progressMessageElement.innerHTML = `You have found ${currentPuzzle.foundKeyWords.size} of ${currentPuzzle.puzzle.keyWords.length} words with ${getAccuracy()}% accuracy.`;

        // Work out count of words at each word length
        const counts = new Map();
        let longestWordLength = 0;
        currentPuzzle.puzzle.keyWords.forEach(([word, _]) => {
            // Make sure we've got an entry for this length of word
            if (!counts.has(word.length)) {
                counts.set(word.length, 0);
            }

            // Increment the number of words of this length
            counts.set(word.length, counts.get(word.length) + 1);

            longestWordLength = Math.max(longestWordLength, word.length);
        });

        // Now take away the ones we've found
        currentPuzzle.foundKeyWords.forEach((word) => {
            counts.set(word.length, counts.get(word.length) - 1);
        });

        let countsTable = `<table class="word-count-table">`;
        for (let i = 1; i <= longestWordLength; i++) {
            if (counts.has(i)) {
                countsTable += `<tr>`;
                countsTable += `  <td class="word-count-word">${i}-letter words:</td>`;
                countsTable += `  <td class="word-count-total">${counts.get(i)}</td>`;
                countsTable += `</tr>`;
            }
        }
        countsTable += `</table>`;

        countsMessageElement.innerHTML = `${countsTable}`;
    }

    if (currentPuzzle.puzzle.keyWords.length === currentPuzzle.foundKeyWords.size) {
        showGridAsComplete();
    }
}

// Progress storage

function getProgressStorageKey() {
    return PuzzleLocalStorageKeys.PROGRESS_STORAGE.replace("%id", currentPuzzle.puzzle.id);
}

// TODO delete when finally obsolete
function getKeyWordStorageKey() {
    return PuzzleLocalStorageKeys.KEY_WORD_STORAGE.replace("%id", currentPuzzle.puzzle.id);
}

// TODO delete when finally obsolete
function getExtraWordStorageKey() {
    return PuzzleLocalStorageKeys.EXTRA_WORD_STORAGE.replace("%id", currentPuzzle.puzzle.id);
}

// TODO delete when finally obsolete
function getNonWordStorageKey() {
    return PuzzleLocalStorageKeys.NON_WORD_STORAGE.replace("%id", currentPuzzle.puzzle.id);
}

function indexFromWord(wordList, searchWord) {
    // Return the index of 'searchWord' in 'wordList' where that is an [word,_] array
    for (let i = 0; i < wordList.length; i++) {
        const [word, _] = wordList[i];
        if (searchWord === word) {
            return i;
        }
    }

    return -1;
}

function wordListToIndexList(wordList, foundWords) {
    // Make a list of the index value of each found word, retaining its found order
    let list = [];
    foundWords.forEach((foundWord) => {
        let index = indexFromWord(wordList, foundWord);
        if (index > -1) {
            list.push(index);
        } else {
            console.warn(`Could not determine index for word: ${foundWord}`);
        }
    })

    return list;
}

function indexListToWordList(indexList, wordList) {
    // Iterate over all items in the index list and reconstitute it into a words list
    let list = [];
    indexList.forEach((index) => {
        const [word, _] = wordList[index];
        list.push(word);
    })

    return list;
}

function updateProgress() {
    const keyWordIndexList = wordListToIndexList(currentPuzzle.puzzle.keyWords, currentPuzzle.foundKeyWords);
    const extraWordIndexList = wordListToIndexList(currentPuzzle.puzzle.extraWords, currentPuzzle.foundExtraWords);

    // Instead of storing found words directly, we store the index number of the found words within the overall word
    // lists (key word and extra word).
    //
    // This is intended to save a little space, where we are storing a 1-4 digit number for each word, rather than the
    // word itself. Casual experimentation on a typical grid suggests about 50% space saving - or the ability to store
    // twice as many before we encounter any space limitations.
    //
    // Worst case, the saving is less than that if the word length average is small, but it will never be as small as 
    // storing the index values, so we can't lose here and the processing isn't that more complex and we can still retain
    // found order.
    //
    // I did consider storing only a boolean if the puzzle got complete, but we might still want the found order for 
    // post-puzzle discussions.
    //
    // Store all the progress data in a single JSON object

    const storedValue = JSON.stringify({
        keyWords: keyWordIndexList,
        extraWords: extraWordIndexList,
        nonWordCount: currentPuzzle.foundNonWords
    });

    localStorage.setItem(getProgressStorageKey(), storedValue);
}

function restoreProgress() {
    const storedValue = localStorage.getItem(getProgressStorageKey());
    if (storedValue) {
        try {
            const progressData = JSON.parse(storedValue);

            // Unpack the keyWord, extraWord and nonWord values 

            // keyWords
            let wordList = indexListToWordList(progressData.keyWords, currentPuzzle.puzzle.keyWords);
            if (wordList) {
                wordList.forEach((word) => {
                    currentPuzzle.foundKeyWords.add(word);

                    // Adjust the red/grey numbers for each restored word
                    decrementRedGrey(word);
                })
            }

            // extraWords
            wordList = indexListToWordList(progressData.extraWords, currentPuzzle.puzzle.extraWords);
            if (wordList) {
                wordList.forEach((word) => {
                    currentPuzzle.foundExtraWords.add(word);
                })
            }

            // nonWords - Retain our ability to calculate accuracy
            currentPuzzle.foundNonWords = progressData.nonWordCount;

            // Infer completed state
            currentPuzzle.completed = (currentPuzzle.foundKeyWords.size == currentPuzzle.puzzle.keyWords.length);
        } catch (error) {
            console.error("Failed to restore progress", error);
        }
    }
}

async function resetProgress() {
    const userConfirmed = await openConfirmationDialog('This will delete all progress for this puzzle.<br/><br/>Do you want to proceed?');

    if (userConfirmed) {
        // Clear stored information
        localStorage.removeItem(getProgressStorageKey());

        // TODO delete these redundant lines at some point when they will have finished cleaning the alpha tester's storage
        localStorage.removeItem(getKeyWordStorageKey());
        localStorage.removeItem(getExtraWordStorageKey());
        localStorage.removeItem(getNonWordStorageKey());

        // Reload everything
        openPuzzle(currentPuzzle.puzzle);
    }
}

function showGridAsComplete() {
    const gridElement = getGridElement();
    for (let i = 0; i < gridElement.children.length; i++) {
        const cell = gridElement.children[i];
        if (!cell.classList.contains('hidden')) {
            cell.classList.remove('zerozero');
            cell.classList.add('completed');
        }
    }
}

// Get ready

attachEventListeners();
