// Scripting applicable to all pages

// Default puzzle repository
const DEFAULT_REPOSITORY = "published";

// ** MESSAGE DISPlAY
const MessageBoxType = Object.freeze({
    PLAIN: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    QUESTION: 4
});

// Function to open the message box with an icon
function openMessageBox(message, type = MessageBoxType.PLAIN) {
    const dialog = document.getElementById('messageBoxDialog');
    const messageBoxText = document.getElementById('messageBoxText');
    const icon = dialog.querySelector('.icon div');
    const okButton = document.getElementById('messageBoxOkButton');

    // Set the message
    messageBoxText.innerHTML = message;

    // Set the icon and dialog class based on the message type
    dialog.className = type; // Apply the type-specific class
    switch (type) {
        default:
        case MessageBoxType.PLAIN:
            icon.innerHTML = '';
            icon.className = 'no-icon';
            break;

        case MessageBoxType.INFO:
            icon.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M3 20V8A3 3 0 0 1 6 5H18A3 3 0 0 1 21 8V14A3 3 0 0 1 18 17H6zM7 9L17 9M7 13L15 13'/></svg>`;
            icon.className = 'info-icon';
            break;

        case MessageBoxType.WARNING:
            icon.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M5 19A2 2 0 0 1 3.16 16.25L10.24 4A2 2 0 0 1 13.74 4L20.84 16.25A2 2 0 0 1 19 19zM12 10L12 16M12 7L12 7'/></svg>`;
            icon.className = 'warning-icon';
            break;

        case MessageBoxType.ERROR:
            icon.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M8 8L16 16M12 3A9 9 0 0 1 12 21A9 9 0 0 1 12 3M16 8L8 16'/></svg>`;
            icon.className = 'error-icon';
            break;

        case MessageBoxType.QUESTION:
            icon.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M12 19L12 19M12 16L12 12A4 4 0 1 0 12 4A4 4 0 0 0 9 5'/></svg>`;
            icon.className = 'question-icon';
            break;
    }

    // Show the dialog
    dialog.showModal();

    // Force focus onto the OK button
    okButton.focus();

    // Return a promise that resolves when the user clicks OK
    return new Promise((resolve) => {
        okButton.addEventListener('click', function () {
            dialog.close();
            resolve();
        }, { once: true });
    });
}

// Function to open the confirmation dialog
function openConfirmationDialog(message) {
    const dialog = document.getElementById('confirmationDialog');
    const dialogMessage = document.getElementById('dialogMessage');
    const noButton = document.getElementById('noButton');

    // Set the dialog message
    dialogMessage.innerHTML = message;

    // Show the dialog
    dialog.showModal();

    // Return a promise that resolves to the user's choice
    return new Promise((resolve) => {
        dialog.addEventListener('close', function () {
            resolve(dialog.returnValue === 'yes');
        }, { once: true });

        // Handle No button click
        noButton.addEventListener('click', function () {
            dialog.close('no');
        }, { once: true });
    });
}

function openSettingsDialog() {
    const dialog = document.getElementById('settingsDialog');
    const settingsControlArea = document.getElementById('settingsControlArea');
    const okButton = document.getElementById('settingsOkButton');

    //NOTE: A 'cancel' button could be added to this if we stated adding settings that warranted it

    const migrateStorageButton = document.getElementById('migrateStorage');
    if (migrateStorageButton) {
        migrateStorageButton.addEventListener('click', async function () {
            const userConfirmed = await openConfirmationDialog('This will rebuild ALL progress data for ALL puzzles.<br/><br/>Do you want to proceed?');
            if (userConfirmed) {
                // For every puzzle we know, attempt to copy progress and status information
                // from localStorage to IndexedDB storage as a one-off exercise
                await migrateAllProgress();
            }
        });
    }

    const resetStorageButton = document.getElementById('resetStorage');
    if (resetStorageButton) {
        resetStorageButton.addEventListener('click', async function () {
            const userConfirmed = await openConfirmationDialog('This will delete ALL progress data for ALL puzzles.<br/><br/>Do you want to proceed?');
            if (userConfirmed) {
                const userAgreed = await openConfirmationDialog('This operation is irreversible.<br/><br/>Are you sure?');
                if (userAgreed) {
                    // For every puzzle we know, attempt to deleted any stored progress values
                    deleteAllProgress();
                }
            }
        });
    }

    // Show the dialog
    dialog.showModal();

    // Force focus onto the OK button
    okButton.focus();

    // Return a promise that resolves when the user clicks OK
    return new Promise((resolve) => {
        okButton.addEventListener('click', function () {
            dialog.close();
            resolve();
        }, { once: true });
    });
}

