# Foghorn

I built a small two-player game called Foghorn and wanted to share it [here](https://lattice-walker.github.io/Foghorn/). I made this mostly for my own amusement and figured others might enjoy trying it too.

## 1. The sudoku generator

Everything starts from a seed string. The solution, the givens, the fog shapes and the marker palette all come out of it, which is why two players only have to agree on a seed to be playing the same puzzle.

The full grid comes from an exact cover solver (Algorithm X with dancing links) run on an empty board with the branch order shuffled. Clues are then removed one at a time in random order, and a removal is kept only if the puzzle still has exactly one completion. That check counts solutions and stops at two, so it is cheap.

Rating is done by a second solver that knows nothing but named human techniques, applied cheapest first: naked and hidden singles, pointing and claiming, naked and hidden subsets up to size four, then X-Wing, Swordfish and Jellyfish. Every deduction it makes records the technique that produced it, so the difficulty is the highest tier the puzzle actually needed plus a weighted count of steps.

The two solvers are kept strictly apart. The technique solver's input type has no field for the solution, so it cannot consult the answer even by accident, and a test fails the build if anything on the rating path imports the brute force solver. Without that boundary, "solvable by technique" would quietly decay into "solvable by search". When the techniques run out, the puzzle is reported as unrated rather than guessed at. About a third of minimal puzzles come back that way, because chains and wings are not implemented yet.

The fog is grown rather than cut. Two seed cells are dropped far apart and each player's visible region grows outward one cell at a time, taking turns, rejecting any step that would break the growing player's fogged area into pieces. That keeps four things true on every puzzle: each player's visible region is in one piece, so is the fog they are looking at, no cell is visible to both players, and whatever neither region claims becomes a no man's land that both have to deduce. A straight vertical split satisfies all of that too, but it reads as a diagram and it is the same board every game.

The whole thing runs in the browser in about 30 milliseconds, which is why the site needs no server.

## 2. Static website bi-player technique

GitHub Pages serves files. There is no place to run code, hold state, or keep a socket open, so the usual way of introducing two players to each other is unavailable.

WebRTC gives browsers a direct data channel to each other, but it does not solve the introduction. Before a connection exists, the two browsers have to swap session descriptions, and that swap normally goes through a signalling server.

Foghorn uses the players as the signalling channel. The host's browser produces an offer, which gets deflated and base64url encoded into a short token starting `FOG1-`. They send it to the other player however they already talk, by message or email or anything else. The guest pastes it in, their browser produces an answer token, and they send that back. Once the host pastes the answer, the data channel opens and the page is out of the loop.

One consequence is worth knowing. With a signalling server, ICE candidates trickle across as they are found. With no channel to trickle over, each side has to finish gathering candidates before its code exists, which is why generating a code takes a second or two. STUN servers are contacted during that gathering to discover public addresses. They learn that some address is looking for a peer and nothing more. On a shared network you can connect without them at all.

What crosses the wire afterwards is very small. Because the puzzle comes from the seed, and because each player's board, pencil marks, colours and fog are private to them, the entire shared state is a seed and a list of markers. Joining a game is really just adopting a seed, and play is an append only exchange of markers placed and retracted.

The honest limitation: roughly one connection in ten sits behind a NAT that needs a relay to get through, and there is no relay here. Two people on the same network always connect.

## 3. The variants and their metas

Players cannot talk. The only thing they can do is place a marker on their own side of the board, which their partner sees through the fog without seeing the cells underneath. A marker states a relation and can never name a digit, and every type leaves at least two possibilities open for every cell it touches.

Each puzzle draws at most three types at random, so part of any given puzzle is working out what can be said in it.

Relations between two cells sharing a border:

| Marker | What it gives you |
| --- | --- |
| Consecutive, a white dot | The two differ by one, so they are opposite parity. A chain of them is a run of consecutive digits whose interior cannot be 1 or 9. |
| Double, a black dot | One is twice the other, so the pair is 1/2, 2/4, 4/8 or 3/6. That rules out 5, 7 and 9, and the two digits always add to a multiple of three. |
| Sum 5, a V | Either 1 and 4 or 2 and 3, so both cells are low. |
| Sum 10, an X | One low digit and one high, and neither is 5. |
| Greater than, a chevron | Orders the pair. 1 is never the greater and 9 never the lesser, and a chain of them bounds both ends. |
| Same parity, opposite parity | A region holds at most four even digits and at most five odd, so counting them caps what can go where. |

Lines, which run cell to cell by king's moves and can be any length:

| Marker | What it gives you |
| --- | --- |
| German whisper | Neighbours differ by at least 5, so no cell on the line is 5 and the line alternates low and high. Colouring that alternation is usually the first move. |
| Dutch whisper | Neighbours differ by at least 4. Weaker, because every digit can appear and the alternation only holds where 5 has been ruled out. |
| Palindrome | Cells the same distance from the centre hold the same digit, so every elimination on one of them counts twice. |
| Renban | A set of consecutive digits in some order, no repeats. Five cells or more must contain a 5, six or more must contain 4, 5 and 6. |
| Thermometer | Digits increase strictly from the bulb. 1 can only sit on the bulb and 9 only on the tip, and a line of N cells narrows every cell on it to a window of 10 minus N candidates. |
| Region sum line | Box borders cut the line into segments that all add to the same total. A segment of a single cell is worth the whole total, and two such cells hold the same digit. |
| Entropic line | Any three cells in a row hold one low digit (1 to 3), one middle (4 to 6) and one high (7 to 9). The bands then repeat in a fixed cycle, which classifies a cell far along the line without pinning it. |

Disequalities asserted of one cell and the cells around it:

| Marker | What it gives you |
| --- | --- |
| Knight badge | The digit does not repeat anywhere a knight's move away. |
| King badge | The digit does not repeat in any of the eight cells it touches. |
| No neighbours | No cell sharing an edge with it holds a consecutive digit. |

The badges are the strongest thing a player can send, for a reason that is easy to miss. They are pure disequalities, so they cannot express a value under any circumstances, and they reach eight cells rather than one neighbour, several of which are usually on the other side of the fog.
