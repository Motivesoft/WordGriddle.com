// Scripting specific to the puzzle.html page

// Enums
const FoundMoveSortOrder = Object.freeze({
    PRE_SORTED_WORD_LENGTH: "PRE_SORTED_WORD_LENGTH",   // Internal value only - don't offer to users
    FOUND_ORDER: "FOUND_ORDER",
    ALPHABETICAL: "ALPHABETICAL",
    WORD_LENGTH: "WORD_LENGTH"
});

// Constants for local storage keys
const PuzzleLocalStorageKeys = Object.freeze({
    FOUND_WORD_ORDERING: "foundWordOrdering",
    SHOW_KEY_WORDS: "showKeyWords",
    SHOW_EXTRA_WORDS: "showExtraWords",
});

// State
const currentPuzzle = {
    puzzleName: null,
    puzzle: null,

    // Transient state variables
    isDrawing: false,
    selectedLetters: [],
    currentTrail: [],
    mostRecentCell: null,

    // Game progress
    foundKeyWords: new Set(),
    foundExtraWords: new Set(),
    foundNonWords: 0,
    foundExtraSpecialWord: false, // At least for now, don't persist this
    completed: false,
};

// Assume we will be loaded with a 'puzzle' parameter that points to a puzzle file on the server
// and a repo in which says where it can be found (defaulting to '/puzzles/')
// Load that puzzle and let the user play it
document.addEventListener('DOMContentLoaded', async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const puzzleName = urlParams.get('p');
    const puzzleRepo = urlParams.get(`r`) || DEFAULT_REPOSITORY;

    // Assuming we have a file, load it and populate the page
    if (puzzleName) {
        fetch(`/assets/data/${decodeURIComponent(puzzleRepo)}/${decodeURIComponent(puzzleName)}.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error status: ${response.status}`);
                }

                return response.json();
            })
            .then(data => {
                if (data.puzzle) {
                    openPuzzle(puzzleName, data.puzzle);
                } else {
                    throw new Error("Missing puzzle information");
                }
            })
            .catch(async error => {
                console.error("Failed to load puzzle", error);
                await openMessageBox(`Failed to load puzzle '${puzzleName}'.`, MessageBoxType.ERROR);

                // If we fail to load a puzzle, go back to the page we would have tried to launch it from
                if (puzzleRepo === DEFAULT_REPOSITORY) {
                    window.location.href = "/";
                } else {
                    window.location.href = `/puzzles.html?r=${encodeURIComponent(puzzleRepo)}`;
                }
            });
    } else {
        await openMessageBox('This page needs to be launched by selecting a puzzle to play.', MessageBoxType.ERROR);

        // Go to the home page
        window.location.replace("/");
    }
});

async function openPuzzle(puzzleName, puzzle) {
    currentPuzzle.puzzleName = puzzleName;
    currentPuzzle.puzzle = puzzle;

    // Display a meaningful title
    let titleText = puzzle.title;

    if (!puzzle.locked) {
        titleText += ' (test)';
    }

    getPuzzleTitleElement().innerHTML = titleText;

    if (puzzle.author === 1) {
        getAuthorElement().innerHTML = `Puzzle by Ian`;
    } else if (puzzle.author === 2) {
        getAuthorElement().innerHTML = `Puzzle by Catherine`;
    }

    // Transient variables
    currentPuzzle.isDrawing = false;
    currentPuzzle.selectedLetters = [];
    currentPuzzle.currentTrail = [];
    currentPuzzle.mostRecentCell = null;

    currentPuzzle.foundKeyWords.clear();
    currentPuzzle.foundExtraWords.clear();
    currentPuzzle.foundExtraSpecialWord = false;
    currentPuzzle.foundNonWords = 0;
    currentPuzzle.completed = false;

    // We're (re)building the entire grid here. Reduce any potential flicker by
    // hiding the element until we've created, populated and restored any prior progress 
    const gridElement = getGridElement();
    const gridDisplay = gridElement.style.display; 
    try {
        gridElement.style.display = 'none';

        // Initiate things using our 'currentPuzzle' state object
        initialiseGrid();

        // See if this progress has got some stored progress against it
        await restoreProgress();

        // Reset clues panel - clues off by default
        const cluesCheckbox = getShowCluesElement();
        cluesCheckbox.checked = false;

        const additionalLetterCheckbox = getShowAdditionalLetterElement();
        additionalLetterCheckbox.checked = false;

        // Hide this until appropriate
        document.getElementById('more-hints').style.display = 'none';
        document.getElementById('refresh-clues').style.display = 'none';

        // Update the other parts of the display
        updateRedGreyDisplay();
        updatePuzzleProgressMessage();
        updateSelectedLettersDisplay();
        updateWordsFound();
        updateExtraWordsFound();
        updateProgressFlashCard();
        updateClues();
    }
    finally {
        // Restore the style
        gridElement.style.display = gridDisplay;
    }
}

