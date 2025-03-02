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
                const navBarRight = document.getElementById('navbar-roles');
                const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--button-background');

                if (navBarRight) {
                    data.roles.forEach((role) => {
                        console.log(`Role: ${role.name}`);
    
                        const roleButton = document.createElement('button');
                        roleButton.classList.add('toolbar-button');
                        roleButton.style.backgroundColor = backgroundColor;
                        roleButton.setAttribute('type', 'button');
                        roleButton.innerHTML = `${role.name}`;
                        roleButton.addEventListener('click', function () {
                            if (role.repo == '#') {
                                // Special configuration setting to go to home page
                                window.location.href = `/`;
                            } else {
                                // Open the puzzles page on this collection of puzzles
                                window.location.href = `/puzzles.html?repo=${role.repo}`;
                            }
                        });
                        navBarRight.appendChild(roleButton);
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
