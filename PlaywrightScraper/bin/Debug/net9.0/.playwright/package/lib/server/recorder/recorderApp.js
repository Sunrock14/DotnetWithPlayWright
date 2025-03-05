"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RecorderApp = exports.EmptyRecorderApp = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _progress = require("../progress");
var _events = require("events");
var _instrumentation = require("../instrumentation");
var _utils = require("../../utils");
var _utilsBundle = require("../../utilsBundle");
var _launchApp = require("../launchApp");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class EmptyRecorderApp extends _events.EventEmitter {
  constructor(...args) {
    super(...args);
    this.wsEndpointForTest = void 0;
  }
  async close() {}
  async setPaused(paused) {}
  async setMode(mode) {}
  async setRunningFile(file) {}
  async elementPicked(elementInfo, userGesture) {}
  async updateCallLogs(callLogs) {}
  async setSources(sources) {}
  async setActions(actions, sources) {}
}
exports.EmptyRecorderApp = EmptyRecorderApp;
class RecorderApp extends _events.EventEmitter {
  constructor(recorder, page, wsEndpoint) {
    super();
    this._page = void 0;
    this.wsEndpointForTest = void 0;
    this._recorder = void 0;
    this.setMaxListeners(0);
    this._recorder = recorder;
    this._page = page;
    this.wsEndpointForTest = wsEndpoint;
  }
  async close() {
    await this._page.context().close({
      reason: 'Recorder window closed'
    });
  }
  async _init() {
    await (0, _launchApp.syncLocalStorageWithSettings)(this._page, 'recorder');
    await this._page._setServerRequestInterceptor(route => {
      if (!route.request().url().startsWith('https://playwright/')) return false;
      const uri = route.request().url().substring('https://playwright/'.length);
      const file = require.resolve('../../vite/recorder/' + uri);
      _fs.default.promises.readFile(file).then(buffer => {
        route.fulfill({
          status: 200,
          headers: [{
            name: 'Content-Type',
            value: _utilsBundle.mime.getType(_path.default.extname(file)) || 'application/octet-stream'
          }],
          body: buffer.toString('base64'),
          isBase64: true
        }).catch(() => {});
      });
      return true;
    });
    await this._page.exposeBinding('dispatch', false, (_, data) => this.emit('event', data));
    this._page.once('close', () => {
      this.emit('close');
      this._page.context().close({
        reason: 'Recorder window closed'
      }).catch(() => {});
    });
    const mainFrame = this._page.mainFrame();
    await mainFrame.goto((0, _instrumentation.serverSideCallMetadata)(), process.env.PW_HMR ? 'http://localhost:44225' : 'https://playwright/index.html');
  }
  static factory(context) {
    return async recorder => {
      if (process.env.PW_CODEGEN_NO_INSPECTOR) return new EmptyRecorderApp();
      return await RecorderApp._open(recorder, context);
    };
  }
  static async _open(recorder, inspectedContext) {
    const sdkLanguage = inspectedContext.attribution.playwright.options.sdkLanguage;
    const headed = !!inspectedContext._browser.options.headful;
    const recorderPlaywright = require('../playwright').createPlaywright({
      sdkLanguage: 'javascript',
      isInternalPlaywright: true
    });
    const {
      context,
      page
    } = await (0, _launchApp.launchApp)(recorderPlaywright.chromium, {
      sdkLanguage,
      windowSize: {
        width: 600,
        height: 600
      },
      windowPosition: {
        x: 1020,
        y: 10
      },
      persistentContextOptions: {
        noDefaultViewport: true,
        headless: !!process.env.PWTEST_CLI_HEADLESS || (0, _utils.isUnderTest)() && !headed,
        useWebSocket: (0, _utils.isUnderTest)(),
        handleSIGINT: recorder.handleSIGINT,
        executablePath: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.customExecutablePath : undefined
      }
    });
    const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), context._browser);
    await controller.run(async progress => {
      await context._browser._defaultContext._loadDefaultContextAsIs(progress);
    });
    const result = new RecorderApp(recorder, page, context._browser.options.wsEndpoint);
    await result._init();
    return result;
  }
  async setMode(mode) {
    await this._page.mainFrame().evaluateExpression((mode => {
      window.playwrightSetMode(mode);
    }).toString(), {
      isFunction: true
    }, mode).catch(() => {});
  }
  async setRunningFile(file) {
    await this._page.mainFrame().evaluateExpression((file => {
      window.playwrightSetRunningFile(file);
    }).toString(), {
      isFunction: true
    }, file).catch(() => {});
  }
  async setPaused(paused) {
    await this._page.mainFrame().evaluateExpression((paused => {
      window.playwrightSetPaused(paused);
    }).toString(), {
      isFunction: true
    }, paused).catch(() => {});
  }
  async setSources(sources) {
    await this._page.mainFrame().evaluateExpression((sources => {
      window.playwrightSetSources(sources);
    }).toString(), {
      isFunction: true
    }, sources).catch(() => {});

    // Testing harness for runCLI mode.
    if (process.env.PWTEST_CLI_IS_UNDER_TEST && sources.length) {
      if (process._didSetSourcesForTest(sources[0].text)) this.close();
    }
  }
  async setActions(actions, sources) {}
  async elementPicked(elementInfo, userGesture) {
    if (userGesture) this._page.bringToFront();
    await this._page.mainFrame().evaluateExpression((param => {
      window.playwrightElementPicked(param.elementInfo, param.userGesture);
    }).toString(), {
      isFunction: true
    }, {
      elementInfo,
      userGesture
    }).catch(() => {});
  }
  async updateCallLogs(callLogs) {
    await this._page.mainFrame().evaluateExpression((callLogs => {
      window.playwrightUpdateLogs(callLogs);
    }).toString(), {
      isFunction: true
    }, callLogs).catch(() => {});
  }
}
exports.RecorderApp = RecorderApp;