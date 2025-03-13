// Scripting applicable to all pages

// This script should be loaded in <head>, without using 'defer' to reduce any theme flickering
// An event handler at the end allows for any actions that require the DOM to have been loaded

// Constants for local storage keys
const ScriptLocalStorageKeys = Object.freeze({
    THEME: "theme",
});

// ** THEME FUNCTIONS

// Function to store a choice of theme and and load it into the current session
function setTheme(theme) {
    // Set the theme and store it for future - or reset it, if an undefined value is provided
    try {
        if (theme) {
            localStorage.setItem(ScriptLocalStorageKeys.THEME, theme);
        } else {
            localStorage.removeItem(ScriptLocalStorageKeys.THEME);
        }
    } catch (error) {
        console.error("Problem persisting theme", error);
    }

    loadTheme();
}

// Function to forget any stored theme and use default behaviour
function resetTheme() {
    // Forget any stored value
    localStorage.removeItem(ScriptLocalStorageKeys.THEME);

    // Use the default behaviour, which includes using OS preferences
    loadTheme();
}

// Load a theme; from localStorage, OS preferences or a default
function loadTheme() {
    // See if we have a stored theme preference. If not, ask the OS, and if there is no other preference, let the CSS decide

    // Don't store any theme chosen here as this is either already stored or an OS default
    // If the user wants to explicitly set the theme, use a technique that calls 'setTheme'

    if (localStorage.getItem(ScriptLocalStorageKeys.THEME)) {
        // Use a stored value - this is used in preference to OS settings
        const theme = localStorage.getItem(ScriptLocalStorageKeys.THEME);

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
    // Theme toggle logic for a UI control
    const themeToggleButton = document.getElementById('themeToggleButton');

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', function () {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                setTheme('light');
            } else {
                setTheme('dark');
            }
        });
    }
});

// Initialise the current theme
loadTheme();