// Migrate all progress information stored for all puzzles
async function migrateAllProgress() {
    // This can be as hard-coded as we like as it is invented for a specific purpose 
    // Examine up to 100 puzzles, even though that is more than enough
    let errorCount = 0;
    for (let puzzleId = 1; puzzleId <= 100; puzzleId++) {
        try {
            const progressData = localStorage.getItem(`puzzle-${puzzleId}.progress`);
            const statusData = localStorage.getItem(`puzzle-${puzzleId}.status`);

            if (progressData) {
                const progress = JSON.parse(progressData);
                await dbStorePuzzleProgress(puzzleId, progress)
                    .catch(error => {
                        console.error("Failed to store progress", error);
                    });
            }

            if (statusData) {
                // This valid was a number held as a string originally. Make it a number now
                const status = Number.parseInt(statusData);
                await dbStorePuzzleStatus(puzzleId, { status: status })
                    .catch(error => {
                        console.error("Failed to store status", error);
                    });
            }
        } catch (error) {
            console.error(`Problem migrating data for puzzle ${puzzleId}`, error);
            errorCount++;
        }
    }

    await openMessageBox(`Progress migrated completed.<br/><br/>Error count: ${errorCount}`, MessageBoxType.INFO);
}

// Delete all progress information stored for all puzzles
function deleteAllProgress() {
    fetch('/assets/data/server.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error status: ${response.status}`);
            }

            return response.json();
        })
        .then(data => {
            data.roles.forEach((role) => {
                // # is a special name for the main puzzles repo, "published"
                const repo = role.repo === '#' ? DEFAULT_REPOSITORY : role.repo;

                // Read the catalog from repo and delete the progress for any puzzle therein
                deleteProgress(repo);
            });
        })
        .catch(async error => {
            console.error(`Failed to load site-roles:`, error);
        });
}

// Delete all "localStorage" progress information stored for all puzzles in a specific repo
function deleteProgress(repo) {
    fetch(`/assets/data/${repo}/catalog.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error status: ${response.status}`);
            }

            return response.json();
        })
        .then(data => {
            data.puzzles.forEach((puzzle) => {
                const puzzleStatusKey = `${puzzle.name}.status`;
                localStorage.clear(puzzleStatusKey);

                const puzzleProgressKey = `puzzle-${puzzle.id}.progress`;
                localStorage.clear(puzzleProgressKey);
            });
        })
        .catch(async error => {
            console.error(`Failed to load ${repo} catalog:`, error);
        });
}

function openAboutBox() {
    const dialog = document.getElementById('aboutBoxDialog');
    const aboutBoxText = document.getElementById('aboutBoxText');
    const okButton = document.getElementById('aboutBoxOkButton');

    // Set the message
    aboutBoxText.innerHTML = `
        <h3>About WordGriddle Junior</h3>
        <div class="aboutBoxSocialMediaLinks">
            <a href="https://discord.gg/vzdqBbnKX8" target="_blank" rel="noopener noreferrer">
                <img src="/assets/svg/discord-mark-blue.svg" alt="WordGriddle Discord Server" class="aboutBoxSocialMediaIcon">
            </a>
            <a href="https://www.reddit.com/r/WordGriddle/" target="_blank" rel="noopener noreferrer">
                <img src="/assets/svg/Reddit_Icon_2Color.svg" alt="WordGriddle channel on Reddit" class="aboutBoxSocialMediaIcon">
            </a>
        </div>
        <p id="aboutBoxVersion"></p>
        <p id="copyrightStatement">Copyright &copy; Ian Brown, 2025. All rights reserved.</p>
        <p id="moreInformation"><a href="/information.html">More Information</a></p>
        <p id="privacyPolicy"><a href="/privacy.html">Privacy Policy</a></p>
        <p id="termsOfUse"><a href="/terms.html">Terms of Use</a></p>
        `;

    displayVersion('aboutBoxVersion');

    // Show the dialog
    dialog.showModal();

    // Force focus onto the OK button
    okButton.focus();

    // Return a promise that resolves when the user clicks OK
    return new Promise((resolve) => {
        okButton.addEventListener('click', function () {
            dialog.close();
            resolve();
        }, { once: true });
    });
}

// Listen on the page load completing to do any final setup steps
document.addEventListener("DOMContentLoaded", async () => {
    // About Box logic for a UI control
    const aboutBoxButton = document.getElementById('aboutBoxButton');
    if (aboutBoxButton) {
        aboutBoxButton.addEventListener('click', async function () {
            await openAboutBox();
        });
    }

    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', async function () {
            await openSettingsDialog();

            // Refresh the current page to react to anything done in settings
            location.reload();
        });
    }

    fetch('/assets/data/server.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error status: ${response.status}`);
            }

            return response.json();
        })
        .then(data => {
            if (data.roles) {
                const puzzleCategoriesElement = document.getElementById('puzzle-categories');

                if (puzzleCategoriesElement) {
                    data.roles.forEach((role) => {
                        const roleButton = document.createElement('button');
                        roleButton.classList.add('button');
                        roleButton.setAttribute('type', 'button');
                        roleButton.innerHTML = `${role.name}`;
                        roleButton.addEventListener('click', function () {
                            if (role.repo == '#') {
                                // Special configuration setting to go to home page
                                window.location.href = `/`;
                            } else {
                                // Open the puzzles page on this collection of puzzles
                                window.location.href = `/puzzles.html?r=${encodeURIComponent(role.repo)}`;
                            }
                        });
                        puzzleCategoriesElement.appendChild(roleButton);
                    });
                }
            }
        })
        .catch(async error => {
            console.error(`Failed to load site-roles:`, error);
        });
});

