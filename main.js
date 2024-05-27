const { readdirSync, readFileSync, writeFileSync } = require("fs-extra");
const { join, resolve } = require('path');
const { execSync } = require('child_process');
const config = require("./config.json");
const chalk = require("chalk");
const login = require('./includes/fca-disme');
const listPackage = JSON.parse(readFileSync('./package.json')).dependencies;
const fs = require("fs");
const moment = require("moment-timezone");
const logger = require("./utils/log.js");

global.client = new Object({
    commands: new Map(),
    events: new Map(),
    cooldowns: new Map(),
    eventRegistered: new Array(),
    handleSchedule: new Array(),
    handleReaction: new Array(),
    handleReply: new Array(),
    mainPath: process.cwd(),
    configPath: new String(),
    getTime: function (option) {
        switch (option) {
        case "seconds":
            return `${moment.tz("Asia/Ho_Chi_minh").format("ss")}`;
        case "minutes":
            return `${moment.tz("Asia/Ho_Chi_minh").format("mm")}`;
        case "hours":
            return `${moment.tz("Asia/Ho_Chi_minh").format("HH")}`;
        case "date":
            return `${moment.tz("Asia/Ho_Chi_minh").format("DD")}`;
        case "month":
            return `${moment.tz("Asia/Ho_Chi_minh").format("MM")}`;
        case "year":
            return `${moment.tz("Asia/Ho_Chi_minh").format("YYYY")}`;
        case "fullHour":
            return `${moment.tz("Asia/Ho_Chi_minh").format("HH:mm:ss")}`;
        case "fullYear":
            return `${moment.tz("Asia/Ho_Chi_minh").format("DD/MM/YYYY")}`;
        case "fullTime":
            return `${moment.tz("Asia/Ho_Chi_minh").format("HH:mm:ss DD/MM/YYYY")}`;
        }
    },
    timeStart: Date.now()
});

global.data = new Object({
    threadInfo: new Map(),
    threadData: new Map(),
    userName: new Map(),
    userBanned: new Map(),
    threadBanned: new Map(),
    commandBanned: new Map(),
    threadAllowNSFW: new Array(),
    allUserID: new Array(),
    allCurrenciesID: new Array(),
    allThreadID: new Array()
});

global.utils = require("./utils");

global.loading = require("./utils/log");

global.nodemodule = new Object();

global.config = new Object();

global.configModule = new Object();

global.moduleData = new Array();

global.language = new Object();

global.account = new Object();

var configValue;
try {
    global.client.configPath = join(global.client.mainPath, "config.json");
    configValue = require(global.client.configPath);
    logger.loader("Found config.json file!");
} catch (e) {
    return logger.loader('"config.json" file not found."', "error");
}

try {
    for (const key in configValue) global.config[key] = configValue[key];
    logger.loader("Config Loaded!");
} catch (e) {
    return logger.loader("Can't load file config!", "error");
}

for (const property in listPackage) {
    try {
        global.nodemodule[property] = require(property);
    } catch (e) {}
}
const langFile = (readFileSync(`${__dirname}/languages/${global.config.language || "en"}.lang`, {
    encoding: 'utf-8'
})).split(/\r?\n|\r/);
const langData = langFile.filter(item => item.indexOf('#') != 0 && item != '');
for (const item of langData) {
    const getSeparator = item.indexOf('=');
    const itemKey = item.slice(0, getSeparator);
    const itemValue = item.slice(getSeparator + 1, item.length);
    const head = itemKey.slice(0, itemKey.indexOf('.'));
    const key = itemKey.replace(head + '.', '');
    const value = itemValue.replace(/\\n/gi, '\n');
    if (typeof global.language[head] == "undefined") global.language[head] = new Object();
    global.language[head][key] = value;
}

global.getText = function (...args) {
    const langText = global.language;
    if (!langText.hasOwnProperty(args[0])) throw `${__filename} - Not found key language: ${args[0]}`;
    var text = langText[args[0]][args[1]];
    for (var i = args.length - 1; i > 0; i--) {
        const regEx = RegExp(`%${i}`, 'g');
        text = text.replace(regEx, args[i + 1]);
    }
    return text;
}

try {
    var appStateFile = resolve(join(global.client.mainPath, config.APPSTATEPATH || "appstate.json"));
    var appState = ((process.env.REPL_OWNER || process.env.PROCESSOR_IDENTIFIER) && (fs.readFileSync(appStateFile, 'utf8'))[0] != "[" && config.encryptSt) ? JSON.parse(global.utils.decryptState(fs.readFileSync(appStateFile, 'utf8'), (process.env.REPL_OWNER || process.env.PROCESSOR_IDENTIFIER))) : require(appStateFile);
    logger.loader("Found the bot's appstate file.");
} catch (e) {
    return logger.loader("Can't find the bot's appstate file.", "error");
}

const PORT = process.env.PORT || 3000;

