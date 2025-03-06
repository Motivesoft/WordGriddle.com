// Scripting applicable to all pages

// ** MESSAGE DISPlAY
const MessageBoxType = Object.freeze({
    PLAIN: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3
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
            icon.innerHTML = '&#x2139';
            icon.className = 'info-icon';
            break;

        case MessageBoxType.WARNING:
            icon.innerHTML = '&#x26a0';
            icon.className = 'warning-icon';
            break;

        case MessageBoxType.ERROR:
            icon.innerHTML = '&#x2716';
            icon.className = 'error-icon';
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

function openAboutBox() {
    const dialog = document.getElementById('aboutBoxDialog');
    const aboutBoxText = document.getElementById('aboutBoxText');
    const okButton = document.getElementById('aboutBoxOkButton');

    // Set the message
    aboutBoxText.innerHTML = `
        <h3>About WordGriddle</h3>
        <div class="aboutBoxSocialMediaLinks">
            <a href="https://discord.gg/vzdqBbnKX8" target="_blank" rel="noopener noreferrer">
                <img src="assets/discord-mark-blue.svg" alt="WordGriddle Discord Server" class="aboutBoxSocialMediaIcon">
            </a>
            <a href="https://www.reddit.com/r/WordGriddle/" target="_blank" rel="noopener noreferrer">
                <img src="assets/Reddit_Icon_2Color.svg" alt="WordGriddle channel on Reddit" class="aboutBoxSocialMediaIcon">
            </a>
        </div>
        <p id="aboutBoxVersion"></p>
        <p id="copyrightStatement">Copyright &copy; Ian Brown, 2025. All rights reserved.</p>
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

    fetch('/assets/server.json')
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
    NONE: "0",
    STARTED: "1",
    MIDWAY: "2",
    NEARLY: "3",
    COMPLETED: "4"
});

const PuzzleSelectorIcons = new Map([
    //Empty battery: ["0", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9'/></svg>`],
    ["0", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M7 4V20L20 12Z'/></svg>`],
    ["1", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14'/></svg>`],
    ["2", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14M10 10V14'/></svg>`],
    ["3", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14M10 10V14M13 10V14'/></svg>`],
    ["4", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M5 12L10 17L20 7'/></svg>`],
    //Full battery: ["4", `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' fill='none' stroke-linecap='round' stroke-linejoin='round'><path fill='none' stroke='none' d='M0 0h24v24H0z'/><path d='M4 9A2 2 0 0 1 6 7H17A2 2 0 0 1 19 9V10H20V14H19V15A2 2 0 0 1 17 17H6A2 2 0 0 1 4 15V9M7 10V14M10 10V14M13 10V14M16 10V14'/></svg>`],
]);

// Internal method
function getPuzzleStatusKey(puzzleName) {
    return `${puzzleName}.status`;
}

function hasPuzzleStatus(puzzleName) {
    const status = localStorage.getItem(getPuzzleStatusKey(puzzleName));
    return !(status === null || status === undefined);
}

function getPuzzleStatus(puzzleName) {
    const status = localStorage.getItem(getPuzzleStatusKey(puzzleName));
    return status ? status : PuzzleStatus.NONE;
}

function setPuzzleStatus(puzzleName, puzzleStatus) {
    localStorage.setItem(getPuzzleStatusKey(puzzleName), puzzleStatus);
}    

function clearPuzzleStatus(puzzleName, puzzleTitle) {
    // We could set this to NONE, but I prefer reducing localStorage use where we can
    return localStorage.clear(getPuzzleStatusKey(puzzleName));
}

function createPuzzleSelector(puzzle) {
    // Get the status (played, unplayed, ...)
    const puzzleStatus = getPuzzleStatus(puzzle.name);

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
    puzzleSelectorSize.setAttribute('class', 'center-text');
    puzzleSelectorSize.textContent = `${puzzle.size}x${puzzle.size}`;
    
    // Icon for play status
    const puzzleSelectorIcon = document.createElement('svg');
    puzzleSelectorIcon.setAttribute('class', 'right-icon');
    puzzleSelectorIcon.innerHTML = PuzzleSelectorIcons.get(puzzleStatus);

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