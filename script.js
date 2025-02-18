// Scripting applicable to all pages

// This script should be loaded in <head>, without using 'defer' to reduce any theme flickering
// An event handler at the end allows for any actions that require the DOM to have been loaded

// ** MESSAGE DISPlAY

// Function to open the message box with an icon
function openMessageBox(message, type = 'info') {
    const dialog = document.getElementById('messageBoxDialog');
    const messageBoxText = document.getElementById('messageBoxText');
    const icon = dialog.querySelector('.icon div');
    const okBtn = document.getElementById('okBtn');

    // Set the message
    messageBoxText.textContent = message;

    // Set the icon and dialog class based on the message type
    dialog.className = type; // Apply the type-specific class
    switch (type) {
        case 'info':
            icon.innerHTML = '&#x2139';
            icon.className = 'info-icon';
            break;
            case 'warning':
            icon.innerHTML = '&#x26a0';
            icon.className = 'warning-icon';
            break;
            case 'error':
            icon.innerHTML = '&#x2716';
            icon.className = 'error-icon';
            break;
        default:
            icon.className = 'info-icon';
    }

    // Show the dialog
    dialog.showModal();

    // Return a promise that resolves when the user clicks OK
    return new Promise((resolve) => {
        okBtn.addEventListener('click', function () {
            dialog.close();
            resolve();
        }, { once: true });
    });
}

// ** THEME FUNCTIONS

// Function to set the theme and store it for future sessions
function setTheme(theme) {
    // Set the theme and store it for future - or reset if an undefined value is provided
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('theme');
    }
}

// Function to forget any stored theme and use default behaviour
function resetTheme() {
    // Forget any stored value
    localStorage.removeItem('theme');

    // Use the default behaviour, which includes using OS preferences
    loadTheme();
}

// Load a theme; from localStorage, OS preferences or a default
function loadTheme() {
    // See if we have a stored theme preference. If not, ask the OS, and if there is no other preference, let the CSS decide

    // Don't store any theme chosen here as this is either already stored or an OS default
    // If the user wants to explicitly set the theme, use a technique that calls 'setTheme'

    if (localStorage.getItem('theme')) {
        // Use a stored value - this is used in preference to OS settings
        const theme = localStorage.getItem('theme');

        document.documentElement.setAttribute('data-theme', theme);
    } else if (window.matchMedia) {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else /* Assumes no-preference */ {
            document.documentElement.removeAttribute('data-theme');
        }
    } else {
        // No stored value, no OS preference, let the CSS decide
        document.documentElement.removeAttribute('data-theme');
    }
}

// Listen on OS preference change and react accordingly. Note this will only 
// impact the UI if the user has not explicitly chosen a theme
if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener('change', loadTheme);
}

// Listen on the page load completing to do any final setup steps
document.addEventListener("DOMContentLoaded", async () => {
    await finalSetup();
});

// Perform final setup tasks
async function finalSetup() {
    console.log("Final setup complete");

    // Theme toggle logic for a UI control wanting
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    themeToggleBtn.addEventListener('click', function () {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    });
}

// Initialise the current theme
loadTheme();