// Asynchronously populate an element with version information
async function displayVersion(elementId) {
    fetch('/version.txt')
        .then(response => response.text())
        .then(version => {
            const element = document.getElementById(elementId);
            if (element) {
                document.getElementById(elementId).textContent = `Version: ${version}`;
            }
        });
}

// Common puzzle status stuff

const PuzzleStatus = Object.freeze({
    NONE: 0,
    STARTED: 1,
    MIDWAY: 2,
    NEARLY: 3,
    COMPLETED: 4
});

const PuzzleSelectorIcons = new Map([
    [PuzzleStatus.NONE, `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M5 4V20L19 12z'/></svg>`],
    [PuzzleStatus.STARTED, `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14'/></svg>`],
    [PuzzleStatus.MIDWAY, `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14M10 10V14'/></svg>`],
    [PuzzleStatus.NEARLY, `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14M10 10V14M13 10V14'/></svg>`],
    [PuzzleStatus.COMPLETED, `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M6 14L9 17L19 7'/></svg>`],
]);

// Internal methods

async function createPuzzleSelector(puzzle, statusContainer) {
    // Determine the status (played, unplayed, ...)
    const puzzleStatus = statusContainer?.status || PuzzleStatus.NONE;

    // Build the button piece by piece
    const puzzleSelector = document.createElement('button');
    puzzleSelector.setAttribute('class', 'puzzle-button');
    puzzleSelector.setAttribute('type', 'button');

    // Title text
    const puzzleSelectorName = document.createElement('span');
    puzzleSelectorName.setAttribute('class', 'left-text');
    puzzleSelectorName.textContent = `#${puzzle.id}`;

    // Size
    const puzzleSelectorSize = document.createElement('span');
    puzzleSelectorSize.setAttribute('class', 'right-rating');

    // Build the star rating string based on difficulty (using size as a fallback)
    let difficulty;
    if (puzzle.difficulty) {
        difficulty = puzzle.difficulty;
    } else {
        difficulty =
            puzzle.size >= 6 ? 4 :
                puzzle.size >= 5 ? 3 :
                    puzzle.size >= 4 ? 2 :
                        1;
    }

    // Build a string of SVG elements to represent the difficulty rating
    let starRating = ``;
    
    if (difficulty > 0) {
        starRating += `
            <g transform="translate(60,0)" filter="url(#shadow)">
                <use href="#star"/>
            </g>
        `;
    }
    if (difficulty > 1) {
        starRating += `
            <g transform="translate(45,0)" filter="url(#shadow)">
                <use href="#star"/>
            </g>
        `;
    }
    if (difficulty > 2) {
        starRating += `
            <g transform="translate(30,0)" filter="url(#shadow)">
                <use href="#star"/>
            </g>
        `;
    }
    if (difficulty > 3) {
        starRating += `
            <g transform="translate(15,0)" filter="url(#shadow)">
                <use href="#star"/>
            </g>
        `;
    }
    if (difficulty > 4) {
        starRating += `
            <g transform="translate(0,0)" filter="url(#shadow)">
                <use href="#star"/>
            </g>
        `;
    }

    // Use a different color scheme for the fiendish puzzles
    const starColor = difficulty > 4 ?
        'style="stroke: #ffa500; fill: #ec3a3a;"' :
        'style="stroke: #e6bd4b; fill: #ffa500;"';

    const stars = `
        <svg width="80" height="24" xmlns="http://www.w3.org/2000/svg" ${starColor}>
            ${starRating}
        </svg>
    `;

    puzzleSelectorSize.innerHTML = stars;

    // Icon for play status - with a fallback to be defensive
    const puzzleSelectorIcon = document.createElement('svg');
    puzzleSelectorIcon.setAttribute('class', 'right-icon');
    puzzleSelectorIcon.innerHTML = PuzzleSelectorIcons.get(puzzleStatus) || PuzzleSelectorIcons.get(PuzzleStatus.NONE);

    // Colouring
    if (puzzleStatus === PuzzleStatus.NONE) {
        // Unplayed or new puzzle
        puzzleSelector.classList.add('unplayed');
    } else if (puzzleStatus === PuzzleStatus.COMPLETED) {
        // Completed puzzle
        puzzleSelector.classList.add('played');
    } else {
        // In progress puzzle
        puzzleSelector.classList.add('playing');
    }

    // Assemble the parts
    puzzleSelector.appendChild(puzzleSelectorName);
    puzzleSelector.appendChild(puzzleSelectorSize);
    puzzleSelector.appendChild(puzzleSelectorIcon);

    // Return the button
    return puzzleSelector;
}
