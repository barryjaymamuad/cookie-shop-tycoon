# Kevin’s Cookie Shop Tycoon

Double-click **index.html** to play in any modern browser. Keep **game.js** in the same folder. No server, installation, or internet connection is required.

You start with $100 and have 30 days to run the shop. Each day, choose how many cookies to bake and what to charge for each variety, then set one advertising budget for the whole shop. Set a batch to zero to leave it off the menu.

| Variety | Cost to bake | Starting price |
| --- | ---: | ---: |
| Chocolate chip | $0.50 | $2.00 |
| Double chocolate | $0.75 | $2.75 |
| White chocolate macadamia | $1.00 | $3.50 |

Your batch mix determines how customer interest is split across the menu. Raising a variety’s price above its starting price reduces demand for it, and advertising boosts traffic for the shop. Unsold cookies are discarded at closing time.

Select **Open shop** to watch customers come in and pick up cookies. Busier days show more shoppers, and each order adds to the live sales count. The receipt appears when the shop closes and breaks down sales and revenue by variety. If your system is set to reduce motion, the receipt appears immediately.

Expand **Sales history** to compare days. Your final result appears after Day 30. Reloading the page or starting a new game resets your progress.

## Customer satisfaction

Satisfaction starts at 75/100 and updates at closing time. Each offered variety’s price is compared with its starting price; its price effect is capped at ±5 points and weighted by its share of the cookies baked. The combined price effect is rounded to whole points. Varieties with a zero batch are off the menu and do not affect satisfaction.

Meeting all demand earns 2 points. A shortage loses up to 10 points in proportion to unmet demand (rounded up). Baking nothing loses 10 points; a stocked menu with no demand has no inventory effect. The score stays between 0 and 100. Daily results and sales history explain both effects and show the actual score change. Satisfaction tracks customer sentiment without changing the existing demand calculation. New game resets it to 75.

## Browser tests

With Python Playwright and Chromium installed, run `python3 -m unittest discover -s tests -v`. Tests use `/usr/bin/chromium`, start their own local HTTP server, and cover prices, shortages, menu mix, empty inventory, zero demand, score limits, completion, reset, budget validation, animation, and mobile layout. Run `node --check game.js` for a JavaScript syntax check.