function onBot() {
    const loginData = {};
    loginData.appState = appState;
    login(loginData, async (loginError, loginApiData) => {
        if (loginError) {
            if (loginError.error == 'Error retrieving userID. This can be caused by a lot of things, including getting blocked by Facebook for logging in from an unknown location. Try logging in with a browser to verify.') {
                console.log(loginError.error);
                process.exit(0);
            } else {
                console.log(loginError);
                return process.exit(0);
            }
        }
        console.log(chalk.blue(`============== LOGIN BOT ==============`));
        const fbstate = loginApiData.getAppState();
        loginApiData.setOptions(global.config.FCAOption);
        let d = loginApiData.getAppState();
        d = JSON.stringify(d, null, '\x09');
        if ((process.env.REPL_OWNER || process.env.PROCESSOR_IDENTIFIER) && global.config.encryptSt) {
            d = await global.utils.encryptState(d, process.env.REPL_OWNER || process.env.PROCESSOR_IDENTIFIER);
            writeFileSync(appStateFile, d);
        } else {
            writeFileSync(appStateFile, d);
        }
        global.account.cookie = fbstate.map(i => i = i.key + "=" + i.value).join(";");
        global.client.api = loginApiData;
        global.config.version = config.version,
        (async () => {
            const commandsPath = `${global.client.mainPath}/modules/commands`;
            const listCommand = readdirSync(commandsPath).filter(command => command.endsWith('.js') && !command.includes('example') && !global.config.commandDisabled.includes(command));
            console.log(chalk.blue(`============ LOADING COMMANDS ============`));
            for (const command of listCommand) {
                try {
                    const module = require(`${commandsPath}/${command}`);
                    const { config } = module;

                    if (!config?.commandCategory) {
                        console.log(chalk.red(`[COMMAND] ${chalk.hex("#FFFF00")(command)} Module is not in the correct format!`));
                        continue;
                    }
                    if (global.client.commands.has(config.name || '')) {
                        console.log(chalk.red(`[COMMAND] ${chalk.hex("#FFFF00")(command)} Module is already loaded!`));
                        continue;
                    }
                    const { dependencies, envConfig } = config;
                    if (dependencies) {
                        Object.entries(dependencies).forEach(([reqDependency, dependencyVersion]) => {
                            if (listPackage[reqDependency]) return;
                            try {
                                execSync(`npm --package-lock false --save install ${reqDependency}${dependencyVersion ? `@${dependencyVersion}` : ''}`, {
                                    stdio: 'inherit',
                                    env: process.env,
                                    shell: true,
                                    cwd: join(__dirname, 'node_modules')
                                });
                                require.cache = {};
                            } catch (error) {
                                const errorMessage = `[PACKAGE] Failed to install package ${reqDependency} for module`;
                                global.loading.err(chalk.hex('#ff7100')(errorMessage), 'LOADED');
                            }
                        });
                    }

                    if (envConfig) {
                        const moduleName = config.name;
                        global.configModule[moduleName] = global.configModule[moduleName] || {};
                        global.config[moduleName] = global.config[moduleName] || {};
                        for (const envConfigKey in envConfig) {
                            global.configModule[moduleName][envConfigKey] = global.config[moduleName][envConfigKey] ?? envConfig[envConfigKey];
                            global.config[moduleName][envConfigKey] = global.config[moduleName][envConfigKey] ?? envConfig[envConfigKey];
                        }
                        var configPath = require('./config.json');
                        configPath[moduleName] = envConfig;
                        writeFileSync(global.client.configPath, JSON.stringify(configPath, null, 4), 'utf-8');
                    }

                    if (module.onLoad) {
                        const moduleData = {
                            api: loginApiData
                        };
                        try {
                                                        module.onLoad(moduleData);
                        } catch (error) {
                            console.log(chalk.red(`[COMMAND] ${chalk.hex("#FFFF00")(command)} Failed to load onLoad!`));
                        }
                    }

                    global.client.commands.set(config.name, module);
                    console.log(chalk.hex("#00FF00")(`[COMMAND] ${chalk.hex("#FFFF00")(command)} Loaded successfully!`));
                } catch (error) {
                    console.log(chalk.red(`[COMMAND] ${chalk.hex("#FFFF00")(command)} Failed to load!`));
                }
            }

            const eventsPath = `${global.client.mainPath}/modules/events`;
            const listEvent = readdirSync(eventsPath).filter(event => event.endsWith('.js') && !event.includes('example') && !global.config.eventDisabled.includes(event));
            console.log(chalk.blue(`============ LOADING EVENTS ============`));
            for (const event of listEvent) {
                try {
                    const module = require(`${eventsPath}/${event}`);
                    const { config } = module;

                    if (!config?.eventName) {
                        console.log(chalk.red(`[EVENT] ${chalk.hex("#FFFF00")(event)} Module is not in the correct format!`));
                        continue;
                    }
                    if (global.client.events.has(config.eventName || '')) {
                        console.log(chalk.red(`[EVENT] ${chalk.hex("#FFFF00")(event)} Module is already loaded!`));
                        continue;
                    }
                    global.client.events.set(config.eventName, module);
                    console.log(chalk.hex("#00FF00")(`[EVENT] ${chalk.hex("#FFFF00")(event)} Loaded successfully!`));
                } catch (error) {
                    console.log(chalk.red(`[EVENT] ${chalk.hex("#FFFF00")(event)} Failed to load!`));
                }
            }

            console.log(chalk.blue(`============ BOT READY ============`));
            global.client.api.listenMqtt((error, message) => {
                if (error) {
                    console.log(chalk.red(`Listen Error: ${error.message}`));
                    return;
                }
                try {
                    const handleEvent = global.client.events.get(message.type);
                    if (handleEvent) handleEvent.run({ api: global.client.api, message });
                } catch (error) {
                    console.log(chalk.red(`Handle Message Error: ${error.message}`));
                }
            });
        })();
    });
}

onBot();

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

