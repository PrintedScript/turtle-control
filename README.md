# Turtle Control
### Fork of [ottomated/turtle-gambit](https://github.com/ottomated/turtle-gambit)
The plan of this fork is to update the dependencies as most of the current dependencies of the [ottomated/turtle-gambit](https://github.com/ottomated/turtle-gambit) repo is no longer maintained or supported, which causes issues during installation.

# TODO List
- [x] Use websockets to allow the frontend to communicate to the backend without having to use Carlo
- [ ] Update dependencies to the latest release
- [ ] Add more automation to the turtles
- [x] GPS support for turtles
- [ ] Some sort of authentication for the control panel?
- [x] Stop sending entire world data to frontend for one block update ( Only send what is updated )
- [ ] Remove block from database if turtle can go into it