function initialiseGrid() {
    const gridElement = getGridElement();

    // Set grid dimensions
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${currentPuzzle.puzzle.size}, 1fr)`;
    gridElement.style.gridTemplateRows = `repeat(${currentPuzzle.puzzle.size}, 1fr)`;

    // Test for a gap (empty cell, a hole) in the puzzle
    const isEmptyCell = (char) => char === ' ' || char === '-' || char === '.';

    // Build the cells in the grid
    const letterArray = Array.from(currentPuzzle.puzzle.letters)
    letterArray.forEach((letter, index) => {
        // Establish the coordinate identifier for the cell as it will appear in word list paths
        const coord = `[${index}]`;

        // Start to construct the HTML 'cell' element
        const cell = document.createElement('div');
        cell.className = 'grid-item';
        cell.textContent = letter;
        cell.dataset.letter = letter;
        cell.dataset.index = index;
        cell.dataset.coord = coord;
        cell.dataset.red = 0;
        cell.dataset.grey = 0;

        // Note that 'dataset' is a string-based map and therefore numbers will have to be handled carefully

        // '.' is meaningful in terms of puzzle design, but don't show in the grid
        // Style the unusable parts of the grid so they look and interact as we need them to
        if (isEmptyCell(letter)) {
            cell.classList.add('hidden');
            cell.textContent = ' ';
        } else {
            // Determine the red and grey counts for the cell by looking for 'coord' in each key word's "path"
            let red = 0;
            let grey = 0;
            currentPuzzle.puzzle.keyWords.forEach(([_, path]) => {
                if (path.includes(coord)) {
                    grey++;

                    if (path.startsWith(coord)) {
                        red++;
                    }
                }
            });

            if (grey == 0) {
                cell.classList.add('zerozero');
            } else {
                cell.dataset.red = red;
                cell.dataset.grey = grey;
            }
        }

        // Add the cell to the grid
        gridElement.appendChild(cell);
    });

    // This can be done whenever it seems like a useful idea 
    prepareCanvas();

    // Make it fit the required display area
    scaleGrid();
}

function scaleGrid() {
    // Work out screen size and orientation and set things like grid gap and font size
    const size = currentPuzzle.puzzle.size;

    // Get a rough idea of what type of device we are on
    const smallLandscape = window.matchMedia("(orientation: landscape) and (max-width: 1023px)");
    const largeLandscape = window.matchMedia("(orientation: landscape) and (min-width: 1024px)");
    const smallPortrait = window.matchMedia("(orientation: portrait) and (max-width: 499px)");
    const largePortrait = window.matchMedia("(orientation: portrait) and (min-width: 500px)");

    // Start with some defaults and then adjust them
    let maxDimension = 360;
    let gap = 10;
    let fontSize = 24;

    if (smallPortrait.matches) {
        maxDimension = 330;
        gap = 14 - size;
        fontSize = Math.min(40, Math.floor(160 / size));
    } else if (largePortrait.matches) {
        maxDimension = 360;
        gap = 14 - size;
        fontSize = Math.min(50, Math.floor(180 / size));
    } else if (smallLandscape.matches) {
        maxDimension = 224;
        gap = 10 - size;
        fontSize = Math.floor(114 / size);
    } else if (largeLandscape.matches) {
        maxDimension = 402;
        gap = 17 - size;
        fontSize = Math.floor(210 / size);
    } else {
        // Unknown scenario according to our rules - not much we can do but allow our default behaviour to do the right thing 
        return;
    }

    // Apply the calculated size, font size and gap
    const gridElement = getGridElement();
    gridElement.style.width = `${maxDimension}px`;
    gridElement.style.height = `${maxDimension}px`;

    document.documentElement.style.setProperty('--grid-cell-gap', `${gap}px`);
    document.documentElement.style.setProperty('--grid-cell-font-size', `${fontSize}px`);
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
            index: Number(cell.dataset.index)
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

    const size = currentPuzzle.puzzle.size;

    // If we're on a cell in the grid and have moved from the previous cell, treat this as a drag gesture
    // unless the cell contains a space, intended to mean a gap in the layout that the user may not select
    if (cell.classList.contains('grid-item') && !cell.classList.contains('hidden') && cell !== currentPuzzle.mostRecentCell) {
        // Reject points too close to the edge sto avoid false positives
        const cellRect = cell.getBoundingClientRect();
        const cellCentreX = cellRect.left + (cellRect.width / 2);
        const cellCentreY = cellRect.top + (cellRect.height / 2);
        const xDistanceToCentre = Math.abs(cellCentreX - clientX);
        const yDistanceToCentre = Math.abs(cellCentreY - clientY);

        // If we are within a certain distance of the centre of the cell, accept that we are selecting it and not just
        // in transit somewhere else. If we are just skirting the edge of the cell, don't treat it as a selection.
        // Another way to put this is to use the middle 70% (+/-0.35 of cell size in pixels) as the target area 
        const proximityMeasure = 0.35;
        if (xDistanceToCentre > cellRect.width * proximityMeasure || yDistanceToCentre > cellRect.height * proximityMeasure) {
            return;
        }

        // Get the cell's index (e.g. 0-8 on a 3x3 grid)
        const cellIndex = Number(cell.dataset.index);

        // Work out if this is potentially a valid move, meaning we have not visited it already or it is a retreat
        const cellAlreadySelected = cell.classList.contains('selected');

        // If a valid move (adjacent and unused), select the cell
        // If a retreat - a step backwards - undo the previous step
        if (cellAlreadySelected) {
            // Is this a step backwards
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
        } else {
            // This may lead to the cell becoming selected. Check it would be a valid selection

            // Where are we within the grid?
            const cellCol = cellIndex % size;
            const cellRow = (cellIndex - cellCol) / size;

            // Where have we come from?
            const prevIndex = currentPuzzle.selectedLetters[currentPuzzle.selectedLetters.length - 1].index;
            const prevCol = prevIndex % size;
            const prevRow = (prevIndex - prevCol) / size;

            // What will help us work out if this is a valid move - valid being:
            //   distance = 1, meaning this cell is adjacent to the previous cell in the selection
            const distance = Math.max(Math.abs(cellCol - prevCol), Math.abs(cellRow - prevRow));
            if (distance === 1) {
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

        // Check for the selected word being either:
        // - too short
        // - too long - bigger than our dictionary so we don't know if its a word, so no penalty applied
        // - a key word (that may or may not have already been found)
        // - an extra word (that may or may not have already been found)
        // - not a word at all (including any word we choose not to allow)
        if (selectedWordLower === currentPuzzle.puzzle.extraSpecialWord) {
            // This is for words not in the main word lists, but noteworthy for other reasons
            // - only one per puzzle and not to be used very often
            // Primary use-case is for a 4x4 puzzle that happens to have a 16 letter word in it even
            // though our dictionary stops at 15 letters. We will automatically make sure the user
            // doesn't get penalized for a long word (valid or not), but celebrate with them if they
            // happen to spot the same 16 letter word the puzzle author saw (or perhaps used as a basis
            // for the puzzle)
            if (currentPuzzle.foundExtraSpecialWord) {
                updateOutcomeDisplay(`Extra special word already found: ${selectedWordUpper}`, true);
            } else {
                currentPuzzle.foundExtraSpecialWord = true;

                updateOutcomeDisplay(`Extra special word found! ${selectedWordUpper}`, true);

                explode("ticker-container", 4);

                await openMessageBox(`<h3>Congratulations!</h3>You have found the hidden extra special word!`);
            }
        }
        else if (selectedWordUpper.length < 4) {
            if (selectedWordUpper.length > 1) {
                updateOutcomeDisplay(`Word too short!`, true);
            } else {
                updateOutcomeDisplay();
            }
        } else if (selectedWordUpper.length > 15) {
            updateOutcomeDisplay(`Word too long! 15 letter maximum`, true);
        } else if (currentPuzzle.puzzle.keyWords?.some(([word, _]) => word === selectedWordLower)) {
            if (currentPuzzle.foundKeyWords.has(selectedWordLower)) {
                updateOutcomeDisplay(`Word already found: ${selectedWordUpper}`);
            } else {
                currentPuzzle.foundKeyWords.add(selectedWordLower);

                decrementRedGrey(selectedWordLower);

                updateOutcomeDisplay(`Word found: ${selectedWordUpper}`);
                updateRedGreyDisplay();
                updateWordsFound();
                updateProgressFlashCard();
                updateClues();

                // Have we finished the puzzle 
                // NB use '>=' not '==' to cover the unlikely event that a puzzle was modified after someone
                // recorded progress against it. There will be a more robust way to do this, but it probably
                // comes at the performance cost of checking off every word
                // One to think about if this becomes a scenario we need to care more about
                if (currentPuzzle.foundKeyWords.size >= currentPuzzle.puzzle.keyWords.length) {
                    currentPuzzle.completed = true;

                    // We've just found a word and completed the puzzle. Store the progress update
                    updateProgress();
                    updatePuzzleStatus();

                    // Tidy up before showing the finished message
                    updatePuzzleProgressMessage();
                    clearTrail();
                    clearSelectedGridItems();

                    explode("ticker-container");

                    await openMessageBox(`<h3>Congratulations!</h3>You have found all of the words for this puzzle!<br/><br/>You achieved ${getAccuracy()}% accuracy`);
                } else {
                    // Puzzle not yet finished, but a word found nonetheless. Update the progress
                    updateProgress();
                    updatePuzzleStatus();
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

                // No need saving puzzle status here - extra words don't contribute to that
                // - small caveat here that this means a puzzle freshly opened and where the user
                //   has only found extra words will not show as started - I think that's OK
            }
        } else {
            updateOutcomeDisplay(`Not in word list: ${selectedWordUpper}`);

            // Stop counting non-words when the puzzle is finished so that the accuracy stays fixed
            // to completing the main word search
            if (!currentPuzzle.completed) {
                currentPuzzle.foundNonWords++;

                updateProgress();

                // No need saving puzzle status here - non-words don't contribute to that
                // - small caveat here that this means a puzzle freshly opened and where the user
                //   has only found non-words will not show as started - I think that's OK
            }
        }

        // Clear any selection decorations
        clearTrail();
        clearSelectedGridItems();

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

function clearSelectedGridItems() {
    document.querySelectorAll('.grid-item').forEach(item => {
        item.classList.remove('selected');
    });
}

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
        try {
            localStorage.setItem(PuzzleLocalStorageKeys.FOUND_WORD_ORDERING, selectedValue);
        } catch (error) {
            console.error("Problem persisting word ordering configuration", error);
        }

        // Apply the change
        updateWordsFound();
        updateExtraWordsFound();
    });

    // Show extra words

    // Load state of checkboxes from localStorage

    const showKeyWordCheckbox = getShowWordsFoundElement();
    showKeyWordCheckbox.checked = localStorage.getItem(PuzzleLocalStorageKeys.SHOW_KEY_WORDS) !== 'false';

    // Handle state changes
    showKeyWordCheckbox.addEventListener('change', function () {
        try {
            localStorage.setItem(PuzzleLocalStorageKeys.SHOW_KEY_WORDS, this.checked ? 'true' : 'false');
        } catch (error) {
            console.error("Problem persisting key word configuration", error);
        }

        updateWordsFound();
    });

    const showExtraWordCheckbox = getShowExtraWordsElement();
    showExtraWordCheckbox.checked = localStorage.getItem(PuzzleLocalStorageKeys.SHOW_EXTRA_WORDS) === 'true';

    // Handle state changes
    showExtraWordCheckbox.addEventListener('change', function () {
        try {
            localStorage.setItem(PuzzleLocalStorageKeys.SHOW_EXTRA_WORDS, this.checked ? 'true' : 'false');
        } catch (error) {
            console.error("Problem persisting extra word configuration", error);
        }

        updateExtraWordsFound();
    });

    // Clues
    const cluesCheckbox = getShowCluesElement();
    cluesCheckbox.addEventListener('change', function () {
        updateClues();
    });

    const additionalLetterCheckbox = getShowAdditionalLetterElement();
    additionalLetterCheckbox.addEventListener('change', function () {
        updateClues();
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
    let shareText = '';
    shareText += `I have been playing WordGriddle!\n`;
    shareText += `Puzzle: '${currentPuzzle.puzzle.title}' - ${window.location.origin}/?p=${currentPuzzle.puzzleName}\n`;
    shareText += `${currentPuzzle.foundKeyWords.size}/${currentPuzzle.puzzle.keyWords.length} words found, with ${getAccuracy()}% accuracy.\n`;
    shareText += `${currentPuzzle.foundExtraWords.size}/${currentPuzzle.puzzle.extraWords.length} extra words found.\n`;
    shareText += `${window.location.origin}`;

    // Copy to clipboard
    navigator.clipboard
        .writeText(shareText)
        .then(async () => {
            await openMessageBox('Puzzle progress copied to the clipboard.', MessageBoxType.PLAIN);
        })
        .catch(async (err) => {
            await openMessageBox('Failed to copy progress information to the clipboard.', MessageBoxType.ERROR);
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

function getAuthorElement() {
    return document.getElementById('author');
}

function getProgressCardElement() {
    return document.getElementById('progress-card');
}

function getWordsFoundElement() {
    return document.getElementById('words-found');
}

function getShowWordsFoundElement() {
    return document.getElementById('show-key-words');
}

function getShowExtraWordsElement() {
    return document.getElementById('show-extra-words');
}

function getShowCluesElement() {
    return document.getElementById('show-clues');
}

function getShowAdditionalLetterElement() {
    return document.getElementById('show-additional-letter');
}

function getMoreHintsElement() {
    return document.getElementById('more-hints');
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

function updateOutcomeDisplay(message, flare = false) {
    const container = document.getElementById('outcome-message');
  
    if (flare) {
        animate(container, 'flare');
    }
  
    updateOutcomeMessage(message);
}

// Function to update the content
function updateOutcomeMessage(message = '', isStyled = false) {
    const container = document.getElementById("outcome-message");

    container.textContent = message;

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

                if (cell.classList.contains('hidden')) {
                    continue;
                }

                let red = Number(cell.dataset.red);
                let grey = Number(cell.dataset.grey);

                // Reduce red/grey numbers as appropriate
                if (path.includes(cell.dataset.coord)) {
                    if (path.startsWith(cell.dataset.coord)) {
                        red--;
                        cell.dataset.red = red;
                    }

                    grey--;
                    cell.dataset.grey = grey;
                }
            }
        }
    });
}

function updateWordsFound() {
    const showWordsFoundElement = getShowWordsFoundElement();
    const wordsFoundElement = getWordsFoundElement();

    if (showWordsFoundElement.checked) {
        if (currentPuzzle.foundKeyWords.size > 0) {
            wordsFoundElement.innerHTML =
                `<p><div class="no-words-message">${currentPuzzle.foundKeyWords.size} out of ${currentPuzzle.puzzle.keyWords.length} words found.</div></p>` +
                buildWordListHtml(currentPuzzle.foundKeyWords);
        } else {
            wordsFoundElement.innerHTML = `<p><div class="no-words-message">No words found</div></p>`;
        }
    } else {
        wordsFoundElement.innerHTML = '';
    }
}

// Flash the current word count and target
function updateProgressFlashCard() {
    const progressCardElement = getProgressCardElement();
    progressCardElement.innerHTML = `${currentPuzzle.foundKeyWords.size}/${currentPuzzle.puzzle.keyWords.length}`;
    animate(progressCardElement, 'flash');
}

// Flash the provided HTML element
function animate(element, effect) {
    element.classList.add(effect);

    // Remove the animation class after the animation ends
    setTimeout(() => {
        element.classList.remove(effect);
    }, 300);
}

function updateExtraWordsFound() {
    const wordsFoundElement = getExtraWordsFoundElement();

    // Don't display anything if the checkbox is unchecked
    if (localStorage.getItem(PuzzleLocalStorageKeys.SHOW_EXTRA_WORDS) !== 'true') {
        wordsFoundElement.innerHTML = ``;
        return;
    }

    if (currentPuzzle.foundExtraWords.size == 0) {
        wordsFoundElement.innerHTML = `<p><div class="no-words-message">No extra words found</div></p>`;
        return;
    }

    wordsFoundElement.innerHTML =
        `<p><div class="no-words-message">${currentPuzzle.foundExtraWords.size} out of ${currentPuzzle.puzzle.extraWords.length} extra words found.</div></p>` +
        buildWordListHtml(currentPuzzle.foundExtraWords);
}

function updateClues() {
    // Show or hide clues controls
    const cluesCheckbox = getShowCluesElement();

    // Don't show anything clue-related if not showing clues
    document.getElementById('more-hints').style.display = cluesCheckbox.checked ? '' : 'none';
    document.getElementById('refresh-clues').style.display = cluesCheckbox.checked ? '' : 'none';
    document.getElementById('clue-panel-1').innerHTML = '';

    if (cluesCheckbox.checked) {
        refreshClues();
    }
}

function refreshClues() {
    let wordArray = [];

    // Produce a clue version of each word yet to be found
    const additionalLetterCheckbox = getShowAdditionalLetterElement();
    currentPuzzle.puzzle.keyWords.forEach(([word, _]) => {
        if (!currentPuzzle.foundKeyWords.has(word)) {
            wordArray.push(wordToClue(word, additionalLetterCheckbox.checked));
        }
    });

    // Array should already be sorted alphabetically within word length
    document.getElementById('clue-panel-1').innerHTML = buildWordListHtml(wordArray, FoundMoveSortOrder.PRE_SORTED_WORD_LENGTH);
}

function wordToClue(word, showAdditionalLetter) {
    const gapChar = '-';//'·';

    // Safety nets - don't run the code if a word is empty or has already
    // got gaps in it. 
    if (!word || word.length === 0) {
        return '';
    }

    for (let i = 0; i < word.length; i++) {
        if (word[i] === gapChar) {
            return;
        }
    }

    /*
    1, 2, 3, 3, 3, 4, 4, 5 
    */
    let letterCount = showAdditionalLetter ? 1 : 0;
    let letterCountIncrements = [
        4, 5, 6, 9, 11, 15, 18, 21
    ];

    for (let i = 0; i < letterCountIncrements.length; i++) {
        if (word.length >= letterCountIncrements[i]) {
            letterCount++;
        }
    }

    let letterIndexArray = [];
    letterIndexArray.push(0);
    for (let i = 1; i < letterCount; i++) {
        const index = 1 + Math.floor((word.length - 1) * Math.random());
        if (letterIndexArray.includes(index)) {
            i--;
            continue;
        }

        letterIndexArray.push(index);
    }

    let newWord = '';
    for (let i = 0; i < word.length; i++) {
        if (letterIndexArray.includes(i)) {
            newWord += word[i];
        } else {
            newWord += gapChar;
        }
    }

    return newWord;
}

// Given a word collection, return it as a columnar list in HTML 
function buildWordListHtml(words, foundWordOrdering = localStorage.getItem(PuzzleLocalStorageKeys.FOUND_WORD_ORDERING)) {
    // Handle being given an empty list
    if (!words || words.length === 0) {
        return '';
    }

    // Copy the array so we can sort the copy and leave the original untouched
    const wordList = [];
    words.forEach((word) => {
        wordList.push(word);
    });

    let lineBreakFunction;
    let leaderFunction;
    switch (foundWordOrdering) {
        default:
        case FoundMoveSortOrder.FOUND_ORDER:
            // Use the natural order - e.g. in which the user discovered them, or a pre-sorted list
            // Nothing to do here as the list will already be in this order
            break;

        case FoundMoveSortOrder.ALPHABETICAL:
            // Alphabetically
            wordList.sort();

            lineBreakFunction = (word, prevWord) => word[0] !== prevWord[0];
            leaderFunction = (word) => `${word.toUpperCase()[0]}:`;
            break;

        case FoundMoveSortOrder.WORD_LENGTH:
            // By length, then alphabetical
            wordList.sort((a, b) => {
                if (a.length === b.length) {
                    return a.localeCompare(b);
                }
                return a.length - b.length;
            });

            lineBreakFunction = (word, prevWord) => word.length !== prevWord.length;
            leaderFunction = (word) => `${word.length}-letter words:`;
            break;

        case FoundMoveSortOrder.PRE_SORTED_WORD_LENGTH:
            // Same as Word Length, but without sorting the list as it is pre-sorted
            lineBreakFunction = (word, prevWord) => word.length !== prevWord.length;
            leaderFunction = (word) => `${word.length}-letter words:`;
            break;
    }

    let html = '';
    if (foundWordOrdering === FoundMoveSortOrder.FOUND_ORDER) {
        // Nothing fancy, just a list
        html += `<div class="found-word-list">`;

        wordList.forEach((word) => {
            html += `<div>${word}</div>`;
        });

        html += `</div>`;
    } else {
        let previousWord;

        // Display a little message at the top of each group of found words
        if (leaderFunction) {
            html += `<div class="found-word-list-leader">${leaderFunction(wordList[0])}</div>`;
        }

        // Start a group of words
        html += `<div class="found-word-list">`;
        wordList.forEach((word) => {
            if (previousWord && lineBreakFunction && lineBreakFunction(word, previousWord)) {
                // Close this group of words
                html += `</div>`;

                // Display a little message at the top of each group of found words
                if (leaderFunction) {
                    html += `<div class="found-word-list-leader">${leaderFunction(word)}</div>`;
                }

                // Start a group of words
                html += `<div class="found-word-list">`;
            }

            // Add the word to the list
            html += `<div>${word}</div>`;

            // Remember it for the comparisons with the next word
            previousWord = word;
        });

        // Close this final group of words
        html += `</div>`;
    }

    return html;
}

function updateRedGreyDisplay() {
    const gridElement = getGridElement();
    for (let i = 0; i < gridElement.children.length; i++) {
        const cell = gridElement.children[i];

        if (cell.classList.contains('hidden')) {
            continue;
        }

        const red = Number(cell.dataset.red);
        const grey = Number(cell.dataset.grey);

        // Display the red number or '+' if 10 or more
        {
            let attr = '';
            if (red > 9) {
                attr = '+';
            } else if (red > 0) {
                attr = `${red}`;
            }

            cell.setAttribute('word-start-counter', attr);
        }

        // Display the grey number, or '+' if 10 or more
        {
            let attr = '';
            if (grey > 9) {
                attr = '+';
            } else if (grey > 0) {
                attr = `${grey}`;
            }

            cell.setAttribute('word-contains-counter', attr);
        }

        // Style the cell accordingly if its numbers are down to zero
        // This is a permanent state change as the game rules currently stand,
        // so no need to make it reversable
        if (grey === 0) {
            if (!cell.classList.contains('zerozero')) {
                animate(cell, 'flare');
            }
            cell.classList.add('zerozero');
        }
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

    let progressTemplate;
    if (currentPuzzle.foundKeyWords.size === 0) {
        progressTemplate = `<p>You have found %foundWords of %totalWords words.</p>`;
    } else {
        progressTemplate = `<p>You have found %foundWords of %totalWords words with %accuracy% accuracy.</p>`;
    }

    progressMessageElement.innerHTML = progressTemplate
        .replace("%foundWords", currentPuzzle.foundKeyWords.size)
        .replace("%totalWords", currentPuzzle.puzzle.keyWords.length)
        .replace("%accuracy", getAccuracy());

    // Show words left to be found - unless we've completed the puzzle
    if (currentPuzzle.completed) {
        countsMessageElement.innerHTML = `<div class="no-words-message">No words remaining.</div>`;

        showGridAsComplete();
    } else {
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

        // Display the counts per word length - but don't display those with none left
        let countsTable = `<table class="word-count-table">`;
        for (let i = 1; i <= longestWordLength; i++) {
            if (counts.has(i) && counts.get(i) > 0) {
                countsTable += `<tr>`;
                countsTable += `  <td class="word-count-word">${i}-letter words:</td>`;
                countsTable += `  <td class="word-count-total">${counts.get(i)}</td>`;
                countsTable += `</tr>`;
            }
        }
        countsTable += `</table>`;

        countsMessageElement.innerHTML = `${countsTable}`;
    }
}

// Progress storage

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

// TODO this is a legacy method. Look to remove it
function wordListToIndexList(wordList, foundWords) {
    // Make a list of the index value of each found word, retaining its found order
    let list = [];
    foundWords.forEach((foundWord) => {
        let index = indexFromWord(wordList, foundWord);
        if (index > -1) {
            list.push(index);
        } else {
            // Should never happen, log it and ignore it
            console.warn(`Could not determine index for word: ${foundWord}`);
        }
    });

    return list;
}

// TODO this is a legacy method. Look to remove it
function indexListToWordList(indexList, wordList) {
    // Iterate over all items in the index list and reconstitute it into a words list
    let list = [];
    if (indexList) {
        indexList.forEach((index) => {
            if (index < wordList.length) {
                const [word, _] = wordList[index];
                list.push(word);
            } else {
                // This might happen if the puzzle has changed since being completed
                // This is not anticipated, but we need to be defensive about the possibility
                console.warn(`Could not find word for index: ${index}`);
            }
        });
    }

    return list;
}

// Update the user's progress through the puzzle in terms of words found etc.
// This will be used to return the puzzle to its in-progress state when the user reopens it
function updateProgress() {
    // For our new storage format, we want to store all the words found as a textual list, and also store the 
    // complete status
    const progressData = {
        foundKeyWords: currentPuzzle.foundKeyWords,
        foundExtraWords: currentPuzzle.foundExtraWords,
        nonWordCount: currentPuzzle.foundNonWords,
        completed: currentPuzzle.completed,
    }

    dbStorePuzzleProgress(currentPuzzle.puzzle.id, progressData)
        .catch((error) => {
            console.error("Failed to save progress", error);
        });
}

// Store the overall progress status of the puzzle (none; varying degrees of partial; complete)
// This is used in the main puzzle list page(s) to allow the user to see which puzzles they've started/finished etc.
function updatePuzzleStatus() {
    // Update the status value we'll use on the puzzles page to help users track the puzzles they're
    // working on
    let puzzleStatus = PuzzleStatus.COMPLETED;
    if (!currentPuzzle.completed) {
        const wordsFound = currentPuzzle.foundKeyWords.size;
        const wordsTotal = currentPuzzle.puzzle.keyWords.length;
        const percentComplete = Math.floor(100 * wordsFound / wordsTotal);

        if (percentComplete < 33) {
            // We are only in this method because the user did something with the puzzle,
            // so even if it wasn't finding a key word, it still counts as having at least started

            puzzleStatus = PuzzleStatus.STARTED;
        }
        else if (percentComplete < 66) {
            puzzleStatus = PuzzleStatus.MIDWAY;
        } else {
            puzzleStatus = PuzzleStatus.NEARLY;
        }
    }

    // Store our status for the benefit of the puzzle list page
    dbStorePuzzleStatus(currentPuzzle.puzzle.id, { status: puzzleStatus })
        .catch((error) => {
            console.error("Failed to save status", error);
        });
}

async function restoreProgress() {
    await dbGetPuzzleProgress(currentPuzzle.puzzle.id)
        .then(progressData => {
            if (progressData) {
                // We want to switch back to storing found words, not indexes of found words
                // Firstly, we have to deal with the transition where progress data will have
                // either a list of index values that relate to a puzzle's words, or an actual list of words
                // If the progress object contains 'foundKeyWords', it is in the newer style
                let wordList;
                if ("foundKeyWords" in progressData) {
                    wordList = progressData.foundKeyWords;
                } else {
                    // Legacy storage 
                    // TODO delete this when we're done with it
                    wordList = indexListToWordList(progressData.keyWords, currentPuzzle.puzzle.keyWords);
                }

                // keyWords
                if (wordList) {
                    wordList.forEach((word) => {
                        currentPuzzle.foundKeyWords.add(word);

                        // Adjust the red/grey numbers for each restored word
                        decrementRedGrey(word);
                    });
                }

                // extraWords
                if ("foundExtraWords" in progressData) {
                    wordList = progressData.foundExtraWords;
                } else {
                    // Legacy storage
                    // TODO delete this when we're done with it
                    wordList = indexListToWordList(progressData.extraWords, currentPuzzle.puzzle.extraWords);
                }

                if (wordList) {
                    wordList.forEach((word) => {
                        currentPuzzle.foundExtraWords.add(word);
                    });
                }

                // nonWords - Retain our ability to calculate accuracy
                currentPuzzle.foundNonWords = progressData.nonWordCount;

                // Infer completed state
                if ("completed" in progressData) {
                    currentPuzzle.completed = progressData.completed;
                } else {
                    // Legacy behaviour
                    // TODO delete this when we're done with it
                    currentPuzzle.completed = (currentPuzzle.foundKeyWords.size >= currentPuzzle.puzzle.keyWords.length);
                }
            }
        })
        .catch(error => {
            console.error("Failed to restore progress", error);
        });
}

async function resetProgress() {
    const userConfirmed = await openConfirmationDialog('This will delete all progress for this puzzle.<br/><br/>Do you want to proceed?');

    if (userConfirmed) {
        // Clear stored progress information
        await dbDeletePuzzleProgress(currentPuzzle.puzzle.id)
            .catch(error => {
                console.error("Failed to delete progress", error);
            });

        // Reset this back to being an unplayed puzzle as far as the list of puzzles is concerned
        await dbDeletePuzzleStatus(currentPuzzle.puzzle.id)
            .catch(error => {
                console.error("Failed to delete status", error);
            });

        // Reload everything
        openPuzzle(currentPuzzle.puzzleName, currentPuzzle.puzzle);
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

// Ticker tape

const tickerTapeColors = [
    'rgb(255, 0, 0)',
    'rgb(255, 128, 0)',
    'rgb(255, 255, 0)',
    'rgb(204, 0, 204)',
]

function createParticle(x, y) {
    const randomColor = tickerTapeColors[Math.floor(Math.random() * tickerTapeColors.length)];

    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.width = `${Math.random() * 10 + 5}px`;
    particle.style.height = particle.style.width;
    particle.style.backgroundColor = randomColor;
    document.body.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 5 + 2;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    let opacity = 1;

    // Screen extents
    const w = window.innerWidth - 20;
    const h = window.innerHeight - 20;

    function animateParticle() {
        const left = parseFloat(particle.style.left);
        const top = parseFloat(particle.style.top);

        // Don't go offscreen
        if (left > w || top > h) {
            particle.remove();
            return;
        }

        particle.style.left = `${left + vx}px`;
        particle.style.top = `${top + vy}px`;
        opacity -= 0.02;
        particle.style.opacity = opacity;

        if (opacity > 0) {
            requestAnimationFrame(animateParticle);
        } else {
            particle.remove();
        }
    }

    requestAnimationFrame(animateParticle);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function explode(elementId, count = 25) {
    // Take the element ID to use as the background area for the ticker tape explosion
    const tickerContainerElement = document.getElementById(elementId);
    if (tickerContainerElement) {
        const rect = { left: document.documentElement.scrollLeft, top: document.documentElement.scrollTop, width: window.innerWidth, height: window.innerHeight };//document.getElementById(elementId).getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Introduce a random start point (around the centre) for each burst
        const distanceFromCenter = 0.25;
        const distanceOverall = distanceFromCenter * 2;

        for (let j = 0; j < count; j++) {
            const xJitter = (Math.random() * (rect.width * distanceOverall)) - (rect.width * distanceFromCenter);
            const yJitter = (Math.random() * (rect.height * distanceOverall)) - (rect.height * distanceFromCenter);
            for (let i = 0; i < 50; i++) {
                createParticle(x + xJitter, y + yJitter);
            }

            await sleep(500);
        }
    }
}

// Get ready

attachEventListeners();
