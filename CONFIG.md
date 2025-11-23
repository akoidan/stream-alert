# 'Config

## Camera

_Object containing the following properties:_

| Property    | Description                                                | Type                       | Default                |
| :---------- | :--------------------------------------------------------- | :------------------------- | :--------------------- |
| `name`      | 📹 Camera name (e.g., "OBS Virtual Camera" or your webcam) | `string` (_min length: 1_) | `'OBS Virtual Camera'` |
| `frameRate` | 🎬 Frame rate in frames per second (recommended: 1-5)      | `number` (_>0_)            | `1`                    |

_All properties are optional._

## Config

_Object containing the following properties:_

| Property            | Type                  |
| :------------------ | :-------------------- |
| **`telegram`** (\*) | [Telegram](#telegram) |
| **`camera`** (\*)   | [Camera](#camera)     |
| **`diff`** (\*)     | [Diff](#diff)         |

_(\*) Required._

## Diff

_Object containing the following properties:_

| Property    | Description                                            | Type                | Default |
| :---------- | :----------------------------------------------------- | :------------------ | :------ |
| `pixels`    | 🔍 Minimum changed pixels required to trigger an alert | `number` (_>0_)     | `1000`  |
| `threshold` | 🎯 Change sensitivity level, lower = more aggressive   | `number` (_≥0, ≤1_) | `0.1`   |

_All properties are optional._

## Telegram

_Object containing the following properties:_

| Property          | Description                                                                        | Type                                               | Default              |
| :---------------- | :--------------------------------------------------------------------------------- | :------------------------------------------------- | :------------------- |
| **`token`** (\*)  | 🔑 Bot token from @BotFather - required for Telegram bot authentication            | `string` (_regex: `/^\d{10}:[a-zA-Z0-9_-]{35}$/`_) |                      |
| **`chatId`** (\*) | 💬 Your Telegram chat ID - get it from @userinfobot                                | `number` (_int, ≥10001_)                           |                      |
| `spamDelay`       | ⏱️ Delay between alerts in seconds - short delay will result in many notifications | `number` (_≥0_)                                    | `300`                |
| `message`         | 📨 Alert message text sent when motion is detected                                 | `string` (_min length: 1_)                         | `'Changes detected'` |
| `initialDelay`    | ⏰ Initial delay before starting motion detection                                   | `number` (_≥0_)                                    | `10`                 |

_(\*) Required._
