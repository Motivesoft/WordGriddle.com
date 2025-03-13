// Functions for allowing user access to a catalog of puzzles

// Display a list of puzzles to allow the user to select one to open
document.addEventListener('DOMContentLoaded', async function () {
    // Import and migrate legacy data - only impacts the first 24 puzzles and we only want to try it once
    // TODO get rid of this at the end of the Alpha
    const migrationCompleted = localStorage.getItem('migration-1-completed') === "true";
    if (!migrationCompleted) {
        localStorage.setItem('migration-1-completed', 'true');

        for (let i = 1; i < 25; i++) {
            const statusData = localStorage.getItem(`puzzle-${i}.status`);
            if (statusData) {
                await dbStorePuzzleStatus(i, {
                    status: Number(statusData)
                })
                    .catch(error => {
                        console.error("Failed to migrate status", error);
                    });
            }
    
            const progressData = localStorage.getItem(`puzzle-${i}.progress`);
            if (progressData) {
                const progress = JSON.parse(progressData);
                await dbStorePuzzleProgress(i, {
                    keyWords: progress.keyWords,
                    extraWords: progress.extraWords,
                    nonWordCount: progress.nonWordCount,
                })
                    .catch(error => {
                        console.error("Failed to migrate progress", error);
                    });
            }
        }

    }

    const DEFAULT_REPOSITORY = "puzzles";

    // Check the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const repository = decodeURIComponent(urlParams.get(`r`) || DEFAULT_REPOSITORY);
    const puzzle = decodeURIComponent(urlParams.get(`p`) || '');

    // Work out the catalog location and the link to use for puzzle buttons
    let puzzleLink;
    if (repository === DEFAULT_REPOSITORY) {
        puzzleLink = `puzzle.html?p=%name`;
    } else {
        puzzleLink = `puzzle.html?r=%repo&p=%name`;
    }

    // Act as a URL shortener, look for a puzzle name coming in as a "p" request parameter and
    // open it (from either the default repo or one that was passed using "r"), for example:
    //   https://wordgriddle.com/?p=puzzle-1
    //   https://wordgriddle.com/puzzles.html?r=repo-1&p=puzzle-1

    if (puzzle.length) {
        // This will only actually add in a repo if puzzleLink is expecting one
        window.location.href = puzzleLink
            .replace("%repo", encodeURIComponent(repository))
            .replace("%name", encodeURIComponent(puzzle));
        return;
    }

    // Read the catalog file and create a puzzle button for each puzzle therein
    let catalogFile = `/assets/${repository}/catalog.json`;
    fetch(catalogFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error status: ${response.status}`);
            }

            return response.json();
        })
        .then(async data => {
            const puzzleListTitleElement = document.getElementById('puzzle-list-title-message');
            puzzleListTitleElement.innerHTML = data.prompt;

            // Work out the range of the set of puzzles in this catalog
            let minPuzzleId = 999999;
            let maxPuzzleId = 0;
            data.puzzles.forEach(puzzle => {
                minPuzzleId = Math.min(minPuzzleId, puzzle.id);
                maxPuzzleId = Math.max(maxPuzzleId, puzzle.id);
            });

            if (maxPuzzleId < minPuzzleId) {
                // No puzzles. Nothing to do
                return;
            }

            // Get all known puzzle statuses for the set of puzzles in which we are interested
            // We could do this piecemeal, puzzle by puzzle as required, but that is multiple database
            // calls and this is just one, so take the slight hit in complexity/readability for performance
            const statusList = await dbGetPuzzleStatusInRange(minPuzzleId, maxPuzzleId)
                .catch(error => {
                    console.error("Failed to get status", error);
                });

            // Start to build puzzle buttons
            const puzzleListElement = document.getElementById('puzzle-list');

            data.puzzles.forEach(async puzzle => {
                // See if we have any stored status for this specific puzzle
                let status = null;
                if (statusList) {
                    statusList.forEach((statusObject) => {
                        if (statusObject.id == puzzle.id) {
                            status = statusObject;
                        }
                    });
                }

                const puzzleSelector = await createPuzzleSelector(puzzle, status);

                puzzleSelector.addEventListener('click', function () {
                    window.location.href = puzzleLink
                        .replace("%name", encodeURIComponent(puzzle.name))
                        .replace("%repo", encodeURIComponent(repository));
                });

                puzzleListElement.appendChild(puzzleSelector);
            });
        })
        .catch(async error => {
            console.error(`Failed to load puzzle list: '${catalogFile}'`, error);
            await openMessageBox(`Failed to load puzzle list from '${repository}'.`, MessageBoxType.ERROR);

            // Go back to the home page
            window.location.href = "/";
        });
});
