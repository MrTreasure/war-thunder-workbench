[<img src="https://login.gaijin.net/gcm/flags/flag_zh.svg" width="24" height="16" alt=""> 简体中文](README.md) · **<img src="https://login.gaijin.net/gcm/flags/flag_en.svg" width="24" height="16" alt=""> English** · [<img src="https://login.gaijin.net/gcm/flags/flag_ru.svg" width="24" height="16" alt=""> Русский](README.ru.md) · [<img src="https://login.gaijin.net/gcm/flags/flag_ja.svg" width="24" height="16" alt=""> 日本語](README.ja.md)

# War Thunder Research Workbench

A community tool for War Thunder players: browse research trees, calculate Research Points, build lineups, explore ground maps, draw tactical routes, look up service records, inspect complete vehicle collections, estimate account value, generate personal combat reports, and keep track of vehicles and sales.

**[Main site (QMuse) →](https://render.qmuse.pub/p/muse/8645013411493394)** · **[International site →](https://wt.mrtreasure.cc/)** · **[Player stats and vehicle collection →](https://render.qmuse.pub/p/muse/8645013411493394#/stats)** · **[Ground maps and tactical drawing →](https://render.qmuse.pub/p/muse/8645013411493394#/maps)** · **[Sales calendar →](https://render.qmuse.pub/p/muse/8645013411493394#/sales)** · [Feature guide](#feature-guide)

![Chinese ground forces research tree](docs/screenshots/tree.png)

## Interface languages

Simplified Chinese, English, Russian and Japanese are supported. Switch instantly using the language menu in the upper-right corner; your choice is saved in the current browser.
Research-tree vehicle and modification names use verified in-game translations where available; missing localized names fall back to English.
Player nicknames, custom plans, map annotations, original guide images and previously generated AI commentary retain their original text.


## What you can do

- **Browse vehicles:** Explore the research trees of ten nations, covering ground vehicles, aircraft, helicopters, bluewater fleets and coastal fleets.
- **Plan research:** Calculate the RP still needed for a target, based on vehicles you own and ranks you have unlocked.
- **Plan modifications:** Mark researched modifications and see how much RP remains.
- **Build lineups:** Save multiple lineups per nation, check their Battle Ratings in different modes, and copy share codes.
- **Explore maps:** Search ground maps, switch mission layouts, and inspect contours, capture points and spawn points.
- **Draw tactics:** Add attack arrows, curves, green defensive lines, sniper positions and danger areas.
- **Check player stats:** View career and official recent statistics, a six-axis performance chart, K/D by vehicle branch, official rankings, vehicle classes and time played.
- **Inspect vehicle performance:** Switch between tables and four-column cards, filter, sort and paginate results, open vehicle details, and generate shareable stat images.
- **View the complete vehicle collection:** List vehicles confirmed as owned in the public collection, including those never taken into battle, grouped into researchable, Golden Eagle, pack and special vehicles.
- **Estimate account value:** Review RP conversions, Golden Eagle vehicles and packs using different valuation methods. Unverified prices are listed separately; estimates are not presented as actual sale prices.
- **Generate combat reports:** Combine your five most-used vehicles, a War Thunder background and your avatar. Choose a commander's address, combat analysis, a roast, or describe your own tone, then save the report as an image.
- **Watch for sales:** Follow Golden Eagle and pack vehicles, check regular prices, upcoming sale windows and countdowns, and compare previous events in a monthly calendar or timeline.
- **Share with teammates:** Save tactical maps as images or export editable drawing files to continue later.

Works on desktop and mobile. Research trees, lineups, maps and the sales calendar require no login. Player lookup uses public records and your in-game nickname; it never requires your game password. Signing into the tool applies the query and report allowances for your account, with remaining uses shown on the page.

## Player stats, rankings, complete collection and account valuation

[Open player lookup](https://render.qmuse.pub/p/muse/8645013411493394#/stats), enter an in-game nickname and confirm the player, or select a player from the official leaderboard on the home screen. Public lookup does not need a game password. The tool's account and your game account are separate.

The screenshots below were recaptured while using the updated preview on 2026-10-23. Player nicknames, UIDs and avatars have been retained as requested. Statistics, rankings, prices and remaining allowances reflect the capture times shown and may change. Preview updates become available after release.

### Career overview: lifetime, official recent stats and battle types

Switch between Arcade, Realistic and Simulator Battles. Select an overall PvP, ground, air or other available battle scope, then view lifetime or official recent records. The page shows battles, win rate, efficiency, air/ground K/D and average score. Recent-versus-career comparisons include win rate, average score and relative position in the team.

A six-axis chart helps compare performance dimensions. K/D by vehicle class aggregates individual ground, air and naval vehicle records. **This differs from grouping statistics by battle type:** ground battles can include aircraft sorties, so the two scopes must not be treated as interchangeable.

![Career overview, recent and lifetime comparison, and six-axis chart](docs/screenshots/player-stats-overview.png)

Owned and elite vehicle counts can also be viewed by nation. Missing data is identified rather than silently counted as zero.

### Rankings: a dedicated page for official leaderboard positions

Switch from **Career overview** to **Rankings**, then filter by battle mode, battle scope, metric and lifetime/official recent period to see the metric value, official rank and number of leaderboard entries.

Available metrics include average score, win rate, relative team position and kills per spawn, depending on the selected scope. Percentile comparisons use a limited sample of official leaderboard records. If that sample is not ready, the page retains your official rank and explains the status. **Leaderboard entries are not the total number of registered players, and sample percentiles are not an exact distribution of all players. This page does not show a site-specific ranking.**

![Official rankings, metric filters and leaderboard scope explanation](docs/screenshots/player-rankings.png)

### Complete vehicle collection: including vehicles never used in battle

Click **Complete collection** beside the player profile to view all vehicles confirmed as owned in public records, including tanks, aircraft and other vehicles that have never been used in battle. No account valuation is required, and opening the list does not consume a valuation use.

Combine filters for **nation, branch, rank, vehicle type, battle participation and name**. The list includes pagination, elite markers and links to the official Wiki. Vehicles with battle records can open their detailed statistics. If collection data is unavailable, the page says so rather than assuming the missing vehicles are not owned.

![Complete collection with unused-vehicle markers, filters and pagination](docs/screenshots/player-owned-vehicles.png)

### Account valuation: review both priced and unpriced items

Click **Account valuation** to estimate the value of currently owned vehicles and switch between the available valuation methods. RP conversions, Golden Eagle vehicles and store packs are itemized. Special vehicles, unverified prices and vehicles excluded from valuation are listed separately for inspection.

Each vehicle and each pack is counted only once; packs use the full pack price. Unknown prices are not treated as zero, and the subtotal of verified prices is not presented as a complete total.

![Account valuation, valuation methods and price breakdown](docs/screenshots/player-account-valuation.png)

**These are reference amounts calculated under the tool's rules, not official prices, actual spending or account transaction prices.** Valuation has a separate allowance, shown at its entry point.

### Vehicle stats: tables, cards and shareable images

The stats list only includes vehicles with battle records; the full owned list is available in **Complete collection**. Filter by **nation, branch, rank and name**, sort by battles, win rate, K/D, efficiency or cumulative Silver Lions, and use pagination, page-size settings or clear sorting.

![Vehicle stats table with filters, sorting and pagination](docs/screenshots/player-stats-vehicles.png)

Switch between **table and card views**. Desktop cards show four vehicles per row with larger images. The view and page size are saved in the current browser. Silver Lions use the game icon and, in the Chinese interface, **万/亿** abbreviations (10,000/100,000,000). They represent cumulative earnings, not account balance or net income. Ground filtering hides naval K/D.

![Four-column desktop vehicle cards and compact text actions](docs/screenshots/player-stats-cards.png)

Click **View details** for individual vehicle performance, or **Generate image** to make a standalone stat card containing the player name, mode, K/D, efficiency, win rate, battles and Silver Lions. Choose a World War II, Cold War or modern background. The image includes game branding and the site address.

![Individual vehicle details](docs/screenshots/player-vehicle-detail.png)

![Vehicle stat card generated by the application](docs/screenshots/player-vehicle-card.png)

After generation, the app attempts to copy the image to the clipboard. If the browser blocks automatic copying, retry manually or download the PNG. A same-vehicle ranking is not shown without a verified official ranking source.

### Vehicle classes and time played

At the **bottom of the career page**, view time played and its share by vehicle class, along with returned spawn/kill records, and switch the gameplay scope. Time played excludes queue time; percentages use the total duration of the returned classes. Battle counts for a gameplay mode cannot be summed by vehicle class. This section is not duplicated on the rankings page.

![Vehicle classes and time played at the bottom of the career page](docs/screenshots/player-type-usage.png)

### Personal combat reports: Top 5 vehicles with AI commentary

Choose a nation, branch, commentary style and background, then click **Generate my report** to create the report and AI commentary together.

- **Commander's address:** A service-record recap in the style of an awards speech.
- **Combat analysis:** A discussion of strengths and weaknesses based on known records.
- **Roast:** Light-hearted criticism of in-game performance.
- **Custom style:** Describe the tone and analytical angle you want.

Use a game background or upload your own image; the report adapts its colors to the background. Custom backgrounds are used in the current page and are not uploaded to the server.

![Nation, branch, AI style and background settings](docs/screenshots/player-report-options.png)

The report includes **career battles, K/D, efficiency and win rate** for the current mode, then the **Top 5 vehicles by battles** within the selected filters, cumulative Silver Lions and related charts. The Top 5 is only one part of the report; its summed battles are not presented as the career battle total.

![Generated Ground Realistic Battles Top 5 report](docs/screenshots/player-report.png)

Save the image once generation is complete. Saving again or changing the background does not consume another use; new commentary counts against the allowance shown on the page. AI analyzes only retrieved records and does not invent recent battle-by-battle results.

![Career overview on mobile](docs/screenshots/player-stats-mobile.png)

### Data, ratings and allowances

- Player queries use adaptive caching. A valid cache hit does not consume a new-query use; expiry depends on the active configuration and record status. Use **Force refresh** when you need current data; a successful refresh counts as one new query.
- The current browser retains recent lookup names and up to 16 previously viewed players. Reopening a saved record first restores its snapshot rather than forcing a refresh of official data. Records do not automatically sync across devices.
- Query, report and valuation allowances depend on the current identity. The page shows actual remaining uses; this document does not promise unlimited access.
- Workbench efficiency ranges from **0–2000**, with fewer than 50 battles scored as 0. It is not an official rating, official rank or player percentile. The page only explains the factors that affect it.
- Official recent statistics are API aggregates, not recent replays or a battle-by-battle log. Performance charts and AI commentary do not replace official records.

## Feature guide

### 1. Choose a nation and explore its research tree

Select a nation, branch and battle mode. Search by Chinese name or English model designation, inspect research prerequisites, expand grouped vehicles and zoom to follow a whole research path.

![Home screen before selecting a nation](docs/screenshots/home.png)

Regular research and special vehicles appear separately, with Golden Eagle, pack, squadron and event acquisition methods distinguished. Switch AB / RB / SB to view the Battle Rating for each mode.

![Research tree and special vehicle sections](docs/screenshots/tree.png)

Open a vehicle to view a larger image, research information and pack prices in CNY. The vehicle title links to the official Wiki; below it are **Research vehicle** and **Research modifications**. Packs without a verified price show **No quote available**. Full pack prices are not split into invented per-vehicle prices.

![Vehicle details and enlarged image](docs/screenshots/vehicle-detail.png)

### 2. Vehicle research: enter your progress and see what remains

After choosing a target, specify the vehicle you have already purchased along its research line and the rank you have unlocked. The tool lists the target, required predecessors and additional vehicles needed to meet rank unlock requirements.

The examples use **CNY 3 per 10,000 RP**. You can change this rate. It is a calculation example, not an in-game price or a service offer.

For a **ZTZ99A** target with no other owned vehicles:

| Unlocked rank | Example remaining RP | At CNY 3 per 10,000 RP |
| --- | --- | --- |
| Rank VIII | 810,000 RP | CNY 243 |
| Rank VII | 2,065,000 RP | CNY 619.50 |

![Calculation starting from Rank VIII](docs/screenshots/vehicle-rank-viii.png)

![Calculation starting from Rank VII](docs/screenshots/vehicle-rank-vii.png)

Instead of using the default additional-research plan, you can select vehicles you want to research and exclude those you do not. Combine search, rank and vehicle-type filters to organize your owned vehicles.

![Filtering vehicles by model, rank and type](docs/screenshots/vehicle-filters.png)

### 3. Modification research: do not count completed research twice

Modifications are calculated separately. Mark completed modifications and enter RP already invested in other modifications to see the remaining amount.

This example uses the **ZTZ99A at CNY 4 per 10,000 RP**. With some modifications complete and another 5,000 RP invested, 263,000 RP remain, totaling **CNY 105.20**. This rate is also editable.

![Modification research and remaining cost](docs/screenshots/modifications.png)

### 4. Lineups: save the setups you play most

Save multiple lineups for each nation. The page opens with your saved lineups; the vehicle picker appears only when creating or editing one. Canceling an edit preserves the saved setup.

![Saved German lineups](docs/screenshots/lineups-germany.png)

Crew slots run horizontally, as in the game. Press and drag to reorder them. Filter the vehicle picker by branch, rank, acquisition method and model; pack, elite, squadron and other special vehicles are identified.

The following Ground RB lineups demonstrate the feature and are not recommendations for optimal setups.

**China · 11.7**

![Chinese 11.7 lineup](docs/screenshots/lineup-china-117.png)

**Germany · 5.7**

![German 5.7 lineup](docs/screenshots/lineup-germany-57.png)

**Germany · 6.7**

![German 6.7 lineup](docs/screenshots/lineup-germany-67.png)

**USA · 7.0**

![US 7.0 lineup](docs/screenshots/lineup-usa-70.png)

**USA · Top tier**

![US top-tier lineup](docs/screenshots/lineup-usa-top.png)

Check the lineup's Battle Rating in different modes. Modes that depend on event vehicle lists or room brackets prompt you to verify those conditions.

The share button sits beside the lineup name. It displays a share code and attempts to copy it. Teammates can select **Import** and paste the code to restore the nation and vehicle order.

![Sharing a lineup](docs/screenshots/lineup-share.png)

Share codes are **case-sensitive and 24 characters long**; empty slots are preserved. After importing, check the lineup name, battle type and aircraft selection.

### 5. Research list: calculate multiple items together

Add vehicles and modifications to the cart to combine remaining RP and costs. Shared prerequisite vehicles are counted only once. Conflicting rates trigger a warning. Copy the list or export a quote.

![Combined vehicle and modification costs](docs/screenshots/cart.png)

The calculation is **remaining RP ÷ 10,000 × your rate**, rounded to cents. Partial blocks of 10,000 RP are not rounded up. Vehicle purchase costs in Silver Lions, Golden Eagles and crew training are excluded.

### 6. Ground maps: study the terrain before battle

**[Open ground maps →](https://render.qmuse.pub/p/muse/8645013411493394#/maps)**

The collection currently covers **55 ground maps and 309 mission layouts**. Search by Chinese or English name and see capture-point thumbnails directly in the list. You can also filter for maps with linked guides.

![Ground map list with mission-point thumbnails](docs/screenshots/ground-maps.png)

Open a map for a larger view, switch mission layouts and your team, and toggle contours, mission points, reference grids and layout bounds independently. Pan, zoom and reset the view to study slopes, valleys and the relationships between objectives.

![El Alamein map with contours and mission points](docs/screenshots/ground-map-detail.png)

Where available, links to original guides appear below the map. Older guides may describe a different version or layout; compare them with the current map.

### 7. Tactical drawing: put your battle plan on the map

Open a map and click **Edit routes** to draw your plan. The routes below are drawing examples only.

![Example attack routes, defensive lines, danger areas and sniper positions](docs/screenshots/tactical-drawing.png)

**Draw routes by dragging.** Release to finish; selecting a route opens its properties. Drag endpoints to adjust direction, add intermediate bends, switch to a smooth curve, or change color and width.

**More than basic arrows.** Hollow attack arrows, green defensive lines, front lines, retreat routes, obstacle lines, supply routes and firing-sector lines help distinguish different intentions.

![Tactical line styles and green defensive lines](docs/screenshots/tactical-lines.png)

**Mark key positions separately.** Add sniper positions, observation posts, ambush sites, rally points and supply points with text labels. Draw danger areas as rectangles, ellipses or polygons, and adjust color and opacity.

![Sniper positions, observation posts and other tactical markers](docs/screenshots/tactical-markers.png)

Original War Thunder icons are also available for familiar map markings.

![Original War Thunder icon picker](docs/screenshots/tactical-game-icons.png)

Text annotations support font family, size, weight and italics. Exported images retain the selected typography.

![Text font and style settings](docs/screenshots/map-text-fonts.png)

Save multiple plans for the same map, separated by mission layout and team. Create, save as, rename, switch and delete plans. Legacy drafts are restored as the default plan; imported files create a new plan.

![Managing multiple map plans](docs/screenshots/map-plans.png)

Undo, redo or clear all custom annotations in one click. The original map and mission points remain intact.

Save **2K / 4K images** to share with teammates, or export an editable drawing file and import it later. Canvas annotations are saved automatically in the current browser, separately for each map, layout and team.

### 8. Sales calendar: keep a wishlist and wait for the right price

**[Open the sales calendar →](https://render.qmuse.pub/p/muse/8645013411493394#/sales)**

Follow Golden Eagle and store-pack vehicles to see their regular prices, the next possible sale window and a countdown together. Golden Eagle and CNY pack prices are displayed separately. Packs show the full pack price and verification date; missing quotes are clearly identified.

![Followed vehicles, regular prices and the next sale countdown](docs/screenshots/sales-overview.png)

Filter by **nation, branch, rank and name** when adding vehicles. The wishlist initially shows five vehicles, with expand/collapse controls for the rest. It is stored in the current browser and does not automatically sync across devices.

![Wishlist vehicle picker with nation, branch and rank filters](docs/screenshots/sales-vehicle-picker.png)

**The monthly calendar shows events as continuous translucent bars spanning dates**, including across weeks, without extra continuation labels. Click a bar for dates, scope and announcement sources. Switch to the timeline to organize events by year, month, nation and purchase channel.

![Monthly sales calendar with event date spans](docs/screenshots/sales-month.png)

![Sales timeline and links to announcements](docs/screenshots/sales-timeline.png)

**Upcoming**, **Active** and **Ended** use both color and text. Officially announced schedules are separate from estimates based on previous years; predicted events use dashed outlines and an **Estimated** label. A predicted start range and end range indicate possible start and end dates, not a confirmed sale throughout the entire period.

Candidate start dates carry **High / Medium / Low** relative likelihood labels based on distance from the historical reference date, not statistically calibrated probabilities. Start candidates exclude weekends. Past dates leave the window after midnight Beijing time; a fully expired window is no longer shown as a future event. Moving a weekend reference date to the next weekday is a prediction assumption of this tool. End dates and the sale period itself can still include weekends.

Wishlist countdowns use the **earliest candidate start date that has not passed**, labeled **Until earliest estimated start**. On entering a candidate window, the label becomes **Within the estimated window**. The historical reference date is not treated as the only possible launch date. Event data is cached; calendar refreshes are triggered only by administrators.

Click the page's **Sales calendar heading** to open a high-resolution annual reference chart with rebuilt text and tables. The dialog displays the full chart, with a separate option to view the high-resolution original.

![Recreated annual sales reference chart](docs/screenshots/sales-reference.png)

**Predictions are based only on past sales; official announcements take precedence. Images and sales information were compiled by HeyBox community members.** Current coverage includes PC in-game and Gaijin Store events, which may begin in stages. Console store schedules can differ. **Announced** does not mean every vehicle is included: check the relevant announcement for new-vehicle exclusions, exclusion lists and bundle conditions.

## Before you start

- This is an unofficial community tool. In-game vehicle data, RP, matchmaking and unlock requirements take precedence.
- Incomplete data is flagged for verification; unknown RP is never silently treated as zero.
- Example lineups and tactical routes demonstrate features, not guaranteed optimal tactics. Tactical markers are intended for communication and guide creation.
- Contours, reference grids and briefing points help interpret maps but cannot replace in-battle judgments about traversability, cover and positions.
- Research progress, lineups, carts and drawings are saved in the current browser and do not automatically sync to other devices. Save share codes or export files before clearing browser data.

## Help improve the workbench

Feature suggestions are welcome. For vehicle data issues, include the nation, branch, vehicle name and battle mode. Screenshots help with display problems.

To contribute, see the [maintenance guide](docs/contributing.md). Also available: a [Xiaohongshu illustrated introduction](docs/xiaohongshu.md), [HeyBox ground maps and tactical drawing guide](docs/heybox/战雷陆战地图与走线编辑.md), [HeyBox sales calendar guide](docs/heybox/战雷折扣日历.md) and [HeyBox player stats and account valuation guide](docs/heybox/战雷战绩查询与个人战报.md).

## License and credits

Project code is licensed under the [MIT License](LICENSE), except where a separate license is stated. The War Thunder name, trademarks, game imagery and third-party materials belong to their respective rights holders.

Thanks to the War Thunder Wiki, game-data contributors, guide authors, and players who supplied map materials and feedback.
