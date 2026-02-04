# VIPReseller Game Codes Reference

## Game Codes for Nickname Validation

These game codes can be used with `getPlayerInfo()` method to validate player IDs and get nicknames:

```javascript
const gameCode = 'mobile-legends';
const result = await adapter.getPlayerInfo(gameCode, playerId, zoneId);
```

### Supported Games:

| Game Name | Code |
|-----------|------|
| Mobile Legends | `mobile-legends` |
| Free Fire | `free-fire` |
| Free Fire Max | `free-fire-max` |
| PUBG Mobile | `pubgm` |
| Genshin Impact * | `genshin-impact` |
| Valorant | `valorant` |
| Call of Duty Mobile | `call-of-duty-mobile` |
| League of Legends: Wild Rift | `league-of-legends-wild-rift` |
| Arena of Valor | `arena-of-valor` |
| Higgs Domino | `higgs-domino` |
| Point Blank | `point-blank` |
| Dragon Raja | `dragon-raja` |
| Hago | `hago` |
| Zepeto | `zepeto` |
| Lords Mobile | `lords-mobile` |
| Marvel Super War | `marvel-super-war` |
| Ragnarok M | `ragnarok-m-eternal-love-big-cat-coin` |
| Speed Drifters | `speed-drifters` |
| Laplace M | `laplace-m` |
| Tom and Jerry: Chase | `tom-and-jerry-chase` |
| IndoPlay | `indoplay` |
| Domino Gaple Boyaa Qiuqiu | `domino-gaple-qiuqiu-boyaa` |
| Cocofun (testing) | `cocofun` |
| 8 Ball Pool (testing) | `8-ball-pool` |
| Auto Chess (testing) | `auto-chess` |
| Bullet Angel (testing) | `bullet-angel` |

\* **Genshin Impact** requires server parameter:
- `os_asia` - Asia Server
- `os_usa` - America Server
- `os_euro` - Europe Server  
- `os_cht` - TW/HK/MO Server

### Usage Example:

```javascript
// Mobile Legends
await adapter.getPlayerInfo('mobile-legends', '123456789', '1234');

// Free Fire
await adapter.getPlayerInfo('free-fire', '123456789');

// Genshin Impact (with server)
await adapter.getPlayerInfo('genshin-impact', '123456789', 'os_asia');
```

## Game Brands for Service Filtering

Use these brand names with `getGameServices()` to fetch available packages:

```javascript
const packages = await adapter.getGameServices('Mobile Legends');
```

### Popular Brands:
- `Mobile Legends`
- `Free Fire`
- `PUBG Mobile`
- `Genshin Impact`
- `Valorant`
- `Call of Duty Mobile`

**Note:** Brand names are case-sensitive and must match exactly as they appear in VIPReseller's system.
