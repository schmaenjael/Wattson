# 🕵️ Wattson, VoltEuropa's Discord Agent

<img src="https://s6.imgcdn.dev/YjxG92.png" width="300" alt="Wattson, circa 2025">

## 📖 Background

> This Bot is the continuation of the discord bot "VoltBot" developed by **fabnem12** and **WhiteBlackGoose**, which is archived starting from version 1.0.0 of Wattson and can be accessed via https://github.com/fabnem12/VoltBot; due to the ever-increasing requirements of the VoltBot, a new start was looked for. This repository aims to restructure the Bot and modernize it to fulfill the requirements of the [Volt Europa Discord Server](https://discord.com/invite/volteuropa).

### 💜 Party Reference

To find out more about our mission at Volt Europa, please refer to [VoltEuropa.org](https://volteuropa.org/)!

## 🔽 Installation & Usage

Clone the repository:

```bash
$ git clone https://github.com/schmaenjael/Wattson
```

Install the dependencies (beware, the project uses `pnpm` instead of `npm`):

```bash
$ pnpm install
```

Navigate to [discord.dev](https://discord.dev) and get a bot token and create a `.env` file with the following content:

```js
TOKEN=[...]
CLIENT_ID=[...]
APPLICATION_ID=[...]
NODE_ENV=[...]
```

Afterwards run the application

```bash
$ npm run dev
```

To deploy the application, we recommend building it first using

```bash
$ npm run build
```

Then reregister the slash commands at the discord API using

```bash
$ npm run script:register-commands
```

And finally deploy it by using `node`. Do not forget to adjust the `.env` file to use `production` instead of `development`.

## 📁 Scaffolding

```bash
storyblok-remix-boilerplate
├── scripts
│   └── register-commands.ts
├── src
│   ├── commands
│   ├── components
│   ├── jobs
│   ├── models
│   └── index.ts
├── types
│   ├── globals.d.ts
│   └── reset.d.ts
├── eslint.config.mjs
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── LICENSE
└── README.md
```

## 🪴 Architecture

To learn about architecture decisions, please refer to the `ARCHITECTURE` documentation.

## 🐛 Bugs

If you have questions, feature requests or a bug you want to report, please click [here](https://github.com/schmaenjael/Wattson/issues) to file an issue.

## ⚒️ Maintainers

- [**schmaenjael**](https://github.com/schmaenjael) [![GitHub followers](https://img.shields.io/github/followers/schmaenjael.svg?style=social)](https://github.com/schmaenjael)

## ⚠️ License

Copyright (c) 2025 VoltEuropa
<br />
Licensed under the GNU General Public License v3.0; for further information refer to the appended `LICENSE`!
