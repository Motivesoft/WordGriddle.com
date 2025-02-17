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

function openPuzzle(puzzle) {
    // Populating this field is just the proof of concept
    document.getElementById('puzzle-title').innerHTML = puzzle.title;

}
