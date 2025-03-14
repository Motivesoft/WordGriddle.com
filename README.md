![WordGriddle](./wordgriddle-64x64.png)
# WordGriddle
Homepage for the upcoming WordGriddle game.

## Rationale
- The URL exists, so it needs some content
- The game is in development, and we'll need somewhere to showcase it
- When the time is right, we will drop the game right here

## Guidance for the UI
> I would like a new, responsive web page. In landscape mode, the left hand side of the display is given over to a 4x4 grid of letters. Above and Below the grid will be areas where I can add controls (buttons and checkboxes) and messages (status reports). On the right of the screen will be large display of text consisting of h3 titles and columnar lists of words. The right hand side area needs to support scrolling if there is sufficient content, with the left hand side staying fixed and in view. In Portrait mode, the two portions of the screen should be changed so that the grid and controls are at the top of the display and the other content beneath. The page has a navbar at the top and an H1 title above the content described above  




# Thoughts / To-Do
- Setting dialog, accessible from top-right
  - Dark/Light Mode
  - Puzzle Font?
  - ?

- Choose a level, where
  - easier levels bring:
    - grey numbers
    - red numbers
    - word counts at lengths
    - ...
  - rewards come in after a while anyway?

- restart puzzle button
  - (enabled only when there are saved results, once we can save results) 

- Put together a complete puzzle with solution
- Store progress and have 'reset progress' to clear that
  - Test with F5 Refresh etc.
- Show found words, word totals/countdowns
- Show red/grey numbers (optional)


## Branching
- work off feature/bug branches
- merge into 'main'
- have 'Staging' and 'Production' branches for releases
- merge changes from main to 'Staging' and test
- if necessary, develop hotfixes and merge into 'Staging'
- when ready, merge from 'Staging' to 'Production'
- tag 'Production' releases
- (optionally) tag 'Staging' releases

### Branching steps
Start with an up to date workspace:
```shell
git checkout main
git pull origin main
```

Create the Staging and Production branches if not already done:
```shell
git checkout main
git checkout -b Staging
git push -u origin Staging

git checkout main
git checkout -b Production
git push -u origin Production
```

Development cycle with main (or use IDE and PRs):
```shell
git checkout main
git merge <feature-branch>
git push origin main
```

Consider tagging significant stages in main
```shell
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin --tags
```

Merge changes into Staging when planning a release (this will cause a merge commit):
```shell
git checkout main
git pull
git checkout Staging
git merge main --no-ff
git push origin Staging
```

>Alternately, try this:
>```shell
>git fetch --all
>git checkout Staging
>git merge origin/main --no-ff
>git push origin Staging
>```

Consider tagging this Staging release
```shell
git tag -a v1.2.3-staging -m "Staging release 1.2.3"
git push origin --tags
```

On staging server, clone the repo (if required) and checkout Staging branch:
```shell
git clone [repo-url]
cd [repo-directory]
git checkout Staging
```

Test. If fixes required, develop the fix, merge to main and then merge main into Staging again.

When ready, merge Staging into Production (this will cause a merge commit):
```shell
git checkout Staging
git pull
git checkout Production
git merge Staging --no-ff
git push origin Production
```

Tag this release in the Production branch:
```shell
git tag -a vX.X.X-prod -m "Production release version X.X.X"
git push origin --tags
```

Or create the tags simultaneously:
```shell
git tag -a v1.2.3 -m "Release version 1.2.3"
git tag -a v1.2.3-staging -m "Staging release 1.2.3"
git tag -a v1.2.3-prod -m "Production release 1.2.3"
git push origin --tags
```

Or against a specific commit, to avoid needing to switch branches:
```shell
git tag -a v1.0.0-prod <commit-hash> -m "Production release 1.0.0"
git push origin v1.0.0-prod
```

# Release strategy
## Alpha
Friends and family.

### Desired end result (1)
- 'Alpha' branch
- robots to disallow / on Alpha
- GitHub default branch to Production
- 'index' page with intro, demo puzzle, released puzzles
- some version of 'puzzles' folder with only released puzzles
- home link on any page goes back to 'index'
- differences from current main are: 
  - no links to test puzzles
  - test puzzles not even present 
  - no 'puzzles' page

### Steps
- Make Alpha branch from main
- Make assets\puzzles folder and populate with released puzzles and a catalog file
- Add links to index page to puzzles in assets, with special call out to demo puzzle
- Delete puzzles page and puzzles folder from Alpha branch
- Our testing and playing continues from main
- To publish a new puzzle to Alpha, make it as 'released' in main as currently and then copy to assets/puzzles and add to its catalog
  - We can always remove from main puzzles folder in future if we want
- Update hosting to use Alpha branch 


- Split puzzles into two repos, test and puzzles
- Populate index page with puzzles - separating out our demo puzzle
- Create test page from 'puzzles', but only for the test repo
- 
- Use an Alpha branch from main
- 