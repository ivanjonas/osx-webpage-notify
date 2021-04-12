import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { chromium as chrome, Page } from "playwright";

type Watcher = {
  name: string;
  url: string;
  actions?: string[] | string[][];
  takeScreenshot?: boolean;
  useTerminalNotifier?: boolean;
  waitForText?: {
    isPresent?: boolean;
    text: string;
  };
};
type Config = {
  defaultActions?: string[] | string[][];
  sendSms?: string[];
  smsPath?: string;
  takeScreenshot?: boolean;
  terminalNotifierPath?: string;
  useTerminalNotifier?: boolean;
  watchers: Watcher[];
};

const config: Config = require("./config.json");

const Logger = (name: string) => {
  const helper = (severity: "log" | "error" | "debug") => (message: any) => {
    // const formattedMessage = `[${name}] ${JSON.stringify(message, null, 2)}`;
    const dateString = new Date().toLocaleString("en", {
      timeZoneName: "short",
    });
    console[severity](`[${dateString}] [${name}]`, message);
  };

  const log = helper("debug");
  const debug = helper("debug");
  const error = helper("error");

  return {
    log,
    error,
    debug,
  };
};
const nonInstancedLogger = Logger("scrape");

const instance = async (
  defaultConfig: Omit<Config, "watchers">,
  watcherConfig: Watcher
) => {
  const {
    name,
    url,
    waitForText: { text, isPresent },
  } = watcherConfig;
  const takeScreenshot =
    (defaultConfig.takeScreenshot || watcherConfig.takeScreenshot) &&
    watcherConfig.takeScreenshot !== false;
  const useTerminalNotifier =
    (defaultConfig.useTerminalNotifier || watcherConfig.useTerminalNotifier) &&
    watcherConfig.useTerminalNotifier !== false;
  const logger = Logger(name);
  const dataDir = `.private/${name}`;
  const foundFile = `${dataDir}/FOUND`;

  logger.log("Checking...");

  mkdirSync(dataDir, { recursive: true });

  if (existsSync(foundFile)) {
    logger.log(`Already found.`);
    return;
  }

  const waitForText = async (page: Page, text: string, timeout = 15000) => {
    try {
      await page.waitForLoadState("networkidle", { timeout });
      await page.waitForSelector(`text=${text}`, { timeout });
      return true;
    } catch (e) {
      if (e.name === "TimeoutError") {
        return false;
      }
      logger.log(e);
      return false;
    }
  };

  const scrape = async (
    name: string,
    url: string,
    searchString: string,
    waitForTextToBePresent = false
  ) => {
    const browser = await chrome.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setViewportSize({
      width: 1440,
      height: 2560,
    });

    try {
      // logger.log({
      //   name,
      //   url,
      //   searchString,
      //   waitForTextToBePresent,
      // });
      const [request] = await Promise.all([
        page.goto(url, {
          timeout: 15000,
          waitUntil: "networkidle",
        }),
      ]);

      const textIsPresent = await waitForText(page, searchString, 15000);
      const conditionMet = waitForTextToBePresent
        ? textIsPresent === true
        : textIsPresent === false;

      if (takeScreenshot) {
        const screenshotPath = `${dataDir}/${name}_${
          (conditionMet && "AVAILABLE") || "UNAVAILABLE"
        }.png`;
        await page.screenshot({
          path: screenshotPath,
        });
      }

      return conditionMet;
    } catch (e) {
      logger.error(e);
    } finally {
      await browser.close();
    }
  };

  const conditionMet = await scrape(name, url, text, isPresent);

  logger.log(
    `[${(conditionMet && "AVAILABLE") || "No appointments"}] text "${
      watcherConfig.waitForText.text
    }" was ${
      (((conditionMet && isPresent) || (!conditionMet && !isPresent)) &&
        "FOUND") ||
      "NOT found"
    }`
  );

  if (conditionMet) {
    execSync(`touch "${foundFile}"`);

    const replaceVariables = (str: string) =>
      str.replace("%URL%", url).replace("%NAME%", `${name}`);
    const actions = watcherConfig.actions?.length
      ? watcherConfig.actions
      : defaultConfig.defaultActions ?? [];
    const updatedActions = actions.map((action: string | string[]) => {
      if (Array.isArray(action)) {
        return replaceVariables(action.join(" "));
      }
      return replaceVariables(action);
    });

    logger.log({
      actions,
      updatedActions,
    });

    if (useTerminalNotifier) {
      if (!defaultConfig.terminalNotifierPath) {
        logger.error(`Missing setting for "terminalNotifierPath"`);
        return;
      }
      const subtitle = isPresent
        ? `Found the text: '${text}'`
        : `Did not find the text: '${text}'`;
      const terminalNotifierCommand = [
        defaultConfig.terminalNotifierPath,
        `-title "Covid Alert! [${name}]"`,
        `-subtitle "${subtitle}"`,
        "-sound sosumi",
        `-open "${url}"`,
      ].join(" ");
      execSync(terminalNotifierCommand);
    }

    if (defaultConfig.sendSms?.length) {
      if (!defaultConfig.smsPath) {
        logger.error(`Missing setting for "smsPath"`);
        return;
      }
      defaultConfig.sendSms.forEach((phoneNumber) => {
        const smsCommand = [
          defaultConfig.smsPath,
          phoneNumber,
          `\"Book a vaccine appointment! [${name}] ${url}\"`,
        ].join(" ");
        execSync(smsCommand);
      });
    }

    updatedActions.forEach(execSync);
  }
};

try {
  (async () => {
    const { watchers, ...defaultConfig } = config;
    return await Promise.all(
      watchers.map((watcher) => instance(defaultConfig, watcher))
    );
  })();
} catch (e) {
  nonInstancedLogger.log(e);
}

export {};
