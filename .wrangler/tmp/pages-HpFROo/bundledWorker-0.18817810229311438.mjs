var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y2, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// ../../../../../../.nvm/versions/node/v24.11.1/lib/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// _worker.js/index.js
import("node:buffer").then(({ Buffer: Buffer2 }) => {
  globalThis.Buffer = Buffer2;
}).catch(() => null);
var __ALSes_PROMISE__ = import("node:async_hooks").then(({ AsyncLocalStorage }) => {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
  const envAsyncLocalStorage = new AsyncLocalStorage();
  const requestContextAsyncLocalStorage = new AsyncLocalStorage();
  globalThis.process = {
    env: new Proxy(
      {},
      {
        ownKeys: /* @__PURE__ */ __name(() => Reflect.ownKeys(envAsyncLocalStorage.getStore()), "ownKeys"),
        getOwnPropertyDescriptor: /* @__PURE__ */ __name((_2, ...args) => Reflect.getOwnPropertyDescriptor(envAsyncLocalStorage.getStore(), ...args), "getOwnPropertyDescriptor"),
        get: /* @__PURE__ */ __name((_2, property) => Reflect.get(envAsyncLocalStorage.getStore(), property), "get"),
        set: /* @__PURE__ */ __name((_2, property, value) => Reflect.set(envAsyncLocalStorage.getStore(), property, value), "set")
      }
    )
  };
  globalThis[/* @__PURE__ */ Symbol.for("__cloudflare-request-context__")] = new Proxy(
    {},
    {
      ownKeys: /* @__PURE__ */ __name(() => Reflect.ownKeys(requestContextAsyncLocalStorage.getStore()), "ownKeys"),
      getOwnPropertyDescriptor: /* @__PURE__ */ __name((_2, ...args) => Reflect.getOwnPropertyDescriptor(requestContextAsyncLocalStorage.getStore(), ...args), "getOwnPropertyDescriptor"),
      get: /* @__PURE__ */ __name((_2, property) => Reflect.get(requestContextAsyncLocalStorage.getStore(), property), "get"),
      set: /* @__PURE__ */ __name((_2, property, value) => Reflect.set(requestContextAsyncLocalStorage.getStore(), property, value), "set")
    }
  );
  return { envAsyncLocalStorage, requestContextAsyncLocalStorage };
}).catch(() => null);
var ne = Object.create;
var V = Object.defineProperty;
var re = Object.getOwnPropertyDescriptor;
var ae = Object.getOwnPropertyNames;
var ie = Object.getPrototypeOf;
var oe = Object.prototype.hasOwnProperty;
var E = /* @__PURE__ */ __name((e, t) => () => (e && (t = e(e = 0)), t), "E");
var U = /* @__PURE__ */ __name((e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports), "U");
var ce = /* @__PURE__ */ __name((e, t, n, s) => {
  if (t && typeof t == "object" || typeof t == "function") for (let a of ae(t)) !oe.call(e, a) && a !== n && V(e, a, { get: /* @__PURE__ */ __name(() => t[a], "get"), enumerable: !(s = re(t, a)) || s.enumerable });
  return e;
}, "ce");
var F = /* @__PURE__ */ __name((e, t, n) => (n = e != null ? ne(ie(e)) : {}, ce(t || !e || !e.__esModule ? V(n, "default", { value: e, enumerable: true }) : n, e)), "F");
var m;
var p = E(() => {
  m = { collectedLocales: [] };
});
var _;
var u = E(() => {
  _ = { version: 3, routes: { none: [{ src: "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$", headers: { Location: "/$1" }, status: 308, continue: true }, { src: "^/_next/__private/trace$", dest: "/404", status: 404, continue: true }, { src: "^/404/?$", status: 404, continue: true, missing: [{ type: "header", key: "x-prerender-revalidate" }] }, { src: "^/500$", status: 500, continue: true }, { src: "^/?$", has: [{ type: "header", key: "rsc", value: "1" }], dest: "/index.rsc", headers: { vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" }, continue: true, override: true }, { src: "^/((?!.+\\.rsc).+?)(?:/)?$", has: [{ type: "header", key: "rsc", value: "1" }], dest: "/$1.rsc", headers: { vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" }, continue: true, override: true }], filesystem: [{ src: "^/index(\\.action|\\.rsc)$", dest: "/", continue: true }, { src: "^/_next/data/(.*)$", dest: "/_next/data/$1", check: true }, { src: "^/\\.prefetch\\.rsc$", dest: "/__index.prefetch.rsc", check: true }, { src: "^/(.+)/\\.prefetch\\.rsc$", dest: "/$1.prefetch.rsc", check: true }, { src: "^/\\.rsc$", dest: "/index.rsc", check: true }, { src: "^/(.+)/\\.rsc$", dest: "/$1.rsc", check: true }], miss: [{ src: "^/_next/static/.+$", status: 404, check: true, dest: "/_next/static/not-found.txt", headers: { "content-type": "text/plain; charset=utf-8" } }], rewrite: [{ src: "^/_next/data/(.*)$", dest: "/404", status: 404 }, { src: "^/api/auth/accounts/(?<nxtPaccountId>[^/]+?)(?:\\.rsc)(?:/)?$", dest: "/api/auth/accounts/[accountId].rsc?nxtPaccountId=$nxtPaccountId" }, { src: "^/api/auth/accounts/(?<nxtPaccountId>[^/]+?)(?:/)?$", dest: "/api/auth/accounts/[accountId]?nxtPaccountId=$nxtPaccountId" }], resource: [{ src: "^/.*$", status: 404 }], hit: [{ src: "^/_next/static/(?:[^/]+/pages|pages|chunks|runtime|css|image|media|Xe3X7yEVdFhKKM90D7VtX)/.+$", headers: { "cache-control": "public,max-age=31536000,immutable" }, continue: true, important: true }, { src: "^/index(?:/)?$", headers: { "x-matched-path": "/" }, continue: true, important: true }, { src: "^/((?!index$).*?)(?:/)?$", headers: { "x-matched-path": "/$1" }, continue: true, important: true }], error: [{ src: "^/.*$", dest: "/404", status: 404 }, { src: "^/.*$", dest: "/500", status: 500 }] }, images: { domains: [], sizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840, 32, 48, 64, 96, 128, 256, 384], qualities: [75], remotePatterns: [{ protocol: "https", hostname: "^(?:^(?:img3\\.doubanio\\.com)$)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:^(?:img1\\.doubanio\\.com)$)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:^(?:img2\\.doubanio\\.com)$)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:^(?:img9\\.doubanio\\.com)$)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.com\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.com\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.cn\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.cn\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.net\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.net\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.org\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.org\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.tv\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.tv\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.io\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.io\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.xyz\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.xyz\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.online\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.online\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "http", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.top\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }, { protocol: "https", hostname: "^(?:(?!\\.)(?:(?:(?!(?:^|\\/)\\.).)*?)\\.top\\/?)$", pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$" }], localPatterns: [{ pathname: "^(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$))(?:(?:(?!(?:^|\\/)\\.{1,2}(?:\\/|$)).)*?)\\/?)$", search: "" }], minimumCacheTTL: 60, formats: ["image/webp"], dangerouslyAllowSVG: false, contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;", contentDispositionType: "attachment" }, overrides: { "404.html": { path: "404", contentType: "text/html; charset=utf-8" }, "500.html": { path: "500", contentType: "text/html; charset=utf-8" }, "404.rsc.json": { path: "404.rsc", contentType: "application/json" }, "500.rsc.json": { path: "500.rsc", contentType: "application/json" }, "_next/static/not-found.txt": { contentType: "text/plain" } }, framework: { version: "16.2.12" }, crons: [] };
});
var f;
var l = E(() => {
  f = { "/404.html": { type: "override", path: "/404.html", headers: { "content-type": "text/html; charset=utf-8" } }, "/404.rsc.json": { type: "override", path: "/404.rsc.json", headers: { "content-type": "application/json" } }, "/500.html": { type: "override", path: "/500.html", headers: { "content-type": "text/html; charset=utf-8" } }, "/500.rsc.json": { type: "override", path: "/500.rsc.json", headers: { "content-type": "application/json" } }, "/_next/static/Xe3X7yEVdFhKKM90D7VtX/_buildManifest.js": { type: "static" }, "/_next/static/Xe3X7yEVdFhKKM90D7VtX/_ssgManifest.js": { type: "static" }, "/_next/static/chunks/3662-d5458e75500c9fd4.js": { type: "static" }, "/_next/static/chunks/3750-8e91f4ec31345106.js": { type: "static" }, "/_next/static/chunks/3794-54c029a39ed2fc32.js": { type: "static" }, "/_next/static/chunks/4892-b145d930805ceac4.js": { type: "static" }, "/_next/static/chunks/4bd1b696-c2f6e0877b6c10aa.js": { type: "static" }, "/_next/static/chunks/5014-adce990da2b2c061.js": { type: "static" }, "/_next/static/chunks/544-5e4001cb12728c00.js": { type: "static" }, "/_next/static/chunks/647-31322aa055087a53.js": { type: "static" }, "/_next/static/chunks/7048-cc6e6f494947da0c.js": { type: "static" }, "/_next/static/chunks/7372-f5ddc0541852f810.js": { type: "static" }, "/_next/static/chunks/7405-3823245d456f9cca.js": { type: "static" }, "/_next/static/chunks/7786-5fc7e0b343b2a14a.js": { type: "static" }, "/_next/static/chunks/7841-bb966b7dd602de55.js": { type: "static" }, "/_next/static/chunks/8500-3953cc33eeceb44e.js": { type: "static" }, "/_next/static/chunks/a4634e51-45a521d3fc58f48d.js": { type: "static" }, "/_next/static/chunks/app/_global-error/page-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/_not-found/page-7d525abe2f073747.js": { type: "static" }, "/_next/static/chunks/app/api/app-update/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/auth/accounts/[accountId]/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/auth/accounts/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/auth/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/auth/session/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/cast/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/cast/ticket/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/config/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/danmaku/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/detail/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/douban/collection/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/douban/filter/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/douban/image/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/douban/recommend/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/douban/tags/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/iptv/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/iptv/stream/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/ping/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/premium/category/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/premium/types/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/probe-resolution/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/proxy/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/search-parallel/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/user/config/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/api/user/sync/route-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/browse/page-5f8325f9772d6a92.js": { type: "static" }, "/_next/static/chunks/app/favorites/page-df9cae3cb3c31c02.js": { type: "static" }, "/_next/static/chunks/app/iptv/layout-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/iptv/page-1250dd7cfe4ead14.js": { type: "static" }, "/_next/static/chunks/app/layout-766796bede7f13aa.js": { type: "static" }, "/_next/static/chunks/app/page-69243cb4476564f9.js": { type: "static" }, "/_next/static/chunks/app/player/layout-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/app/player/page-860ea31e66fe0d52.js": { type: "static" }, "/_next/static/chunks/app/premium/favorites/page-d70cf7fae3889e4d.js": { type: "static" }, "/_next/static/chunks/app/premium/page-27b44ae61b84b222.js": { type: "static" }, "/_next/static/chunks/app/premium/settings/page-74dd0bcfa9b038e4.js": { type: "static" }, "/_next/static/chunks/app/settings/page-2ba6c30cb563b8ea.js": { type: "static" }, "/_next/static/chunks/f788f2b5.2d071faae01e5698.js": { type: "static" }, "/_next/static/chunks/framework-d1de002210ddaaef.js": { type: "static" }, "/_next/static/chunks/main-app-6058069701fdd17f.js": { type: "static" }, "/_next/static/chunks/main-de74f31c66e3f6ce.js": { type: "static" }, "/_next/static/chunks/next/dist/client/components/builtin/app-error-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/next/dist/client/components/builtin/forbidden-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/next/dist/client/components/builtin/global-error-103a094c14f1b9a8.js": { type: "static" }, "/_next/static/chunks/next/dist/client/components/builtin/not-found-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/next/dist/client/components/builtin/unauthorized-996195530b4d2384.js": { type: "static" }, "/_next/static/chunks/polyfills-42372ed130431b0a.js": { type: "static" }, "/_next/static/chunks/webpack-c3545b234939bc44.js": { type: "static" }, "/_next/static/css/513749afdccbb60a.css": { type: "static" }, "/_next/static/css/936ac5c3b9e259db.css": { type: "static" }, "/_next/static/not-found.txt": { type: "static" }, "/icon.png": { type: "static" }, "/manifest.json": { type: "static" }, "/placeholder-poster.svg": { type: "static" }, "/sw.js": { type: "static" }, "/api/app-update": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/app-update.func.js" }, "/api/app-update.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/app-update.func.js" }, "/api/auth/accounts/[accountId]": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth/accounts/[accountId].func.js" }, "/api/auth/accounts/[accountId].rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth/accounts/[accountId].func.js" }, "/api/auth/accounts": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth/accounts.func.js" }, "/api/auth/accounts.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth/accounts.func.js" }, "/api/auth/session": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth/session.func.js" }, "/api/auth/session.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth/session.func.js" }, "/api/auth": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth.func.js" }, "/api/auth.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/auth.func.js" }, "/api/cast/ticket": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/cast/ticket.func.js" }, "/api/cast/ticket.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/cast/ticket.func.js" }, "/api/cast": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/cast.func.js" }, "/api/cast.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/cast.func.js" }, "/api/config": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/config.func.js" }, "/api/config.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/config.func.js" }, "/api/danmaku": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/danmaku.func.js" }, "/api/danmaku.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/danmaku.func.js" }, "/api/detail": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/detail.func.js" }, "/api/detail.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/detail.func.js" }, "/api/douban/collection": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/collection.func.js" }, "/api/douban/collection.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/collection.func.js" }, "/api/douban/filter": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/filter.func.js" }, "/api/douban/filter.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/filter.func.js" }, "/api/douban/image": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/image.func.js" }, "/api/douban/image.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/image.func.js" }, "/api/douban/recommend": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/recommend.func.js" }, "/api/douban/recommend.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/recommend.func.js" }, "/api/douban/tags": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/tags.func.js" }, "/api/douban/tags.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/douban/tags.func.js" }, "/api/iptv/stream": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/iptv/stream.func.js" }, "/api/iptv/stream.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/iptv/stream.func.js" }, "/api/iptv": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/iptv.func.js" }, "/api/iptv.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/iptv.func.js" }, "/api/ping": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/ping.func.js" }, "/api/ping.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/ping.func.js" }, "/api/premium/category": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/premium/category.func.js" }, "/api/premium/category.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/premium/category.func.js" }, "/api/premium/types": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/premium/types.func.js" }, "/api/premium/types.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/premium/types.func.js" }, "/api/probe-resolution": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/probe-resolution.func.js" }, "/api/probe-resolution.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/probe-resolution.func.js" }, "/api/proxy": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/proxy.func.js" }, "/api/proxy.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/proxy.func.js" }, "/api/search-parallel": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/search-parallel.func.js" }, "/api/search-parallel.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/search-parallel.func.js" }, "/api/user/config": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/user/config.func.js" }, "/api/user/config.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/user/config.func.js" }, "/api/user/sync": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/user/sync.func.js" }, "/api/user/sync.rsc": { type: "function", entrypoint: "__next-on-pages-dist__/functions/api/user/sync.func.js" }, "/404": { type: "override", path: "/404.html", headers: { "content-type": "text/html; charset=utf-8" } }, "/500": { type: "override", path: "/500.html", headers: { "content-type": "text/html; charset=utf-8" } }, "/404.rsc": { type: "override", path: "/404.rsc.json", headers: { "content-type": "application/json" } }, "/500.rsc": { type: "override", path: "/500.rsc.json", headers: { "content-type": "application/json" } }, "/_global-error.html": { type: "override", path: "/_global-error.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/_global-error/layout,_N_T_/_global-error/page,_N_T_/_global-error", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/_global-error": { type: "override", path: "/_global-error.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/_global-error/layout,_N_T_/_global-error/page,_N_T_/_global-error", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/_global-error.rsc": { type: "override", path: "/_global-error.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/_global-error/layout,_N_T_/_global-error/page,_N_T_/_global-error", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/_not-found.html": { type: "override", path: "/_not-found.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/_not-found/layout,_N_T_/_not-found/page,_N_T_/_not-found", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/_not-found": { type: "override", path: "/_not-found.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/_not-found/layout,_N_T_/_not-found/page,_N_T_/_not-found", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/_not-found.rsc": { type: "override", path: "/_not-found.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/_not-found/layout,_N_T_/_not-found/page,_N_T_/_not-found", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/browse.html": { type: "override", path: "/browse.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/browse/layout,_N_T_/browse/page,_N_T_/browse", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/browse": { type: "override", path: "/browse.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/browse/layout,_N_T_/browse/page,_N_T_/browse", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/browse.rsc": { type: "override", path: "/browse.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/browse/layout,_N_T_/browse/page,_N_T_/browse", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/favorites.html": { type: "override", path: "/favorites.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/favorites/layout,_N_T_/favorites/page,_N_T_/favorites", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/favorites": { type: "override", path: "/favorites.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/favorites/layout,_N_T_/favorites/page,_N_T_/favorites", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/favorites.rsc": { type: "override", path: "/favorites.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/favorites/layout,_N_T_/favorites/page,_N_T_/favorites", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/index.html": { type: "override", path: "/index.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/page,_N_T_/,_N_T_/index", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/index": { type: "override", path: "/index.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/page,_N_T_/,_N_T_/index", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/": { type: "override", path: "/index.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/page,_N_T_/,_N_T_/index", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/index.rsc": { type: "override", path: "/index.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/page,_N_T_/,_N_T_/index", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/iptv.html": { type: "override", path: "/iptv.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/iptv/layout,_N_T_/iptv/page,_N_T_/iptv", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/iptv": { type: "override", path: "/iptv.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/iptv/layout,_N_T_/iptv/page,_N_T_/iptv", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/iptv.rsc": { type: "override", path: "/iptv.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/iptv/layout,_N_T_/iptv/page,_N_T_/iptv", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/player.html": { type: "override", path: "/player.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/player/layout,_N_T_/player/page,_N_T_/player", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/player": { type: "override", path: "/player.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/player/layout,_N_T_/player/page,_N_T_/player", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/player.rsc": { type: "override", path: "/player.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/player/layout,_N_T_/player/page,_N_T_/player", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/premium/favorites.html": { type: "override", path: "/premium/favorites.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/favorites/layout,_N_T_/premium/favorites/page,_N_T_/premium/favorites", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/premium/favorites": { type: "override", path: "/premium/favorites.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/favorites/layout,_N_T_/premium/favorites/page,_N_T_/premium/favorites", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/premium/favorites.rsc": { type: "override", path: "/premium/favorites.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/favorites/layout,_N_T_/premium/favorites/page,_N_T_/premium/favorites", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/premium/settings.html": { type: "override", path: "/premium/settings.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/settings/layout,_N_T_/premium/settings/page,_N_T_/premium/settings", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/premium/settings": { type: "override", path: "/premium/settings.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/settings/layout,_N_T_/premium/settings/page,_N_T_/premium/settings", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/premium/settings.rsc": { type: "override", path: "/premium/settings.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/settings/layout,_N_T_/premium/settings/page,_N_T_/premium/settings", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/premium.html": { type: "override", path: "/premium.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/page,_N_T_/premium", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/premium": { type: "override", path: "/premium.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/page,_N_T_/premium", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/premium.rsc": { type: "override", path: "/premium.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/premium/layout,_N_T_/premium/page,_N_T_/premium", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } }, "/settings.html": { type: "override", path: "/settings.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/settings/layout,_N_T_/settings/page,_N_T_/settings", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/settings": { type: "override", path: "/settings.html", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/settings/layout,_N_T_/settings/page,_N_T_/settings", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch" } }, "/settings.rsc": { type: "override", path: "/settings.rsc", headers: { "x-nextjs-stale-time": "300", "x-nextjs-prerender": "1", "x-next-cache-tags": "_N_T_/layout,_N_T_/settings/layout,_N_T_/settings/page,_N_T_/settings", vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch", "content-type": "text/x-component" } } };
});
var q = U((ze, $) => {
  "use strict";
  p();
  u();
  l();
  function b(e, t) {
    e = String(e || "").trim();
    let n = e, s, a = "";
    if (/^[^a-zA-Z\\\s]/.test(e)) {
      s = e[0];
      let o = e.lastIndexOf(s);
      a += e.substring(o + 1), e = e.substring(1, o);
    }
    let r = 0;
    return e = le(e, (o) => {
      if (/^\(\?[P<']/.test(o)) {
        let c = /^\(\?P?[<']([^>']+)[>']/.exec(o);
        if (!c) throw new Error(`Failed to extract named captures from ${JSON.stringify(o)}`);
        let h = o.substring(c[0].length, o.length - 1);
        return t && (t[r] = c[1]), r++, `(${h})`;
      }
      return o.substring(0, 3) === "(?:" || r++, o;
    }), e = e.replace(/\[:([^:]+):\]/g, (o, c) => b.characterClasses[c] || o), new b.PCRE(e, a, n, a, s);
  }
  __name(b, "b");
  function le(e, t) {
    let n = 0, s = 0, a = false;
    for (let i = 0; i < e.length; i++) {
      let r = e[i];
      if (a) {
        a = false;
        continue;
      }
      switch (r) {
        case "(":
          s === 0 && (n = i), s++;
          break;
        case ")":
          if (s > 0 && (s--, s === 0)) {
            let o = i + 1, c = n === 0 ? "" : e.substring(0, n), h = e.substring(o), d = String(t(e.substring(n, o)));
            e = c + d + h, i = n;
          }
          break;
        case "\\":
          a = true;
          break;
        default:
          break;
      }
    }
    return e;
  }
  __name(le, "le");
  (function(e) {
    class t extends RegExp {
      static {
        __name(this, "t");
      }
      constructor(s, a, i, r, o) {
        super(s, a), this.pcrePattern = i, this.pcreFlags = r, this.delimiter = o;
      }
    }
    e.PCRE = t, e.characterClasses = { alnum: "[A-Za-z0-9]", word: "[A-Za-z0-9_]", alpha: "[A-Za-z]", blank: "[ \\t]", cntrl: "[\\x00-\\x1F\\x7F]", digit: "\\d", graph: "[\\x21-\\x7E]", lower: "[a-z]", print: "[\\x20-\\x7E]", punct: "[\\]\\[!\"#$%&'()*+,./:;<=>?@\\\\^_`{|}~-]", space: "\\s", upper: "[A-Z]", xdigit: "[A-Fa-f0-9]" };
  })(b || (b = {}));
  b.prototype = b.PCRE.prototype;
  $.exports = b;
});
var Q = U((H) => {
  "use strict";
  p();
  u();
  l();
  H.parse = Te;
  H.serialize = Re;
  var we = Object.prototype.toString, S = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
  function Te(e, t) {
    if (typeof e != "string") throw new TypeError("argument str must be a string");
    for (var n = {}, s = t || {}, a = s.decode || je, i = 0; i < e.length; ) {
      var r = e.indexOf("=", i);
      if (r === -1) break;
      var o = e.indexOf(";", i);
      if (o === -1) o = e.length;
      else if (o < r) {
        i = e.lastIndexOf(";", r - 1) + 1;
        continue;
      }
      var c = e.slice(i, r).trim();
      if (n[c] === void 0) {
        var h = e.slice(r + 1, o).trim();
        h.charCodeAt(0) === 34 && (h = h.slice(1, -1)), n[c] = Pe(h, a);
      }
      i = o + 1;
    }
    return n;
  }
  __name(Te, "Te");
  function Re(e, t, n) {
    var s = n || {}, a = s.encode || Ne;
    if (typeof a != "function") throw new TypeError("option encode is invalid");
    if (!S.test(e)) throw new TypeError("argument name is invalid");
    var i = a(t);
    if (i && !S.test(i)) throw new TypeError("argument val is invalid");
    var r = e + "=" + i;
    if (s.maxAge != null) {
      var o = s.maxAge - 0;
      if (isNaN(o) || !isFinite(o)) throw new TypeError("option maxAge is invalid");
      r += "; Max-Age=" + Math.floor(o);
    }
    if (s.domain) {
      if (!S.test(s.domain)) throw new TypeError("option domain is invalid");
      r += "; Domain=" + s.domain;
    }
    if (s.path) {
      if (!S.test(s.path)) throw new TypeError("option path is invalid");
      r += "; Path=" + s.path;
    }
    if (s.expires) {
      var c = s.expires;
      if (!ke(c) || isNaN(c.valueOf())) throw new TypeError("option expires is invalid");
      r += "; Expires=" + c.toUTCString();
    }
    if (s.httpOnly && (r += "; HttpOnly"), s.secure && (r += "; Secure"), s.priority) {
      var h = typeof s.priority == "string" ? s.priority.toLowerCase() : s.priority;
      switch (h) {
        case "low":
          r += "; Priority=Low";
          break;
        case "medium":
          r += "; Priority=Medium";
          break;
        case "high":
          r += "; Priority=High";
          break;
        default:
          throw new TypeError("option priority is invalid");
      }
    }
    if (s.sameSite) {
      var d = typeof s.sameSite == "string" ? s.sameSite.toLowerCase() : s.sameSite;
      switch (d) {
        case true:
          r += "; SameSite=Strict";
          break;
        case "lax":
          r += "; SameSite=Lax";
          break;
        case "strict":
          r += "; SameSite=Strict";
          break;
        case "none":
          r += "; SameSite=None";
          break;
        default:
          throw new TypeError("option sameSite is invalid");
      }
    }
    return r;
  }
  __name(Re, "Re");
  function je(e) {
    return e.indexOf("%") !== -1 ? decodeURIComponent(e) : e;
  }
  __name(je, "je");
  function Ne(e) {
    return encodeURIComponent(e);
  }
  __name(Ne, "Ne");
  function ke(e) {
    return we.call(e) === "[object Date]" || e instanceof Date;
  }
  __name(ke, "ke");
  function Pe(e, t) {
    try {
      return t(e);
    } catch {
      return e;
    }
  }
  __name(Pe, "Pe");
});
p();
u();
l();
p();
u();
l();
p();
u();
l();
var w = "INTERNAL_SUSPENSE_CACHE_HOSTNAME.local";
p();
u();
l();
p();
u();
l();
p();
u();
l();
p();
u();
l();
var D = F(q());
function N(e, t, n) {
  if (t == null) return { match: null, captureGroupKeys: [] };
  let s = n ? "" : "i", a = [];
  return { match: (0, D.default)(`%${e}%${s}`, a).exec(t), captureGroupKeys: a };
}
__name(N, "N");
function T(e, t, n, { namedOnly: s } = {}) {
  return e.replace(/\$([a-zA-Z0-9_]+)/g, (a, i) => {
    let r = n.indexOf(i);
    return s && r === -1 ? a : (r === -1 ? t[parseInt(i, 10)] : t[r + 1]) || "";
  });
}
__name(T, "T");
function I(e, { url: t, cookies: n, headers: s, routeDest: a }) {
  switch (e.type) {
    case "host":
      return { valid: t.hostname === e.value };
    case "header":
      return e.value !== void 0 ? M(e.value, s.get(e.key), a) : { valid: s.has(e.key) };
    case "cookie": {
      let i = n[e.key];
      return i && e.value !== void 0 ? M(e.value, i, a) : { valid: i !== void 0 };
    }
    case "query":
      return e.value !== void 0 ? M(e.value, t.searchParams.get(e.key), a) : { valid: t.searchParams.has(e.key) };
  }
}
__name(I, "I");
function M(e, t, n) {
  let { match: s, captureGroupKeys: a } = N(e, t);
  return n && s && a.length ? { valid: !!s, newRouteDest: T(n, s, a, { namedOnly: true }) } : { valid: !!s };
}
__name(M, "M");
p();
u();
l();
function B(e) {
  let t = new Headers(e.headers);
  return e.cf && (t.set("x-vercel-ip-city", encodeURIComponent(e.cf.city)), t.set("x-vercel-ip-country", e.cf.country), t.set("x-vercel-ip-country-region", e.cf.regionCode), t.set("x-vercel-ip-latitude", e.cf.latitude), t.set("x-vercel-ip-longitude", e.cf.longitude)), t.set("x-vercel-sc-host", w), new Request(e, { headers: t });
}
__name(B, "B");
p();
u();
l();
function y(e, t, n) {
  let s = t instanceof Headers ? t.entries() : Object.entries(t);
  for (let [a, i] of s) {
    let r = a.toLowerCase(), o = n?.match ? T(i, n.match, n.captureGroupKeys) : i;
    r === "set-cookie" ? e.append(r, o) : e.set(r, o);
  }
}
__name(y, "y");
function R(e) {
  return /^https?:\/\//.test(e);
}
__name(R, "R");
function g(e, t) {
  for (let [n, s] of t.entries()) {
    let a = /^nxtP(.+)$/.exec(n), i = /^nxtI(.+)$/.exec(n);
    a?.[1] ? (e.set(n, s), e.set(a[1], s)) : i?.[1] ? e.set(i[1], s.replace(/(\(\.+\))+/, "")) : (!e.has(n) || !!s && !e.getAll(n).includes(s)) && e.append(n, s);
  }
}
__name(g, "g");
function A(e, t) {
  let n = new URL(t, e.url);
  return g(n.searchParams, new URL(e.url).searchParams), n.pathname = n.pathname.replace(/\/index.html$/, "/").replace(/\.html$/, ""), new Request(n, e);
}
__name(A, "A");
function j(e) {
  return new Response(e.body, e);
}
__name(j, "j");
function L(e) {
  return e.split(",").map((t) => {
    let [n, s] = t.split(";"), a = parseFloat((s ?? "q=1").replace(/q *= */gi, ""));
    return [n.trim(), isNaN(a) ? 1 : a];
  }).sort((t, n) => n[1] - t[1]).map(([t]) => t === "*" || t === "" ? [] : t).flat();
}
__name(L, "L");
p();
u();
l();
function O(e) {
  switch (e) {
    case "none":
      return "filesystem";
    case "filesystem":
      return "rewrite";
    case "rewrite":
      return "resource";
    case "resource":
      return "miss";
    default:
      return "miss";
  }
}
__name(O, "O");
async function k(e, { request: t, assetsFetcher: n, ctx: s }, { path: a, searchParams: i }) {
  let r, o = new URL(t.url);
  g(o.searchParams, i);
  let c = new Request(o, t);
  try {
    switch (e?.type) {
      case "function":
      case "middleware": {
        let h = await import(e.entrypoint);
        try {
          r = await h.default(c, s);
        } catch (d) {
          let x = d;
          throw x.name === "TypeError" && x.message.endsWith("default is not a function") ? new Error(`An error occurred while evaluating the target edge function (${e.entrypoint})`) : d;
        }
        break;
      }
      case "override": {
        r = j(await n.fetch(A(c, e.path ?? a))), e.headers && y(r.headers, e.headers);
        break;
      }
      case "static": {
        r = await n.fetch(A(c, a));
        break;
      }
      default:
        r = new Response("Not Found", { status: 404 });
    }
  } catch (h) {
    return console.error(h), new Response("Internal Server Error", { status: 500 });
  }
  return j(r);
}
__name(k, "k");
function K(e, t) {
  let n = "^//?(?:", s = ")/(.*)$";
  return !e.startsWith(n) || !e.endsWith(s) ? false : e.slice(n.length, -s.length).split("|").every((i) => t.has(i));
}
__name(K, "K");
p();
u();
l();
function he(e, { protocol: t, hostname: n, port: s, pathname: a }) {
  return !(t && e.protocol.replace(/:$/, "") !== t || !new RegExp(n).test(e.hostname) || s && !new RegExp(s).test(e.port) || a && !new RegExp(a).test(e.pathname));
}
__name(he, "he");
function de(e, t) {
  if (e.method !== "GET") return;
  let { origin: n, searchParams: s } = new URL(e.url), a = s.get("url"), i = Number.parseInt(s.get("w") ?? "", 10), r = Number.parseInt(s.get("q") ?? "75", 10);
  if (!a || Number.isNaN(i) || Number.isNaN(r) || !t?.sizes?.includes(i) || r < 0 || r > 100) return;
  let o = new URL(a, n);
  if (o.pathname.endsWith(".svg") && !t?.dangerouslyAllowSVG) return;
  let c = a.startsWith("//"), h = a.startsWith("/") && !c;
  if (!h && !t?.domains?.includes(o.hostname) && !t?.remotePatterns?.find((v) => he(o, v))) return;
  let d = e.headers.get("Accept") ?? "", x = t?.formats?.find((v) => d.includes(v))?.replace("image/", "");
  return { isRelative: h, imageUrl: o, options: { width: i, quality: r, format: x } };
}
__name(de, "de");
function _e(e, t, n) {
  let s = new Headers();
  if (n?.contentSecurityPolicy && s.set("Content-Security-Policy", n.contentSecurityPolicy), n?.contentDispositionType) {
    let i = t.pathname.split("/").pop(), r = i ? `${n.contentDispositionType}; filename="${i}"` : n.contentDispositionType;
    s.set("Content-Disposition", r);
  }
  e.headers.has("Cache-Control") || s.set("Cache-Control", `public, max-age=${n?.minimumCacheTTL ?? 60}`);
  let a = j(e);
  return y(a.headers, s), a;
}
__name(_e, "_e");
async function G(e, { buildOutput: t, assetsFetcher: n, imagesConfig: s }) {
  let a = de(e, s);
  if (!a) return new Response("Invalid image resizing request", { status: 400 });
  let { isRelative: i, imageUrl: r } = a, c = await (i && r.pathname in t ? n.fetch.bind(n) : fetch)(r);
  return _e(c, r, s);
}
__name(G, "G");
p();
u();
l();
p();
u();
l();
p();
u();
l();
async function P(e) {
  return import(e);
}
__name(P, "P");
var fe = "x-vercel-cache-tags";
var me = "x-next-cache-soft-tags";
var xe = /* @__PURE__ */ Symbol.for("__cloudflare-request-context__");
async function X(e) {
  let t = `https://${w}/v1/suspense-cache/`;
  if (!e.url.startsWith(t)) return null;
  try {
    let n = new URL(e.url), s = await ye();
    if (n.pathname === "/v1/suspense-cache/revalidate") {
      let i = n.searchParams.get("tags")?.split(",") ?? [];
      for (let r of i) await s.revalidateTag(r);
      return new Response(null, { status: 200 });
    }
    let a = n.pathname.replace("/v1/suspense-cache/", "");
    if (!a.length) return new Response("Invalid cache key", { status: 400 });
    switch (e.method) {
      case "GET": {
        let i = z(e, me), r = await s.get(a, { softTags: i });
        return r ? new Response(JSON.stringify(r.value), { status: 200, headers: { "Content-Type": "application/json", "x-vercel-cache-state": "fresh", age: `${(Date.now() - (r.lastModified ?? Date.now())) / 1e3}` } }) : new Response(null, { status: 404 });
      }
      case "POST": {
        let i = globalThis[xe], r = /* @__PURE__ */ __name(async () => {
          let o = await e.json();
          o.data.tags === void 0 && (o.tags ??= z(e, fe) ?? []), await s.set(a, o);
        }, "r");
        return i ? i.ctx.waitUntil(r()) : await r(), new Response(null, { status: 200 });
      }
      default:
        return new Response(null, { status: 405 });
    }
  } catch (n) {
    return console.error(n), new Response("Error handling cache request", { status: 500 });
  }
}
__name(X, "X");
async function ye() {
  return process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE ? W("kv") : W("cache-api");
}
__name(ye, "ye");
async function W(e) {
  let t = `./__next-on-pages-dist__/cache/${e}.js`, n = await P(t);
  return new n.default();
}
__name(W, "W");
function z(e, t) {
  return e.headers.get(t)?.split(",")?.filter(Boolean);
}
__name(z, "z");
function Z() {
  globalThis[J] || (ge(), globalThis[J] = true);
}
__name(Z, "Z");
function ge() {
  let e = globalThis.fetch;
  globalThis.fetch = async (...t) => {
    let n = new Request(...t), s = await be(n);
    return s || (s = await X(n), s) ? s : (ve(n), e(n));
  };
}
__name(ge, "ge");
async function be(e) {
  if (e.url.startsWith("blob:")) try {
    let n = `./__next-on-pages-dist__/assets/${new URL(e.url).pathname}.bin`, s = (await P(n)).default, a = { async arrayBuffer() {
      return s;
    }, get body() {
      return new ReadableStream({ start(i) {
        let r = Buffer.from(s);
        i.enqueue(r), i.close();
      } });
    }, async text() {
      return Buffer.from(s).toString();
    }, async json() {
      let i = Buffer.from(s);
      return JSON.stringify(i.toString());
    }, async blob() {
      return new Blob(s);
    } };
    return a.clone = () => ({ ...a }), a;
  } catch {
  }
  return null;
}
__name(be, "be");
function ve(e) {
  e.headers.has("user-agent") || e.headers.set("user-agent", "Next.js Middleware");
}
__name(ve, "ve");
var J = /* @__PURE__ */ Symbol.for("next-on-pages fetch patch");
p();
u();
l();
var Y = F(Q());
var C = class {
  static {
    __name(this, "C");
  }
  constructor(t, n, s, a, i) {
    this.routes = t;
    this.output = n;
    this.reqCtx = s;
    this.url = new URL(s.request.url), this.cookies = (0, Y.parse)(s.request.headers.get("cookie") || ""), this.path = this.url.pathname || "/", this.headers = { normal: new Headers(), important: new Headers() }, this.searchParams = new URLSearchParams(), g(this.searchParams, this.url.searchParams), this.checkPhaseCounter = 0, this.middlewareInvoked = [], this.wildcardMatch = i?.find((r) => r.domain === this.url.hostname), this.locales = new Set(a.collectedLocales);
  }
  url;
  cookies;
  wildcardMatch;
  path;
  status;
  headers;
  searchParams;
  body;
  checkPhaseCounter;
  middlewareInvoked;
  locales;
  checkRouteMatch(t, { checkStatus: n, checkIntercept: s }) {
    let a = N(t.src, this.path, t.caseSensitive);
    if (!a.match || t.methods && !t.methods.map((r) => r.toUpperCase()).includes(this.reqCtx.request.method.toUpperCase())) return;
    let i = { url: this.url, cookies: this.cookies, headers: this.reqCtx.request.headers, routeDest: t.dest };
    if (!t.has?.find((r) => {
      let o = I(r, i);
      return o.newRouteDest && (i.routeDest = o.newRouteDest), !o.valid;
    }) && !t.missing?.find((r) => I(r, i).valid) && !(n && t.status !== this.status)) {
      if (s && t.dest) {
        let r = /\/(\(\.+\))+/, o = r.test(t.dest), c = r.test(this.path);
        if (o && !c) return;
      }
      return { routeMatch: a, routeDest: i.routeDest };
    }
  }
  processMiddlewareResp(t) {
    let n = "x-middleware-override-headers", s = t.headers.get(n);
    if (s) {
      let c = new Set(s.split(",").map((h) => h.trim()));
      for (let h of c.keys()) {
        let d = `x-middleware-request-${h}`, x = t.headers.get(d);
        this.reqCtx.request.headers.get(h) !== x && (x ? this.reqCtx.request.headers.set(h, x) : this.reqCtx.request.headers.delete(h)), t.headers.delete(d);
      }
      t.headers.delete(n);
    }
    let a = "x-middleware-rewrite", i = t.headers.get(a);
    if (i) {
      let c = new URL(i, this.url), h = this.url.hostname !== c.hostname;
      this.path = h ? `${c}` : c.pathname, g(this.searchParams, c.searchParams), t.headers.delete(a);
    }
    let r = "x-middleware-next";
    t.headers.get(r) ? t.headers.delete(r) : !i && !t.headers.has("location") ? (this.body = t.body, this.status = t.status) : t.headers.has("location") && t.status >= 300 && t.status < 400 && (this.status = t.status), y(this.reqCtx.request.headers, t.headers), y(this.headers.normal, t.headers), this.headers.middlewareLocation = t.headers.get("location");
  }
  async runRouteMiddleware(t) {
    if (!t) return true;
    let n = t && this.output[t];
    if (!n || n.type !== "middleware") return this.status = 500, false;
    let s = await k(n, this.reqCtx, { path: this.path, searchParams: this.searchParams, headers: this.headers, status: this.status });
    return this.middlewareInvoked.push(t), s.status === 500 ? (this.status = s.status, false) : (this.processMiddlewareResp(s), true);
  }
  applyRouteOverrides(t) {
    !t.override || (this.status = void 0, this.headers.normal = new Headers(), this.headers.important = new Headers());
  }
  applyRouteHeaders(t, n, s) {
    !t.headers || (y(this.headers.normal, t.headers, { match: n, captureGroupKeys: s }), t.important && y(this.headers.important, t.headers, { match: n, captureGroupKeys: s }));
  }
  applyRouteStatus(t) {
    !t.status || (this.status = t.status);
  }
  applyRouteDest(t, n, s) {
    if (!t.dest) return this.path;
    let a = this.path, i = t.dest;
    this.wildcardMatch && /\$wildcard/.test(i) && (i = i.replace(/\$wildcard/g, this.wildcardMatch.value)), this.path = T(i, n, s);
    let r = /\/index\.rsc$/i.test(this.path), o = /^\/(?:index)?$/i.test(a), c = /^\/__index\.prefetch\.rsc$/i.test(a);
    r && !o && !c && (this.path = a);
    let h = /\.rsc$/i.test(this.path), d = /\.prefetch\.rsc$/i.test(this.path), x = this.path in this.output;
    h && !d && !x && (this.path = this.path.replace(/\.rsc/i, ""));
    let v = new URL(this.path, this.url);
    return g(this.searchParams, v.searchParams), R(this.path) || (this.path = v.pathname), a;
  }
  applyLocaleRedirects(t) {
    if (!t.locale?.redirect || !/^\^(.)*$/.test(t.src) && t.src !== this.path || this.headers.normal.has("location")) return;
    let { locale: { redirect: s, cookie: a } } = t, i = a && this.cookies[a], r = L(i ?? ""), o = L(this.reqCtx.request.headers.get("accept-language") ?? ""), d = [...r, ...o].map((x) => s[x]).filter(Boolean)[0];
    if (d) {
      !this.path.startsWith(d) && (this.headers.normal.set("location", d), this.status = 307);
      return;
    }
  }
  getLocaleFriendlyRoute(t, n) {
    return !this.locales || n !== "miss" ? t : K(t.src, this.locales) ? { ...t, src: t.src.replace(/\/\(\.\*\)\$$/, "(?:/(.*))?$") } : t;
  }
  async checkRoute(t, n) {
    let s = this.getLocaleFriendlyRoute(n, t), { routeMatch: a, routeDest: i } = this.checkRouteMatch(s, { checkStatus: t === "error", checkIntercept: t === "rewrite" }) ?? {}, r = { ...s, dest: i };
    if (!a?.match || r.middlewarePath && this.middlewareInvoked.includes(r.middlewarePath)) return "skip";
    let { match: o, captureGroupKeys: c } = a;
    if (this.applyRouteOverrides(r), this.applyLocaleRedirects(r), !await this.runRouteMiddleware(r.middlewarePath)) return "error";
    if (this.body !== void 0 || this.headers.middlewareLocation) return "done";
    this.applyRouteHeaders(r, o, c), this.applyRouteStatus(r);
    let d = this.applyRouteDest(r, o, c);
    if (r.check && !R(this.path)) if (d === this.path) {
      if (t !== "miss") return this.checkPhase(O(t));
      this.status = 404;
    } else if (t === "miss") {
      if (!(this.path in this.output) && !(this.path.replace(/\/$/, "") in this.output)) return this.checkPhase("filesystem");
      this.status === 404 && (this.status = void 0);
    } else return this.checkPhase("none");
    return !r.continue || r.status && r.status >= 300 && r.status <= 399 ? "done" : "next";
  }
  async checkPhase(t) {
    if (this.checkPhaseCounter++ >= 50) return console.error(`Routing encountered an infinite loop while checking ${this.url.pathname}`), this.status = 500, "error";
    this.middlewareInvoked = [];
    let n = true;
    for (let i of this.routes[t]) {
      let r = await this.checkRoute(t, i);
      if (r === "error") return "error";
      if (r === "done") {
        n = false;
        break;
      }
    }
    if (t === "hit" || R(this.path) || this.headers.normal.has("location") || !!this.body) return "done";
    if (t === "none") for (let i of this.locales) {
      let r = new RegExp(`/${i}(/.*)`), c = this.path.match(r)?.[1];
      if (c && c in this.output) {
        this.path = c;
        break;
      }
    }
    let s = this.path in this.output;
    if (!s && this.path.endsWith("/")) {
      let i = this.path.replace(/\/$/, "");
      s = i in this.output, s && (this.path = i);
    }
    if (t === "miss" && !s) {
      let i = !this.status || this.status < 400;
      this.status = i ? 404 : this.status;
    }
    let a = "miss";
    return s || t === "miss" || t === "error" ? a = "hit" : n && (a = O(t)), this.checkPhase(a);
  }
  async run(t = "none") {
    this.checkPhaseCounter = 0;
    let n = await this.checkPhase(t);
    return this.headers.normal.has("location") && (!this.status || this.status < 300 || this.status >= 400) && (this.status = 307), n;
  }
};
async function ee(e, t, n, s) {
  let a = new C(t.routes, n, e, s, t.wildcard), i = await te(a);
  return Se(e, i, n);
}
__name(ee, "ee");
async function te(e, t = "none", n = false) {
  return await e.run(t) === "error" || !n && e.status && e.status >= 400 ? te(e, "error", true) : { path: e.path, status: e.status, headers: e.headers, searchParams: e.searchParams, body: e.body };
}
__name(te, "te");
async function Se(e, { path: t = "/404", status: n, headers: s, searchParams: a, body: i }, r) {
  let o = s.normal.get("location");
  if (o) {
    if (o !== s.middlewareLocation) {
      let d = [...a.keys()].length ? `?${a.toString()}` : "";
      s.normal.set("location", `${o ?? "/"}${d}`);
    }
    return new Response(null, { status: n, headers: s.normal });
  }
  let c;
  if (i !== void 0) c = new Response(i, { status: n });
  else if (R(t)) {
    let d = new URL(t);
    g(d.searchParams, a), c = await fetch(d, e.request);
  } else c = await k(r[t], e, { path: t, status: n, headers: s, searchParams: a });
  let h = s.normal;
  return y(h, c.headers), y(h, s.important), c = new Response(c.body, { ...c, status: n || c.status, headers: h }), c;
}
__name(Se, "Se");
p();
u();
l();
function se() {
  globalThis.__nextOnPagesRoutesIsolation ??= { _map: /* @__PURE__ */ new Map(), getProxyFor: Ce };
}
__name(se, "se");
function Ce(e) {
  let t = globalThis.__nextOnPagesRoutesIsolation._map.get(e);
  if (t) return t;
  let n = Ee();
  return globalThis.__nextOnPagesRoutesIsolation._map.set(e, n), n;
}
__name(Ce, "Ce");
function Ee() {
  let e = /* @__PURE__ */ new Map();
  return new Proxy(globalThis, { get: /* @__PURE__ */ __name((t, n) => e.has(n) ? e.get(n) : Reflect.get(globalThis, n), "get"), set: /* @__PURE__ */ __name((t, n, s) => Me.has(n) ? Reflect.set(globalThis, n, s) : (e.set(n, s), true), "set") });
}
__name(Ee, "Ee");
var Me = /* @__PURE__ */ new Set(["_nextOriginalFetch", "fetch", "__incrementalCache"]);
var Ie = Object.defineProperty;
var Ae = /* @__PURE__ */ __name((...e) => {
  let t = e[0], n = e[1], s = "__import_unsupported";
  if (!(n === s && typeof t == "object" && t !== null && s in t)) return Ie(...e);
}, "Ae");
globalThis.Object.defineProperty = Ae;
globalThis.AbortController = class extends AbortController {
  constructor() {
    try {
      super();
    } catch (t) {
      if (t instanceof Error && t.message.includes("Disallowed operation called within global scope")) return { signal: { aborted: false, reason: null, onabort: /* @__PURE__ */ __name(() => {
      }, "onabort"), throwIfAborted: /* @__PURE__ */ __name(() => {
      }, "throwIfAborted") }, abort() {
      } };
      throw t;
    }
  }
};
var js = { async fetch(e, t, n) {
  se(), Z();
  let s = await __ALSes_PROMISE__;
  if (!s) {
    let r = new URL(e.url), o = await t.ASSETS.fetch(`${r.protocol}//${r.host}/cdn-cgi/errors/no-nodejs_compat.html`), c = o.ok ? o.body : "Error: Could not access built-in Node.js modules. Please make sure that your Cloudflare Pages project has the 'nodejs_compat' compatibility flag set.";
    return new Response(c, { status: 503 });
  }
  let { envAsyncLocalStorage: a, requestContextAsyncLocalStorage: i } = s;
  return a.run({ ...t, NODE_ENV: "production", SUSPENSE_CACHE_URL: w }, async () => i.run({ env: t, ctx: n, cf: e.cf }, async () => {
    if (new URL(e.url).pathname.startsWith("/_next/image")) return G(e, { buildOutput: f, assetsFetcher: t.ASSETS, imagesConfig: _.images });
    let o = B(e);
    return ee({ request: o, ctx: n, assetsFetcher: t.ASSETS }, _, f, m);
  }));
} };
export {
  js as default
};
/*!
 * cookie
 * Copyright(c) 2012-2014 Roman Shtylman
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */
//# sourceMappingURL=bundledWorker-0.18817810229311438.mjs.map
