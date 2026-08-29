import { createRequire } from "node:module";
import { createServer } from "node:http";
import { unlinkSync } from "node:fs";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region ../../node_modules/.pnpm/ms@2.0.0/node_modules/ms/index.js
var require_ms$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Helpers.
	*/
	var s = 1e3;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;
	/**
	* Parse or format the given `val`.
	*
	* Options:
	*
	*  - `long` verbose formatting [false]
	*
	* @param {String|Number} val
	* @param {Object} [options]
	* @throws {Error} throw an error if val is not a non-empty string or a number
	* @return {String|Number}
	* @api public
	*/
	module.exports = function(val, options) {
		options = options || {};
		var type = typeof val;
		if (type === "string" && val.length > 0) return parse(val);
		else if (type === "number" && isNaN(val) === false) return options.long ? fmtLong(val) : fmtShort(val);
		throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
	};
	/**
	* Parse the given `str` and return milliseconds.
	*
	* @param {String} str
	* @return {Number}
	* @api private
	*/
	function parse(str) {
		str = String(str);
		if (str.length > 100) return;
		var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
		if (!match) return;
		var n = parseFloat(match[1]);
		switch ((match[2] || "ms").toLowerCase()) {
			case "years":
			case "year":
			case "yrs":
			case "yr":
			case "y": return n * y;
			case "days":
			case "day":
			case "d": return n * d;
			case "hours":
			case "hour":
			case "hrs":
			case "hr":
			case "h": return n * h;
			case "minutes":
			case "minute":
			case "mins":
			case "min":
			case "m": return n * m;
			case "seconds":
			case "second":
			case "secs":
			case "sec":
			case "s": return n * s;
			case "milliseconds":
			case "millisecond":
			case "msecs":
			case "msec":
			case "ms": return n;
			default: return;
		}
	}
	/**
	* Short format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtShort(ms) {
		if (ms >= d) return Math.round(ms / d) + "d";
		if (ms >= h) return Math.round(ms / h) + "h";
		if (ms >= m) return Math.round(ms / m) + "m";
		if (ms >= s) return Math.round(ms / s) + "s";
		return ms + "ms";
	}
	/**
	* Long format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtLong(ms) {
		return plural(ms, d, "day") || plural(ms, h, "hour") || plural(ms, m, "minute") || plural(ms, s, "second") || ms + " ms";
	}
	/**
	* Pluralization helper.
	*/
	function plural(ms, n, name) {
		if (ms < n) return;
		if (ms < n * 1.5) return Math.floor(ms / n) + " " + name;
		return Math.ceil(ms / n) + " " + name + "s";
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@2.6.9/node_modules/debug/src/debug.js
var require_debug$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This is the common logic for both the Node.js and web browser
	* implementations of `debug()`.
	*
	* Expose `debug()` as the module.
	*/
	exports = module.exports = createDebug.debug = createDebug["default"] = createDebug;
	exports.coerce = coerce;
	exports.disable = disable;
	exports.enable = enable;
	exports.enabled = enabled;
	exports.humanize = require_ms$1();
	/**
	* The currently active debug mode names, and names to skip.
	*/
	exports.names = [];
	exports.skips = [];
	/**
	* Map of special "%n" handling functions, for the debug "format" argument.
	*
	* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	*/
	exports.formatters = {};
	/**
	* Previous log timestamp.
	*/
	var prevTime;
	/**
	* Select a color.
	* @param {String} namespace
	* @return {Number}
	* @api private
	*/
	function selectColor(namespace) {
		var hash = 0, i;
		for (i in namespace) {
			hash = (hash << 5) - hash + namespace.charCodeAt(i);
			hash |= 0;
		}
		return exports.colors[Math.abs(hash) % exports.colors.length];
	}
	/**
	* Create a debugger with the given `namespace`.
	*
	* @param {String} namespace
	* @return {Function}
	* @api public
	*/
	function createDebug(namespace) {
		function debug() {
			if (!debug.enabled) return;
			var self = debug;
			var curr = +/* @__PURE__ */ new Date();
			self.diff = curr - (prevTime || curr);
			self.prev = prevTime;
			self.curr = curr;
			prevTime = curr;
			var args = new Array(arguments.length);
			for (var i = 0; i < args.length; i++) args[i] = arguments[i];
			args[0] = exports.coerce(args[0]);
			if ("string" !== typeof args[0]) args.unshift("%O");
			var index = 0;
			args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
				if (match === "%%") return match;
				index++;
				var formatter = exports.formatters[format];
				if ("function" === typeof formatter) {
					var val = args[index];
					match = formatter.call(self, val);
					args.splice(index, 1);
					index--;
				}
				return match;
			});
			exports.formatArgs.call(self, args);
			(debug.log || exports.log || console.log.bind(console)).apply(self, args);
		}
		debug.namespace = namespace;
		debug.enabled = exports.enabled(namespace);
		debug.useColors = exports.useColors();
		debug.color = selectColor(namespace);
		if ("function" === typeof exports.init) exports.init(debug);
		return debug;
	}
	/**
	* Enables a debug mode by namespaces. This can include modes
	* separated by a colon and wildcards.
	*
	* @param {String} namespaces
	* @api public
	*/
	function enable(namespaces) {
		exports.save(namespaces);
		exports.names = [];
		exports.skips = [];
		var split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
		var len = split.length;
		for (var i = 0; i < len; i++) {
			if (!split[i]) continue;
			namespaces = split[i].replace(/\*/g, ".*?");
			if (namespaces[0] === "-") exports.skips.push(new RegExp("^" + namespaces.substr(1) + "$"));
			else exports.names.push(new RegExp("^" + namespaces + "$"));
		}
	}
	/**
	* Disable debug output.
	*
	* @api public
	*/
	function disable() {
		exports.enable("");
	}
	/**
	* Returns true if the given mode name is enabled, false otherwise.
	*
	* @param {String} name
	* @return {Boolean}
	* @api public
	*/
	function enabled(name) {
		var i, len;
		for (i = 0, len = exports.skips.length; i < len; i++) if (exports.skips[i].test(name)) return false;
		for (i = 0, len = exports.names.length; i < len; i++) if (exports.names[i].test(name)) return true;
		return false;
	}
	/**
	* Coerce `val`.
	*
	* @param {Mixed} val
	* @return {Mixed}
	* @api private
	*/
	function coerce(val) {
		if (val instanceof Error) return val.stack || val.message;
		return val;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@2.6.9/node_modules/debug/src/browser.js
var require_browser$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This is the web browser implementation of `debug()`.
	*
	* Expose `debug()` as the module.
	*/
	exports = module.exports = require_debug$2();
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = "undefined" != typeof chrome && "undefined" != typeof chrome.storage ? chrome.storage.local : localstorage();
	/**
	* Colors.
	*/
	exports.colors = [
		"lightseagreen",
		"forestgreen",
		"goldenrod",
		"dodgerblue",
		"darkorchid",
		"crimson"
	];
	/**
	* Currently only WebKit-based Web Inspectors, Firefox >= v31,
	* and the Firebug extension (any Firefox version) are known
	* to support "%c" CSS customizations.
	*
	* TODO: add a `localStorage` variable to explicitly enable/disable colors
	*/
	function useColors() {
		if (typeof window !== "undefined" && window.process && window.process.type === "renderer") return true;
		return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
	}
	/**
	* Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	*/
	exports.formatters.j = function(v) {
		try {
			return JSON.stringify(v);
		} catch (err) {
			return "[UnexpectedJSONParseError]: " + err.message;
		}
	};
	/**
	* Colorize log arguments if enabled.
	*
	* @api public
	*/
	function formatArgs(args) {
		var useColors = this.useColors;
		args[0] = (useColors ? "%c" : "") + this.namespace + (useColors ? " %c" : " ") + args[0] + (useColors ? "%c " : " ") + "+" + exports.humanize(this.diff);
		if (!useColors) return;
		var c = "color: " + this.color;
		args.splice(1, 0, c, "color: inherit");
		var index = 0;
		var lastC = 0;
		args[0].replace(/%[a-zA-Z%]/g, function(match) {
			if ("%%" === match) return;
			index++;
			if ("%c" === match) lastC = index;
		});
		args.splice(lastC, 0, c);
	}
	/**
	* Invokes `console.log()` when available.
	* No-op when `console.log` is not a "function".
	*
	* @api public
	*/
	function log() {
		return "object" === typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments);
	}
	/**
	* Save `namespaces`.
	*
	* @param {String} namespaces
	* @api private
	*/
	function save(namespaces) {
		try {
			if (null == namespaces) exports.storage.removeItem("debug");
			else exports.storage.debug = namespaces;
		} catch (e) {}
	}
	/**
	* Load `namespaces`.
	*
	* @return {String} returns the previously persisted debug modes
	* @api private
	*/
	function load() {
		var r;
		try {
			r = exports.storage.debug;
		} catch (e) {}
		if (!r && typeof process !== "undefined" && "env" in process) r = process.env.DEBUG;
		return r;
	}
	/**
	* Enable namespaces listed in `localStorage.debug` initially.
	*/
	exports.enable(load());
	/**
	* Localstorage attempts to return the localstorage.
	*
	* This is necessary because safari throws
	* when a user disables cookies/localstorage
	* and you attempt to access it.
	*
	* @return {LocalStorage}
	* @api private
	*/
	function localstorage() {
		try {
			return window.localStorage;
		} catch (e) {}
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@2.6.9/node_modules/debug/src/node.js
var require_node$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	*/
	var tty$1 = __require("tty");
	var util$3 = __require("util");
	/**
	* This is the Node.js implementation of `debug()`.
	*
	* Expose `debug()` as the module.
	*/
	exports = module.exports = require_debug$2();
	exports.init = init;
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	/**
	* Colors.
	*/
	exports.colors = [
		6,
		2,
		3,
		4,
		5,
		1
	];
	/**
	* Build up the default `inspectOpts` object from the environment variables.
	*
	*   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
	*/
	exports.inspectOpts = Object.keys(process.env).filter(function(key) {
		return /^debug_/i.test(key);
	}).reduce(function(obj, key) {
		var prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, function(_, k) {
			return k.toUpperCase();
		});
		var val = process.env[key];
		if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
		else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
		else if (val === "null") val = null;
		else val = Number(val);
		obj[prop] = val;
		return obj;
	}, {});
	/**
	* The file descriptor to write the `debug()` calls to.
	* Set the `DEBUG_FD` env variable to override with another value. i.e.:
	*
	*   $ DEBUG_FD=3 node script.js 3>debug.log
	*/
	var fd = parseInt(process.env.DEBUG_FD, 10) || 2;
	if (1 !== fd && 2 !== fd) util$3.deprecate(function() {}, "except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)")();
	var stream = 1 === fd ? process.stdout : 2 === fd ? process.stderr : createWritableStdioStream(fd);
	/**
	* Is stdout a TTY? Colored output is enabled when `true`.
	*/
	function useColors() {
		return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty$1.isatty(fd);
	}
	/**
	* Map %o to `util.inspect()`, all on a single line.
	*/
	exports.formatters.o = function(v) {
		this.inspectOpts.colors = this.useColors;
		return util$3.inspect(v, this.inspectOpts).split("\n").map(function(str) {
			return str.trim();
		}).join(" ");
	};
	/**
	* Map %o to `util.inspect()`, allowing multiple lines if needed.
	*/
	exports.formatters.O = function(v) {
		this.inspectOpts.colors = this.useColors;
		return util$3.inspect(v, this.inspectOpts);
	};
	/**
	* Adds ANSI color escape codes if enabled.
	*
	* @api public
	*/
	function formatArgs(args) {
		var name = this.namespace;
		if (this.useColors) {
			var c = this.color;
			var prefix = "  \x1B[3" + c + ";1m" + name + " \x1B[0m";
			args[0] = prefix + args[0].split("\n").join("\n" + prefix);
			args.push("\x1B[3" + c + "m+" + exports.humanize(this.diff) + "\x1B[0m");
		} else args[0] = (/* @__PURE__ */ new Date()).toUTCString() + " " + name + " " + args[0];
	}
	/**
	* Invokes `util.format()` with the specified arguments and writes to `stream`.
	*/
	function log() {
		return stream.write(util$3.format.apply(util$3, arguments) + "\n");
	}
	/**
	* Save `namespaces`.
	*
	* @param {String} namespaces
	* @api private
	*/
	function save(namespaces) {
		if (null == namespaces) delete process.env.DEBUG;
		else process.env.DEBUG = namespaces;
	}
	/**
	* Load `namespaces`.
	*
	* @return {String} returns the previously persisted debug modes
	* @api private
	*/
	function load() {
		return process.env.DEBUG;
	}
	/**
	* Copied from `node/src/node.js`.
	*
	* XXX: It's lame that node doesn't expose this API out-of-the-box. It also
	* relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
	*/
	function createWritableStdioStream(fd) {
		var stream;
		switch (process.binding("tty_wrap").guessHandleType(fd)) {
			case "TTY":
				stream = new tty$1.WriteStream(fd);
				stream._type = "tty";
				if (stream._handle && stream._handle.unref) stream._handle.unref();
				break;
			case "FILE":
				stream = new (__require("fs")).SyncWriteStream(fd, { autoClose: false });
				stream._type = "fs";
				break;
			case "PIPE":
			case "TCP":
				stream = new (__require("net")).Socket({
					fd,
					readable: false,
					writable: true
				});
				stream.readable = false;
				stream.read = null;
				stream._type = "pipe";
				if (stream._handle && stream._handle.unref) stream._handle.unref();
				break;
			default: throw new Error("Implement me. Unknown stream file type!");
		}
		stream.fd = fd;
		stream._isStdio = true;
		return stream;
	}
	/**
	* Init logic for `debug` instances.
	*
	* Create a new `inspectOpts` object in case `useColors` is set
	* differently for a particular `debug` instance.
	*/
	function init(debug) {
		debug.inspectOpts = {};
		var keys = Object.keys(exports.inspectOpts);
		for (var i = 0; i < keys.length; i++) debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
	}
	/**
	* Enable namespaces listed in `process.env.DEBUG` initially.
	*/
	exports.enable(load());
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@2.6.9/node_modules/debug/src/index.js
var require_src$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Detect Electron renderer process, which is node, but we should
	* treat as a browser.
	*/
	if (typeof process !== "undefined" && process.type === "renderer") module.exports = require_browser$1();
	else module.exports = require_node$1();
}));
//#endregion
//#region ../../node_modules/.pnpm/encodeurl@1.0.2/node_modules/encodeurl/index.js
/*!
* encodeurl
* Copyright(c) 2016 Douglas Christopher Wilson
* MIT Licensed
*/
var require_encodeurl = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module exports.
	* @public
	*/
	module.exports = encodeUrl;
	/**
	* RegExp to match non-URL code points, *after* encoding (i.e. not including "%")
	* and including invalid escape sequences.
	* @private
	*/
	var ENCODE_CHARS_REGEXP = /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;
	/**
	* RegExp to match unmatched surrogate pair.
	* @private
	*/
	var UNMATCHED_SURROGATE_PAIR_REGEXP = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;
	/**
	* String to replace unmatched surrogate pair with.
	* @private
	*/
	var UNMATCHED_SURROGATE_PAIR_REPLACE = "$1�$2";
	/**
	* Encode a URL to a percent-encoded form, excluding already-encoded sequences.
	*
	* This function will take an already-encoded URL and encode all the non-URL
	* code points. This function will not encode the "%" character unless it is
	* not part of a valid sequence (`%20` will be left as-is, but `%foo` will
	* be encoded as `%25foo`).
	*
	* This encode is meant to be "safe" and does not throw errors. It will try as
	* hard as it can to properly encode the given URL, including replacing any raw,
	* unpaired surrogate pairs with the Unicode replacement character prior to
	* encoding.
	*
	* @param {string} url
	* @return {string}
	* @public
	*/
	function encodeUrl(url) {
		return String(url).replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE).replace(ENCODE_CHARS_REGEXP, encodeURI);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/escape-html@1.0.3/node_modules/escape-html/index.js
/*!
* escape-html
* Copyright(c) 2012-2013 TJ Holowaychuk
* Copyright(c) 2015 Andreas Lubbe
* Copyright(c) 2015 Tiancheng "Timothy" Gu
* MIT Licensed
*/
var require_escape_html = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module variables.
	* @private
	*/
	var matchHtmlRegExp = /["'&<>]/;
	/**
	* Module exports.
	* @public
	*/
	module.exports = escapeHtml;
	/**
	* Escape special characters in the given string of html.
	*
	* @param  {string} string The string to escape for inserting into HTML
	* @return {string}
	* @public
	*/
	function escapeHtml(string) {
		var str = "" + string;
		var match = matchHtmlRegExp.exec(str);
		if (!match) return str;
		var escape;
		var html = "";
		var index = 0;
		var lastIndex = 0;
		for (index = match.index; index < str.length; index++) {
			switch (str.charCodeAt(index)) {
				case 34:
					escape = "&quot;";
					break;
				case 38:
					escape = "&amp;";
					break;
				case 39:
					escape = "&#39;";
					break;
				case 60:
					escape = "&lt;";
					break;
				case 62:
					escape = "&gt;";
					break;
				default: continue;
			}
			if (lastIndex !== index) html += str.substring(lastIndex, index);
			lastIndex = index + 1;
			html += escape;
		}
		return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/ee-first@1.1.1/node_modules/ee-first/index.js
/*!
* ee-first
* Copyright(c) 2014 Jonathan Ong
* MIT Licensed
*/
var require_ee_first = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module exports.
	* @public
	*/
	module.exports = first;
	/**
	* Get the first event in a set of event emitters and event pairs.
	*
	* @param {array} stuff
	* @param {function} done
	* @public
	*/
	function first(stuff, done) {
		if (!Array.isArray(stuff)) throw new TypeError("arg must be an array of [ee, events...] arrays");
		var cleanups = [];
		for (var i = 0; i < stuff.length; i++) {
			var arr = stuff[i];
			if (!Array.isArray(arr) || arr.length < 2) throw new TypeError("each array member must be [ee, events...]");
			var ee = arr[0];
			for (var j = 1; j < arr.length; j++) {
				var event = arr[j];
				var fn = listener(event, callback);
				ee.on(event, fn);
				cleanups.push({
					ee,
					event,
					fn
				});
			}
		}
		function callback() {
			cleanup();
			done.apply(null, arguments);
		}
		function cleanup() {
			var x;
			for (var i = 0; i < cleanups.length; i++) {
				x = cleanups[i];
				x.ee.removeListener(x.event, x.fn);
			}
		}
		function thunk(fn) {
			done = fn;
		}
		thunk.cancel = cleanup;
		return thunk;
	}
	/**
	* Create the event listener.
	* @private
	*/
	function listener(event, done) {
		return function onevent(arg1) {
			var args = new Array(arguments.length);
			var ee = this;
			var err = event === "error" ? arg1 : null;
			for (var i = 0; i < args.length; i++) args[i] = arguments[i];
			done(err, ee, event, args);
		};
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/on-finished@2.3.0/node_modules/on-finished/index.js
/*!
* on-finished
* Copyright(c) 2013 Jonathan Ong
* Copyright(c) 2014 Douglas Christopher Wilson
* MIT Licensed
*/
var require_on_finished = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module exports.
	* @public
	*/
	module.exports = onFinished;
	module.exports.isFinished = isFinished;
	/**
	* Module dependencies.
	* @private
	*/
	var first = require_ee_first();
	/**
	* Variables.
	* @private
	*/
	/* istanbul ignore next */
	var defer = typeof setImmediate === "function" ? setImmediate : function(fn) {
		process.nextTick(fn.bind.apply(fn, arguments));
	};
	/**
	* Invoke callback when the response has finished, useful for
	* cleaning up resources afterwards.
	*
	* @param {object} msg
	* @param {function} listener
	* @return {object}
	* @public
	*/
	function onFinished(msg, listener) {
		if (isFinished(msg) !== false) {
			defer(listener, null, msg);
			return msg;
		}
		attachListener(msg, listener);
		return msg;
	}
	/**
	* Determine if message is already finished.
	*
	* @param {object} msg
	* @return {boolean}
	* @public
	*/
	function isFinished(msg) {
		var socket = msg.socket;
		if (typeof msg.finished === "boolean") return Boolean(msg.finished || socket && !socket.writable);
		if (typeof msg.complete === "boolean") return Boolean(msg.upgrade || !socket || !socket.readable || msg.complete && !msg.readable);
	}
	/**
	* Attach a finished listener to the message.
	*
	* @param {object} msg
	* @param {function} callback
	* @private
	*/
	function attachFinishedListener(msg, callback) {
		var eeMsg;
		var eeSocket;
		var finished = false;
		function onFinish(error) {
			eeMsg.cancel();
			eeSocket.cancel();
			finished = true;
			callback(error);
		}
		eeMsg = eeSocket = first([[
			msg,
			"end",
			"finish"
		]], onFinish);
		function onSocket(socket) {
			msg.removeListener("socket", onSocket);
			if (finished) return;
			if (eeMsg !== eeSocket) return;
			eeSocket = first([[
				socket,
				"error",
				"close"
			]], onFinish);
		}
		if (msg.socket) {
			onSocket(msg.socket);
			return;
		}
		msg.on("socket", onSocket);
		if (msg.socket === void 0) patchAssignSocket(msg, onSocket);
	}
	/**
	* Attach the listener to the message.
	*
	* @param {object} msg
	* @return {function}
	* @private
	*/
	function attachListener(msg, listener) {
		var attached = msg.__onFinished;
		if (!attached || !attached.queue) {
			attached = msg.__onFinished = createListener(msg);
			attachFinishedListener(msg, attached);
		}
		attached.queue.push(listener);
	}
	/**
	* Create listener on message.
	*
	* @param {object} msg
	* @return {function}
	* @private
	*/
	function createListener(msg) {
		function listener(err) {
			if (msg.__onFinished === listener) msg.__onFinished = null;
			if (!listener.queue) return;
			var queue = listener.queue;
			listener.queue = null;
			for (var i = 0; i < queue.length; i++) queue[i](err, msg);
		}
		listener.queue = [];
		return listener;
	}
	/**
	* Patch ServerResponse.prototype.assignSocket for node.js 0.8.
	*
	* @param {ServerResponse} res
	* @param {function} callback
	* @private
	*/
	function patchAssignSocket(res, callback) {
		var assignSocket = res.assignSocket;
		if (typeof assignSocket !== "function") return;
		res.assignSocket = function _assignSocket(socket) {
			assignSocket.call(this, socket);
			callback(socket);
		};
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/parseurl@1.3.3/node_modules/parseurl/index.js
/*!
* parseurl
* Copyright(c) 2014 Jonathan Ong
* Copyright(c) 2014-2017 Douglas Christopher Wilson
* MIT Licensed
*/
var require_parseurl = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	* @private
	*/
	var url$5 = __require("url");
	var parse = url$5.parse;
	var Url = url$5.Url;
	/**
	* Module exports.
	* @public
	*/
	module.exports = parseurl;
	module.exports.original = originalurl;
	/**
	* Parse the `req` url with memoization.
	*
	* @param {ServerRequest} req
	* @return {Object}
	* @public
	*/
	function parseurl(req) {
		var url = req.url;
		if (url === void 0) return;
		var parsed = req._parsedUrl;
		if (fresh(url, parsed)) return parsed;
		parsed = fastparse(url);
		parsed._raw = url;
		return req._parsedUrl = parsed;
	}
	/**
	* Parse the `req` original url with fallback and memoization.
	*
	* @param {ServerRequest} req
	* @return {Object}
	* @public
	*/
	function originalurl(req) {
		var url = req.originalUrl;
		if (typeof url !== "string") return parseurl(req);
		var parsed = req._parsedOriginalUrl;
		if (fresh(url, parsed)) return parsed;
		parsed = fastparse(url);
		parsed._raw = url;
		return req._parsedOriginalUrl = parsed;
	}
	/**
	* Parse the `str` url with fast-path short-cut.
	*
	* @param {string} str
	* @return {Object}
	* @private
	*/
	function fastparse(str) {
		if (typeof str !== "string" || str.charCodeAt(0) !== 47) return parse(str);
		var pathname = str;
		var query = null;
		var search = null;
		for (var i = 1; i < str.length; i++) switch (str.charCodeAt(i)) {
			case 63:
				if (search === null) {
					pathname = str.substring(0, i);
					query = str.substring(i + 1);
					search = str.substring(i);
				}
				break;
			case 9:
			case 10:
			case 12:
			case 13:
			case 32:
			case 35:
			case 160:
			case 65279: return parse(str);
		}
		var url = Url !== void 0 ? new Url() : {};
		url.path = str;
		url.href = str;
		url.pathname = pathname;
		if (search !== null) {
			url.query = query;
			url.search = search;
		}
		return url;
	}
	/**
	* Determine if parsed is still fresh for url.
	*
	* @param {string} url
	* @param {object} parsedUrl
	* @return {boolean}
	* @private
	*/
	function fresh(url, parsedUrl) {
		return typeof parsedUrl === "object" && parsedUrl !== null && (Url === void 0 || parsedUrl instanceof Url) && parsedUrl._raw === url;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/statuses@1.5.0/node_modules/statuses/codes.json
var require_codes = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		"100": "Continue",
		"101": "Switching Protocols",
		"102": "Processing",
		"103": "Early Hints",
		"200": "OK",
		"201": "Created",
		"202": "Accepted",
		"203": "Non-Authoritative Information",
		"204": "No Content",
		"205": "Reset Content",
		"206": "Partial Content",
		"207": "Multi-Status",
		"208": "Already Reported",
		"226": "IM Used",
		"300": "Multiple Choices",
		"301": "Moved Permanently",
		"302": "Found",
		"303": "See Other",
		"304": "Not Modified",
		"305": "Use Proxy",
		"306": "(Unused)",
		"307": "Temporary Redirect",
		"308": "Permanent Redirect",
		"400": "Bad Request",
		"401": "Unauthorized",
		"402": "Payment Required",
		"403": "Forbidden",
		"404": "Not Found",
		"405": "Method Not Allowed",
		"406": "Not Acceptable",
		"407": "Proxy Authentication Required",
		"408": "Request Timeout",
		"409": "Conflict",
		"410": "Gone",
		"411": "Length Required",
		"412": "Precondition Failed",
		"413": "Payload Too Large",
		"414": "URI Too Long",
		"415": "Unsupported Media Type",
		"416": "Range Not Satisfiable",
		"417": "Expectation Failed",
		"418": "I'm a teapot",
		"421": "Misdirected Request",
		"422": "Unprocessable Entity",
		"423": "Locked",
		"424": "Failed Dependency",
		"425": "Unordered Collection",
		"426": "Upgrade Required",
		"428": "Precondition Required",
		"429": "Too Many Requests",
		"431": "Request Header Fields Too Large",
		"451": "Unavailable For Legal Reasons",
		"500": "Internal Server Error",
		"501": "Not Implemented",
		"502": "Bad Gateway",
		"503": "Service Unavailable",
		"504": "Gateway Timeout",
		"505": "HTTP Version Not Supported",
		"506": "Variant Also Negotiates",
		"507": "Insufficient Storage",
		"508": "Loop Detected",
		"509": "Bandwidth Limit Exceeded",
		"510": "Not Extended",
		"511": "Network Authentication Required"
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/statuses@1.5.0/node_modules/statuses/index.js
/*!
* statuses
* Copyright(c) 2014 Jonathan Ong
* Copyright(c) 2016 Douglas Christopher Wilson
* MIT Licensed
*/
var require_statuses = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	* @private
	*/
	var codes = require_codes();
	/**
	* Module exports.
	* @public
	*/
	module.exports = status;
	status.STATUS_CODES = codes;
	status.codes = populateStatusesMap(status, codes);
	status.redirect = {
		300: true,
		301: true,
		302: true,
		303: true,
		305: true,
		307: true,
		308: true
	};
	status.empty = {
		204: true,
		205: true,
		304: true
	};
	status.retry = {
		502: true,
		503: true,
		504: true
	};
	/**
	* Populate the statuses map for given codes.
	* @private
	*/
	function populateStatusesMap(statuses, codes) {
		var arr = [];
		Object.keys(codes).forEach(function forEachCode(code) {
			var message = codes[code];
			var status = Number(code);
			statuses[status] = message;
			statuses[message] = status;
			statuses[message.toLowerCase()] = status;
			arr.push(status);
		});
		return arr;
	}
	/**
	* Get the status code.
	*
	* Given a number, this will throw if it is not a known status
	* code, otherwise the code will be returned. Given a string,
	* the string will be parsed for a number and return the code
	* if valid, otherwise will lookup the code assuming this is
	* the status message.
	*
	* @param {string|number} code
	* @returns {number}
	* @public
	*/
	function status(code) {
		if (typeof code === "number") {
			if (!status[code]) throw new Error("invalid status code: " + code);
			return code;
		}
		if (typeof code !== "string") throw new TypeError("code must be a number or string");
		var n = parseInt(code, 10);
		if (!isNaN(n)) {
			if (!status[n]) throw new Error("invalid status code: " + n);
			return n;
		}
		n = status[code.toLowerCase()];
		if (!n) throw new Error("invalid status message: \"" + code + "\"");
		return n;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/unpipe@1.0.0/node_modules/unpipe/index.js
/*!
* unpipe
* Copyright(c) 2015 Douglas Christopher Wilson
* MIT Licensed
*/
var require_unpipe = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module exports.
	* @public
	*/
	module.exports = unpipe;
	/**
	* Determine if there are Node.js pipe-like data listeners.
	* @private
	*/
	function hasPipeDataListeners(stream) {
		var listeners = stream.listeners("data");
		for (var i = 0; i < listeners.length; i++) if (listeners[i].name === "ondata") return true;
		return false;
	}
	/**
	* Unpipe a stream from all destinations.
	*
	* @param {object} stream
	* @public
	*/
	function unpipe(stream) {
		if (!stream) throw new TypeError("argument stream is required");
		if (typeof stream.unpipe === "function") {
			stream.unpipe();
			return;
		}
		if (!hasPipeDataListeners(stream)) return;
		var listener;
		var listeners = stream.listeners("close");
		for (var i = 0; i < listeners.length; i++) {
			listener = listeners[i];
			if (listener.name !== "cleanup" && listener.name !== "onclose") continue;
			listener.call(stream);
		}
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/finalhandler@1.1.2/node_modules/finalhandler/index.js
/*!
* finalhandler
* Copyright(c) 2014-2017 Douglas Christopher Wilson
* MIT Licensed
*/
var require_finalhandler = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	* @private
	*/
	var debug = require_src$1()("finalhandler");
	var encodeUrl = require_encodeurl();
	var escapeHtml = require_escape_html();
	var onFinished = require_on_finished();
	var parseUrl = require_parseurl();
	var statuses = require_statuses();
	var unpipe = require_unpipe();
	/**
	* Module variables.
	* @private
	*/
	var DOUBLE_SPACE_REGEXP = /\x20{2}/g;
	var NEWLINE_REGEXP = /\n/g;
	/* istanbul ignore next */
	var defer = typeof setImmediate === "function" ? setImmediate : function(fn) {
		process.nextTick(fn.bind.apply(fn, arguments));
	};
	var isFinished = onFinished.isFinished;
	/**
	* Create a minimal HTML document.
	*
	* @param {string} message
	* @private
	*/
	function createHtmlDocument(message) {
		return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>" + escapeHtml(message).replace(NEWLINE_REGEXP, "<br>").replace(DOUBLE_SPACE_REGEXP, " &nbsp;") + "</pre>\n</body>\n</html>\n";
	}
	/**
	* Module exports.
	* @public
	*/
	module.exports = finalhandler;
	/**
	* Create a function to handle the final response.
	*
	* @param {Request} req
	* @param {Response} res
	* @param {Object} [options]
	* @return {Function}
	* @public
	*/
	function finalhandler(req, res, options) {
		var opts = options || {};
		var env = opts.env || process.env.NODE_ENV || "development";
		var onerror = opts.onerror;
		return function(err) {
			var headers;
			var msg;
			var status;
			if (!err && headersSent(res)) {
				debug("cannot 404 after headers sent");
				return;
			}
			if (err) {
				status = getErrorStatusCode(err);
				if (status === void 0) status = getResponseStatusCode(res);
				else headers = getErrorHeaders(err);
				msg = getErrorMessage(err, status, env);
			} else {
				status = 404;
				msg = "Cannot " + req.method + " " + encodeUrl(getResourceName(req));
			}
			debug("default %s", status);
			if (err && onerror) defer(onerror, err, req, res);
			if (headersSent(res)) {
				debug("cannot %d after headers sent", status);
				req.socket.destroy();
				return;
			}
			send(req, res, status, headers, msg);
		};
	}
	/**
	* Get headers from Error object.
	*
	* @param {Error} err
	* @return {object}
	* @private
	*/
	function getErrorHeaders(err) {
		if (!err.headers || typeof err.headers !== "object") return;
		var headers = Object.create(null);
		var keys = Object.keys(err.headers);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			headers[key] = err.headers[key];
		}
		return headers;
	}
	/**
	* Get message from Error object, fallback to status message.
	*
	* @param {Error} err
	* @param {number} status
	* @param {string} env
	* @return {string}
	* @private
	*/
	function getErrorMessage(err, status, env) {
		var msg;
		if (env !== "production") {
			msg = err.stack;
			if (!msg && typeof err.toString === "function") msg = err.toString();
		}
		return msg || statuses[status];
	}
	/**
	* Get status code from Error object.
	*
	* @param {Error} err
	* @return {number}
	* @private
	*/
	function getErrorStatusCode(err) {
		if (typeof err.status === "number" && err.status >= 400 && err.status < 600) return err.status;
		if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600) return err.statusCode;
	}
	/**
	* Get resource name for the request.
	*
	* This is typically just the original pathname of the request
	* but will fallback to "resource" is that cannot be determined.
	*
	* @param {IncomingMessage} req
	* @return {string}
	* @private
	*/
	function getResourceName(req) {
		try {
			return parseUrl.original(req).pathname;
		} catch (e) {
			return "resource";
		}
	}
	/**
	* Get status code from response.
	*
	* @param {OutgoingMessage} res
	* @return {number}
	* @private
	*/
	function getResponseStatusCode(res) {
		var status = res.statusCode;
		if (typeof status !== "number" || status < 400 || status > 599) status = 500;
		return status;
	}
	/**
	* Determine if the response headers have been sent.
	*
	* @param {object} res
	* @returns {boolean}
	* @private
	*/
	function headersSent(res) {
		return typeof res.headersSent !== "boolean" ? Boolean(res._header) : res.headersSent;
	}
	/**
	* Send response.
	*
	* @param {IncomingMessage} req
	* @param {OutgoingMessage} res
	* @param {number} status
	* @param {object} headers
	* @param {string} message
	* @private
	*/
	function send(req, res, status, headers, message) {
		function write() {
			var body = createHtmlDocument(message);
			res.statusCode = status;
			res.statusMessage = statuses[status];
			setHeaders(res, headers);
			res.setHeader("Content-Security-Policy", "default-src 'none'");
			res.setHeader("X-Content-Type-Options", "nosniff");
			res.setHeader("Content-Type", "text/html; charset=utf-8");
			res.setHeader("Content-Length", Buffer.byteLength(body, "utf8"));
			if (req.method === "HEAD") {
				res.end();
				return;
			}
			res.end(body, "utf8");
		}
		if (isFinished(req)) {
			write();
			return;
		}
		unpipe(req);
		onFinished(req, write);
		req.resume();
	}
	/**
	* Set response headers from an object.
	*
	* @param {OutgoingMessage} res
	* @param {object} headers
	* @private
	*/
	function setHeaders(res, headers) {
		if (!headers) return;
		var keys = Object.keys(headers);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			res.setHeader(key, headers[key]);
		}
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/utils-merge@1.0.1/node_modules/utils-merge/index.js
var require_utils_merge = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Merge object b with object a.
	*
	*     var a = { foo: 'bar' }
	*       , b = { bar: 'baz' };
	*
	*     merge(a, b);
	*     // => { foo: 'bar', bar: 'baz' }
	*
	* @param {Object} a
	* @param {Object} b
	* @return {Object}
	* @api public
	*/
	exports = module.exports = function(a, b) {
		if (a && b) for (var key in b) a[key] = b[key];
		return a;
	};
}));
/*!
* connect
* Copyright(c) 2010 Sencha Inc.
* Copyright(c) 2011 TJ Holowaychuk
* Copyright(c) 2015 Douglas Christopher Wilson
* MIT Licensed
*/
//#endregion
//#region src/middleware/path-rewrite.ts
var import_connect = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	* @private
	*/
	var debug = require_src$1()("connect:dispatcher");
	var EventEmitter = __require("events").EventEmitter;
	var finalhandler = require_finalhandler();
	var http$3 = __require("http");
	var merge = require_utils_merge();
	var parseUrl = require_parseurl();
	/**
	* Module exports.
	* @public
	*/
	module.exports = createServer;
	/**
	* Module variables.
	* @private
	*/
	var env = process.env.NODE_ENV || "development";
	var proto = {};
	/* istanbul ignore next */
	var defer = typeof setImmediate === "function" ? setImmediate : function(fn) {
		process.nextTick(fn.bind.apply(fn, arguments));
	};
	/**
	* Create a new connect server.
	*
	* @return {function}
	* @public
	*/
	function createServer() {
		function app(req, res, next) {
			app.handle(req, res, next);
		}
		merge(app, proto);
		merge(app, EventEmitter.prototype);
		app.route = "/";
		app.stack = [];
		return app;
	}
	/**
	* Utilize the given middleware `handle` to the given `route`,
	* defaulting to _/_. This "route" is the mount-point for the
	* middleware, when given a value other than _/_ the middleware
	* is only effective when that segment is present in the request's
	* pathname.
	*
	* For example if we were to mount a function at _/admin_, it would
	* be invoked on _/admin_, and _/admin/settings_, however it would
	* not be invoked for _/_, or _/posts_.
	*
	* @param {String|Function|Server} route, callback or server
	* @param {Function|Server} callback or server
	* @return {Server} for chaining
	* @public
	*/
	proto.use = function use(route, fn) {
		var handle = fn;
		var path = route;
		if (typeof route !== "string") {
			handle = route;
			path = "/";
		}
		if (typeof handle.handle === "function") {
			var server = handle;
			server.route = path;
			handle = function(req, res, next) {
				server.handle(req, res, next);
			};
		}
		if (handle instanceof http$3.Server) handle = handle.listeners("request")[0];
		if (path[path.length - 1] === "/") path = path.slice(0, -1);
		debug("use %s %s", path || "/", handle.name || "anonymous");
		this.stack.push({
			route: path,
			handle
		});
		return this;
	};
	/**
	* Handle server requests, punting them down
	* the middleware stack.
	*
	* @private
	*/
	proto.handle = function handle(req, res, out) {
		var index = 0;
		var protohost = getProtohost(req.url) || "";
		var removed = "";
		var slashAdded = false;
		var stack = this.stack;
		var done = out || finalhandler(req, res, {
			env,
			onerror: logerror
		});
		req.originalUrl = req.originalUrl || req.url;
		function next(err) {
			if (slashAdded) {
				req.url = req.url.substr(1);
				slashAdded = false;
			}
			if (removed.length !== 0) {
				req.url = protohost + removed + req.url.substr(protohost.length);
				removed = "";
			}
			var layer = stack[index++];
			if (!layer) {
				defer(done, err);
				return;
			}
			var path = parseUrl(req).pathname || "/";
			var route = layer.route;
			if (path.toLowerCase().substr(0, route.length) !== route.toLowerCase()) return next(err);
			var c = path.length > route.length && path[route.length];
			if (c && c !== "/" && c !== ".") return next(err);
			if (route.length !== 0 && route !== "/") {
				removed = route;
				req.url = protohost + req.url.substr(protohost.length + removed.length);
				if (!protohost && req.url[0] !== "/") {
					req.url = "/" + req.url;
					slashAdded = true;
				}
			}
			call(layer.handle, route, err, req, res, next);
		}
		next();
	};
	/**
	* Listen for connections.
	*
	* This method takes the same arguments
	* as node's `http.Server#listen()`.
	*
	* HTTP and HTTPS:
	*
	* If you run your application both as HTTP
	* and HTTPS you may wrap them individually,
	* since your Connect "server" is really just
	* a JavaScript `Function`.
	*
	*      var connect = require('connect')
	*        , http = require('http')
	*        , https = require('https');
	*
	*      var app = connect();
	*
	*      http.createServer(app).listen(80);
	*      https.createServer(options, app).listen(443);
	*
	* @return {http.Server}
	* @api public
	*/
	proto.listen = function listen() {
		var server = http$3.createServer(this);
		return server.listen.apply(server, arguments);
	};
	/**
	* Invoke a route handle.
	* @private
	*/
	function call(handle, route, err, req, res, next) {
		var arity = handle.length;
		var error = err;
		var hasError = Boolean(err);
		debug("%s %s : %s", handle.name || "<anonymous>", route, req.originalUrl);
		try {
			if (hasError && arity === 4) {
				handle(err, req, res, next);
				return;
			} else if (!hasError && arity < 4) {
				handle(req, res, next);
				return;
			}
		} catch (e) {
			error = e;
		}
		next(error);
	}
	/**
	* Log error using console.error.
	*
	* @param {Error} err
	* @private
	*/
	function logerror(err) {
		if (env !== "test") console.error(err.stack || err.toString());
	}
	/**
	* Get get protocol + host for a URL.
	*
	* @param {string} url
	* @private
	*/
	function getProtohost(url) {
		if (url.length === 0 || url[0] === "/") return;
		var fqdnIndex = url.indexOf("://");
		return fqdnIndex !== -1 && url.lastIndexOf("?", fqdnIndex) === -1 ? url.substr(0, url.indexOf("/", 3 + fqdnIndex)) : void 0;
	}
})))(), 1);
function normalizePrefix(value) {
	const prefix = String(value || "").trim();
	if (prefix === "" || prefix === "/") return "";
	return "/" + prefix.replace(/^\/+|\/+$/g, "");
}
function rewritePath(rawUrl, gatewayPrefix) {
	if (!rawUrl || rawUrl === "*") return rawUrl || "/";
	let parsed;
	try {
		parsed = new URL(rawUrl, "http://dsh-gateway.invalid");
	} catch {
		return rawUrl;
	}
	const pathname = parsed.pathname || "/";
	if (gatewayPrefix && (pathname === gatewayPrefix || pathname === gatewayPrefix + "/")) parsed.pathname = "/";
	else if (gatewayPrefix && pathname.startsWith(gatewayPrefix + "/")) parsed.pathname = pathname.slice(gatewayPrefix.length) || "/";
	return (parsed.pathname || "/") + parsed.search;
}
function addGatewayPrefix(path, gatewayPrefix) {
	if (!gatewayPrefix || !path || !path.startsWith("/") || path.startsWith("//")) return path;
	if (path === gatewayPrefix || path.startsWith(gatewayPrefix + "/")) return path;
	return gatewayPrefix + path;
}
function rewriteLocation(value, gatewayPrefix) {
	if (typeof value !== "string") return value;
	return value.startsWith("/") && !value.startsWith("//") ? addGatewayPrefix(value, gatewayPrefix) : value;
}
function pathRewriteMiddleware(gatewayPrefix) {
	return (req, _res, next) => {
		if (req.url) req.url = rewritePath(req.url, gatewayPrefix);
		next();
	};
}
//#endregion
//#region ../../node_modules/.pnpm/eventemitter3@4.0.7/node_modules/eventemitter3/index.js
var require_eventemitter3 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var has = Object.prototype.hasOwnProperty;
	var prefix = "~";
	/**
	* Constructor to create a storage for our `EE` objects.
	* An `Events` instance is a plain object whose properties are event names.
	*
	* @constructor
	* @private
	*/
	function Events() {}
	if (Object.create) {
		Events.prototype = Object.create(null);
		if (!new Events().__proto__) prefix = false;
	}
	/**
	* Representation of a single event listener.
	*
	* @param {Function} fn The listener function.
	* @param {*} context The context to invoke the listener with.
	* @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	* @constructor
	* @private
	*/
	function EE(fn, context, once) {
		this.fn = fn;
		this.context = context;
		this.once = once || false;
	}
	/**
	* Add a listener for a given event.
	*
	* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} context The context to invoke the listener with.
	* @param {Boolean} once Specify if the listener is a one-time listener.
	* @returns {EventEmitter}
	* @private
	*/
	function addListener(emitter, event, fn, context, once) {
		if (typeof fn !== "function") throw new TypeError("The listener must be a function");
		var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
		if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
		else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
		else emitter._events[evt] = [emitter._events[evt], listener];
		return emitter;
	}
	/**
	* Clear event by name.
	*
	* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	* @param {(String|Symbol)} evt The Event name.
	* @private
	*/
	function clearEvent(emitter, evt) {
		if (--emitter._eventsCount === 0) emitter._events = new Events();
		else delete emitter._events[evt];
	}
	/**
	* Minimal `EventEmitter` interface that is molded against the Node.js
	* `EventEmitter` interface.
	*
	* @constructor
	* @public
	*/
	function EventEmitter() {
		this._events = new Events();
		this._eventsCount = 0;
	}
	/**
	* Return an array listing the events for which the emitter has registered
	* listeners.
	*
	* @returns {Array}
	* @public
	*/
	EventEmitter.prototype.eventNames = function eventNames() {
		var names = [], events, name;
		if (this._eventsCount === 0) return names;
		for (name in events = this._events) if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
		if (Object.getOwnPropertySymbols) return names.concat(Object.getOwnPropertySymbols(events));
		return names;
	};
	/**
	* Return the listeners registered for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Array} The registered listeners.
	* @public
	*/
	EventEmitter.prototype.listeners = function listeners(event) {
		var evt = prefix ? prefix + event : event, handlers = this._events[evt];
		if (!handlers) return [];
		if (handlers.fn) return [handlers.fn];
		for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) ee[i] = handlers[i].fn;
		return ee;
	};
	/**
	* Return the number of listeners listening to a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Number} The number of listeners.
	* @public
	*/
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
		var evt = prefix ? prefix + event : event, listeners = this._events[evt];
		if (!listeners) return 0;
		if (listeners.fn) return 1;
		return listeners.length;
	};
	/**
	* Calls each of the listeners registered for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Boolean} `true` if the event had listeners, else `false`.
	* @public
	*/
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
		var evt = prefix ? prefix + event : event;
		if (!this._events[evt]) return false;
		var listeners = this._events[evt], len = arguments.length, args, i;
		if (listeners.fn) {
			if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
			switch (len) {
				case 1: return listeners.fn.call(listeners.context), true;
				case 2: return listeners.fn.call(listeners.context, a1), true;
				case 3: return listeners.fn.call(listeners.context, a1, a2), true;
				case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
				case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
				case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
			}
			for (i = 1, args = new Array(len - 1); i < len; i++) args[i - 1] = arguments[i];
			listeners.fn.apply(listeners.context, args);
		} else {
			var length = listeners.length, j;
			for (i = 0; i < length; i++) {
				if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
				switch (len) {
					case 1:
						listeners[i].fn.call(listeners[i].context);
						break;
					case 2:
						listeners[i].fn.call(listeners[i].context, a1);
						break;
					case 3:
						listeners[i].fn.call(listeners[i].context, a1, a2);
						break;
					case 4:
						listeners[i].fn.call(listeners[i].context, a1, a2, a3);
						break;
					default:
						if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) args[j - 1] = arguments[j];
						listeners[i].fn.apply(listeners[i].context, args);
				}
			}
		}
		return true;
	};
	/**
	* Add a listener for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} [context=this] The context to invoke the listener with.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.on = function on(event, fn, context) {
		return addListener(this, event, fn, context, false);
	};
	/**
	* Add a one-time listener for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} [context=this] The context to invoke the listener with.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.once = function once(event, fn, context) {
		return addListener(this, event, fn, context, true);
	};
	/**
	* Remove the listeners of a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn Only remove the listeners that match this function.
	* @param {*} context Only remove the listeners that have this context.
	* @param {Boolean} once Only remove one-time listeners.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
		var evt = prefix ? prefix + event : event;
		if (!this._events[evt]) return this;
		if (!fn) {
			clearEvent(this, evt);
			return this;
		}
		var listeners = this._events[evt];
		if (listeners.fn) {
			if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) clearEvent(this, evt);
		} else {
			for (var i = 0, events = [], length = listeners.length; i < length; i++) if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) events.push(listeners[i]);
			if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
			else clearEvent(this, evt);
		}
		return this;
	};
	/**
	* Remove all listeners, or those of the specified event.
	*
	* @param {(String|Symbol)} [event] The event name.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
		var evt;
		if (event) {
			evt = prefix ? prefix + event : event;
			if (this._events[evt]) clearEvent(this, evt);
		} else {
			this._events = new Events();
			this._eventsCount = 0;
		}
		return this;
	};
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;
	EventEmitter.prefixed = prefix;
	EventEmitter.EventEmitter = EventEmitter;
	if ("undefined" !== typeof module) module.exports = EventEmitter;
}));
//#endregion
//#region ../../node_modules/.pnpm/requires-port@1.0.0/node_modules/requires-port/index.js
var require_requires_port = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Check if we're required to add a port number.
	*
	* @see https://url.spec.whatwg.org/#default-port
	* @param {Number|String} port Port number we need to check
	* @param {String} protocol Protocol we need to check against.
	* @returns {Boolean} Is it a default port for the given protocol
	* @api private
	*/
	module.exports = function required(port, protocol) {
		protocol = protocol.split(":")[0];
		port = +port;
		if (!port) return false;
		switch (protocol) {
			case "http":
			case "ws": return port !== 80;
			case "https":
			case "wss": return port !== 443;
			case "ftp": return port !== 21;
			case "gopher": return port !== 70;
			case "file": return false;
		}
		return port !== 0;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/lib/http-proxy/common.js
var require_common$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	var common = exports;
	var url$4 = __require("url");
	var extend$1 = __require("util")._extend;
	var required = require_requires_port();
	var upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i;
	var isSSL = /^https|wss/;
	/**
	* Simple Regex for testing if protocol is https
	*/
	common.isSSL = isSSL;
	/**
	* Copies the right headers from `options` and `req` to
	* `outgoing` which is then used to fire the proxied
	* request.
	*
	* Examples:
	*
	*    common.setupOutgoing(outgoing, options, req)
	*    // => { host: ..., hostname: ...}
	*
	* @param {Object} Outgoing Base object to be filled with required properties
	* @param {Object} Options Config object passed to the proxy
	* @param {ClientRequest} Req Request Object
	* @param {String} Forward String to select forward or target
	* 
	* @return {Object} Outgoing Object with all required properties set
	*
	* @api private
	*/
	common.setupOutgoing = function(outgoing, options, req, forward) {
		outgoing.port = options[forward || "target"].port || (isSSL.test(options[forward || "target"].protocol) ? 443 : 80);
		[
			"host",
			"hostname",
			"socketPath",
			"pfx",
			"key",
			"passphrase",
			"cert",
			"ca",
			"ciphers",
			"secureProtocol"
		].forEach(function(e) {
			outgoing[e] = options[forward || "target"][e];
		});
		outgoing.method = options.method || req.method;
		outgoing.headers = extend$1({}, req.headers);
		if (options.headers) extend$1(outgoing.headers, options.headers);
		if (options.auth) outgoing.auth = options.auth;
		if (options.ca) outgoing.ca = options.ca;
		if (isSSL.test(options[forward || "target"].protocol)) outgoing.rejectUnauthorized = typeof options.secure === "undefined" ? true : options.secure;
		outgoing.agent = options.agent || false;
		outgoing.localAddress = options.localAddress;
		if (!outgoing.agent) {
			outgoing.headers = outgoing.headers || {};
			if (typeof outgoing.headers.connection !== "string" || !upgradeHeader.test(outgoing.headers.connection)) outgoing.headers.connection = "close";
		}
		var target = options[forward || "target"];
		var targetPath = target && options.prependPath !== false ? target.path || "" : "";
		var outgoingPath = !options.toProxy ? url$4.parse(req.url).path || "" : req.url;
		outgoingPath = !options.ignorePath ? outgoingPath : "";
		outgoing.path = common.urlJoin(targetPath, outgoingPath);
		if (options.changeOrigin) outgoing.headers.host = required(outgoing.port, options[forward || "target"].protocol) && !hasPort(outgoing.host) ? outgoing.host + ":" + outgoing.port : outgoing.host;
		return outgoing;
	};
	/**
	* Set the proper configuration for sockets,
	* set no delay and set keep alive, also set
	* the timeout to 0.
	*
	* Examples:
	*
	*    common.setupSocket(socket)
	*    // => Socket
	*
	* @param {Socket} Socket instance to setup
	* 
	* @return {Socket} Return the configured socket.
	*
	* @api private
	*/
	common.setupSocket = function(socket) {
		socket.setTimeout(0);
		socket.setNoDelay(true);
		socket.setKeepAlive(true, 0);
		return socket;
	};
	/**
	* Get the port number from the host. Or guess it based on the connection type.
	*
	* @param {Request} req Incoming HTTP request.
	*
	* @return {String} The port number.
	*
	* @api private
	*/
	common.getPort = function(req) {
		var res = req.headers.host ? req.headers.host.match(/:(\d+)/) : "";
		return res ? res[1] : common.hasEncryptedConnection(req) ? "443" : "80";
	};
	/**
	* Check if the request has an encrypted connection.
	*
	* @param {Request} req Incoming HTTP request.
	*
	* @return {Boolean} Whether the connection is encrypted or not.
	*
	* @api private
	*/
	common.hasEncryptedConnection = function(req) {
		return Boolean(req.connection.encrypted || req.connection.pair);
	};
	/**
	* OS-agnostic join (doesn't break on URLs like path.join does on Windows)>
	*
	* @return {String} The generated path.
	*
	* @api private
	*/
	common.urlJoin = function() {
		var args = Array.prototype.slice.call(arguments), lastIndex = args.length - 1, lastSegs = args[lastIndex].split("?"), retSegs;
		args[lastIndex] = lastSegs.shift();
		retSegs = [args.filter(Boolean).join("/").replace(/\/+/g, "/").replace("http:/", "http://").replace("https:/", "https://")];
		retSegs.push.apply(retSegs, lastSegs);
		return retSegs.join("?");
	};
	/**
	* Rewrites or removes the domain of a cookie header
	*
	* @param {String|Array} Header
	* @param {Object} Config, mapping of domain to rewritten domain.
	*                 '*' key to match any domain, null value to remove the domain.
	*
	* @api private
	*/
	common.rewriteCookieProperty = function rewriteCookieProperty(header, config, property) {
		if (Array.isArray(header)) return header.map(function(headerElement) {
			return rewriteCookieProperty(headerElement, config, property);
		});
		return header.replace(new RegExp("(;\\s*" + property + "=)([^;]+)", "i"), function(match, prefix, previousValue) {
			var newValue;
			if (previousValue in config) newValue = config[previousValue];
			else if ("*" in config) newValue = config["*"];
			else return match;
			if (newValue) return prefix + newValue;
			else return "";
		});
	};
	/**
	* Check the host and see if it potentially has a port in it (keep it simple)
	*
	* @returns {Boolean} Whether we have one or not
	*
	* @api private
	*/
	function hasPort(host) {
		return !!~host.indexOf(":");
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/lib/http-proxy/passes/web-outgoing.js
var require_web_outgoing = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var url$3 = __require("url");
	var common = require_common$1();
	var redirectRegex = /^201|30(1|2|7|8)$/;
	/*!
	* Array of passes.
	*
	* A `pass` is just a function that is executed on `req, res, options`
	* so that you can easily add new checks while still keeping the base
	* flexible.
	*/
	module.exports = {
		/**
		* If is a HTTP 1.0 request, remove chunk headers
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {proxyResponse} Res Response object from the proxy request
		*
		* @api private
		*/
		removeChunked: function removeChunked(req, res, proxyRes) {
			if (req.httpVersion === "1.0") delete proxyRes.headers["transfer-encoding"];
		},
		/**
		* If is a HTTP 1.0 request, set the correct connection header
		* or if connection header not present, then use `keep-alive`
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {proxyResponse} Res Response object from the proxy request
		*
		* @api private
		*/
		setConnection: function setConnection(req, res, proxyRes) {
			if (req.httpVersion === "1.0") proxyRes.headers.connection = req.headers.connection || "close";
			else if (req.httpVersion !== "2.0" && !proxyRes.headers.connection) proxyRes.headers.connection = req.headers.connection || "keep-alive";
		},
		setRedirectHostRewrite: function setRedirectHostRewrite(req, res, proxyRes, options) {
			if ((options.hostRewrite || options.autoRewrite || options.protocolRewrite) && proxyRes.headers["location"] && redirectRegex.test(proxyRes.statusCode)) {
				var target = url$3.parse(options.target);
				var u = url$3.parse(proxyRes.headers["location"]);
				if (target.host != u.host) return;
				if (options.hostRewrite) u.host = options.hostRewrite;
				else if (options.autoRewrite) u.host = req.headers["host"];
				if (options.protocolRewrite) u.protocol = options.protocolRewrite;
				proxyRes.headers["location"] = u.format();
			}
		},
		/**
		* Copy headers from proxyResponse to response
		* set each header in response object.
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {proxyResponse} Res Response object from the proxy request
		* @param {Object} Options options.cookieDomainRewrite: Config to rewrite cookie domain
		*
		* @api private
		*/
		writeHeaders: function writeHeaders(req, res, proxyRes, options) {
			var rewriteCookieDomainConfig = options.cookieDomainRewrite, rewriteCookiePathConfig = options.cookiePathRewrite, preserveHeaderKeyCase = options.preserveHeaderKeyCase, rawHeaderKeyMap, setHeader = function(key, header) {
				if (header == void 0) return;
				if (rewriteCookieDomainConfig && key.toLowerCase() === "set-cookie") header = common.rewriteCookieProperty(header, rewriteCookieDomainConfig, "domain");
				if (rewriteCookiePathConfig && key.toLowerCase() === "set-cookie") header = common.rewriteCookieProperty(header, rewriteCookiePathConfig, "path");
				res.setHeader(String(key).trim(), header);
			};
			if (typeof rewriteCookieDomainConfig === "string") rewriteCookieDomainConfig = { "*": rewriteCookieDomainConfig };
			if (typeof rewriteCookiePathConfig === "string") rewriteCookiePathConfig = { "*": rewriteCookiePathConfig };
			if (preserveHeaderKeyCase && proxyRes.rawHeaders != void 0) {
				rawHeaderKeyMap = {};
				for (var i = 0; i < proxyRes.rawHeaders.length; i += 2) {
					var key = proxyRes.rawHeaders[i];
					rawHeaderKeyMap[key.toLowerCase()] = key;
				}
			}
			Object.keys(proxyRes.headers).forEach(function(key) {
				var header = proxyRes.headers[key];
				if (preserveHeaderKeyCase && rawHeaderKeyMap) key = rawHeaderKeyMap[key] || key;
				setHeader(key, header);
			});
		},
		/**
		* Set the statusCode from the proxyResponse
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {proxyResponse} Res Response object from the proxy request
		*
		* @api private
		*/
		writeStatusCode: function writeStatusCode(req, res, proxyRes) {
			if (proxyRes.statusMessage) {
				res.statusCode = proxyRes.statusCode;
				res.statusMessage = proxyRes.statusMessage;
			} else res.statusCode = proxyRes.statusCode;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Helpers.
	*/
	var s = 1e3;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var w = d * 7;
	var y = d * 365.25;
	/**
	* Parse or format the given `val`.
	*
	* Options:
	*
	*  - `long` verbose formatting [false]
	*
	* @param {String|Number} val
	* @param {Object} [options]
	* @throws {Error} throw an error if val is not a non-empty string or a number
	* @return {String|Number}
	* @api public
	*/
	module.exports = function(val, options) {
		options = options || {};
		var type = typeof val;
		if (type === "string" && val.length > 0) return parse(val);
		else if (type === "number" && isFinite(val)) return options.long ? fmtLong(val) : fmtShort(val);
		throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
	};
	/**
	* Parse the given `str` and return milliseconds.
	*
	* @param {String} str
	* @return {Number}
	* @api private
	*/
	function parse(str) {
		str = String(str);
		if (str.length > 100) return;
		var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
		if (!match) return;
		var n = parseFloat(match[1]);
		switch ((match[2] || "ms").toLowerCase()) {
			case "years":
			case "year":
			case "yrs":
			case "yr":
			case "y": return n * y;
			case "weeks":
			case "week":
			case "w": return n * w;
			case "days":
			case "day":
			case "d": return n * d;
			case "hours":
			case "hour":
			case "hrs":
			case "hr":
			case "h": return n * h;
			case "minutes":
			case "minute":
			case "mins":
			case "min":
			case "m": return n * m;
			case "seconds":
			case "second":
			case "secs":
			case "sec":
			case "s": return n * s;
			case "milliseconds":
			case "millisecond":
			case "msecs":
			case "msec":
			case "ms": return n;
			default: return;
		}
	}
	/**
	* Short format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtShort(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) return Math.round(ms / d) + "d";
		if (msAbs >= h) return Math.round(ms / h) + "h";
		if (msAbs >= m) return Math.round(ms / m) + "m";
		if (msAbs >= s) return Math.round(ms / s) + "s";
		return ms + "ms";
	}
	/**
	* Long format for `ms`.
	*
	* @param {Number} ms
	* @return {String}
	* @api private
	*/
	function fmtLong(ms) {
		var msAbs = Math.abs(ms);
		if (msAbs >= d) return plural(ms, msAbs, d, "day");
		if (msAbs >= h) return plural(ms, msAbs, h, "hour");
		if (msAbs >= m) return plural(ms, msAbs, m, "minute");
		if (msAbs >= s) return plural(ms, msAbs, s, "second");
		return ms + " ms";
	}
	/**
	* Pluralization helper.
	*/
	function plural(ms, msAbs, n, name) {
		var isPlural = msAbs >= n * 1.5;
		return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js
var require_common = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This is the common logic for both the Node.js and web browser
	* implementations of `debug()`.
	*/
	function setup(env) {
		createDebug.debug = createDebug;
		createDebug.default = createDebug;
		createDebug.coerce = coerce;
		createDebug.disable = disable;
		createDebug.enable = enable;
		createDebug.enabled = enabled;
		createDebug.humanize = require_ms();
		createDebug.destroy = destroy;
		Object.keys(env).forEach((key) => {
			createDebug[key] = env[key];
		});
		/**
		* The currently active debug mode names, and names to skip.
		*/
		createDebug.names = [];
		createDebug.skips = [];
		/**
		* Map of special "%n" handling functions, for the debug "format" argument.
		*
		* Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
		*/
		createDebug.formatters = {};
		/**
		* Selects a color for a debug namespace
		* @param {String} namespace The namespace string for the debug instance to be colored
		* @return {Number|String} An ANSI color code for the given namespace
		* @api private
		*/
		function selectColor(namespace) {
			let hash = 0;
			for (let i = 0; i < namespace.length; i++) {
				hash = (hash << 5) - hash + namespace.charCodeAt(i);
				hash |= 0;
			}
			return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
		}
		createDebug.selectColor = selectColor;
		/**
		* Create a debugger with the given `namespace`.
		*
		* @param {String} namespace
		* @return {Function}
		* @api public
		*/
		function createDebug(namespace) {
			let prevTime;
			let enableOverride = null;
			let namespacesCache;
			let enabledCache;
			function debug(...args) {
				if (!debug.enabled) return;
				const self = debug;
				const curr = Number(/* @__PURE__ */ new Date());
				self.diff = curr - (prevTime || curr);
				self.prev = prevTime;
				self.curr = curr;
				prevTime = curr;
				args[0] = createDebug.coerce(args[0]);
				if (typeof args[0] !== "string") args.unshift("%O");
				let index = 0;
				args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
					if (match === "%%") return "%";
					index++;
					const formatter = createDebug.formatters[format];
					if (typeof formatter === "function") {
						const val = args[index];
						match = formatter.call(self, val);
						args.splice(index, 1);
						index--;
					}
					return match;
				});
				createDebug.formatArgs.call(self, args);
				(self.log || createDebug.log).apply(self, args);
			}
			debug.namespace = namespace;
			debug.useColors = createDebug.useColors();
			debug.color = createDebug.selectColor(namespace);
			debug.extend = extend;
			debug.destroy = createDebug.destroy;
			Object.defineProperty(debug, "enabled", {
				enumerable: true,
				configurable: false,
				get: () => {
					if (enableOverride !== null) return enableOverride;
					if (namespacesCache !== createDebug.namespaces) {
						namespacesCache = createDebug.namespaces;
						enabledCache = createDebug.enabled(namespace);
					}
					return enabledCache;
				},
				set: (v) => {
					enableOverride = v;
				}
			});
			if (typeof createDebug.init === "function") createDebug.init(debug);
			return debug;
		}
		function extend(namespace, delimiter) {
			const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
			newDebug.log = this.log;
			return newDebug;
		}
		/**
		* Enables a debug mode by namespaces. This can include modes
		* separated by a colon and wildcards.
		*
		* @param {String} namespaces
		* @api public
		*/
		function enable(namespaces) {
			createDebug.save(namespaces);
			createDebug.namespaces = namespaces;
			createDebug.names = [];
			createDebug.skips = [];
			const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
			for (const ns of split) if (ns[0] === "-") createDebug.skips.push(ns.slice(1));
			else createDebug.names.push(ns);
		}
		/**
		* Checks if the given string matches a namespace template, honoring
		* asterisks as wildcards.
		*
		* @param {String} search
		* @param {String} template
		* @return {Boolean}
		*/
		function matchesTemplate(search, template) {
			let searchIndex = 0;
			let templateIndex = 0;
			let starIndex = -1;
			let matchIndex = 0;
			while (searchIndex < search.length) if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
				if (template[templateIndex] === "*") {
					starIndex = templateIndex;
					matchIndex = searchIndex;
					templateIndex++;
				} else {
					searchIndex++;
					templateIndex++;
				}
			} else if (starIndex !== -1) {
				templateIndex = starIndex + 1;
				matchIndex++;
				searchIndex = matchIndex;
			} else return false;
			while (templateIndex < template.length && template[templateIndex] === "*") templateIndex++;
			return templateIndex === template.length;
		}
		/**
		* Disable debug output.
		*
		* @return {String} namespaces
		* @api public
		*/
		function disable() {
			const namespaces = [...createDebug.names, ...createDebug.skips.map((namespace) => "-" + namespace)].join(",");
			createDebug.enable("");
			return namespaces;
		}
		/**
		* Returns true if the given mode name is enabled, false otherwise.
		*
		* @param {String} name
		* @return {Boolean}
		* @api public
		*/
		function enabled(name) {
			for (const skip of createDebug.skips) if (matchesTemplate(name, skip)) return false;
			for (const ns of createDebug.names) if (matchesTemplate(name, ns)) return true;
			return false;
		}
		/**
		* Coerce `val`.
		*
		* @param {Mixed} val
		* @return {Mixed}
		* @api private
		*/
		function coerce(val) {
			if (val instanceof Error) return val.stack || val.message;
			return val;
		}
		/**
		* XXX DO NOT USE. This is a temporary stub function.
		* XXX It WILL be removed in the next major release.
		*/
		function destroy() {
			console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
		}
		createDebug.enable(createDebug.load());
		return createDebug;
	}
	module.exports = setup;
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* This is the web browser implementation of `debug()`.
	*/
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = localstorage();
	exports.destroy = (() => {
		let warned = false;
		return () => {
			if (!warned) {
				warned = true;
				console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
			}
		};
	})();
	/**
	* Colors.
	*/
	exports.colors = [
		"#0000CC",
		"#0000FF",
		"#0033CC",
		"#0033FF",
		"#0066CC",
		"#0066FF",
		"#0099CC",
		"#0099FF",
		"#00CC00",
		"#00CC33",
		"#00CC66",
		"#00CC99",
		"#00CCCC",
		"#00CCFF",
		"#3300CC",
		"#3300FF",
		"#3333CC",
		"#3333FF",
		"#3366CC",
		"#3366FF",
		"#3399CC",
		"#3399FF",
		"#33CC00",
		"#33CC33",
		"#33CC66",
		"#33CC99",
		"#33CCCC",
		"#33CCFF",
		"#6600CC",
		"#6600FF",
		"#6633CC",
		"#6633FF",
		"#66CC00",
		"#66CC33",
		"#9900CC",
		"#9900FF",
		"#9933CC",
		"#9933FF",
		"#99CC00",
		"#99CC33",
		"#CC0000",
		"#CC0033",
		"#CC0066",
		"#CC0099",
		"#CC00CC",
		"#CC00FF",
		"#CC3300",
		"#CC3333",
		"#CC3366",
		"#CC3399",
		"#CC33CC",
		"#CC33FF",
		"#CC6600",
		"#CC6633",
		"#CC9900",
		"#CC9933",
		"#CCCC00",
		"#CCCC33",
		"#FF0000",
		"#FF0033",
		"#FF0066",
		"#FF0099",
		"#FF00CC",
		"#FF00FF",
		"#FF3300",
		"#FF3333",
		"#FF3366",
		"#FF3399",
		"#FF33CC",
		"#FF33FF",
		"#FF6600",
		"#FF6633",
		"#FF9900",
		"#FF9933",
		"#FFCC00",
		"#FFCC33"
	];
	/**
	* Currently only WebKit-based Web Inspectors, Firefox >= v31,
	* and the Firebug extension (any Firefox version) are known
	* to support "%c" CSS customizations.
	*
	* TODO: add a `localStorage` variable to explicitly enable/disable colors
	*/
	function useColors() {
		if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) return true;
		if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) return false;
		let m;
		return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
	}
	/**
	* Colorize log arguments if enabled.
	*
	* @api public
	*/
	function formatArgs(args) {
		args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
		if (!this.useColors) return;
		const c = "color: " + this.color;
		args.splice(1, 0, c, "color: inherit");
		let index = 0;
		let lastC = 0;
		args[0].replace(/%[a-zA-Z%]/g, (match) => {
			if (match === "%%") return;
			index++;
			if (match === "%c") lastC = index;
		});
		args.splice(lastC, 0, c);
	}
	/**
	* Invokes `console.debug()` when available.
	* No-op when `console.debug` is not a "function".
	* If `console.debug` is not available, falls back
	* to `console.log`.
	*
	* @api public
	*/
	exports.log = console.debug || console.log || (() => {});
	/**
	* Save `namespaces`.
	*
	* @param {String} namespaces
	* @api private
	*/
	function save(namespaces) {
		try {
			if (namespaces) exports.storage.setItem("debug", namespaces);
			else exports.storage.removeItem("debug");
		} catch (error) {}
	}
	/**
	* Load `namespaces`.
	*
	* @return {String} returns the previously persisted debug modes
	* @api private
	*/
	function load() {
		let r;
		try {
			r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
		} catch (error) {}
		if (!r && typeof process !== "undefined" && "env" in process) r = process.env.DEBUG;
		return r;
	}
	/**
	* Localstorage attempts to return the localstorage.
	*
	* This is necessary because safari throws
	* when a user disables cookies/localstorage
	* and you attempt to access it.
	*
	* @return {LocalStorage}
	* @api private
	*/
	function localstorage() {
		try {
			return localStorage;
		} catch (error) {}
	}
	module.exports = require_common()(exports);
	const { formatters } = module.exports;
	/**
	* Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	*/
	formatters.j = function(v) {
		try {
			return JSON.stringify(v);
		} catch (error) {
			return "[UnexpectedJSONParseError]: " + error.message;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js
var require_node = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Module dependencies.
	*/
	const tty = __require("tty");
	const util$2 = __require("util");
	/**
	* This is the Node.js implementation of `debug()`.
	*/
	exports.init = init;
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.destroy = util$2.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
	/**
	* Colors.
	*/
	exports.colors = [
		6,
		2,
		3,
		4,
		5,
		1
	];
	try {
		const supportsColor = __require("supports-color");
		if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) exports.colors = [
			20,
			21,
			26,
			27,
			32,
			33,
			38,
			39,
			40,
			41,
			42,
			43,
			44,
			45,
			56,
			57,
			62,
			63,
			68,
			69,
			74,
			75,
			76,
			77,
			78,
			79,
			80,
			81,
			92,
			93,
			98,
			99,
			112,
			113,
			128,
			129,
			134,
			135,
			148,
			149,
			160,
			161,
			162,
			163,
			164,
			165,
			166,
			167,
			168,
			169,
			170,
			171,
			172,
			173,
			178,
			179,
			184,
			185,
			196,
			197,
			198,
			199,
			200,
			201,
			202,
			203,
			204,
			205,
			206,
			207,
			208,
			209,
			214,
			215,
			220,
			221
		];
	} catch (error) {}
	/**
	* Build up the default `inspectOpts` object from the environment variables.
	*
	*   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
	*/
	exports.inspectOpts = Object.keys(process.env).filter((key) => {
		return /^debug_/i.test(key);
	}).reduce((obj, key) => {
		const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
			return k.toUpperCase();
		});
		let val = process.env[key];
		if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
		else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
		else if (val === "null") val = null;
		else val = Number(val);
		obj[prop] = val;
		return obj;
	}, {});
	/**
	* Is stdout a TTY? Colored output is enabled when `true`.
	*/
	function useColors() {
		return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
	}
	/**
	* Adds ANSI color escape codes if enabled.
	*
	* @api public
	*/
	function formatArgs(args) {
		const { namespace: name, useColors } = this;
		if (useColors) {
			const c = this.color;
			const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
			const prefix = `  ${colorCode};1m${name} \u001B[0m`;
			args[0] = prefix + args[0].split("\n").join("\n" + prefix);
			args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
		} else args[0] = getDate() + name + " " + args[0];
	}
	function getDate() {
		if (exports.inspectOpts.hideDate) return "";
		return (/* @__PURE__ */ new Date()).toISOString() + " ";
	}
	/**
	* Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
	*/
	function log(...args) {
		return process.stderr.write(util$2.formatWithOptions(exports.inspectOpts, ...args) + "\n");
	}
	/**
	* Save `namespaces`.
	*
	* @param {String} namespaces
	* @api private
	*/
	function save(namespaces) {
		if (namespaces) process.env.DEBUG = namespaces;
		else delete process.env.DEBUG;
	}
	/**
	* Load `namespaces`.
	*
	* @return {String} returns the previously persisted debug modes
	* @api private
	*/
	function load() {
		return process.env.DEBUG;
	}
	/**
	* Init logic for `debug` instances.
	*
	* Create a new `inspectOpts` object in case `useColors` is set
	* differently for a particular `debug` instance.
	*/
	function init(debug) {
		debug.inspectOpts = {};
		const keys = Object.keys(exports.inspectOpts);
		for (let i = 0; i < keys.length; i++) debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
	}
	module.exports = require_common()(exports);
	const { formatters } = module.exports;
	/**
	* Map %o to `util.inspect()`, all on a single line.
	*/
	formatters.o = function(v) {
		this.inspectOpts.colors = this.useColors;
		return util$2.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
	};
	/**
	* Map %O to `util.inspect()`, allowing multiple lines if needed.
	*/
	formatters.O = function(v) {
		this.inspectOpts.colors = this.useColors;
		return util$2.inspect(v, this.inspectOpts);
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js
var require_src = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/**
	* Detect Electron renderer / nwjs process, which is node, but we should
	* treat as a browser.
	*/
	if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) module.exports = require_browser();
	else module.exports = require_node();
}));
//#endregion
//#region ../../node_modules/.pnpm/follow-redirects@1.16.0_debug@4.4.3/node_modules/follow-redirects/debug.js
var require_debug$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var debug;
	module.exports = function() {
		if (!debug) {
			try {
				debug = require_src()("follow-redirects");
			} catch (error) {}
			if (typeof debug !== "function") debug = function() {};
		}
		debug.apply(null, arguments);
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/follow-redirects@1.16.0_debug@4.4.3/node_modules/follow-redirects/index.js
var require_follow_redirects = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var url$2 = __require("url");
	var URL = url$2.URL;
	var http$2 = __require("http");
	var https$2 = __require("https");
	var Writable = __require("stream").Writable;
	var assert = __require("assert");
	var debug = require_debug$1();
	// istanbul ignore next
	(function detectUnsupportedEnvironment() {
		var looksLikeNode = typeof process !== "undefined";
		var looksLikeBrowser = typeof window !== "undefined" && typeof document !== "undefined";
		var looksLikeV8 = isFunction(Error.captureStackTrace);
		if (!looksLikeNode && (looksLikeBrowser || !looksLikeV8)) console.warn("The follow-redirects package should be excluded from browser builds.");
	})();
	var useNativeURL = false;
	try {
		assert(new URL(""));
	} catch (error) {
		useNativeURL = error.code === "ERR_INVALID_URL";
	}
	var sensitiveHeaders = [
		"Authorization",
		"Proxy-Authorization",
		"Cookie"
	];
	var preservedUrlFields = [
		"auth",
		"host",
		"hostname",
		"href",
		"path",
		"pathname",
		"port",
		"protocol",
		"query",
		"search",
		"hash"
	];
	var events = [
		"abort",
		"aborted",
		"connect",
		"error",
		"socket",
		"timeout"
	];
	var eventHandlers = Object.create(null);
	events.forEach(function(event) {
		eventHandlers[event] = function(arg1, arg2, arg3) {
			this._redirectable.emit(event, arg1, arg2, arg3);
		};
	});
	var InvalidUrlError = createErrorType("ERR_INVALID_URL", "Invalid URL", TypeError);
	var RedirectionError = createErrorType("ERR_FR_REDIRECTION_FAILURE", "Redirected request failed");
	var TooManyRedirectsError = createErrorType("ERR_FR_TOO_MANY_REDIRECTS", "Maximum number of redirects exceeded", RedirectionError);
	var MaxBodyLengthExceededError = createErrorType("ERR_FR_MAX_BODY_LENGTH_EXCEEDED", "Request body larger than maxBodyLength limit");
	var WriteAfterEndError = createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
	// istanbul ignore next
	var destroy = Writable.prototype.destroy || noop;
	function RedirectableRequest(options, responseCallback) {
		Writable.call(this);
		this._sanitizeOptions(options);
		this._options = options;
		this._ended = false;
		this._ending = false;
		this._redirectCount = 0;
		this._redirects = [];
		this._requestBodyLength = 0;
		this._requestBodyBuffers = [];
		if (responseCallback) this.on("response", responseCallback);
		var self = this;
		this._onNativeResponse = function(response) {
			try {
				self._processResponse(response);
			} catch (cause) {
				self.emit("error", cause instanceof RedirectionError ? cause : new RedirectionError({ cause }));
			}
		};
		this._headerFilter = new RegExp("^(?:" + sensitiveHeaders.concat(options.sensitiveHeaders).map(escapeRegex).join("|") + ")$", "i");
		this._performRequest();
	}
	RedirectableRequest.prototype = Object.create(Writable.prototype);
	RedirectableRequest.prototype.abort = function() {
		destroyRequest(this._currentRequest);
		this._currentRequest.abort();
		this.emit("abort");
	};
	RedirectableRequest.prototype.destroy = function(error) {
		destroyRequest(this._currentRequest, error);
		destroy.call(this, error);
		return this;
	};
	RedirectableRequest.prototype.write = function(data, encoding, callback) {
		if (this._ending) throw new WriteAfterEndError();
		if (!isString(data) && !isBuffer(data)) throw new TypeError("data should be a string, Buffer or Uint8Array");
		if (isFunction(encoding)) {
			callback = encoding;
			encoding = null;
		}
		if (data.length === 0) {
			if (callback) callback();
			return;
		}
		if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
			this._requestBodyLength += data.length;
			this._requestBodyBuffers.push({
				data,
				encoding
			});
			this._currentRequest.write(data, encoding, callback);
		} else {
			this.emit("error", new MaxBodyLengthExceededError());
			this.abort();
		}
	};
	RedirectableRequest.prototype.end = function(data, encoding, callback) {
		if (isFunction(data)) {
			callback = data;
			data = encoding = null;
		} else if (isFunction(encoding)) {
			callback = encoding;
			encoding = null;
		}
		if (!data) {
			this._ended = this._ending = true;
			this._currentRequest.end(null, null, callback);
		} else {
			var self = this;
			var currentRequest = this._currentRequest;
			this.write(data, encoding, function() {
				self._ended = true;
				currentRequest.end(null, null, callback);
			});
			this._ending = true;
		}
	};
	RedirectableRequest.prototype.setHeader = function(name, value) {
		this._options.headers[name] = value;
		this._currentRequest.setHeader(name, value);
	};
	RedirectableRequest.prototype.removeHeader = function(name) {
		delete this._options.headers[name];
		this._currentRequest.removeHeader(name);
	};
	RedirectableRequest.prototype.setTimeout = function(msecs, callback) {
		var self = this;
		function destroyOnTimeout(socket) {
			socket.setTimeout(msecs);
			socket.removeListener("timeout", socket.destroy);
			socket.addListener("timeout", socket.destroy);
		}
		function startTimer(socket) {
			if (self._timeout) clearTimeout(self._timeout);
			self._timeout = setTimeout(function() {
				self.emit("timeout");
				clearTimer();
			}, msecs);
			destroyOnTimeout(socket);
		}
		function clearTimer() {
			if (self._timeout) {
				clearTimeout(self._timeout);
				self._timeout = null;
			}
			self.removeListener("abort", clearTimer);
			self.removeListener("error", clearTimer);
			self.removeListener("response", clearTimer);
			self.removeListener("close", clearTimer);
			if (callback) self.removeListener("timeout", callback);
			if (!self.socket) self._currentRequest.removeListener("socket", startTimer);
		}
		if (callback) this.on("timeout", callback);
		if (this.socket) startTimer(this.socket);
		else this._currentRequest.once("socket", startTimer);
		this.on("socket", destroyOnTimeout);
		this.on("abort", clearTimer);
		this.on("error", clearTimer);
		this.on("response", clearTimer);
		this.on("close", clearTimer);
		return this;
	};
	[
		"flushHeaders",
		"getHeader",
		"setNoDelay",
		"setSocketKeepAlive"
	].forEach(function(method) {
		RedirectableRequest.prototype[method] = function(a, b) {
			return this._currentRequest[method](a, b);
		};
	});
	[
		"aborted",
		"connection",
		"socket"
	].forEach(function(property) {
		Object.defineProperty(RedirectableRequest.prototype, property, { get: function() {
			return this._currentRequest[property];
		} });
	});
	RedirectableRequest.prototype._sanitizeOptions = function(options) {
		if (!options.headers) options.headers = {};
		if (!isArray(options.sensitiveHeaders)) options.sensitiveHeaders = [];
		if (options.host) {
			if (!options.hostname) options.hostname = options.host;
			delete options.host;
		}
		if (!options.pathname && options.path) {
			var searchPos = options.path.indexOf("?");
			if (searchPos < 0) options.pathname = options.path;
			else {
				options.pathname = options.path.substring(0, searchPos);
				options.search = options.path.substring(searchPos);
			}
		}
	};
	RedirectableRequest.prototype._performRequest = function() {
		var protocol = this._options.protocol;
		var nativeProtocol = this._options.nativeProtocols[protocol];
		if (!nativeProtocol) throw new TypeError("Unsupported protocol " + protocol);
		if (this._options.agents) {
			var scheme = protocol.slice(0, -1);
			this._options.agent = this._options.agents[scheme];
		}
		var request = this._currentRequest = nativeProtocol.request(this._options, this._onNativeResponse);
		request._redirectable = this;
		for (var event of events) request.on(event, eventHandlers[event]);
		this._currentUrl = /^\//.test(this._options.path) ? url$2.format(this._options) : this._options.path;
		if (this._isRedirect) {
			var i = 0;
			var self = this;
			var buffers = this._requestBodyBuffers;
			(function writeNext(error) {
				// istanbul ignore else
				if (request === self._currentRequest) {
					// istanbul ignore if
					if (error) self.emit("error", error);
					else if (i < buffers.length) {
						var buffer = buffers[i++];
						// istanbul ignore else
						if (!request.finished) request.write(buffer.data, buffer.encoding, writeNext);
					} else if (self._ended) request.end();
				}
			})();
		}
	};
	RedirectableRequest.prototype._processResponse = function(response) {
		var statusCode = response.statusCode;
		if (this._options.trackRedirects) this._redirects.push({
			url: this._currentUrl,
			headers: response.headers,
			statusCode
		});
		var location = response.headers.location;
		if (!location || this._options.followRedirects === false || statusCode < 300 || statusCode >= 400) {
			response.responseUrl = this._currentUrl;
			response.redirects = this._redirects;
			this.emit("response", response);
			this._requestBodyBuffers = [];
			return;
		}
		destroyRequest(this._currentRequest);
		response.destroy();
		if (++this._redirectCount > this._options.maxRedirects) throw new TooManyRedirectsError();
		var requestHeaders;
		var beforeRedirect = this._options.beforeRedirect;
		if (beforeRedirect) requestHeaders = Object.assign({ Host: response.req.getHeader("host") }, this._options.headers);
		var method = this._options.method;
		if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" || statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method)) {
			this._options.method = "GET";
			this._requestBodyBuffers = [];
			removeMatchingHeaders(/^content-/i, this._options.headers);
		}
		var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
		var currentUrlParts = parseUrl(this._currentUrl);
		var currentHost = currentHostHeader || currentUrlParts.host;
		var currentUrl = /^\w+:/.test(location) ? this._currentUrl : url$2.format(Object.assign(currentUrlParts, { host: currentHost }));
		var redirectUrl = resolveUrl(location, currentUrl);
		debug("redirecting to", redirectUrl.href);
		this._isRedirect = true;
		spreadUrlObject(redirectUrl, this._options);
		if (redirectUrl.protocol !== currentUrlParts.protocol && redirectUrl.protocol !== "https:" || redirectUrl.host !== currentHost && !isSubdomain(redirectUrl.host, currentHost)) removeMatchingHeaders(this._headerFilter, this._options.headers);
		if (isFunction(beforeRedirect)) {
			var responseDetails = {
				headers: response.headers,
				statusCode
			};
			var requestDetails = {
				url: currentUrl,
				method,
				headers: requestHeaders
			};
			beforeRedirect(this._options, responseDetails, requestDetails);
			this._sanitizeOptions(this._options);
		}
		this._performRequest();
	};
	function wrap(protocols) {
		var exports$5 = {
			maxRedirects: 21,
			maxBodyLength: 10485760
		};
		var nativeProtocols = {};
		Object.keys(protocols).forEach(function(scheme) {
			var protocol = scheme + ":";
			var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
			var wrappedProtocol = exports$5[scheme] = Object.create(nativeProtocol);
			function request(input, options, callback) {
				if (isURL(input)) input = spreadUrlObject(input);
				else if (isString(input)) input = spreadUrlObject(parseUrl(input));
				else {
					callback = options;
					options = validateUrl(input);
					input = { protocol };
				}
				if (isFunction(options)) {
					callback = options;
					options = null;
				}
				options = Object.assign({
					maxRedirects: exports$5.maxRedirects,
					maxBodyLength: exports$5.maxBodyLength
				}, input, options);
				options.nativeProtocols = nativeProtocols;
				if (!isString(options.host) && !isString(options.hostname)) options.hostname = "::1";
				assert.equal(options.protocol, protocol, "protocol mismatch");
				debug("options", options);
				return new RedirectableRequest(options, callback);
			}
			function get(input, options, callback) {
				var wrappedRequest = wrappedProtocol.request(input, options, callback);
				wrappedRequest.end();
				return wrappedRequest;
			}
			Object.defineProperties(wrappedProtocol, {
				request: {
					value: request,
					configurable: true,
					enumerable: true,
					writable: true
				},
				get: {
					value: get,
					configurable: true,
					enumerable: true,
					writable: true
				}
			});
		});
		return exports$5;
	}
	function noop() {}
	function parseUrl(input) {
		var parsed;
		// istanbul ignore else
		if (useNativeURL) parsed = new URL(input);
		else {
			parsed = validateUrl(url$2.parse(input));
			if (!isString(parsed.protocol)) throw new InvalidUrlError({ input });
		}
		return parsed;
	}
	function resolveUrl(relative, base) {
		// istanbul ignore next
		return useNativeURL ? new URL(relative, base) : parseUrl(url$2.resolve(base, relative));
	}
	function validateUrl(input) {
		if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) throw new InvalidUrlError({ input: input.href || input });
		if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) throw new InvalidUrlError({ input: input.href || input });
		return input;
	}
	function spreadUrlObject(urlObject, target) {
		var spread = target || {};
		for (var key of preservedUrlFields) spread[key] = urlObject[key];
		if (spread.hostname.startsWith("[")) spread.hostname = spread.hostname.slice(1, -1);
		if (spread.port !== "") spread.port = Number(spread.port);
		spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;
		return spread;
	}
	function removeMatchingHeaders(regex, headers) {
		var lastValue;
		for (var header in headers) if (regex.test(header)) {
			lastValue = headers[header];
			delete headers[header];
		}
		return lastValue === null || typeof lastValue === "undefined" ? void 0 : String(lastValue).trim();
	}
	function createErrorType(code, message, baseClass) {
		function CustomError(properties) {
			// istanbul ignore else
			if (isFunction(Error.captureStackTrace)) Error.captureStackTrace(this, this.constructor);
			Object.assign(this, properties || {});
			this.code = code;
			this.message = this.cause ? message + ": " + this.cause.message : message;
		}
		CustomError.prototype = new (baseClass || Error)();
		Object.defineProperties(CustomError.prototype, {
			constructor: {
				value: CustomError,
				enumerable: false
			},
			name: {
				value: "Error [" + code + "]",
				enumerable: false
			}
		});
		return CustomError;
	}
	function destroyRequest(request, error) {
		for (var event of events) request.removeListener(event, eventHandlers[event]);
		request.on("error", noop);
		request.destroy(error);
	}
	function isSubdomain(subdomain, domain) {
		assert(isString(subdomain) && isString(domain));
		var dot = subdomain.length - domain.length - 1;
		return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
	}
	function isArray(value) {
		return value instanceof Array;
	}
	function isString(value) {
		return typeof value === "string" || value instanceof String;
	}
	function isFunction(value) {
		return typeof value === "function";
	}
	function isBuffer(value) {
		return typeof value === "object" && "length" in value;
	}
	function isURL(value) {
		return URL && value instanceof URL;
	}
	function escapeRegex(regex) {
		return regex.replace(/[\]\\/()*+?.$]/g, "\\$&");
	}
	module.exports = wrap({
		http: http$2,
		https: https$2
	});
	module.exports.wrap = wrap;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/lib/http-proxy/passes/web-incoming.js
var require_web_incoming = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var httpNative = __require("http");
	var httpsNative = __require("https");
	var web_o = require_web_outgoing();
	var common = require_common$1();
	var followRedirects = require_follow_redirects();
	web_o = Object.keys(web_o).map(function(pass) {
		return web_o[pass];
	});
	var nativeAgents = {
		http: httpNative,
		https: httpsNative
	};
	/*!
	* Array of passes.
	*
	* A `pass` is just a function that is executed on `req, res, options`
	* so that you can easily add new checks while still keeping the base
	* flexible.
	*/
	module.exports = {
		/**
		* Sets `content-length` to '0' if request is of DELETE type.
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {Object} Options Config object passed to the proxy
		*
		* @api private
		*/
		deleteLength: function deleteLength(req, res, options) {
			if ((req.method === "DELETE" || req.method === "OPTIONS") && !req.headers["content-length"]) {
				req.headers["content-length"] = "0";
				delete req.headers["transfer-encoding"];
			}
		},
		/**
		* Sets timeout in request socket if it was specified in options.
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {Object} Options Config object passed to the proxy
		*
		* @api private
		*/
		timeout: function timeout(req, res, options) {
			if (options.timeout) req.socket.setTimeout(options.timeout);
		},
		/**
		* Sets `x-forwarded-*` headers if specified in config.
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {Object} Options Config object passed to the proxy
		*
		* @api private
		*/
		XHeaders: function XHeaders(req, res, options) {
			if (!options.xfwd) return;
			var encrypted = req.isSpdy || common.hasEncryptedConnection(req);
			var values = {
				for: req.connection.remoteAddress || req.socket.remoteAddress,
				port: common.getPort(req),
				proto: encrypted ? "https" : "http"
			};
			[
				"for",
				"port",
				"proto"
			].forEach(function(header) {
				req.headers["x-forwarded-" + header] = (req.headers["x-forwarded-" + header] || "") + (req.headers["x-forwarded-" + header] ? "," : "") + values[header];
			});
			req.headers["x-forwarded-host"] = req.headers["x-forwarded-host"] || req.headers["host"] || "";
		},
		/**
		* Does the actual proxying. If `forward` is enabled fires up
		* a ForwardStream, same happens for ProxyStream. The request
		* just dies otherwise.
		*
		* @param {ClientRequest} Req Request object
		* @param {IncomingMessage} Res Response object
		* @param {Object} Options Config object passed to the proxy
		*
		* @api private
		*/
		stream: function stream(req, res, options, _, server, clb) {
			server.emit("start", req, res, options.target || options.forward);
			var agents = options.followRedirects ? followRedirects : nativeAgents;
			var http = agents.http;
			var https = agents.https;
			if (options.forward) {
				var forwardReq = (options.forward.protocol === "https:" ? https : http).request(common.setupOutgoing(options.ssl || {}, options, req, "forward"));
				var forwardError = createErrorHandler(forwardReq, options.forward);
				req.on("error", forwardError);
				forwardReq.on("error", forwardError);
				(options.buffer || req).pipe(forwardReq);
				if (!options.target) return res.end();
			}
			var proxyReq = (options.target.protocol === "https:" ? https : http).request(common.setupOutgoing(options.ssl || {}, options, req));
			proxyReq.on("socket", function(socket) {
				if (server && !proxyReq.getHeader("expect")) server.emit("proxyReq", proxyReq, req, res, options);
			});
			if (options.proxyTimeout) proxyReq.setTimeout(options.proxyTimeout, function() {
				proxyReq.abort();
			});
			req.on("aborted", function() {
				proxyReq.abort();
			});
			var proxyError = createErrorHandler(proxyReq, options.target);
			req.on("error", proxyError);
			proxyReq.on("error", proxyError);
			function createErrorHandler(proxyReq, url) {
				return function proxyError(err) {
					if (req.socket.destroyed && err.code === "ECONNRESET") {
						server.emit("econnreset", err, req, res, url);
						return proxyReq.abort();
					}
					if (clb) clb(err, req, res, url);
					else server.emit("error", err, req, res, url);
				};
			}
			(options.buffer || req).pipe(proxyReq);
			proxyReq.on("response", function(proxyRes) {
				if (server) server.emit("proxyRes", proxyRes, req, res);
				if (!res.headersSent && !options.selfHandleResponse) {
					for (var i = 0; i < web_o.length; i++) if (web_o[i](req, res, proxyRes, options)) break;
				}
				if (!res.finished) {
					proxyRes.on("end", function() {
						if (server) server.emit("end", req, res, proxyRes);
					});
					if (!options.selfHandleResponse) proxyRes.pipe(res);
				} else if (server) server.emit("end", req, res, proxyRes);
			});
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/lib/http-proxy/passes/ws-incoming.js
var require_ws_incoming = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var http$1 = __require("http");
	var https$1 = __require("https");
	var common = require_common$1();
	/*!
	* Array of passes.
	*
	* A `pass` is just a function that is executed on `req, socket, options`
	* so that you can easily add new checks while still keeping the base
	* flexible.
	*/
	module.exports = {
		/**
		* WebSocket requests must have the `GET` method and
		* the `upgrade:websocket` header
		*
		* @param {ClientRequest} Req Request object
		* @param {Socket} Websocket
		*
		* @api private
		*/
		checkMethodAndHeader: function checkMethodAndHeader(req, socket) {
			if (req.method !== "GET" || !req.headers.upgrade) {
				socket.destroy();
				return true;
			}
			if (req.headers.upgrade.toLowerCase() !== "websocket") {
				socket.destroy();
				return true;
			}
		},
		/**
		* Sets `x-forwarded-*` headers if specified in config.
		*
		* @param {ClientRequest} Req Request object
		* @param {Socket} Websocket
		* @param {Object} Options Config object passed to the proxy
		*
		* @api private
		*/
		XHeaders: function XHeaders(req, socket, options) {
			if (!options.xfwd) return;
			var values = {
				for: req.connection.remoteAddress || req.socket.remoteAddress,
				port: common.getPort(req),
				proto: common.hasEncryptedConnection(req) ? "wss" : "ws"
			};
			[
				"for",
				"port",
				"proto"
			].forEach(function(header) {
				req.headers["x-forwarded-" + header] = (req.headers["x-forwarded-" + header] || "") + (req.headers["x-forwarded-" + header] ? "," : "") + values[header];
			});
		},
		/**
		* Does the actual proxying. Make the request and upgrade it
		* send the Switching Protocols request and pipe the sockets.
		*
		* @param {ClientRequest} Req Request object
		* @param {Socket} Websocket
		* @param {Object} Options Config object passed to the proxy
		*
		* @api private
		*/
		stream: function stream(req, socket, options, head, server, clb) {
			var createHttpHeader = function(line, headers) {
				return Object.keys(headers).reduce(function(head, key) {
					var value = headers[key];
					if (!Array.isArray(value)) {
						head.push(key + ": " + value);
						return head;
					}
					for (var i = 0; i < value.length; i++) head.push(key + ": " + value[i]);
					return head;
				}, [line]).join("\r\n") + "\r\n\r\n";
			};
			common.setupSocket(socket);
			if (head && head.length) socket.unshift(head);
			var proxyReq = (common.isSSL.test(options.target.protocol) ? https$1 : http$1).request(common.setupOutgoing(options.ssl || {}, options, req));
			if (server) server.emit("proxyReqWs", proxyReq, req, socket, options, head);
			proxyReq.on("error", onOutgoingError);
			proxyReq.on("response", function(res) {
				if (!res.upgrade) {
					socket.write(createHttpHeader("HTTP/" + res.httpVersion + " " + res.statusCode + " " + res.statusMessage, res.headers));
					res.pipe(socket);
				}
			});
			proxyReq.on("upgrade", function(proxyRes, proxySocket, proxyHead) {
				proxySocket.on("error", onOutgoingError);
				proxySocket.on("end", function() {
					server.emit("close", proxyRes, proxySocket, proxyHead);
				});
				socket.on("error", function() {
					proxySocket.end();
				});
				common.setupSocket(proxySocket);
				if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);
				socket.write(createHttpHeader("HTTP/1.1 101 Switching Protocols", proxyRes.headers));
				proxySocket.pipe(socket).pipe(proxySocket);
				server.emit("open", proxySocket);
				server.emit("proxySocket", proxySocket);
			});
			return proxyReq.end();
			function onOutgoingError(err) {
				if (clb) clb(err, req, socket);
				else server.emit("error", err, req, socket);
				socket.end();
			}
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/lib/http-proxy/index.js
var require_http_proxy$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var httpProxy = module.exports;
	var extend = __require("util")._extend;
	var parse_url = __require("url").parse;
	var EE3 = require_eventemitter3();
	var http = __require("http");
	var https = __require("https");
	var web = require_web_incoming();
	var ws = require_ws_incoming();
	httpProxy.Server = ProxyServer;
	/**
	* Returns a function that creates the loader for
	* either `ws` or `web`'s  passes.
	*
	* Examples:
	*
	*    httpProxy.createRightProxy('ws')
	*    // => [Function]
	*
	* @param {String} Type Either 'ws' or 'web'
	* 
	* @return {Function} Loader Function that when called returns an iterator for the right passes
	*
	* @api private
	*/
	function createRightProxy(type) {
		return function(options) {
			return function(req, res) {
				var passes = type === "ws" ? this.wsPasses : this.webPasses, args = [].slice.call(arguments), cntr = args.length - 1, head, cbl;
				if (typeof args[cntr] === "function") {
					cbl = args[cntr];
					cntr--;
				}
				var requestOptions = options;
				if (!(args[cntr] instanceof Buffer) && args[cntr] !== res) {
					requestOptions = extend({}, options);
					extend(requestOptions, args[cntr]);
					cntr--;
				}
				if (args[cntr] instanceof Buffer) head = args[cntr];
				["target", "forward"].forEach(function(e) {
					if (typeof requestOptions[e] === "string") requestOptions[e] = parse_url(requestOptions[e]);
				});
				if (!requestOptions.target && !requestOptions.forward) return this.emit("error", /* @__PURE__ */ new Error("Must provide a proper URL as target"));
				for (var i = 0; i < passes.length; i++)
 /**
				* Call of passes functions
				* pass(req, res, options, head)
				*
				* In WebSockets case the `res` variable
				* refer to the connection socket
				* pass(req, socket, options, head)
				*/
				if (passes[i](req, res, requestOptions, head, this, cbl)) break;
			};
		};
	}
	httpProxy.createRightProxy = createRightProxy;
	function ProxyServer(options) {
		EE3.call(this);
		options = options || {};
		options.prependPath = options.prependPath === false ? false : true;
		this.web = this.proxyRequest = createRightProxy("web")(options);
		this.ws = this.proxyWebsocketRequest = createRightProxy("ws")(options);
		this.options = options;
		this.webPasses = Object.keys(web).map(function(pass) {
			return web[pass];
		});
		this.wsPasses = Object.keys(ws).map(function(pass) {
			return ws[pass];
		});
		this.on("error", this.onError, this);
	}
	__require("util").inherits(ProxyServer, EE3);
	ProxyServer.prototype.onError = function(err) {
		if (this.listeners("error").length === 1) throw err;
	};
	ProxyServer.prototype.listen = function(port, hostname) {
		var self = this, closure = function(req, res) {
			self.web(req, res);
		};
		this._server = this.options.ssl ? https.createServer(this.options.ssl, closure) : http.createServer(closure);
		if (this.options.ws) this._server.on("upgrade", function(req, socket, head) {
			self.ws(req, socket, head);
		});
		this._server.listen(port, hostname);
		return this;
	};
	ProxyServer.prototype.close = function(callback) {
		var self = this;
		if (this._server) this._server.close(done);
		function done() {
			self._server = null;
			if (callback) callback.apply(null, arguments);
		}
	};
	ProxyServer.prototype.before = function(type, passName, callback) {
		if (type !== "ws" && type !== "web") throw new Error("type must be `web` or `ws`");
		var passes = type === "ws" ? this.wsPasses : this.webPasses, i = false;
		passes.forEach(function(v, idx) {
			if (v.name === passName) i = idx;
		});
		if (i === false) throw new Error("No such pass");
		passes.splice(i, 0, callback);
	};
	ProxyServer.prototype.after = function(type, passName, callback) {
		if (type !== "ws" && type !== "web") throw new Error("type must be `web` or `ws`");
		var passes = type === "ws" ? this.wsPasses : this.webPasses, i = false;
		passes.forEach(function(v, idx) {
			if (v.name === passName) i = idx;
		});
		if (i === false) throw new Error("No such pass");
		passes.splice(i++, 0, callback);
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/lib/http-proxy.js
var require_http_proxy$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var ProxyServer = require_http_proxy$2().Server;
	/**
	* Creates the proxy server.
	*
	* Examples:
	*
	*    httpProxy.createProxyServer({ .. }, 8000)
	*    // => '{ web: [Function], ws: [Function] ... }'
	*
	* @param {Object} Options Config object passed to the proxy
	*
	* @return {Object} Proxy Proxy object with handlers for `ws` and `web` requests
	*
	* @api public
	*/
	function createProxyServer(options) {
		return new ProxyServer(options);
	}
	ProxyServer.createProxyServer = createProxyServer;
	ProxyServer.createServer = createProxyServer;
	ProxyServer.createProxy = createProxyServer;
	/**
	* Export the proxy "Server" as the main export.
	*/
	module.exports = ProxyServer;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy@1.18.1_debug@4.4.3/node_modules/http-proxy/index.js
var require_http_proxy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/*!
	* Caron dimonio, con occhi di bragia
	* loro accennando, tutte le raccoglie;
	* batte col remo qualunque s’adagia 
	*
	* Charon the demon, with the eyes of glede,
	* Beckoning to them, collects them all together,
	* Beats with his oar whoever lags behind
	*          
	*          Dante - The Divine Comedy (Canto III)
	*/
	module.exports = require_http_proxy$1();
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/errors.js
var require_errors = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.HttpProxyMiddlewareError = exports.ERRORS = void 0;
	var ERRORS;
	(function(ERRORS) {
		ERRORS["ERR_CONFIG_FACTORY_TARGET_MISSING"] = "[HPM] Missing \"target\" option. Example: {target: \"http://www.example.org\"}";
		ERRORS["ERR_CONTEXT_MATCHER_GENERIC"] = "[HPM] Invalid pathFilter. Expecting something like: \"/api\" or [\"/api\", \"/ajax\"]";
		ERRORS["ERR_CONTEXT_MATCHER_INVALID_ARRAY"] = "[HPM] Invalid pathFilter. Plain paths (e.g. \"/api\") can not be mixed with globs (e.g. \"/api/**\"). Expecting something like: [\"/api\", \"/ajax\"] or [\"/api/**\", \"!**.html\"].";
		ERRORS["ERR_PATH_REWRITER_CONFIG"] = "[HPM] Invalid pathRewrite config. Expecting object with pathRewrite config or a rewrite function";
	})(ERRORS || (exports.ERRORS = ERRORS = {}));
	var HttpProxyMiddlewareError = class extends Error {
		constructor(message, code) {
			super(message);
			this.code = code;
			this.name = this.constructor.name;
			if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
		}
	};
	exports.HttpProxyMiddlewareError = HttpProxyMiddlewareError;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/configuration.js
var require_configuration = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.verifyConfig = verifyConfig;
	const errors_1 = require_errors();
	function verifyConfig(options) {
		if (!options.target && !options.router) throw new Error(errors_1.ERRORS.ERR_CONFIG_FACTORY_TARGET_MISSING);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/debug.js
var require_debug = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Debug = void 0;
	/**
	* Debug instance with the given namespace: http-proxy-middleware
	*/
	exports.Debug = require_src()("http-proxy-middleware");
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/plugins/default/debug-proxy-errors-plugin.js
var require_debug_proxy_errors_plugin = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.debugProxyErrorsPlugin = void 0;
	const debug = require_debug().Debug.extend("debug-proxy-errors-plugin");
	/**
	* Subscribe to {@link https://www.npmjs.com/package/http-proxy#listening-for-proxy-events http-proxy error events} to prevent server from crashing.
	* Errors are logged with {@link https://www.npmjs.com/package/debug debug} library.
	*/
	const debugProxyErrorsPlugin = (proxyServer) => {
		/**
		* http-proxy doesn't handle any errors by default (https://github.com/http-party/node-http-proxy#listening-for-proxy-events)
		* Prevent server from crashing when http-proxy errors (uncaught errors)
		*/
		proxyServer.on("error", (error, req, res, target) => {
			debug(`http-proxy error event: \n%O`, error);
		});
		proxyServer.on("proxyReq", (proxyReq, req, socket) => {
			socket.on("error", (error) => {
				debug("Socket error in proxyReq event: \n%O", error);
			});
		});
		/**
		* Fix SSE close events
		* @link https://github.com/chimurai/http-proxy-middleware/issues/678
		* @link https://github.com/http-party/node-http-proxy/issues/1520#issue-877626125
		*/
		proxyServer.on("proxyRes", (proxyRes, req, res) => {
			res.on("close", () => {
				if (!res.writableEnded) {
					debug("Destroying proxyRes in proxyRes close event");
					proxyRes.destroy();
				}
			});
		});
		/**
		* Fix crash when target server restarts
		* https://github.com/chimurai/http-proxy-middleware/issues/476#issuecomment-746329030
		* https://github.com/webpack/webpack-dev-server/issues/1642#issuecomment-790602225
		*/
		proxyServer.on("proxyReqWs", (proxyReq, req, socket) => {
			socket.on("error", (error) => {
				debug("Socket error in proxyReqWs event: \n%O", error);
			});
		});
		proxyServer.on("open", (proxySocket) => {
			proxySocket.on("error", (error) => {
				debug("Socket error in open event: \n%O", error);
			});
		});
		proxyServer.on("close", (req, socket, head) => {
			socket.on("error", (error) => {
				debug("Socket error in close event: \n%O", error);
			});
		});
		proxyServer.on("econnreset", (error, req, res, target) => {
			debug(`http-proxy econnreset event: \n%O`, error);
		});
	};
	exports.debugProxyErrorsPlugin = debugProxyErrorsPlugin;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/status-code.js
var require_status_code = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getStatusCode = getStatusCode;
	function getStatusCode(errorCode) {
		let statusCode;
		if (/HPE_INVALID/.test(errorCode)) {
			statusCode = 502;
			return statusCode;
		}
		if (/HPM_ERR_INVALID_MULTIPART_/.test(errorCode)) {
			statusCode = 400;
			return statusCode;
		}
		switch (errorCode) {
			case "ECONNRESET":
			case "ENOTFOUND":
			case "ECONNREFUSED":
			case "ETIMEDOUT":
				statusCode = 504;
				break;
			default: statusCode = 500;
		}
		return statusCode;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/utils/sanitize.js
var require_sanitize = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.sanitize = sanitize;
	function sanitize(input) {
		return input?.replace(/[<>]/g, (i) => encodeURIComponent(i)) ?? "";
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/plugins/default/error-response-plugin.js
var require_error_response_plugin = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.errorResponsePlugin = void 0;
	const status_code_1 = require_status_code();
	const sanitize_1 = require_sanitize();
	function isResponseLike(obj) {
		return obj && typeof obj.writeHead === "function";
	}
	function isSocketLike(obj) {
		return obj && typeof obj.write === "function" && !("writeHead" in obj);
	}
	const errorResponsePlugin = (proxyServer, options) => {
		proxyServer.on("error", (err, req, res, target) => {
			if (!req && !res) throw err;
			if (isResponseLike(res)) {
				if (!res.headersSent) {
					const statusCode = (0, status_code_1.getStatusCode)(err.code);
					res.writeHead(statusCode);
				}
				const host = req.headers && req.headers.host;
				res.end(`Error occurred while trying to proxy: ${(0, sanitize_1.sanitize)(host)}${(0, sanitize_1.sanitize)(req.url)}`);
			} else if (isSocketLike(res)) res.destroy();
		});
	};
	exports.errorResponsePlugin = errorResponsePlugin;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/logger.js
var require_logger = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getLogger = getLogger;
	/**
	* Compatibility matrix
	*
	| Library  |  log  |  info  | warn  |  error  | \<interpolation\> |
	|----------|:------|:-------|:------|:--------|:------------------|
	| console  |   ✅   |  ✅   |   ✅   |   ✅    |   ✅ (%s %o %O)   |
	| bunyan   |   ❌   |  ✅   |   ✅   |   ✅    |   ✅ (%s %o %O)   |
	| pino     |   ❌   |  ✅   |   ✅   |   ✅    |   ✅ (%s %o %O)   |
	| winston  |   ❌   |  ✅   |   ✅   |   ✅    |   ✅ (%s %o %O)^1 |
	| log4js   |   ❌   |  ✅   |   ✅   |   ✅    |   ✅ (%s %o %O)   |
	*
	* ^1: https://github.com/winstonjs/winston#string-interpolation
	*/
	const noopLogger = {
		info: () => {},
		warn: () => {},
		error: () => {}
	};
	function getLogger(options) {
		return options.logger || noopLogger;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/utils/logger-plugin.js
var require_logger_plugin$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getPort = getPort;
	/**
	* Get port from target
	* Using proxyRes.req.agent.sockets to determine the target port
	*/
	function getPort(sockets) {
		return Object.keys(sockets || {})?.[0]?.split(":")[1];
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/plugins/default/logger-plugin.js
var require_logger_plugin = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.loggerPlugin = void 0;
	const node_url_1 = __require("node:url");
	const logger_1 = require_logger();
	const logger_plugin_1 = require_logger_plugin$1();
	const loggerPlugin = (proxyServer, options) => {
		const logger = (0, logger_1.getLogger)(options);
		proxyServer.on("error", (err, req, res, target) => {
			const requestHref = `${req?.headers?.host}${req?.url}`;
			const targetHref = `${target?.href}`;
			logger.error("[HPM] Error occurred while proxying request %s to %s [%s] (%s)", requestHref, targetHref, err.code || err, "https://nodejs.org/api/errors.html#errors_common_system_errors");
		});
		/**
		* Log request and response
		* @example
		* ```shell
		* [HPM] GET /users/ -> http://jsonplaceholder.typicode.com/users/ [304]
		* ```
		*/
		proxyServer.on("proxyRes", (proxyRes, req, res) => {
			const originalUrl = req.originalUrl ?? `${req.baseUrl || ""}${req.url}`;
			let target;
			try {
				const port = (0, logger_plugin_1.getPort)(proxyRes.req?.agent?.sockets);
				const obj = {
					protocol: proxyRes.req.protocol,
					host: proxyRes.req.host,
					pathname: proxyRes.req.path
				};
				target = new node_url_1.URL(`${obj.protocol}//${obj.host}${obj.pathname}`);
				if (port) target.port = port;
			} catch (err) {
				target = new node_url_1.URL(options.target);
				target.pathname = proxyRes.req.path;
			}
			const targetUrl = target.toString();
			const exchange = `[HPM] ${req.method} ${originalUrl} -> ${targetUrl} [${proxyRes.statusCode}]`;
			logger.info(exchange);
		});
		/**
		* When client opens WebSocket connection
		*/
		proxyServer.on("open", (socket) => {
			logger.info("[HPM] Client connected: %o", socket.address());
		});
		/**
		* When client closes WebSocket connection
		*/
		proxyServer.on("close", (req, proxySocket, proxyHead) => {
			logger.info("[HPM] Client disconnected: %o", proxySocket.address());
		});
	};
	exports.loggerPlugin = loggerPlugin;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/utils/function.js
var require_function = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getFunctionName = getFunctionName;
	function getFunctionName(fn) {
		return fn.name || "[anonymous Function]";
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/plugins/default/proxy-events.js
var require_proxy_events = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.proxyEventsPlugin = void 0;
	const debug_1 = require_debug();
	const function_1 = require_function();
	const debug = debug_1.Debug.extend("proxy-events-plugin");
	/**
	* Implements option.on object to subscribe to http-proxy events.
	*
	* @example
	* ```js
	* createProxyMiddleware({
	*  on: {
	*    error: (error, req, res, target) => {},
	*    proxyReq: (proxyReq, req, res, options) => {},
	*    proxyReqWs: (proxyReq, req, socket, options) => {},
	*    proxyRes: (proxyRes, req, res) => {},
	*    open: (proxySocket) => {},
	*    close: (proxyRes, proxySocket, proxyHead) => {},
	*    start: (req, res, target) => {},
	*    end: (req, res, proxyRes) => {},
	*    econnreset: (error, req, res, target) => {},
	*  }
	* });
	* ```
	*/
	const proxyEventsPlugin = (proxyServer, options) => {
		Object.entries(options.on || {}).forEach(([eventName, handler]) => {
			debug(`register event handler: "${eventName}" -> "${(0, function_1.getFunctionName)(handler)}"`);
			proxyServer.on(eventName, handler);
		});
	};
	exports.proxyEventsPlugin = proxyEventsPlugin;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/plugins/default/index.js
var require_default = /* @__PURE__ */ __commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$4) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$4, p)) __createBinding(exports$4, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_debug_proxy_errors_plugin(), exports);
	__exportStar(require_error_response_plugin(), exports);
	__exportStar(require_logger_plugin(), exports);
	__exportStar(require_proxy_events(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/get-plugins.js
var require_get_plugins = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getPlugins = getPlugins;
	const default_1 = require_default();
	function getPlugins(options) {
		const maybeErrorResponsePlugin = options.on?.error ? [] : [default_1.errorResponsePlugin];
		const defaultPlugins = options.ejectPlugins ? [] : [
			default_1.debugProxyErrorsPlugin,
			default_1.proxyEventsPlugin,
			default_1.loggerPlugin,
			...maybeErrorResponsePlugin
		];
		const userPlugins = options.plugins ?? [];
		return [...defaultPlugins, ...userPlugins];
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/is-extglob@2.1.1/node_modules/is-extglob/index.js
var require_is_extglob = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/*!
	* is-extglob <https://github.com/jonschlinkert/is-extglob>
	*
	* Copyright (c) 2014-2016, Jon Schlinkert.
	* Licensed under the MIT License.
	*/
	module.exports = function isExtglob(str) {
		if (typeof str !== "string" || str === "") return false;
		var match;
		while (match = /(\\).|([@?!+*]\(.*\))/g.exec(str)) {
			if (match[2]) return true;
			str = str.slice(match.index + match[0].length);
		}
		return false;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/is-glob@4.0.3/node_modules/is-glob/index.js
var require_is_glob = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/*!
	* is-glob <https://github.com/jonschlinkert/is-glob>
	*
	* Copyright (c) 2014-2017, Jon Schlinkert.
	* Released under the MIT License.
	*/
	var isExtglob = require_is_extglob();
	var chars = {
		"{": "}",
		"(": ")",
		"[": "]"
	};
	var strictCheck = function(str) {
		if (str[0] === "!") return true;
		var index = 0;
		var pipeIndex = -2;
		var closeSquareIndex = -2;
		var closeCurlyIndex = -2;
		var closeParenIndex = -2;
		var backSlashIndex = -2;
		while (index < str.length) {
			if (str[index] === "*") return true;
			if (str[index + 1] === "?" && /[\].+)]/.test(str[index])) return true;
			if (closeSquareIndex !== -1 && str[index] === "[" && str[index + 1] !== "]") {
				if (closeSquareIndex < index) closeSquareIndex = str.indexOf("]", index);
				if (closeSquareIndex > index) {
					if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) return true;
					backSlashIndex = str.indexOf("\\", index);
					if (backSlashIndex === -1 || backSlashIndex > closeSquareIndex) return true;
				}
			}
			if (closeCurlyIndex !== -1 && str[index] === "{" && str[index + 1] !== "}") {
				closeCurlyIndex = str.indexOf("}", index);
				if (closeCurlyIndex > index) {
					backSlashIndex = str.indexOf("\\", index);
					if (backSlashIndex === -1 || backSlashIndex > closeCurlyIndex) return true;
				}
			}
			if (closeParenIndex !== -1 && str[index] === "(" && str[index + 1] === "?" && /[:!=]/.test(str[index + 2]) && str[index + 3] !== ")") {
				closeParenIndex = str.indexOf(")", index);
				if (closeParenIndex > index) {
					backSlashIndex = str.indexOf("\\", index);
					if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) return true;
				}
			}
			if (pipeIndex !== -1 && str[index] === "(" && str[index + 1] !== "|") {
				if (pipeIndex < index) pipeIndex = str.indexOf("|", index);
				if (pipeIndex !== -1 && str[pipeIndex + 1] !== ")") {
					closeParenIndex = str.indexOf(")", pipeIndex);
					if (closeParenIndex > pipeIndex) {
						backSlashIndex = str.indexOf("\\", pipeIndex);
						if (backSlashIndex === -1 || backSlashIndex > closeParenIndex) return true;
					}
				}
			}
			if (str[index] === "\\") {
				var open = str[index + 1];
				index += 2;
				var close = chars[open];
				if (close) {
					var n = str.indexOf(close, index);
					if (n !== -1) index = n + 1;
				}
				if (str[index] === "!") return true;
			} else index++;
		}
		return false;
	};
	var relaxedCheck = function(str) {
		if (str[0] === "!") return true;
		var index = 0;
		while (index < str.length) {
			if (/[*?{}()[\]]/.test(str[index])) return true;
			if (str[index] === "\\") {
				var open = str[index + 1];
				index += 2;
				var close = chars[open];
				if (close) {
					var n = str.indexOf(close, index);
					if (n !== -1) index = n + 1;
				}
				if (str[index] === "!") return true;
			} else index++;
		}
		return false;
	};
	module.exports = function isGlob(str, options) {
		if (typeof str !== "string" || str === "") return false;
		if (isExtglob(str)) return true;
		var check = strictCheck;
		if (options && options.strict === false) check = relaxedCheck;
		return check(str);
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/utils.js
var require_utils$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	exports.isInteger = (num) => {
		if (typeof num === "number") return Number.isInteger(num);
		if (typeof num === "string" && num.trim() !== "") return Number.isInteger(Number(num));
		return false;
	};
	/**
	* Find a node of the given type
	*/
	exports.find = (node, type) => node.nodes.find((node) => node.type === type);
	/**
	* Find a node of the given type
	*/
	exports.exceedsLimit = (min, max, step = 1, limit) => {
		if (limit === false) return false;
		if (!exports.isInteger(min) || !exports.isInteger(max)) return false;
		return (Number(max) - Number(min)) / Number(step) >= limit;
	};
	/**
	* Escape the given node with '\\' before node.value
	*/
	exports.escapeNode = (block, n = 0, type) => {
		const node = block.nodes[n];
		if (!node) return;
		if (type && node.type === type || node.type === "open" || node.type === "close") {
			if (node.escaped !== true) {
				node.value = "\\" + node.value;
				node.escaped = true;
			}
		}
	};
	/**
	* Returns true if the given brace node should be enclosed in literal braces
	*/
	exports.encloseBrace = (node) => {
		if (node.type !== "brace") return false;
		if (node.commas >> 0 + node.ranges >> 0 === 0) {
			node.invalid = true;
			return true;
		}
		return false;
	};
	/**
	* Returns true if a brace node is invalid.
	*/
	exports.isInvalidBrace = (block) => {
		if (block.type !== "brace") return false;
		if (block.invalid === true || block.dollar) return true;
		if (block.commas >> 0 + block.ranges >> 0 === 0) {
			block.invalid = true;
			return true;
		}
		if (block.open !== true || block.close !== true) {
			block.invalid = true;
			return true;
		}
		return false;
	};
	/**
	* Returns true if a node is an open or close node
	*/
	exports.isOpenOrClose = (node) => {
		if (node.type === "open" || node.type === "close") return true;
		return node.open === true || node.close === true;
	};
	/**
	* Reduce an array of text nodes.
	*/
	exports.reduce = (nodes) => nodes.reduce((acc, node) => {
		if (node.type === "text") acc.push(node.value);
		if (node.type === "range") node.type = "text";
		return acc;
	}, []);
	/**
	* Flatten an array
	*/
	exports.flatten = (...args) => {
		const result = [];
		const flat = (arr) => {
			for (let i = 0; i < arr.length; i++) {
				const ele = arr[i];
				if (Array.isArray(ele)) {
					flat(ele);
					continue;
				}
				if (ele !== void 0) result.push(ele);
			}
			return result;
		};
		flat(args);
		return result;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/stringify.js
var require_stringify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const utils = require_utils$1();
	module.exports = (ast, options = {}) => {
		const stringify = (node, parent = {}) => {
			const invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
			const invalidNode = node.invalid === true && options.escapeInvalid === true;
			let output = "";
			if (node.value) {
				if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) return "\\" + node.value;
				return node.value;
			}
			if (node.value) return node.value;
			if (node.nodes) for (const child of node.nodes) output += stringify(child);
			return output;
		};
		return stringify(ast);
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/is-number@7.0.0/node_modules/is-number/index.js
/*!
* is-number <https://github.com/jonschlinkert/is-number>
*
* Copyright (c) 2014-present, Jon Schlinkert.
* Released under the MIT License.
*/
var require_is_number = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function(num) {
		if (typeof num === "number") return num - num === 0;
		if (typeof num === "string" && num.trim() !== "") return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
		return false;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/to-regex-range@5.0.1/node_modules/to-regex-range/index.js
/*!
* to-regex-range <https://github.com/micromatch/to-regex-range>
*
* Copyright (c) 2015-present, Jon Schlinkert.
* Released under the MIT License.
*/
var require_to_regex_range = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const isNumber = require_is_number();
	const toRegexRange = (min, max, options) => {
		if (isNumber(min) === false) throw new TypeError("toRegexRange: expected the first argument to be a number");
		if (max === void 0 || min === max) return String(min);
		if (isNumber(max) === false) throw new TypeError("toRegexRange: expected the second argument to be a number.");
		let opts = {
			relaxZeros: true,
			...options
		};
		if (typeof opts.strictZeros === "boolean") opts.relaxZeros = opts.strictZeros === false;
		let relax = String(opts.relaxZeros);
		let shorthand = String(opts.shorthand);
		let capture = String(opts.capture);
		let wrap = String(opts.wrap);
		let cacheKey = min + ":" + max + "=" + relax + shorthand + capture + wrap;
		if (toRegexRange.cache.hasOwnProperty(cacheKey)) return toRegexRange.cache[cacheKey].result;
		let a = Math.min(min, max);
		let b = Math.max(min, max);
		if (Math.abs(a - b) === 1) {
			let result = min + "|" + max;
			if (opts.capture) return `(${result})`;
			if (opts.wrap === false) return result;
			return `(?:${result})`;
		}
		let isPadded = hasPadding(min) || hasPadding(max);
		let state = {
			min,
			max,
			a,
			b
		};
		let positives = [];
		let negatives = [];
		if (isPadded) {
			state.isPadded = isPadded;
			state.maxLen = String(state.max).length;
		}
		if (a < 0) {
			negatives = splitToPatterns(b < 0 ? Math.abs(b) : 1, Math.abs(a), state, opts);
			a = state.a = 0;
		}
		if (b >= 0) positives = splitToPatterns(a, b, state, opts);
		state.negatives = negatives;
		state.positives = positives;
		state.result = collatePatterns(negatives, positives, opts);
		if (opts.capture === true) state.result = `(${state.result})`;
		else if (opts.wrap !== false && positives.length + negatives.length > 1) state.result = `(?:${state.result})`;
		toRegexRange.cache[cacheKey] = state;
		return state.result;
	};
	function collatePatterns(neg, pos, options) {
		let onlyNegative = filterPatterns(neg, pos, "-", false, options) || [];
		let onlyPositive = filterPatterns(pos, neg, "", false, options) || [];
		let intersected = filterPatterns(neg, pos, "-?", true, options) || [];
		return onlyNegative.concat(intersected).concat(onlyPositive).join("|");
	}
	function splitToRanges(min, max) {
		let nines = 1;
		let zeros = 1;
		let stop = countNines(min, nines);
		let stops = /* @__PURE__ */ new Set([max]);
		while (min <= stop && stop <= max) {
			stops.add(stop);
			nines += 1;
			stop = countNines(min, nines);
		}
		stop = countZeros(max + 1, zeros) - 1;
		while (min < stop && stop <= max) {
			stops.add(stop);
			zeros += 1;
			stop = countZeros(max + 1, zeros) - 1;
		}
		stops = [...stops];
		stops.sort(compare);
		return stops;
	}
	/**
	* Convert a range to a regex pattern
	* @param {Number} `start`
	* @param {Number} `stop`
	* @return {String}
	*/
	function rangeToPattern(start, stop, options) {
		if (start === stop) return {
			pattern: start,
			count: [],
			digits: 0
		};
		let zipped = zip(start, stop);
		let digits = zipped.length;
		let pattern = "";
		let count = 0;
		for (let i = 0; i < digits; i++) {
			let [startDigit, stopDigit] = zipped[i];
			if (startDigit === stopDigit) pattern += startDigit;
			else if (startDigit !== "0" || stopDigit !== "9") pattern += toCharacterClass(startDigit, stopDigit, options);
			else count++;
		}
		if (count) pattern += options.shorthand === true ? "\\d" : "[0-9]";
		return {
			pattern,
			count: [count],
			digits
		};
	}
	function splitToPatterns(min, max, tok, options) {
		let ranges = splitToRanges(min, max);
		let tokens = [];
		let start = min;
		let prev;
		for (let i = 0; i < ranges.length; i++) {
			let max = ranges[i];
			let obj = rangeToPattern(String(start), String(max), options);
			let zeros = "";
			if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
				if (prev.count.length > 1) prev.count.pop();
				prev.count.push(obj.count[0]);
				prev.string = prev.pattern + toQuantifier(prev.count);
				start = max + 1;
				continue;
			}
			if (tok.isPadded) zeros = padZeros(max, tok, options);
			obj.string = zeros + obj.pattern + toQuantifier(obj.count);
			tokens.push(obj);
			start = max + 1;
			prev = obj;
		}
		return tokens;
	}
	function filterPatterns(arr, comparison, prefix, intersection, options) {
		let result = [];
		for (let ele of arr) {
			let { string } = ele;
			if (!intersection && !contains(comparison, "string", string)) result.push(prefix + string);
			if (intersection && contains(comparison, "string", string)) result.push(prefix + string);
		}
		return result;
	}
	/**
	* Zip strings
	*/
	function zip(a, b) {
		let arr = [];
		for (let i = 0; i < a.length; i++) arr.push([a[i], b[i]]);
		return arr;
	}
	function compare(a, b) {
		return a > b ? 1 : b > a ? -1 : 0;
	}
	function contains(arr, key, val) {
		return arr.some((ele) => ele[key] === val);
	}
	function countNines(min, len) {
		return Number(String(min).slice(0, -len) + "9".repeat(len));
	}
	function countZeros(integer, zeros) {
		return integer - integer % Math.pow(10, zeros);
	}
	function toQuantifier(digits) {
		let [start = 0, stop = ""] = digits;
		if (stop || start > 1) return `{${start + (stop ? "," + stop : "")}}`;
		return "";
	}
	function toCharacterClass(a, b, options) {
		return `[${a}${b - a === 1 ? "" : "-"}${b}]`;
	}
	function hasPadding(str) {
		return /^-?(0+)\d/.test(str);
	}
	function padZeros(value, tok, options) {
		if (!tok.isPadded) return value;
		let diff = Math.abs(tok.maxLen - String(value).length);
		let relax = options.relaxZeros !== false;
		switch (diff) {
			case 0: return "";
			case 1: return relax ? "0?" : "0";
			case 2: return relax ? "0{0,2}" : "00";
			default: return relax ? `0{0,${diff}}` : `0{${diff}}`;
		}
	}
	/**
	* Cache
	*/
	toRegexRange.cache = {};
	toRegexRange.clearCache = () => toRegexRange.cache = {};
	/**
	* Expose `toRegexRange`
	*/
	module.exports = toRegexRange;
}));
//#endregion
//#region ../../node_modules/.pnpm/fill-range@7.1.1/node_modules/fill-range/index.js
/*!
* fill-range <https://github.com/jonschlinkert/fill-range>
*
* Copyright (c) 2014-present, Jon Schlinkert.
* Licensed under the MIT License.
*/
var require_fill_range = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const util$1 = __require("util");
	const toRegexRange = require_to_regex_range();
	const isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
	const transform = (toNumber) => {
		return (value) => toNumber === true ? Number(value) : String(value);
	};
	const isValidValue = (value) => {
		return typeof value === "number" || typeof value === "string" && value !== "";
	};
	const isNumber = (num) => Number.isInteger(+num);
	const zeros = (input) => {
		let value = `${input}`;
		let index = -1;
		if (value[0] === "-") value = value.slice(1);
		if (value === "0") return false;
		while (value[++index] === "0");
		return index > 0;
	};
	const stringify = (start, end, options) => {
		if (typeof start === "string" || typeof end === "string") return true;
		return options.stringify === true;
	};
	const pad = (input, maxLength, toNumber) => {
		if (maxLength > 0) {
			let dash = input[0] === "-" ? "-" : "";
			if (dash) input = input.slice(1);
			input = dash + input.padStart(dash ? maxLength - 1 : maxLength, "0");
		}
		if (toNumber === false) return String(input);
		return input;
	};
	const toMaxLen = (input, maxLength) => {
		let negative = input[0] === "-" ? "-" : "";
		if (negative) {
			input = input.slice(1);
			maxLength--;
		}
		while (input.length < maxLength) input = "0" + input;
		return negative ? "-" + input : input;
	};
	const toSequence = (parts, options, maxLen) => {
		parts.negatives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
		parts.positives.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
		let prefix = options.capture ? "" : "?:";
		let positives = "";
		let negatives = "";
		let result;
		if (parts.positives.length) positives = parts.positives.map((v) => toMaxLen(String(v), maxLen)).join("|");
		if (parts.negatives.length) negatives = `-(${prefix}${parts.negatives.map((v) => toMaxLen(String(v), maxLen)).join("|")})`;
		if (positives && negatives) result = `${positives}|${negatives}`;
		else result = positives || negatives;
		if (options.wrap) return `(${prefix}${result})`;
		return result;
	};
	const toRange = (a, b, isNumbers, options) => {
		if (isNumbers) return toRegexRange(a, b, {
			wrap: false,
			...options
		});
		let start = String.fromCharCode(a);
		if (a === b) return start;
		return `[${start}-${String.fromCharCode(b)}]`;
	};
	const toRegex = (start, end, options) => {
		if (Array.isArray(start)) {
			let wrap = options.wrap === true;
			let prefix = options.capture ? "" : "?:";
			return wrap ? `(${prefix}${start.join("|")})` : start.join("|");
		}
		return toRegexRange(start, end, options);
	};
	const rangeError = (...args) => {
		return /* @__PURE__ */ new RangeError("Invalid range arguments: " + util$1.inspect(...args));
	};
	const invalidRange = (start, end, options) => {
		if (options.strictRanges === true) throw rangeError([start, end]);
		return [];
	};
	const invalidStep = (step, options) => {
		if (options.strictRanges === true) throw new TypeError(`Expected step "${step}" to be a number`);
		return [];
	};
	const fillNumbers = (start, end, step = 1, options = {}) => {
		let a = Number(start);
		let b = Number(end);
		if (!Number.isInteger(a) || !Number.isInteger(b)) {
			if (options.strictRanges === true) throw rangeError([start, end]);
			return [];
		}
		if (a === 0) a = 0;
		if (b === 0) b = 0;
		let descending = a > b;
		let startString = String(start);
		let endString = String(end);
		let stepString = String(step);
		step = Math.max(Math.abs(step), 1);
		let padded = zeros(startString) || zeros(endString) || zeros(stepString);
		let maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
		let toNumber = padded === false && stringify(start, end, options) === false;
		let format = options.transform || transform(toNumber);
		if (options.toRegex && step === 1) return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
		let parts = {
			negatives: [],
			positives: []
		};
		let push = (num) => parts[num < 0 ? "negatives" : "positives"].push(Math.abs(num));
		let range = [];
		let index = 0;
		while (descending ? a >= b : a <= b) {
			if (options.toRegex === true && step > 1) push(a);
			else range.push(pad(format(a, index), maxLen, toNumber));
			a = descending ? a - step : a + step;
			index++;
		}
		if (options.toRegex === true) return step > 1 ? toSequence(parts, options, maxLen) : toRegex(range, null, {
			wrap: false,
			...options
		});
		return range;
	};
	const fillLetters = (start, end, step = 1, options = {}) => {
		if (!isNumber(start) && start.length > 1 || !isNumber(end) && end.length > 1) return invalidRange(start, end, options);
		let format = options.transform || ((val) => String.fromCharCode(val));
		let a = `${start}`.charCodeAt(0);
		let b = `${end}`.charCodeAt(0);
		let descending = a > b;
		let min = Math.min(a, b);
		let max = Math.max(a, b);
		if (options.toRegex && step === 1) return toRange(min, max, false, options);
		let range = [];
		let index = 0;
		while (descending ? a >= b : a <= b) {
			range.push(format(a, index));
			a = descending ? a - step : a + step;
			index++;
		}
		if (options.toRegex === true) return toRegex(range, null, {
			wrap: false,
			options
		});
		return range;
	};
	const fill = (start, end, step, options = {}) => {
		if (end == null && isValidValue(start)) return [start];
		if (!isValidValue(start) || !isValidValue(end)) return invalidRange(start, end, options);
		if (typeof step === "function") return fill(start, end, 1, { transform: step });
		if (isObject(step)) return fill(start, end, 0, step);
		let opts = { ...options };
		if (opts.capture === true) opts.wrap = true;
		step = step || opts.step || 1;
		if (!isNumber(step)) {
			if (step != null && !isObject(step)) return invalidStep(step, opts);
			return fill(start, end, 1, step);
		}
		if (isNumber(start) && isNumber(end)) return fillNumbers(start, end, step, opts);
		return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
	};
	module.exports = fill;
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/compile.js
var require_compile = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const fill = require_fill_range();
	const utils = require_utils$1();
	const compile = (ast, options = {}) => {
		const walk = (node, parent = {}) => {
			const invalidBlock = utils.isInvalidBrace(parent);
			const invalidNode = node.invalid === true && options.escapeInvalid === true;
			const invalid = invalidBlock === true || invalidNode === true;
			const prefix = options.escapeInvalid === true ? "\\" : "";
			let output = "";
			if (node.isOpen === true) return prefix + node.value;
			if (node.isClose === true) {
				console.log("node.isClose", prefix, node.value);
				return prefix + node.value;
			}
			if (node.type === "open") return invalid ? prefix + node.value : "(";
			if (node.type === "close") return invalid ? prefix + node.value : ")";
			if (node.type === "comma") return node.prev.type === "comma" ? "" : invalid ? node.value : "|";
			if (node.value) return node.value;
			if (node.nodes && node.ranges > 0) {
				const args = utils.reduce(node.nodes);
				const range = fill(...args, {
					...options,
					wrap: false,
					toRegex: true,
					strictZeros: true
				});
				if (range.length !== 0) return args.length > 1 && range.length > 1 ? `(${range})` : range;
			}
			if (node.nodes) for (const child of node.nodes) output += walk(child, node);
			return output;
		};
		return walk(ast);
	};
	module.exports = compile;
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/expand.js
var require_expand = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const fill = require_fill_range();
	const stringify = require_stringify();
	const utils = require_utils$1();
	const append = (queue = "", stash = "", enclose = false) => {
		const result = [];
		queue = [].concat(queue);
		stash = [].concat(stash);
		if (!stash.length) return queue;
		if (!queue.length) return enclose ? utils.flatten(stash).map((ele) => `{${ele}}`) : stash;
		for (const item of queue) if (Array.isArray(item)) for (const value of item) result.push(append(value, stash, enclose));
		else for (let ele of stash) {
			if (enclose === true && typeof ele === "string") ele = `{${ele}}`;
			result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
		}
		return utils.flatten(result);
	};
	const expand = (ast, options = {}) => {
		const rangeLimit = options.rangeLimit === void 0 ? 1e3 : options.rangeLimit;
		const walk = (node, parent = {}) => {
			node.queue = [];
			let p = parent;
			let q = parent.queue;
			while (p.type !== "brace" && p.type !== "root" && p.parent) {
				p = p.parent;
				q = p.queue;
			}
			if (node.invalid || node.dollar) {
				q.push(append(q.pop(), stringify(node, options)));
				return;
			}
			if (node.type === "brace" && node.invalid !== true && node.nodes.length === 2) {
				q.push(append(q.pop(), ["{}"]));
				return;
			}
			if (node.nodes && node.ranges > 0) {
				const args = utils.reduce(node.nodes);
				if (utils.exceedsLimit(...args, options.step, rangeLimit)) throw new RangeError("expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.");
				let range = fill(...args, options);
				if (range.length === 0) range = stringify(node, options);
				q.push(append(q.pop(), range));
				node.nodes = [];
				return;
			}
			const enclose = utils.encloseBrace(node);
			let queue = node.queue;
			let block = node;
			while (block.type !== "brace" && block.type !== "root" && block.parent) {
				block = block.parent;
				queue = block.queue;
			}
			for (let i = 0; i < node.nodes.length; i++) {
				const child = node.nodes[i];
				if (child.type === "comma" && node.type === "brace") {
					if (i === 1) queue.push("");
					queue.push("");
					continue;
				}
				if (child.type === "close") {
					q.push(append(q.pop(), queue, enclose));
					continue;
				}
				if (child.value && child.type !== "open") {
					queue.push(append(queue.pop(), child.value));
					continue;
				}
				if (child.nodes) walk(child, node);
			}
			return queue;
		};
		return utils.flatten(walk(ast));
	};
	module.exports = expand;
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/constants.js
var require_constants$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = {
		MAX_LENGTH: 1e4,
		CHAR_0: "0",
		CHAR_9: "9",
		CHAR_UPPERCASE_A: "A",
		CHAR_LOWERCASE_A: "a",
		CHAR_UPPERCASE_Z: "Z",
		CHAR_LOWERCASE_Z: "z",
		CHAR_LEFT_PARENTHESES: "(",
		CHAR_RIGHT_PARENTHESES: ")",
		CHAR_ASTERISK: "*",
		CHAR_AMPERSAND: "&",
		CHAR_AT: "@",
		CHAR_BACKSLASH: "\\",
		CHAR_BACKTICK: "`",
		CHAR_CARRIAGE_RETURN: "\r",
		CHAR_CIRCUMFLEX_ACCENT: "^",
		CHAR_COLON: ":",
		CHAR_COMMA: ",",
		CHAR_DOLLAR: "$",
		CHAR_DOT: ".",
		CHAR_DOUBLE_QUOTE: "\"",
		CHAR_EQUAL: "=",
		CHAR_EXCLAMATION_MARK: "!",
		CHAR_FORM_FEED: "\f",
		CHAR_FORWARD_SLASH: "/",
		CHAR_HASH: "#",
		CHAR_HYPHEN_MINUS: "-",
		CHAR_LEFT_ANGLE_BRACKET: "<",
		CHAR_LEFT_CURLY_BRACE: "{",
		CHAR_LEFT_SQUARE_BRACKET: "[",
		CHAR_LINE_FEED: "\n",
		CHAR_NO_BREAK_SPACE: "\xA0",
		CHAR_PERCENT: "%",
		CHAR_PLUS: "+",
		CHAR_QUESTION_MARK: "?",
		CHAR_RIGHT_ANGLE_BRACKET: ">",
		CHAR_RIGHT_CURLY_BRACE: "}",
		CHAR_RIGHT_SQUARE_BRACKET: "]",
		CHAR_SEMICOLON: ";",
		CHAR_SINGLE_QUOTE: "'",
		CHAR_SPACE: " ",
		CHAR_TAB: "	",
		CHAR_UNDERSCORE: "_",
		CHAR_VERTICAL_LINE: "|",
		CHAR_ZERO_WIDTH_NOBREAK_SPACE: "﻿"
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/parse.js
var require_parse$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const stringify = require_stringify();
	/**
	* Constants
	*/
	const { MAX_LENGTH, CHAR_BACKSLASH, CHAR_BACKTICK, CHAR_COMMA, CHAR_DOT, CHAR_LEFT_PARENTHESES, CHAR_RIGHT_PARENTHESES, CHAR_LEFT_CURLY_BRACE, CHAR_RIGHT_CURLY_BRACE, CHAR_LEFT_SQUARE_BRACKET, CHAR_RIGHT_SQUARE_BRACKET, CHAR_DOUBLE_QUOTE, CHAR_SINGLE_QUOTE, CHAR_NO_BREAK_SPACE, CHAR_ZERO_WIDTH_NOBREAK_SPACE } = require_constants$1();
	/**
	* parse
	*/
	const parse = (input, options = {}) => {
		if (typeof input !== "string") throw new TypeError("Expected a string");
		const opts = options || {};
		const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
		if (input.length > max) throw new SyntaxError(`Input length (${input.length}), exceeds max characters (${max})`);
		const ast = {
			type: "root",
			input,
			nodes: []
		};
		const stack = [ast];
		let block = ast;
		let prev = ast;
		let brackets = 0;
		const length = input.length;
		let index = 0;
		let depth = 0;
		let value;
		/**
		* Helpers
		*/
		const advance = () => input[index++];
		const push = (node) => {
			if (node.type === "text" && prev.type === "dot") prev.type = "text";
			if (prev && prev.type === "text" && node.type === "text") {
				prev.value += node.value;
				return;
			}
			block.nodes.push(node);
			node.parent = block;
			node.prev = prev;
			prev = node;
			return node;
		};
		push({ type: "bos" });
		while (index < length) {
			block = stack[stack.length - 1];
			value = advance();
			/**
			* Invalid chars
			*/
			if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) continue;
			/**
			* Escaped chars
			*/
			if (value === CHAR_BACKSLASH) {
				push({
					type: "text",
					value: (options.keepEscaping ? value : "") + advance()
				});
				continue;
			}
			/**
			* Right square bracket (literal): ']'
			*/
			if (value === CHAR_RIGHT_SQUARE_BRACKET) {
				push({
					type: "text",
					value: "\\" + value
				});
				continue;
			}
			/**
			* Left square bracket: '['
			*/
			if (value === CHAR_LEFT_SQUARE_BRACKET) {
				brackets++;
				let next;
				while (index < length && (next = advance())) {
					value += next;
					if (next === CHAR_LEFT_SQUARE_BRACKET) {
						brackets++;
						continue;
					}
					if (next === CHAR_BACKSLASH) {
						value += advance();
						continue;
					}
					if (next === CHAR_RIGHT_SQUARE_BRACKET) {
						brackets--;
						if (brackets === 0) break;
					}
				}
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Parentheses
			*/
			if (value === CHAR_LEFT_PARENTHESES) {
				block = push({
					type: "paren",
					nodes: []
				});
				stack.push(block);
				push({
					type: "text",
					value
				});
				continue;
			}
			if (value === CHAR_RIGHT_PARENTHESES) {
				if (block.type !== "paren") {
					push({
						type: "text",
						value
					});
					continue;
				}
				block = stack.pop();
				push({
					type: "text",
					value
				});
				block = stack[stack.length - 1];
				continue;
			}
			/**
			* Quotes: '|"|`
			*/
			if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
				const open = value;
				let next;
				if (options.keepQuotes !== true) value = "";
				while (index < length && (next = advance())) {
					if (next === CHAR_BACKSLASH) {
						value += next + advance();
						continue;
					}
					if (next === open) {
						if (options.keepQuotes === true) value += next;
						break;
					}
					value += next;
				}
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Left curly brace: '{'
			*/
			if (value === CHAR_LEFT_CURLY_BRACE) {
				depth++;
				block = push({
					type: "brace",
					open: true,
					close: false,
					dollar: prev.value && prev.value.slice(-1) === "$" || block.dollar === true,
					depth,
					commas: 0,
					ranges: 0,
					nodes: []
				});
				stack.push(block);
				push({
					type: "open",
					value
				});
				continue;
			}
			/**
			* Right curly brace: '}'
			*/
			if (value === CHAR_RIGHT_CURLY_BRACE) {
				if (block.type !== "brace") {
					push({
						type: "text",
						value
					});
					continue;
				}
				const type = "close";
				block = stack.pop();
				block.close = true;
				push({
					type,
					value
				});
				depth--;
				block = stack[stack.length - 1];
				continue;
			}
			/**
			* Comma: ','
			*/
			if (value === CHAR_COMMA && depth > 0) {
				if (block.ranges > 0) {
					block.ranges = 0;
					const open = block.nodes.shift();
					block.nodes = [open, {
						type: "text",
						value: stringify(block)
					}];
				}
				push({
					type: "comma",
					value
				});
				block.commas++;
				continue;
			}
			/**
			* Dot: '.'
			*/
			if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
				const siblings = block.nodes;
				if (depth === 0 || siblings.length === 0) {
					push({
						type: "text",
						value
					});
					continue;
				}
				if (prev.type === "dot") {
					block.range = [];
					prev.value += value;
					prev.type = "range";
					if (block.nodes.length !== 3 && block.nodes.length !== 5) {
						block.invalid = true;
						block.ranges = 0;
						prev.type = "text";
						continue;
					}
					block.ranges++;
					block.args = [];
					continue;
				}
				if (prev.type === "range") {
					siblings.pop();
					const before = siblings[siblings.length - 1];
					before.value += prev.value + value;
					prev = before;
					block.ranges--;
					continue;
				}
				push({
					type: "dot",
					value
				});
				continue;
			}
			/**
			* Text
			*/
			push({
				type: "text",
				value
			});
		}
		do {
			block = stack.pop();
			if (block.type !== "root") {
				block.nodes.forEach((node) => {
					if (!node.nodes) {
						if (node.type === "open") node.isOpen = true;
						if (node.type === "close") node.isClose = true;
						if (!node.nodes) node.type = "text";
						node.invalid = true;
					}
				});
				const parent = stack[stack.length - 1];
				const index = parent.nodes.indexOf(block);
				parent.nodes.splice(index, 1, ...block.nodes);
			}
		} while (stack.length > 0);
		push({ type: "eos" });
		return ast;
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/index.js
var require_braces = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const stringify = require_stringify();
	const compile = require_compile();
	const expand = require_expand();
	const parse = require_parse$1();
	/**
	* Expand the given pattern or create a regex-compatible string.
	*
	* ```js
	* const braces = require('braces');
	* console.log(braces('{a,b,c}', { compile: true })); //=> ['(a|b|c)']
	* console.log(braces('{a,b,c}')); //=> ['a', 'b', 'c']
	* ```
	* @param {String} `str`
	* @param {Object} `options`
	* @return {String}
	* @api public
	*/
	const braces = (input, options = {}) => {
		let output = [];
		if (Array.isArray(input)) for (const pattern of input) {
			const result = braces.create(pattern, options);
			if (Array.isArray(result)) output.push(...result);
			else output.push(result);
		}
		else output = [].concat(braces.create(input, options));
		if (options && options.expand === true && options.nodupes === true) output = [...new Set(output)];
		return output;
	};
	/**
	* Parse the given `str` with the given `options`.
	*
	* ```js
	* // braces.parse(pattern, [, options]);
	* const ast = braces.parse('a/{b,c}/d');
	* console.log(ast);
	* ```
	* @param {String} pattern Brace pattern to parse
	* @param {Object} options
	* @return {Object} Returns an AST
	* @api public
	*/
	braces.parse = (input, options = {}) => parse(input, options);
	/**
	* Creates a braces string from an AST, or an AST node.
	*
	* ```js
	* const braces = require('braces');
	* let ast = braces.parse('foo/{a,b}/bar');
	* console.log(stringify(ast.nodes[2])); //=> '{a,b}'
	* ```
	* @param {String} `input` Brace pattern or AST.
	* @param {Object} `options`
	* @return {Array} Returns an array of expanded values.
	* @api public
	*/
	braces.stringify = (input, options = {}) => {
		if (typeof input === "string") return stringify(braces.parse(input, options), options);
		return stringify(input, options);
	};
	/**
	* Compiles a brace pattern into a regex-compatible, optimized string.
	* This method is called by the main [braces](#braces) function by default.
	*
	* ```js
	* const braces = require('braces');
	* console.log(braces.compile('a/{b,c}/d'));
	* //=> ['a/(b|c)/d']
	* ```
	* @param {String} `input` Brace pattern or AST.
	* @param {Object} `options`
	* @return {Array} Returns an array of expanded values.
	* @api public
	*/
	braces.compile = (input, options = {}) => {
		if (typeof input === "string") input = braces.parse(input, options);
		return compile(input, options);
	};
	/**
	* Expands a brace pattern into an array. This method is called by the
	* main [braces](#braces) function when `options.expand` is true. Before
	* using this method it's recommended that you read the [performance notes](#performance))
	* and advantages of using [.compile](#compile) instead.
	*
	* ```js
	* const braces = require('braces');
	* console.log(braces.expand('a/{b,c}/d'));
	* //=> ['a/b/d', 'a/c/d'];
	* ```
	* @param {String} `pattern` Brace pattern
	* @param {Object} `options`
	* @return {Array} Returns an array of expanded values.
	* @api public
	*/
	braces.expand = (input, options = {}) => {
		if (typeof input === "string") input = braces.parse(input, options);
		let result = expand(input, options);
		if (options.noempty === true) result = result.filter(Boolean);
		if (options.nodupes === true) result = [...new Set(result)];
		return result;
	};
	/**
	* Processes a brace pattern and returns either an expanded array
	* (if `options.expand` is true), a highly optimized regex-compatible string.
	* This method is called by the main [braces](#braces) function.
	*
	* ```js
	* const braces = require('braces');
	* console.log(braces.create('user-{200..300}/project-{a,b,c}-{1..10}'))
	* //=> 'user-(20[0-9]|2[1-9][0-9]|300)/project-(a|b|c)-([1-9]|10)'
	* ```
	* @param {String} `pattern` Brace pattern
	* @param {Object} `options`
	* @return {Array} Returns an array of expanded values.
	* @api public
	*/
	braces.create = (input, options = {}) => {
		if (input === "" || input.length < 3) return [input];
		return options.expand !== true ? braces.compile(input, options) : braces.expand(input, options);
	};
	/**
	* Expose "braces"
	*/
	module.exports = braces;
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path$2 = __require("path");
	const WIN_SLASH = "\\\\/";
	const WIN_NO_SLASH = `[^${WIN_SLASH}]`;
	const DEFAULT_MAX_EXTGLOB_RECURSION = 0;
	/**
	* Posix glob regex
	*/
	const DOT_LITERAL = "\\.";
	const PLUS_LITERAL = "\\+";
	const QMARK_LITERAL = "\\?";
	const SLASH_LITERAL = "\\/";
	const ONE_CHAR = "(?=.)";
	const QMARK = "[^/]";
	const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
	const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
	const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
	const POSIX_CHARS = {
		DOT_LITERAL,
		PLUS_LITERAL,
		QMARK_LITERAL,
		SLASH_LITERAL,
		ONE_CHAR,
		QMARK,
		END_ANCHOR,
		DOTS_SLASH,
		NO_DOT: `(?!${DOT_LITERAL})`,
		NO_DOTS: `(?!${START_ANCHOR}${DOTS_SLASH})`,
		NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`,
		NO_DOTS_SLASH: `(?!${DOTS_SLASH})`,
		QMARK_NO_DOT: `[^.${SLASH_LITERAL}]`,
		STAR: `${QMARK}*?`,
		START_ANCHOR
	};
	/**
	* Windows glob regex
	*/
	const WINDOWS_CHARS = {
		...POSIX_CHARS,
		SLASH_LITERAL: `[${WIN_SLASH}]`,
		QMARK: WIN_NO_SLASH,
		STAR: `${WIN_NO_SLASH}*?`,
		DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
		NO_DOT: `(?!${DOT_LITERAL})`,
		NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
		NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
		NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
		QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
		START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
		END_ANCHOR: `(?:[${WIN_SLASH}]|$)`
	};
	module.exports = {
		DEFAULT_MAX_EXTGLOB_RECURSION,
		MAX_LENGTH: 65536,
		POSIX_REGEX_SOURCE: {
			__proto__: null,
			alnum: "a-zA-Z0-9",
			alpha: "a-zA-Z",
			ascii: "\\x00-\\x7F",
			blank: " \\t",
			cntrl: "\\x00-\\x1F\\x7F",
			digit: "0-9",
			graph: "\\x21-\\x7E",
			lower: "a-z",
			print: "\\x20-\\x7E ",
			punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
			space: " \\t\\r\\n\\v\\f",
			upper: "A-Z",
			word: "A-Za-z0-9_",
			xdigit: "A-Fa-f0-9"
		},
		REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
		REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
		REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
		REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
		REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
		REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
		REPLACEMENTS: {
			__proto__: null,
			"***": "*",
			"**/**": "**",
			"**/**/**": "**"
		},
		CHAR_0: 48,
		CHAR_9: 57,
		CHAR_UPPERCASE_A: 65,
		CHAR_LOWERCASE_A: 97,
		CHAR_UPPERCASE_Z: 90,
		CHAR_LOWERCASE_Z: 122,
		CHAR_LEFT_PARENTHESES: 40,
		CHAR_RIGHT_PARENTHESES: 41,
		CHAR_ASTERISK: 42,
		CHAR_AMPERSAND: 38,
		CHAR_AT: 64,
		CHAR_BACKWARD_SLASH: 92,
		CHAR_CARRIAGE_RETURN: 13,
		CHAR_CIRCUMFLEX_ACCENT: 94,
		CHAR_COLON: 58,
		CHAR_COMMA: 44,
		CHAR_DOT: 46,
		CHAR_DOUBLE_QUOTE: 34,
		CHAR_EQUAL: 61,
		CHAR_EXCLAMATION_MARK: 33,
		CHAR_FORM_FEED: 12,
		CHAR_FORWARD_SLASH: 47,
		CHAR_GRAVE_ACCENT: 96,
		CHAR_HASH: 35,
		CHAR_HYPHEN_MINUS: 45,
		CHAR_LEFT_ANGLE_BRACKET: 60,
		CHAR_LEFT_CURLY_BRACE: 123,
		CHAR_LEFT_SQUARE_BRACKET: 91,
		CHAR_LINE_FEED: 10,
		CHAR_NO_BREAK_SPACE: 160,
		CHAR_PERCENT: 37,
		CHAR_PLUS: 43,
		CHAR_QUESTION_MARK: 63,
		CHAR_RIGHT_ANGLE_BRACKET: 62,
		CHAR_RIGHT_CURLY_BRACE: 125,
		CHAR_RIGHT_SQUARE_BRACKET: 93,
		CHAR_SEMICOLON: 59,
		CHAR_SINGLE_QUOTE: 39,
		CHAR_SPACE: 32,
		CHAR_TAB: 9,
		CHAR_UNDERSCORE: 95,
		CHAR_VERTICAL_LINE: 124,
		CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
		SEP: path$2.sep,
		/**
		* Create EXTGLOB_CHARS
		*/
		extglobChars(chars) {
			return {
				"!": {
					type: "negate",
					open: "(?:(?!(?:",
					close: `))${chars.STAR})`
				},
				"?": {
					type: "qmark",
					open: "(?:",
					close: ")?"
				},
				"+": {
					type: "plus",
					open: "(?:",
					close: ")+"
				},
				"*": {
					type: "star",
					open: "(?:",
					close: ")*"
				},
				"@": {
					type: "at",
					open: "(?:",
					close: ")"
				}
			};
		},
		/**
		* Create GLOB_CHARS
		*/
		globChars(win32) {
			return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
		}
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/utils.js
var require_utils = /* @__PURE__ */ __commonJSMin(((exports) => {
	const path$1 = __require("path");
	const win32 = process.platform === "win32";
	const { REGEX_BACKSLASH, REGEX_REMOVE_BACKSLASH, REGEX_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_GLOBAL } = require_constants();
	exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
	exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
	exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
	exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
	exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
	exports.removeBackslashes = (str) => {
		return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
			return match === "\\" ? "" : match;
		});
	};
	exports.supportsLookbehinds = () => {
		const segs = process.version.slice(1).split(".").map(Number);
		if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) return true;
		return false;
	};
	exports.isWindows = (options) => {
		if (options && typeof options.windows === "boolean") return options.windows;
		return win32 === true || path$1.sep === "\\";
	};
	exports.escapeLast = (input, char, lastIdx) => {
		const idx = input.lastIndexOf(char, lastIdx);
		if (idx === -1) return input;
		if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
		return `${input.slice(0, idx)}\\${input.slice(idx)}`;
	};
	exports.removePrefix = (input, state = {}) => {
		let output = input;
		if (output.startsWith("./")) {
			output = output.slice(2);
			state.prefix = "./";
		}
		return output;
	};
	exports.wrapOutput = (input, state = {}, options = {}) => {
		let output = `${options.contains ? "" : "^"}(?:${input})${options.contains ? "" : "$"}`;
		if (state.negated === true) output = `(?:^(?!${output}).*$)`;
		return output;
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/scan.js
var require_scan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const utils = require_utils();
	const { CHAR_ASTERISK, CHAR_AT, CHAR_BACKWARD_SLASH, CHAR_COMMA, CHAR_DOT, CHAR_EXCLAMATION_MARK, CHAR_FORWARD_SLASH, CHAR_LEFT_CURLY_BRACE, CHAR_LEFT_PARENTHESES, CHAR_LEFT_SQUARE_BRACKET, CHAR_PLUS, CHAR_QUESTION_MARK, CHAR_RIGHT_CURLY_BRACE, CHAR_RIGHT_PARENTHESES, CHAR_RIGHT_SQUARE_BRACKET } = require_constants();
	const isPathSeparator = (code) => {
		return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
	};
	const depth = (token) => {
		if (token.isPrefix !== true) token.depth = token.isGlobstar ? Infinity : 1;
	};
	/**
	* Quickly scans a glob pattern and returns an object with a handful of
	* useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
	* `glob` (the actual pattern), `negated` (true if the path starts with `!` but not
	* with `!(`) and `negatedExtglob` (true if the path starts with `!(`).
	*
	* ```js
	* const pm = require('picomatch');
	* console.log(pm.scan('foo/bar/*.js'));
	* { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
	* ```
	* @param {String} `str`
	* @param {Object} `options`
	* @return {Object} Returns an object with tokens and regex source string.
	* @api public
	*/
	const scan = (input, options) => {
		const opts = options || {};
		const length = input.length - 1;
		const scanToEnd = opts.parts === true || opts.scanToEnd === true;
		const slashes = [];
		const tokens = [];
		const parts = [];
		let str = input;
		let index = -1;
		let start = 0;
		let lastIndex = 0;
		let isBrace = false;
		let isBracket = false;
		let isGlob = false;
		let isExtglob = false;
		let isGlobstar = false;
		let braceEscaped = false;
		let backslashes = false;
		let negated = false;
		let negatedExtglob = false;
		let finished = false;
		let braces = 0;
		let prev;
		let code;
		let token = {
			value: "",
			depth: 0,
			isGlob: false
		};
		const eos = () => index >= length;
		const peek = () => str.charCodeAt(index + 1);
		const advance = () => {
			prev = code;
			return str.charCodeAt(++index);
		};
		while (index < length) {
			code = advance();
			let next;
			if (code === CHAR_BACKWARD_SLASH) {
				backslashes = token.backslashes = true;
				code = advance();
				if (code === CHAR_LEFT_CURLY_BRACE) braceEscaped = true;
				continue;
			}
			if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
				braces++;
				while (eos() !== true && (code = advance())) {
					if (code === CHAR_BACKWARD_SLASH) {
						backslashes = token.backslashes = true;
						advance();
						continue;
					}
					if (code === CHAR_LEFT_CURLY_BRACE) {
						braces++;
						continue;
					}
					if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
						isBrace = token.isBrace = true;
						isGlob = token.isGlob = true;
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
					if (braceEscaped !== true && code === CHAR_COMMA) {
						isBrace = token.isBrace = true;
						isGlob = token.isGlob = true;
						finished = true;
						if (scanToEnd === true) continue;
						break;
					}
					if (code === CHAR_RIGHT_CURLY_BRACE) {
						braces--;
						if (braces === 0) {
							braceEscaped = false;
							isBrace = token.isBrace = true;
							finished = true;
							break;
						}
					}
				}
				if (scanToEnd === true) continue;
				break;
			}
			if (code === CHAR_FORWARD_SLASH) {
				slashes.push(index);
				tokens.push(token);
				token = {
					value: "",
					depth: 0,
					isGlob: false
				};
				if (finished === true) continue;
				if (prev === CHAR_DOT && index === start + 1) {
					start += 2;
					continue;
				}
				lastIndex = index + 1;
				continue;
			}
			if (opts.noext !== true) {
				if ((code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK) === true && peek() === CHAR_LEFT_PARENTHESES) {
					isGlob = token.isGlob = true;
					isExtglob = token.isExtglob = true;
					finished = true;
					if (code === CHAR_EXCLAMATION_MARK && index === start) negatedExtglob = true;
					if (scanToEnd === true) {
						while (eos() !== true && (code = advance())) {
							if (code === CHAR_BACKWARD_SLASH) {
								backslashes = token.backslashes = true;
								code = advance();
								continue;
							}
							if (code === CHAR_RIGHT_PARENTHESES) {
								isGlob = token.isGlob = true;
								finished = true;
								break;
							}
						}
						continue;
					}
					break;
				}
			}
			if (code === CHAR_ASTERISK) {
				if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
				isGlob = token.isGlob = true;
				finished = true;
				if (scanToEnd === true) continue;
				break;
			}
			if (code === CHAR_QUESTION_MARK) {
				isGlob = token.isGlob = true;
				finished = true;
				if (scanToEnd === true) continue;
				break;
			}
			if (code === CHAR_LEFT_SQUARE_BRACKET) {
				while (eos() !== true && (next = advance())) {
					if (next === CHAR_BACKWARD_SLASH) {
						backslashes = token.backslashes = true;
						advance();
						continue;
					}
					if (next === CHAR_RIGHT_SQUARE_BRACKET) {
						isBracket = token.isBracket = true;
						isGlob = token.isGlob = true;
						finished = true;
						break;
					}
				}
				if (scanToEnd === true) continue;
				break;
			}
			if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
				negated = token.negated = true;
				start++;
				continue;
			}
			if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
				isGlob = token.isGlob = true;
				if (scanToEnd === true) {
					while (eos() !== true && (code = advance())) {
						if (code === CHAR_LEFT_PARENTHESES) {
							backslashes = token.backslashes = true;
							code = advance();
							continue;
						}
						if (code === CHAR_RIGHT_PARENTHESES) {
							finished = true;
							break;
						}
					}
					continue;
				}
				break;
			}
			if (isGlob === true) {
				finished = true;
				if (scanToEnd === true) continue;
				break;
			}
		}
		if (opts.noext === true) {
			isExtglob = false;
			isGlob = false;
		}
		let base = str;
		let prefix = "";
		let glob = "";
		if (start > 0) {
			prefix = str.slice(0, start);
			str = str.slice(start);
			lastIndex -= start;
		}
		if (base && isGlob === true && lastIndex > 0) {
			base = str.slice(0, lastIndex);
			glob = str.slice(lastIndex);
		} else if (isGlob === true) {
			base = "";
			glob = str;
		} else base = str;
		if (base && base !== "" && base !== "/" && base !== str) {
			if (isPathSeparator(base.charCodeAt(base.length - 1))) base = base.slice(0, -1);
		}
		if (opts.unescape === true) {
			if (glob) glob = utils.removeBackslashes(glob);
			if (base && backslashes === true) base = utils.removeBackslashes(base);
		}
		const state = {
			prefix,
			input,
			start,
			base,
			glob,
			isBrace,
			isBracket,
			isGlob,
			isExtglob,
			isGlobstar,
			negated,
			negatedExtglob
		};
		if (opts.tokens === true) {
			state.maxDepth = 0;
			if (!isPathSeparator(code)) tokens.push(token);
			state.tokens = tokens;
		}
		if (opts.parts === true || opts.tokens === true) {
			let prevIndex;
			for (let idx = 0; idx < slashes.length; idx++) {
				const n = prevIndex ? prevIndex + 1 : start;
				const i = slashes[idx];
				const value = input.slice(n, i);
				if (opts.tokens) {
					if (idx === 0 && start !== 0) {
						tokens[idx].isPrefix = true;
						tokens[idx].value = prefix;
					} else tokens[idx].value = value;
					depth(tokens[idx]);
					state.maxDepth += tokens[idx].depth;
				}
				if (idx !== 0 || value !== "") parts.push(value);
				prevIndex = i;
			}
			if (prevIndex && prevIndex + 1 < input.length) {
				const value = input.slice(prevIndex + 1);
				parts.push(value);
				if (opts.tokens) {
					tokens[tokens.length - 1].value = value;
					depth(tokens[tokens.length - 1]);
					state.maxDepth += tokens[tokens.length - 1].depth;
				}
			}
			state.slashes = slashes;
			state.parts = parts;
		}
		return state;
	};
	module.exports = scan;
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const constants = require_constants();
	const utils = require_utils();
	/**
	* Constants
	*/
	const { MAX_LENGTH, POSIX_REGEX_SOURCE, REGEX_NON_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_BACKREF, REPLACEMENTS } = constants;
	/**
	* Helpers
	*/
	const expandRange = (args, options) => {
		if (typeof options.expandRange === "function") return options.expandRange(...args, options);
		args.sort();
		const value = `[${args.join("-")}]`;
		try {
			new RegExp(value);
		} catch (ex) {
			return args.map((v) => utils.escapeRegex(v)).join("..");
		}
		return value;
	};
	/**
	* Create the message for a syntax error
	*/
	const syntaxError = (type, char) => {
		return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
	};
	const splitTopLevel = (input) => {
		const parts = [];
		let bracket = 0;
		let paren = 0;
		let quote = 0;
		let value = "";
		let escaped = false;
		for (const ch of input) {
			if (escaped === true) {
				value += ch;
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				value += ch;
				escaped = true;
				continue;
			}
			if (ch === "\"") {
				quote = quote === 1 ? 0 : 1;
				value += ch;
				continue;
			}
			if (quote === 0) {
				if (ch === "[") bracket++;
				else if (ch === "]" && bracket > 0) bracket--;
				else if (bracket === 0) {
					if (ch === "(") paren++;
					else if (ch === ")" && paren > 0) paren--;
					else if (ch === "|" && paren === 0) {
						parts.push(value);
						value = "";
						continue;
					}
				}
			}
			value += ch;
		}
		parts.push(value);
		return parts;
	};
	const isPlainBranch = (branch) => {
		let escaped = false;
		for (const ch of branch) {
			if (escaped === true) {
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				escaped = true;
				continue;
			}
			if (/[?*+@!()[\]{}]/.test(ch)) return false;
		}
		return true;
	};
	const normalizeSimpleBranch = (branch) => {
		let value = branch.trim();
		let changed = true;
		while (changed === true) {
			changed = false;
			if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
				value = value.slice(2, -1);
				changed = true;
			}
		}
		if (!isPlainBranch(value)) return;
		return value.replace(/\\(.)/g, "$1");
	};
	const hasRepeatedCharPrefixOverlap = (branches) => {
		const values = branches.map(normalizeSimpleBranch).filter(Boolean);
		for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
			const a = values[i];
			const b = values[j];
			const char = a[0];
			if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) continue;
			if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
		}
		return false;
	};
	const parseRepeatedExtglob = (pattern, requireEnd = true) => {
		if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") return;
		let bracket = 0;
		let paren = 0;
		let quote = 0;
		let escaped = false;
		for (let i = 1; i < pattern.length; i++) {
			const ch = pattern[i];
			if (escaped === true) {
				escaped = false;
				continue;
			}
			if (ch === "\\") {
				escaped = true;
				continue;
			}
			if (ch === "\"") {
				quote = quote === 1 ? 0 : 1;
				continue;
			}
			if (quote === 1) continue;
			if (ch === "[") {
				bracket++;
				continue;
			}
			if (ch === "]" && bracket > 0) {
				bracket--;
				continue;
			}
			if (bracket > 0) continue;
			if (ch === "(") {
				paren++;
				continue;
			}
			if (ch === ")") {
				paren--;
				if (paren === 0) {
					if (requireEnd === true && i !== pattern.length - 1) return;
					return {
						type: pattern[0],
						body: pattern.slice(2, i),
						end: i
					};
				}
			}
		}
	};
	const getStarExtglobSequenceOutput = (pattern) => {
		let index = 0;
		const chars = [];
		while (index < pattern.length) {
			const match = parseRepeatedExtglob(pattern.slice(index), false);
			if (!match || match.type !== "*") return;
			const branches = splitTopLevel(match.body).map((branch) => branch.trim());
			if (branches.length !== 1) return;
			const branch = normalizeSimpleBranch(branches[0]);
			if (!branch || branch.length !== 1) return;
			chars.push(branch);
			index += match.end + 1;
		}
		if (chars.length < 1) return;
		return `${chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`}*`;
	};
	const repeatedExtglobRecursion = (pattern) => {
		let depth = 0;
		let value = pattern.trim();
		let match = parseRepeatedExtglob(value);
		while (match) {
			depth++;
			value = match.body.trim();
			match = parseRepeatedExtglob(value);
		}
		return depth;
	};
	const analyzeRepeatedExtglob = (body, options) => {
		if (options.maxExtglobRecursion === false) return { risky: false };
		const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
		const branches = splitTopLevel(body).map((branch) => branch.trim());
		if (branches.length > 1) {
			if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) return { risky: true };
		}
		for (const branch of branches) {
			const safeOutput = getStarExtglobSequenceOutput(branch);
			if (safeOutput) return {
				risky: true,
				safeOutput
			};
			if (repeatedExtglobRecursion(branch) > max) return { risky: true };
		}
		return { risky: false };
	};
	/**
	* Parse the given input string.
	* @param {String} input
	* @param {Object} options
	* @return {Object}
	*/
	const parse = (input, options) => {
		if (typeof input !== "string") throw new TypeError("Expected a string");
		input = REPLACEMENTS[input] || input;
		const opts = { ...options };
		const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
		let len = input.length;
		if (len > max) throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
		const bos = {
			type: "bos",
			value: "",
			output: opts.prepend || ""
		};
		const tokens = [bos];
		const capture = opts.capture ? "" : "?:";
		const win32 = utils.isWindows(options);
		const PLATFORM_CHARS = constants.globChars(win32);
		const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
		const { DOT_LITERAL, PLUS_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOT_SLASH, NO_DOTS_SLASH, QMARK, QMARK_NO_DOT, STAR, START_ANCHOR } = PLATFORM_CHARS;
		const globstar = (opts) => {
			return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
		};
		const nodot = opts.dot ? "" : NO_DOT;
		const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
		let star = opts.bash === true ? globstar(opts) : STAR;
		if (opts.capture) star = `(${star})`;
		if (typeof opts.noext === "boolean") opts.noextglob = opts.noext;
		const state = {
			input,
			index: -1,
			start: 0,
			dot: opts.dot === true,
			consumed: "",
			output: "",
			prefix: "",
			backtrack: false,
			negated: false,
			brackets: 0,
			braces: 0,
			parens: 0,
			quotes: 0,
			globstar: false,
			tokens
		};
		input = utils.removePrefix(input, state);
		len = input.length;
		const extglobs = [];
		const braces = [];
		const stack = [];
		let prev = bos;
		let value;
		/**
		* Tokenizing helpers
		*/
		const eos = () => state.index === len - 1;
		const peek = state.peek = (n = 1) => input[state.index + n];
		const advance = state.advance = () => input[++state.index] || "";
		const remaining = () => input.slice(state.index + 1);
		const consume = (value = "", num = 0) => {
			state.consumed += value;
			state.index += num;
		};
		const append = (token) => {
			state.output += token.output != null ? token.output : token.value;
			consume(token.value);
		};
		const negate = () => {
			let count = 1;
			while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
				advance();
				state.start++;
				count++;
			}
			if (count % 2 === 0) return false;
			state.negated = true;
			state.start++;
			return true;
		};
		const increment = (type) => {
			state[type]++;
			stack.push(type);
		};
		const decrement = (type) => {
			state[type]--;
			stack.pop();
		};
		/**
		* Push tokens onto the tokens array. This helper speeds up
		* tokenizing by 1) helping us avoid backtracking as much as possible,
		* and 2) helping us avoid creating extra tokens when consecutive
		* characters are plain text. This improves performance and simplifies
		* lookbehinds.
		*/
		const push = (tok) => {
			if (prev.type === "globstar") {
				const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
				const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
				if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
					state.output = state.output.slice(0, -prev.output.length);
					prev.type = "star";
					prev.value = "*";
					prev.output = star;
					state.output += prev.output;
				}
			}
			if (extglobs.length && tok.type !== "paren") extglobs[extglobs.length - 1].inner += tok.value;
			if (tok.value || tok.output) append(tok);
			if (prev && prev.type === "text" && tok.type === "text") {
				prev.value += tok.value;
				prev.output = (prev.output || "") + tok.value;
				return;
			}
			tok.prev = prev;
			tokens.push(tok);
			prev = tok;
		};
		const extglobOpen = (type, value) => {
			const token = {
				...EXTGLOB_CHARS[value],
				conditions: 1,
				inner: ""
			};
			token.prev = prev;
			token.parens = state.parens;
			token.output = state.output;
			token.startIndex = state.index;
			token.tokensIndex = tokens.length;
			const output = (opts.capture ? "(" : "") + token.open;
			increment("parens");
			push({
				type,
				value,
				output: state.output ? "" : ONE_CHAR
			});
			push({
				type: "paren",
				extglob: true,
				value: advance(),
				output
			});
			extglobs.push(token);
		};
		const extglobClose = (token) => {
			const literal = input.slice(token.startIndex, state.index + 1);
			const body = input.slice(token.startIndex + 2, state.index);
			const analysis = analyzeRepeatedExtglob(body, opts);
			if ((token.type === "plus" || token.type === "star") && analysis.risky) {
				const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
				const open = tokens[token.tokensIndex];
				open.type = "text";
				open.value = literal;
				open.output = safeOutput || utils.escapeRegex(literal);
				for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
					tokens[i].value = "";
					tokens[i].output = "";
					delete tokens[i].suffix;
				}
				state.output = token.output + open.output;
				state.backtrack = true;
				push({
					type: "paren",
					extglob: true,
					value,
					output: ""
				});
				decrement("parens");
				return;
			}
			let output = token.close + (opts.capture ? ")" : "");
			let rest;
			if (token.type === "negate") {
				let extglobStar = star;
				if (token.inner && token.inner.length > 1 && token.inner.includes("/")) extglobStar = globstar(opts);
				if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) output = token.close = `)$))${extglobStar}`;
				if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) output = token.close = `)${parse(rest, {
					...options,
					fastpaths: false
				}).output})${extglobStar})`;
				if (token.prev.type === "bos") state.negatedExtglob = true;
			}
			push({
				type: "paren",
				extglob: true,
				value,
				output
			});
			decrement("parens");
		};
		/**
		* Fast paths
		*/
		if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
			let backslashes = false;
			let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
				if (first === "\\") {
					backslashes = true;
					return m;
				}
				if (first === "?") {
					if (esc) return esc + first + (rest ? QMARK.repeat(rest.length) : "");
					if (index === 0) return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
					return QMARK.repeat(chars.length);
				}
				if (first === ".") return DOT_LITERAL.repeat(chars.length);
				if (first === "*") {
					if (esc) return esc + first + (rest ? star : "");
					return star;
				}
				return esc ? m : `\\${m}`;
			});
			if (backslashes === true) {
				if (opts.unescape === true) output = output.replace(/\\/g, "");
				else output = output.replace(/\\+/g, (m) => {
					return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
				});
			}
			if (output === input && opts.contains === true) {
				state.output = input;
				return state;
			}
			state.output = utils.wrapOutput(output, state, options);
			return state;
		}
		/**
		* Tokenize input until we reach end-of-string
		*/
		while (!eos()) {
			value = advance();
			if (value === "\0") continue;
			/**
			* Escaped characters
			*/
			if (value === "\\") {
				const next = peek();
				if (next === "/" && opts.bash !== true) continue;
				if (next === "." || next === ";") continue;
				if (!next) {
					value += "\\";
					push({
						type: "text",
						value
					});
					continue;
				}
				const match = /^\\+/.exec(remaining());
				let slashes = 0;
				if (match && match[0].length > 2) {
					slashes = match[0].length;
					state.index += slashes;
					if (slashes % 2 !== 0) value += "\\";
				}
				if (opts.unescape === true) value = advance();
				else value += advance();
				if (state.brackets === 0) {
					push({
						type: "text",
						value
					});
					continue;
				}
			}
			/**
			* If we're inside a regex character class, continue
			* until we reach the closing bracket.
			*/
			if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
				if (opts.posix !== false && value === ":") {
					const inner = prev.value.slice(1);
					if (inner.includes("[")) {
						prev.posix = true;
						if (inner.includes(":")) {
							const idx = prev.value.lastIndexOf("[");
							const pre = prev.value.slice(0, idx);
							const rest = prev.value.slice(idx + 2);
							const posix = POSIX_REGEX_SOURCE[rest];
							if (posix) {
								prev.value = pre + posix;
								state.backtrack = true;
								advance();
								if (!bos.output && tokens.indexOf(prev) === 1) bos.output = ONE_CHAR;
								continue;
							}
						}
					}
				}
				if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") value = `\\${value}`;
				if (value === "]" && (prev.value === "[" || prev.value === "[^")) value = `\\${value}`;
				if (opts.posix === true && value === "!" && prev.value === "[") value = "^";
				prev.value += value;
				append({ value });
				continue;
			}
			/**
			* If we're inside a quoted string, continue
			* until we reach the closing double quote.
			*/
			if (state.quotes === 1 && value !== "\"") {
				value = utils.escapeRegex(value);
				prev.value += value;
				append({ value });
				continue;
			}
			/**
			* Double quotes
			*/
			if (value === "\"") {
				state.quotes = state.quotes === 1 ? 0 : 1;
				if (opts.keepQuotes === true) push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Parentheses
			*/
			if (value === "(") {
				increment("parens");
				push({
					type: "paren",
					value
				});
				continue;
			}
			if (value === ")") {
				if (state.parens === 0 && opts.strictBrackets === true) throw new SyntaxError(syntaxError("opening", "("));
				const extglob = extglobs[extglobs.length - 1];
				if (extglob && state.parens === extglob.parens + 1) {
					extglobClose(extglobs.pop());
					continue;
				}
				push({
					type: "paren",
					value,
					output: state.parens ? ")" : "\\)"
				});
				decrement("parens");
				continue;
			}
			/**
			* Square brackets
			*/
			if (value === "[") {
				if (opts.nobracket === true || !remaining().includes("]")) {
					if (opts.nobracket !== true && opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
					value = `\\${value}`;
				} else increment("brackets");
				push({
					type: "bracket",
					value
				});
				continue;
			}
			if (value === "]") {
				if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
					push({
						type: "text",
						value,
						output: `\\${value}`
					});
					continue;
				}
				if (state.brackets === 0) {
					if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("opening", "["));
					push({
						type: "text",
						value,
						output: `\\${value}`
					});
					continue;
				}
				decrement("brackets");
				const prevValue = prev.value.slice(1);
				if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) value = `/${value}`;
				prev.value += value;
				append({ value });
				if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) continue;
				const escaped = utils.escapeRegex(prev.value);
				state.output = state.output.slice(0, -prev.value.length);
				if (opts.literalBrackets === true) {
					state.output += escaped;
					prev.value = escaped;
					continue;
				}
				prev.value = `(${capture}${escaped}|${prev.value})`;
				state.output += prev.value;
				continue;
			}
			/**
			* Braces
			*/
			if (value === "{" && opts.nobrace !== true) {
				increment("braces");
				const open = {
					type: "brace",
					value,
					output: "(",
					outputIndex: state.output.length,
					tokensIndex: state.tokens.length
				};
				braces.push(open);
				push(open);
				continue;
			}
			if (value === "}") {
				const brace = braces[braces.length - 1];
				if (opts.nobrace === true || !brace) {
					push({
						type: "text",
						value,
						output: value
					});
					continue;
				}
				let output = ")";
				if (brace.dots === true) {
					const arr = tokens.slice();
					const range = [];
					for (let i = arr.length - 1; i >= 0; i--) {
						tokens.pop();
						if (arr[i].type === "brace") break;
						if (arr[i].type !== "dots") range.unshift(arr[i].value);
					}
					output = expandRange(range, opts);
					state.backtrack = true;
				}
				if (brace.comma !== true && brace.dots !== true) {
					const out = state.output.slice(0, brace.outputIndex);
					const toks = state.tokens.slice(brace.tokensIndex);
					brace.value = brace.output = "\\{";
					value = output = "\\}";
					state.output = out;
					for (const t of toks) state.output += t.output || t.value;
				}
				push({
					type: "brace",
					value,
					output
				});
				decrement("braces");
				braces.pop();
				continue;
			}
			/**
			* Pipes
			*/
			if (value === "|") {
				if (extglobs.length > 0) extglobs[extglobs.length - 1].conditions++;
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Commas
			*/
			if (value === ",") {
				let output = value;
				const brace = braces[braces.length - 1];
				if (brace && stack[stack.length - 1] === "braces") {
					brace.comma = true;
					output = "|";
				}
				push({
					type: "comma",
					value,
					output
				});
				continue;
			}
			/**
			* Slashes
			*/
			if (value === "/") {
				if (prev.type === "dot" && state.index === state.start + 1) {
					state.start = state.index + 1;
					state.consumed = "";
					state.output = "";
					tokens.pop();
					prev = bos;
					continue;
				}
				push({
					type: "slash",
					value,
					output: SLASH_LITERAL
				});
				continue;
			}
			/**
			* Dots
			*/
			if (value === ".") {
				if (state.braces > 0 && prev.type === "dot") {
					if (prev.value === ".") prev.output = DOT_LITERAL;
					const brace = braces[braces.length - 1];
					prev.type = "dots";
					prev.output += value;
					prev.value += value;
					brace.dots = true;
					continue;
				}
				if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
					push({
						type: "text",
						value,
						output: DOT_LITERAL
					});
					continue;
				}
				push({
					type: "dot",
					value,
					output: DOT_LITERAL
				});
				continue;
			}
			/**
			* Question marks
			*/
			if (value === "?") {
				if (!(prev && prev.value === "(") && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
					extglobOpen("qmark", value);
					continue;
				}
				if (prev && prev.type === "paren") {
					const next = peek();
					let output = value;
					if (next === "<" && !utils.supportsLookbehinds()) throw new Error("Node.js v10 or higher is required for regex lookbehinds");
					if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) output = `\\${value}`;
					push({
						type: "text",
						value,
						output
					});
					continue;
				}
				if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
					push({
						type: "qmark",
						value,
						output: QMARK_NO_DOT
					});
					continue;
				}
				push({
					type: "qmark",
					value,
					output: QMARK
				});
				continue;
			}
			/**
			* Exclamation
			*/
			if (value === "!") {
				if (opts.noextglob !== true && peek() === "(") {
					if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
						extglobOpen("negate", value);
						continue;
					}
				}
				if (opts.nonegate !== true && state.index === 0) {
					negate();
					continue;
				}
			}
			/**
			* Plus
			*/
			if (value === "+") {
				if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
					extglobOpen("plus", value);
					continue;
				}
				if (prev && prev.value === "(" || opts.regex === false) {
					push({
						type: "plus",
						value,
						output: PLUS_LITERAL
					});
					continue;
				}
				if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
					push({
						type: "plus",
						value
					});
					continue;
				}
				push({
					type: "plus",
					value: PLUS_LITERAL
				});
				continue;
			}
			/**
			* Plain text
			*/
			if (value === "@") {
				if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
					push({
						type: "at",
						extglob: true,
						value,
						output: ""
					});
					continue;
				}
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Plain text
			*/
			if (value !== "*") {
				if (value === "$" || value === "^") value = `\\${value}`;
				const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
				if (match) {
					value += match[0];
					state.index += match[0].length;
				}
				push({
					type: "text",
					value
				});
				continue;
			}
			/**
			* Stars
			*/
			if (prev && (prev.type === "globstar" || prev.star === true)) {
				prev.type = "star";
				prev.star = true;
				prev.value += value;
				prev.output = star;
				state.backtrack = true;
				state.globstar = true;
				consume(value);
				continue;
			}
			let rest = remaining();
			if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
				extglobOpen("star", value);
				continue;
			}
			if (prev.type === "star") {
				if (opts.noglobstar === true) {
					consume(value);
					continue;
				}
				const prior = prev.prev;
				const before = prior.prev;
				const isStart = prior.type === "slash" || prior.type === "bos";
				const afterStar = before && (before.type === "star" || before.type === "globstar");
				if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
					push({
						type: "star",
						value,
						output: ""
					});
					continue;
				}
				const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
				const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
				if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
					push({
						type: "star",
						value,
						output: ""
					});
					continue;
				}
				while (rest.slice(0, 3) === "/**") {
					const after = input[state.index + 4];
					if (after && after !== "/") break;
					rest = rest.slice(3);
					consume("/**", 3);
				}
				if (prior.type === "bos" && eos()) {
					prev.type = "globstar";
					prev.value += value;
					prev.output = globstar(opts);
					state.output = prev.output;
					state.globstar = true;
					consume(value);
					continue;
				}
				if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
					state.output = state.output.slice(0, -(prior.output + prev.output).length);
					prior.output = `(?:${prior.output}`;
					prev.type = "globstar";
					prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
					prev.value += value;
					state.globstar = true;
					state.output += prior.output + prev.output;
					consume(value);
					continue;
				}
				if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
					const end = rest[1] !== void 0 ? "|$" : "";
					state.output = state.output.slice(0, -(prior.output + prev.output).length);
					prior.output = `(?:${prior.output}`;
					prev.type = "globstar";
					prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
					prev.value += value;
					state.output += prior.output + prev.output;
					state.globstar = true;
					consume(value + advance());
					push({
						type: "slash",
						value: "/",
						output: ""
					});
					continue;
				}
				if (prior.type === "bos" && rest[0] === "/") {
					prev.type = "globstar";
					prev.value += value;
					prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
					state.output = prev.output;
					state.globstar = true;
					consume(value + advance());
					push({
						type: "slash",
						value: "/",
						output: ""
					});
					continue;
				}
				state.output = state.output.slice(0, -prev.output.length);
				prev.type = "globstar";
				prev.output = globstar(opts);
				prev.value += value;
				state.output += prev.output;
				state.globstar = true;
				consume(value);
				continue;
			}
			const token = {
				type: "star",
				value,
				output: star
			};
			if (opts.bash === true) {
				token.output = ".*?";
				if (prev.type === "bos" || prev.type === "slash") token.output = nodot + token.output;
				push(token);
				continue;
			}
			if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
				token.output = value;
				push(token);
				continue;
			}
			if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
				if (prev.type === "dot") {
					state.output += NO_DOT_SLASH;
					prev.output += NO_DOT_SLASH;
				} else if (opts.dot === true) {
					state.output += NO_DOTS_SLASH;
					prev.output += NO_DOTS_SLASH;
				} else {
					state.output += nodot;
					prev.output += nodot;
				}
				if (peek() !== "*") {
					state.output += ONE_CHAR;
					prev.output += ONE_CHAR;
				}
			}
			push(token);
		}
		while (state.brackets > 0) {
			if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
			state.output = utils.escapeLast(state.output, "[");
			decrement("brackets");
		}
		while (state.parens > 0) {
			if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
			state.output = utils.escapeLast(state.output, "(");
			decrement("parens");
		}
		while (state.braces > 0) {
			if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
			state.output = utils.escapeLast(state.output, "{");
			decrement("braces");
		}
		if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) push({
			type: "maybe_slash",
			value: "",
			output: `${SLASH_LITERAL}?`
		});
		if (state.backtrack === true) {
			state.output = "";
			for (const token of state.tokens) {
				state.output += token.output != null ? token.output : token.value;
				if (token.suffix) state.output += token.suffix;
			}
		}
		return state;
	};
	/**
	* Fast paths for creating regular expressions for common glob patterns.
	* This can significantly speed up processing and has very little downside
	* impact when none of the fast paths match.
	*/
	parse.fastpaths = (input, options) => {
		const opts = { ...options };
		const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
		const len = input.length;
		if (len > max) throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
		input = REPLACEMENTS[input] || input;
		const win32 = utils.isWindows(options);
		const { DOT_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOTS, NO_DOTS_SLASH, STAR, START_ANCHOR } = constants.globChars(win32);
		const nodot = opts.dot ? NO_DOTS : NO_DOT;
		const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
		const capture = opts.capture ? "" : "?:";
		const state = {
			negated: false,
			prefix: ""
		};
		let star = opts.bash === true ? ".*?" : STAR;
		if (opts.capture) star = `(${star})`;
		const globstar = (opts) => {
			if (opts.noglobstar === true) return star;
			return `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
		};
		const create = (str) => {
			switch (str) {
				case "*": return `${nodot}${ONE_CHAR}${star}`;
				case ".*": return `${DOT_LITERAL}${ONE_CHAR}${star}`;
				case "*.*": return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
				case "*/*": return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
				case "**": return nodot + globstar(opts);
				case "**/*": return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
				case "**/*.*": return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
				case "**/.*": return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
				default: {
					const match = /^(.*?)\.(\w+)$/.exec(str);
					if (!match) return;
					const source = create(match[1]);
					if (!source) return;
					return source + DOT_LITERAL + match[2];
				}
			}
		};
		let source = create(utils.removePrefix(input, state));
		if (source && opts.strictSlashes !== true) source += `${SLASH_LITERAL}?`;
		return source;
	};
	module.exports = parse;
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/picomatch.js
var require_picomatch$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const path = __require("path");
	const scan = require_scan();
	const parse = require_parse();
	const utils = require_utils();
	const constants = require_constants();
	const isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
	/**
	* Creates a matcher function from one or more glob patterns. The
	* returned function takes a string to match as its first argument,
	* and returns true if the string is a match. The returned matcher
	* function also takes a boolean as the second argument that, when true,
	* returns an object with additional information.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch(glob[, options]);
	*
	* const isMatch = picomatch('*.!(*a)');
	* console.log(isMatch('a.a')); //=> false
	* console.log(isMatch('a.b')); //=> true
	* ```
	* @name picomatch
	* @param {String|Array} `globs` One or more glob patterns.
	* @param {Object=} `options`
	* @return {Function=} Returns a matcher function.
	* @api public
	*/
	const picomatch = (glob, options, returnState = false) => {
		if (Array.isArray(glob)) {
			const fns = glob.map((input) => picomatch(input, options, returnState));
			const arrayMatcher = (str) => {
				for (const isMatch of fns) {
					const state = isMatch(str);
					if (state) return state;
				}
				return false;
			};
			return arrayMatcher;
		}
		const isState = isObject(glob) && glob.tokens && glob.input;
		if (glob === "" || typeof glob !== "string" && !isState) throw new TypeError("Expected pattern to be a non-empty string");
		const opts = options || {};
		const posix = utils.isWindows(options);
		const regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
		const state = regex.state;
		delete regex.state;
		let isIgnored = () => false;
		if (opts.ignore) {
			const ignoreOpts = {
				...options,
				ignore: null,
				onMatch: null,
				onResult: null
			};
			isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
		}
		const matcher = (input, returnObject = false) => {
			const { isMatch, match, output } = picomatch.test(input, regex, options, {
				glob,
				posix
			});
			const result = {
				glob,
				state,
				regex,
				posix,
				input,
				output,
				match,
				isMatch
			};
			if (typeof opts.onResult === "function") opts.onResult(result);
			if (isMatch === false) {
				result.isMatch = false;
				return returnObject ? result : false;
			}
			if (isIgnored(input)) {
				if (typeof opts.onIgnore === "function") opts.onIgnore(result);
				result.isMatch = false;
				return returnObject ? result : false;
			}
			if (typeof opts.onMatch === "function") opts.onMatch(result);
			return returnObject ? result : true;
		};
		if (returnState) matcher.state = state;
		return matcher;
	};
	/**
	* Test `input` with the given `regex`. This is used by the main
	* `picomatch()` function to test the input string.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.test(input, regex[, options]);
	*
	* console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
	* // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
	* ```
	* @param {String} `input` String to test.
	* @param {RegExp} `regex`
	* @return {Object} Returns an object with matching info.
	* @api public
	*/
	picomatch.test = (input, regex, options, { glob, posix } = {}) => {
		if (typeof input !== "string") throw new TypeError("Expected input to be a string");
		if (input === "") return {
			isMatch: false,
			output: ""
		};
		const opts = options || {};
		const format = opts.format || (posix ? utils.toPosixSlashes : null);
		let match = input === glob;
		let output = match && format ? format(input) : input;
		if (match === false) {
			output = format ? format(input) : input;
			match = output === glob;
		}
		if (match === false || opts.capture === true) {
			if (opts.matchBase === true || opts.basename === true) match = picomatch.matchBase(input, regex, options, posix);
			else match = regex.exec(output);
		}
		return {
			isMatch: Boolean(match),
			match,
			output
		};
	};
	/**
	* Match the basename of a filepath.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.matchBase(input, glob[, options]);
	* console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
	* ```
	* @param {String} `input` String to test.
	* @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
	* @return {Boolean}
	* @api public
	*/
	picomatch.matchBase = (input, glob, options, posix = utils.isWindows(options)) => {
		return (glob instanceof RegExp ? glob : picomatch.makeRe(glob, options)).test(path.basename(input));
	};
	/**
	* Returns true if **any** of the given glob `patterns` match the specified `string`.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.isMatch(string, patterns[, options]);
	*
	* console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
	* console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
	* ```
	* @param {String|Array} str The string to test.
	* @param {String|Array} patterns One or more glob patterns to use for matching.
	* @param {Object} [options] See available [options](#options).
	* @return {Boolean} Returns true if any patterns match `str`
	* @api public
	*/
	picomatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
	/**
	* Parse a glob pattern to create the source string for a regular
	* expression.
	*
	* ```js
	* const picomatch = require('picomatch');
	* const result = picomatch.parse(pattern[, options]);
	* ```
	* @param {String} `pattern`
	* @param {Object} `options`
	* @return {Object} Returns an object with useful properties and output to be used as a regex source string.
	* @api public
	*/
	picomatch.parse = (pattern, options) => {
		if (Array.isArray(pattern)) return pattern.map((p) => picomatch.parse(p, options));
		return parse(pattern, {
			...options,
			fastpaths: false
		});
	};
	/**
	* Scan a glob pattern to separate the pattern into segments.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.scan(input[, options]);
	*
	* const result = picomatch.scan('!./foo/*.js');
	* console.log(result);
	* { prefix: '!./',
	*   input: '!./foo/*.js',
	*   start: 3,
	*   base: 'foo',
	*   glob: '*.js',
	*   isBrace: false,
	*   isBracket: false,
	*   isGlob: true,
	*   isExtglob: false,
	*   isGlobstar: false,
	*   negated: true }
	* ```
	* @param {String} `input` Glob pattern to scan.
	* @param {Object} `options`
	* @return {Object} Returns an object with
	* @api public
	*/
	picomatch.scan = (input, options) => scan(input, options);
	/**
	* Compile a regular expression from the `state` object returned by the
	* [parse()](#parse) method.
	*
	* @param {Object} `state`
	* @param {Object} `options`
	* @param {Boolean} `returnOutput` Intended for implementors, this argument allows you to return the raw output from the parser.
	* @param {Boolean} `returnState` Adds the state to a `state` property on the returned regex. Useful for implementors and debugging.
	* @return {RegExp}
	* @api public
	*/
	picomatch.compileRe = (state, options, returnOutput = false, returnState = false) => {
		if (returnOutput === true) return state.output;
		const opts = options || {};
		const prepend = opts.contains ? "" : "^";
		const append = opts.contains ? "" : "$";
		let source = `${prepend}(?:${state.output})${append}`;
		if (state && state.negated === true) source = `^(?!${source}).*$`;
		const regex = picomatch.toRegex(source, options);
		if (returnState === true) regex.state = state;
		return regex;
	};
	/**
	* Create a regular expression from a parsed glob pattern.
	*
	* ```js
	* const picomatch = require('picomatch');
	* const state = picomatch.parse('*.js');
	* // picomatch.compileRe(state[, options]);
	*
	* console.log(picomatch.compileRe(state));
	* //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	* ```
	* @param {String} `state` The object returned from the `.parse` method.
	* @param {Object} `options`
	* @param {Boolean} `returnOutput` Implementors may use this argument to return the compiled output, instead of a regular expression. This is not exposed on the options to prevent end-users from mutating the result.
	* @param {Boolean} `returnState` Implementors may use this argument to return the state from the parsed glob with the returned regular expression.
	* @return {RegExp} Returns a regex created from the given pattern.
	* @api public
	*/
	picomatch.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
		if (!input || typeof input !== "string") throw new TypeError("Expected a non-empty string");
		let parsed = {
			negated: false,
			fastpaths: true
		};
		if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) parsed.output = parse.fastpaths(input, options);
		if (!parsed.output) parsed = parse(input, options);
		return picomatch.compileRe(parsed, options, returnOutput, returnState);
	};
	/**
	* Create a regular expression from the given regex source string.
	*
	* ```js
	* const picomatch = require('picomatch');
	* // picomatch.toRegex(source[, options]);
	*
	* const { output } = picomatch.parse('*.js');
	* console.log(picomatch.toRegex(output));
	* //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
	* ```
	* @param {String} `source` Regular expression source string.
	* @param {Object} `options`
	* @return {RegExp}
	* @api public
	*/
	picomatch.toRegex = (source, options) => {
		try {
			const opts = options || {};
			return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
		} catch (err) {
			if (options && options.debug === true) throw err;
			return /$^/;
		}
	};
	/**
	* Picomatch constants.
	* @return {Object}
	*/
	picomatch.constants = constants;
	/**
	* Expose "picomatch"
	*/
	module.exports = picomatch;
}));
//#endregion
//#region ../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/index.js
var require_picomatch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_picomatch$1();
}));
//#endregion
//#region ../../node_modules/.pnpm/micromatch@4.0.8/node_modules/micromatch/index.js
var require_micromatch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const util = __require("util");
	const braces = require_braces();
	const picomatch = require_picomatch();
	const utils = require_utils();
	const isEmptyString = (v) => v === "" || v === "./";
	const hasBraces = (v) => {
		const index = v.indexOf("{");
		return index > -1 && v.indexOf("}", index) > -1;
	};
	/**
	* Returns an array of strings that match one or more glob patterns.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm(list, patterns[, options]);
	*
	* console.log(mm(['a.js', 'a.txt'], ['*.js']));
	* //=> [ 'a.js' ]
	* ```
	* @param {String|Array<string>} `list` List of strings to match.
	* @param {String|Array<string>} `patterns` One or more glob patterns to use for matching.
	* @param {Object} `options` See available [options](#options)
	* @return {Array} Returns an array of matches
	* @summary false
	* @api public
	*/
	const micromatch = (list, patterns, options) => {
		patterns = [].concat(patterns);
		list = [].concat(list);
		let omit = /* @__PURE__ */ new Set();
		let keep = /* @__PURE__ */ new Set();
		let items = /* @__PURE__ */ new Set();
		let negatives = 0;
		let onResult = (state) => {
			items.add(state.output);
			if (options && options.onResult) options.onResult(state);
		};
		for (let i = 0; i < patterns.length; i++) {
			let isMatch = picomatch(String(patterns[i]), {
				...options,
				onResult
			}, true);
			let negated = isMatch.state.negated || isMatch.state.negatedExtglob;
			if (negated) negatives++;
			for (let item of list) {
				let matched = isMatch(item, true);
				if (!(negated ? !matched.isMatch : matched.isMatch)) continue;
				if (negated) omit.add(matched.output);
				else {
					omit.delete(matched.output);
					keep.add(matched.output);
				}
			}
		}
		let matches = (negatives === patterns.length ? [...items] : [...keep]).filter((item) => !omit.has(item));
		if (options && matches.length === 0) {
			if (options.failglob === true) throw new Error(`No matches found for "${patterns.join(", ")}"`);
			if (options.nonull === true || options.nullglob === true) return options.unescape ? patterns.map((p) => p.replace(/\\/g, "")) : patterns;
		}
		return matches;
	};
	/**
	* Backwards compatibility
	*/
	micromatch.match = micromatch;
	/**
	* Returns a matcher function from the given glob `pattern` and `options`.
	* The returned function takes a string to match as its only argument and returns
	* true if the string is a match.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.matcher(pattern[, options]);
	*
	* const isMatch = mm.matcher('*.!(*a)');
	* console.log(isMatch('a.a')); //=> false
	* console.log(isMatch('a.b')); //=> true
	* ```
	* @param {String} `pattern` Glob pattern
	* @param {Object} `options`
	* @return {Function} Returns a matcher function.
	* @api public
	*/
	micromatch.matcher = (pattern, options) => picomatch(pattern, options);
	/**
	* Returns true if **any** of the given glob `patterns` match the specified `string`.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.isMatch(string, patterns[, options]);
	*
	* console.log(mm.isMatch('a.a', ['b.*', '*.a'])); //=> true
	* console.log(mm.isMatch('a.a', 'b.*')); //=> false
	* ```
	* @param {String} `str` The string to test.
	* @param {String|Array} `patterns` One or more glob patterns to use for matching.
	* @param {Object} `[options]` See available [options](#options).
	* @return {Boolean} Returns true if any patterns match `str`
	* @api public
	*/
	micromatch.isMatch = (str, patterns, options) => picomatch(patterns, options)(str);
	/**
	* Backwards compatibility
	*/
	micromatch.any = micromatch.isMatch;
	/**
	* Returns a list of strings that _**do not match any**_ of the given `patterns`.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.not(list, patterns[, options]);
	*
	* console.log(mm.not(['a.a', 'b.b', 'c.c'], '*.a'));
	* //=> ['b.b', 'c.c']
	* ```
	* @param {Array} `list` Array of strings to match.
	* @param {String|Array} `patterns` One or more glob pattern to use for matching.
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Array} Returns an array of strings that **do not match** the given patterns.
	* @api public
	*/
	micromatch.not = (list, patterns, options = {}) => {
		patterns = [].concat(patterns).map(String);
		let result = /* @__PURE__ */ new Set();
		let items = [];
		let onResult = (state) => {
			if (options.onResult) options.onResult(state);
			items.push(state.output);
		};
		let matches = new Set(micromatch(list, patterns, {
			...options,
			onResult
		}));
		for (let item of items) if (!matches.has(item)) result.add(item);
		return [...result];
	};
	/**
	* Returns true if the given `string` contains the given pattern. Similar
	* to [.isMatch](#isMatch) but the pattern can match any part of the string.
	*
	* ```js
	* var mm = require('micromatch');
	* // mm.contains(string, pattern[, options]);
	*
	* console.log(mm.contains('aa/bb/cc', '*b'));
	* //=> true
	* console.log(mm.contains('aa/bb/cc', '*d'));
	* //=> false
	* ```
	* @param {String} `str` The string to match.
	* @param {String|Array} `patterns` Glob pattern to use for matching.
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Boolean} Returns true if any of the patterns matches any part of `str`.
	* @api public
	*/
	micromatch.contains = (str, pattern, options) => {
		if (typeof str !== "string") throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
		if (Array.isArray(pattern)) return pattern.some((p) => micromatch.contains(str, p, options));
		if (typeof pattern === "string") {
			if (isEmptyString(str) || isEmptyString(pattern)) return false;
			if (str.includes(pattern) || str.startsWith("./") && str.slice(2).includes(pattern)) return true;
		}
		return micromatch.isMatch(str, pattern, {
			...options,
			contains: true
		});
	};
	/**
	* Filter the keys of the given object with the given `glob` pattern
	* and `options`. Does not attempt to match nested keys. If you need this feature,
	* use [glob-object][] instead.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.matchKeys(object, patterns[, options]);
	*
	* const obj = { aa: 'a', ab: 'b', ac: 'c' };
	* console.log(mm.matchKeys(obj, '*b'));
	* //=> { ab: 'b' }
	* ```
	* @param {Object} `object` The object with keys to filter.
	* @param {String|Array} `patterns` One or more glob patterns to use for matching.
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Object} Returns an object with only keys that match the given patterns.
	* @api public
	*/
	micromatch.matchKeys = (obj, patterns, options) => {
		if (!utils.isObject(obj)) throw new TypeError("Expected the first argument to be an object");
		let keys = micromatch(Object.keys(obj), patterns, options);
		let res = {};
		for (let key of keys) res[key] = obj[key];
		return res;
	};
	/**
	* Returns true if some of the strings in the given `list` match any of the given glob `patterns`.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.some(list, patterns[, options]);
	*
	* console.log(mm.some(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
	* // true
	* console.log(mm.some(['foo.js'], ['*.js', '!foo.js']));
	* // false
	* ```
	* @param {String|Array} `list` The string or array of strings to test. Returns as soon as the first match is found.
	* @param {String|Array} `patterns` One or more glob patterns to use for matching.
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Boolean} Returns true if any `patterns` matches any of the strings in `list`
	* @api public
	*/
	micromatch.some = (list, patterns, options) => {
		let items = [].concat(list);
		for (let pattern of [].concat(patterns)) {
			let isMatch = picomatch(String(pattern), options);
			if (items.some((item) => isMatch(item))) return true;
		}
		return false;
	};
	/**
	* Returns true if every string in the given `list` matches
	* any of the given glob `patterns`.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.every(list, patterns[, options]);
	*
	* console.log(mm.every('foo.js', ['foo.js']));
	* // true
	* console.log(mm.every(['foo.js', 'bar.js'], ['*.js']));
	* // true
	* console.log(mm.every(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
	* // false
	* console.log(mm.every(['foo.js'], ['*.js', '!foo.js']));
	* // false
	* ```
	* @param {String|Array} `list` The string or array of strings to test.
	* @param {String|Array} `patterns` One or more glob patterns to use for matching.
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Boolean} Returns true if all `patterns` matches all of the strings in `list`
	* @api public
	*/
	micromatch.every = (list, patterns, options) => {
		let items = [].concat(list);
		for (let pattern of [].concat(patterns)) {
			let isMatch = picomatch(String(pattern), options);
			if (!items.every((item) => isMatch(item))) return false;
		}
		return true;
	};
	/**
	* Returns true if **all** of the given `patterns` match
	* the specified string.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.all(string, patterns[, options]);
	*
	* console.log(mm.all('foo.js', ['foo.js']));
	* // true
	*
	* console.log(mm.all('foo.js', ['*.js', '!foo.js']));
	* // false
	*
	* console.log(mm.all('foo.js', ['*.js', 'foo.js']));
	* // true
	*
	* console.log(mm.all('foo.js', ['*.js', 'f*', '*o*', '*o.js']));
	* // true
	* ```
	* @param {String|Array} `str` The string to test.
	* @param {String|Array} `patterns` One or more glob patterns to use for matching.
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Boolean} Returns true if any patterns match `str`
	* @api public
	*/
	micromatch.all = (str, patterns, options) => {
		if (typeof str !== "string") throw new TypeError(`Expected a string: "${util.inspect(str)}"`);
		return [].concat(patterns).every((p) => picomatch(p, options)(str));
	};
	/**
	* Returns an array of matches captured by `pattern` in `string, or `null` if the pattern did not match.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.capture(pattern, string[, options]);
	*
	* console.log(mm.capture('test/*.js', 'test/foo.js'));
	* //=> ['foo']
	* console.log(mm.capture('test/*.js', 'foo/bar.css'));
	* //=> null
	* ```
	* @param {String} `glob` Glob pattern to use for matching.
	* @param {String} `input` String to match
	* @param {Object} `options` See available [options](#options) for changing how matches are performed
	* @return {Array|null} Returns an array of captures if the input matches the glob pattern, otherwise `null`.
	* @api public
	*/
	micromatch.capture = (glob, input, options) => {
		let posix = utils.isWindows(options);
		let match = picomatch.makeRe(String(glob), {
			...options,
			capture: true
		}).exec(posix ? utils.toPosixSlashes(input) : input);
		if (match) return match.slice(1).map((v) => v === void 0 ? "" : v);
	};
	/**
	* Create a regular expression from the given glob `pattern`.
	*
	* ```js
	* const mm = require('micromatch');
	* // mm.makeRe(pattern[, options]);
	*
	* console.log(mm.makeRe('*.js'));
	* //=> /^(?:(\.[\\\/])?(?!\.)(?=.)[^\/]*?\.js)$/
	* ```
	* @param {String} `pattern` A glob pattern to convert to regex.
	* @param {Object} `options`
	* @return {RegExp} Returns a regex created from the given pattern.
	* @api public
	*/
	micromatch.makeRe = (...args) => picomatch.makeRe(...args);
	/**
	* Scan a glob pattern to separate the pattern into segments. Used
	* by the [split](#split) method.
	*
	* ```js
	* const mm = require('micromatch');
	* const state = mm.scan(pattern[, options]);
	* ```
	* @param {String} `pattern`
	* @param {Object} `options`
	* @return {Object} Returns an object with
	* @api public
	*/
	micromatch.scan = (...args) => picomatch.scan(...args);
	/**
	* Parse a glob pattern to create the source string for a regular
	* expression.
	*
	* ```js
	* const mm = require('micromatch');
	* const state = mm.parse(pattern[, options]);
	* ```
	* @param {String} `glob`
	* @param {Object} `options`
	* @return {Object} Returns an object with useful properties and output to be used as regex source string.
	* @api public
	*/
	micromatch.parse = (patterns, options) => {
		let res = [];
		for (let pattern of [].concat(patterns || [])) for (let str of braces(String(pattern), options)) res.push(picomatch.parse(str, options));
		return res;
	};
	/**
	* Process the given brace `pattern`.
	*
	* ```js
	* const { braces } = require('micromatch');
	* console.log(braces('foo/{a,b,c}/bar'));
	* //=> [ 'foo/(a|b|c)/bar' ]
	*
	* console.log(braces('foo/{a,b,c}/bar', { expand: true }));
	* //=> [ 'foo/a/bar', 'foo/b/bar', 'foo/c/bar' ]
	* ```
	* @param {String} `pattern` String with brace pattern to process.
	* @param {Object} `options` Any [options](#options) to change how expansion is performed. See the [braces][] library for all available options.
	* @return {Array}
	* @api public
	*/
	micromatch.braces = (pattern, options) => {
		if (typeof pattern !== "string") throw new TypeError("Expected a string");
		if (options && options.nobrace === true || !hasBraces(pattern)) return [pattern];
		return braces(pattern, options);
	};
	/**
	* Expand braces
	*/
	micromatch.braceExpand = (pattern, options) => {
		if (typeof pattern !== "string") throw new TypeError("Expected a string");
		return micromatch.braces(pattern, {
			...options,
			expand: true
		});
	};
	/**
	* Expose micromatch
	*/
	micromatch.hasBraces = hasBraces;
	module.exports = micromatch;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/path-filter.js
var require_path_filter = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.matchPathFilter = matchPathFilter;
	const url$1 = __require("node:url");
	const isGlob = require_is_glob();
	const micromatch = require_micromatch();
	const errors_1 = require_errors();
	function matchPathFilter(pathFilter = "/", uri, req) {
		if (isStringPath(pathFilter)) return matchSingleStringPath(pathFilter, uri);
		if (isGlobPath(pathFilter)) return matchSingleGlobPath(pathFilter, uri);
		if (Array.isArray(pathFilter)) {
			if (pathFilter.every(isStringPath)) return matchMultiPath(pathFilter, uri);
			if (pathFilter.every(isGlobPath)) return matchMultiGlobPath(pathFilter, uri);
			throw new Error(errors_1.ERRORS.ERR_CONTEXT_MATCHER_INVALID_ARRAY);
		}
		if (typeof pathFilter === "function") return pathFilter(getUrlPathName(uri), req);
		throw new Error(errors_1.ERRORS.ERR_CONTEXT_MATCHER_GENERIC);
	}
	/**
	* @param  {String} pathFilter '/api'
	* @param  {String} uri     'http://example.org/api/b/c/d.html'
	* @return {Boolean}
	*/
	function matchSingleStringPath(pathFilter, uri) {
		return getUrlPathName(uri)?.indexOf(pathFilter) === 0;
	}
	function matchSingleGlobPath(pattern, uri) {
		const pathname = getUrlPathName(uri);
		const matches = micromatch([pathname], pattern);
		return matches && matches.length > 0;
	}
	function matchMultiGlobPath(patternList, uri) {
		return matchSingleGlobPath(patternList, uri);
	}
	/**
	* @param  {String} pathFilterList ['/api', '/ajax']
	* @param  {String} uri     'http://example.org/api/b/c/d.html'
	* @return {Boolean}
	*/
	function matchMultiPath(pathFilterList, uri) {
		let isMultiPath = false;
		for (const context of pathFilterList) if (matchSingleStringPath(context, uri)) {
			isMultiPath = true;
			break;
		}
		return isMultiPath;
	}
	/**
	* Parses URI and returns RFC 3986 path
	*
	* @param  {String} uri from req.url
	* @return {String}     RFC 3986 path
	*/
	function getUrlPathName(uri) {
		return uri && url$1.parse(uri).pathname;
	}
	function isStringPath(pathFilter) {
		return typeof pathFilter === "string" && !isGlob(pathFilter);
	}
	function isGlobPath(pathFilter) {
		return isGlob(pathFilter);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/is-plain-object@5.1.0/node_modules/is-plain-object/dist/is-plain-object.js
var require_is_plain_object = /* @__PURE__ */ __commonJSMin(((exports) => {
	/*!
	* is-plain-object <https://github.com/jonschlinkert/is-plain-object>
	*
	* Copyright (c) 2014-2017, Jon Schlinkert.
	* Released under the MIT License.
	*/
	function isObject(o) {
		return Object.prototype.toString.call(o) === "[object Object]";
	}
	function isPlainObject(o) {
		var ctor, prot;
		if (isObject(o) === false) return false;
		ctor = o.constructor;
		if (ctor === void 0) return true;
		prot = ctor.prototype;
		if (isObject(prot) === false) return false;
		if (prot.hasOwnProperty("isPrototypeOf") === false) return false;
		return true;
	}
	exports.isPlainObject = isPlainObject;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/path-rewriter.js
var require_path_rewriter = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.createPathRewriter = createPathRewriter;
	const is_plain_object_1 = require_is_plain_object();
	const debug_1 = require_debug();
	const errors_1 = require_errors();
	const debug = debug_1.Debug.extend("path-rewriter");
	/**
	* Create rewrite function, to cache parsed rewrite rules.
	*
	* @param {Object} rewriteConfig
	* @return {Function} Function to rewrite paths; This function should accept `path` (request.url) as parameter
	*/
	function createPathRewriter(rewriteConfig) {
		let rulesCache;
		if (!isValidRewriteConfig(rewriteConfig)) return;
		if (typeof rewriteConfig === "function") return rewriteConfig;
		else {
			rulesCache = parsePathRewriteRules(rewriteConfig);
			return rewritePath;
		}
		function rewritePath(path) {
			let result = path;
			for (const rule of rulesCache) if (rule.regex.test(path)) {
				result = result.replace(rule.regex, rule.value);
				debug("rewriting path from \"%s\" to \"%s\"", path, result);
				break;
			}
			return result;
		}
	}
	function isValidRewriteConfig(rewriteConfig) {
		if (typeof rewriteConfig === "function") return true;
		else if ((0, is_plain_object_1.isPlainObject)(rewriteConfig)) return Object.keys(rewriteConfig).length !== 0;
		else if (rewriteConfig === void 0 || rewriteConfig === null) return false;
		else throw new Error(errors_1.ERRORS.ERR_PATH_REWRITER_CONFIG);
	}
	function parsePathRewriteRules(rewriteConfig) {
		const rules = [];
		if ((0, is_plain_object_1.isPlainObject)(rewriteConfig)) for (const [key, value] of Object.entries(rewriteConfig)) {
			rules.push({
				regex: new RegExp(key),
				value
			});
			debug("rewrite rule created: \"%s\" ~> \"%s\"", key, value);
		}
		return rules;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/router.js
var require_router = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getTarget = getTarget;
	const is_plain_object_1 = require_is_plain_object();
	const debug = require_debug().Debug.extend("router");
	async function getTarget(req, config) {
		let newTarget;
		const router = config.router;
		if ((0, is_plain_object_1.isPlainObject)(router)) newTarget = getTargetFromProxyTable(req, router);
		else if (typeof router === "function") newTarget = await router(req);
		return newTarget;
	}
	function getTargetFromProxyTable(req, table) {
		let result;
		const host = req.headers.host || "";
		const path = req.url || "";
		for (const [key, value] of Object.entries(table)) if (containsPath(key)) {
			if (isHostAndPathKey(key)) {
				const [keyHost, keyPath] = splitHostAndPathKey(key);
				if (host === keyHost && path.startsWith(keyPath)) {
					result = value;
					debug("match: \"%s\" -> \"%s\"", key, result);
					break;
				}
			} else if (path.startsWith(key)) {
				result = value;
				debug("match: \"%s\" -> \"%s\"", key, result);
				break;
			}
		} else if (key === host) {
			result = value;
			debug("match: \"%s\" -> \"%s\"", host, result);
			break;
		}
		return result;
	}
	function containsPath(v) {
		return v.indexOf("/") > -1;
	}
	function isHostAndPathKey(v) {
		return containsPath(v) && !v.startsWith("/");
	}
	function splitHostAndPathKey(v) {
		const firstSlash = v.indexOf("/");
		return [v.slice(0, firstSlash), v.slice(firstSlash)];
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/http-proxy-middleware.js
var require_http_proxy_middleware = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.HttpProxyMiddleware = void 0;
	const httpProxy = require_http_proxy();
	const configuration_1 = require_configuration();
	const debug_1 = require_debug();
	const get_plugins_1 = require_get_plugins();
	const logger_1 = require_logger();
	const path_filter_1 = require_path_filter();
	const PathRewriter = require_path_rewriter();
	const Router = require_router();
	const function_1 = require_function();
	var HttpProxyMiddleware = class {
		constructor(options) {
			this.wsInternalSubscribed = false;
			this.serverOnCloseSubscribed = false;
			this.middleware = (async (req, res, next) => {
				if (this.shouldProxy(this.proxyOptions.pathFilter, req)) try {
					const activeProxyOptions = await this.prepareProxyRequest(req);
					(0, debug_1.Debug)(`proxy request to target: %O`, activeProxyOptions.target);
					this.proxy.web(req, res, activeProxyOptions);
				} catch (err) {
					next?.(err);
				}
				else next?.();
				/**
				* Get the server object to subscribe to server events;
				* 'upgrade' for websocket and 'close' for graceful shutdown
				*
				* NOTE:
				* req.socket: node >= 13
				* req.connection: node < 13 (Remove this when node 12/13 support is dropped)
				*/
				const server = (req.socket ?? req.connection)?.server;
				if (server && !this.serverOnCloseSubscribed) {
					server.on("close", () => {
						(0, debug_1.Debug)("server close signal received: closing proxy server");
						this.proxy.close();
					});
					this.serverOnCloseSubscribed = true;
				}
				if (this.proxyOptions.ws === true) this.catchUpgradeRequest(server);
			});
			this.catchUpgradeRequest = (server) => {
				if (!this.wsInternalSubscribed) {
					(0, debug_1.Debug)("subscribing to server upgrade event");
					server.on("upgrade", this.handleUpgrade);
					this.wsInternalSubscribed = true;
				}
			};
			this.handleUpgrade = async (req, socket, head) => {
				try {
					if (this.shouldProxy(this.proxyOptions.pathFilter, req)) {
						const activeProxyOptions = await this.prepareProxyRequest(req);
						this.proxy.ws(req, socket, head, activeProxyOptions);
						(0, debug_1.Debug)("server upgrade event received. Proxying WebSocket");
					}
				} catch (err) {
					this.proxy.emit("error", err, req, socket);
				}
			};
			/**
			* Determine whether request should be proxied.
			*/
			this.shouldProxy = (pathFilter, req) => {
				try {
					return (0, path_filter_1.matchPathFilter)(pathFilter, req.url, req);
				} catch (err) {
					(0, debug_1.Debug)("Error: matchPathFilter() called with request url: ", `"${req.url}"`);
					this.logger.error(err);
					return false;
				}
			};
			/**
			* Apply option.router and option.pathRewrite
			* Order matters:
			*    Router uses original path for routing;
			*    NOT the modified path, after it has been rewritten by pathRewrite
			* @param {Object} req
			* @return {Object} proxy options
			*/
			this.prepareProxyRequest = async (req) => {
				/**
				* Incorrect usage confirmed: https://github.com/expressjs/express/issues/4854#issuecomment-1066171160
				* Temporary restore req.url patch for {@link src/legacy/create-proxy-middleware.ts legacyCreateProxyMiddleware()}
				* FIXME: remove this patch in future release
				*/
				if (this.middleware.__LEGACY_HTTP_PROXY_MIDDLEWARE__) req.url = req.originalUrl || req.url;
				const newProxyOptions = Object.assign({}, this.proxyOptions);
				await this.applyRouter(req, newProxyOptions);
				await this.applyPathRewrite(req, this.pathRewriter);
				return newProxyOptions;
			};
			this.applyRouter = async (req, options) => {
				let newTarget;
				if (options.router) {
					newTarget = await Router.getTarget(req, options);
					if (newTarget) {
						(0, debug_1.Debug)("router new target: \"%s\"", newTarget);
						options.target = newTarget;
					}
				}
			};
			this.applyPathRewrite = async (req, pathRewriter) => {
				if (pathRewriter) {
					const path = await pathRewriter(req.url, req);
					if (typeof path === "string") {
						(0, debug_1.Debug)("pathRewrite new path: %s", req.url);
						req.url = path;
					} else (0, debug_1.Debug)("pathRewrite: no rewritten path found: %s", req.url);
				}
			};
			(0, configuration_1.verifyConfig)(options);
			this.proxyOptions = options;
			this.logger = (0, logger_1.getLogger)(options);
			(0, debug_1.Debug)(`create proxy server`);
			this.proxy = httpProxy.createProxyServer({});
			this.registerPlugins(this.proxy, this.proxyOptions);
			this.pathRewriter = PathRewriter.createPathRewriter(this.proxyOptions.pathRewrite);
			this.middleware.upgrade = (req, socket, head) => {
				if (!this.wsInternalSubscribed) this.handleUpgrade(req, socket, head);
			};
		}
		registerPlugins(proxy, options) {
			(0, get_plugins_1.getPlugins)(options).forEach((plugin) => {
				(0, debug_1.Debug)(`register plugin: "${(0, function_1.getFunctionName)(plugin)}"`);
				plugin(proxy, options);
			});
		}
	};
	exports.HttpProxyMiddleware = HttpProxyMiddleware;
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/factory.js
var require_factory = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.createProxyMiddleware = createProxyMiddleware;
	const http_proxy_middleware_1 = require_http_proxy_middleware();
	function createProxyMiddleware(options) {
		const { middleware } = new http_proxy_middleware_1.HttpProxyMiddleware(options);
		return middleware;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/handlers/response-interceptor.js
var require_response_interceptor = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.responseInterceptor = responseInterceptor;
	const zlib = __require("node:zlib");
	const debug_1 = require_debug();
	const function_1 = require_function();
	const debug = debug_1.Debug.extend("response-interceptor");
	/**
	* Intercept responses from upstream.
	* Automatically decompress (deflate, gzip, brotli).
	* Give developer the opportunity to modify intercepted Buffer and http.ServerResponse
	*
	* NOTE: must set options.selfHandleResponse=true (prevent automatic call of res.end())
	*/
	function responseInterceptor(interceptor) {
		return async function proxyResResponseInterceptor(proxyRes, req, res) {
			debug("intercept proxy response");
			const originalProxyRes = proxyRes;
			let buffer = Buffer.from("", "utf8");
			const _proxyRes = decompress(proxyRes, proxyRes.headers["content-encoding"]);
			_proxyRes.on("data", (chunk) => buffer = Buffer.concat([buffer, chunk]));
			_proxyRes.on("end", async () => {
				copyHeaders(proxyRes, res);
				debug("call interceptor function: %s", (0, function_1.getFunctionName)(interceptor));
				const interceptedBuffer = Buffer.from(await interceptor(buffer, originalProxyRes, req, res));
				debug("set content-length: %s", Buffer.byteLength(interceptedBuffer, "utf8"));
				res.setHeader("content-length", Buffer.byteLength(interceptedBuffer, "utf8"));
				debug("write intercepted response");
				res.write(interceptedBuffer);
				res.end();
			});
			_proxyRes.on("error", (error) => {
				res.end(`Error fetching proxied request: ${error.message}`);
			});
		};
	}
	/**
	* Streaming decompression of proxy response
	* source: https://github.com/apache/superset/blob/9773aba522e957ed9423045ca153219638a85d2f/superset-frontend/webpack.proxy-config.js#L116
	*/
	function decompress(proxyRes, contentEncoding) {
		let _proxyRes = proxyRes;
		let decompress;
		switch (contentEncoding) {
			case "gzip":
				decompress = zlib.createGunzip();
				break;
			case "br":
				decompress = zlib.createBrotliDecompress();
				break;
			case "deflate": decompress = zlib.createInflate();
		}
		if (decompress) {
			debug(`decompress proxy response with 'content-encoding': %s`, contentEncoding);
			_proxyRes.pipe(decompress);
			_proxyRes = decompress;
		}
		return _proxyRes;
	}
	/**
	* Copy original headers
	* https://github.com/apache/superset/blob/9773aba522e957ed9423045ca153219638a85d2f/superset-frontend/webpack.proxy-config.js#L78
	*/
	function copyHeaders(originalResponse, response) {
		debug("copy original response headers");
		response.statusCode = originalResponse.statusCode;
		response.statusMessage = originalResponse.statusMessage;
		if (response.setHeader) {
			let keys = Object.keys(originalResponse.headers);
			keys = keys.filter((key) => !["content-encoding", "transfer-encoding"].includes(key));
			keys.forEach((key) => {
				let value = originalResponse.headers[key];
				if (key === "set-cookie") {
					value = Array.isArray(value) ? value : [value];
					value = value.map((x) => x.replace(/Domain=[^;]+?/i, ""));
				}
				response.setHeader(key, value);
			});
		} else response.headers = originalResponse.headers;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/handlers/fix-request-body-utils/stringify-form-data.js
var require_stringify_form_data = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.stringifyFormData = stringifyFormData;
	const errors_1 = require_errors();
	const CR_OR_LF = /[\r\n]/;
	const ERROR_CODE_PREFIX = "HPM_ERR_INVALID_MULTIPART";
	/**
	* stringify FormData data
	* @param contentType
	* @param data
	* @returns
	*/
	function stringifyFormData(contentType, data) {
		const boundary = getMultipartBoundary(contentType);
		let str = "";
		for (const [key, value] of Object.entries(data)) {
			const normalizedKey = String(key);
			const normalizedValue = String(value);
			validateMultipartField(normalizedKey, normalizedValue, boundary);
			str += `--${boundary}\r\nContent-Disposition: form-data; name="${escapeMultipartFieldName(normalizedKey)}"\r\n\r\n${normalizedValue}\r\n`;
		}
		return str;
	}
	function getMultipartBoundary(contentType) {
		const boundaryMatch = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
		const boundary = (boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? contentType).trim();
		if (!boundary || CR_OR_LF.test(boundary)) throw new errors_1.HttpProxyMiddlewareError("[HPM] invalid multipart boundary detected.", `${ERROR_CODE_PREFIX}_BOUNDARY`);
		return boundary;
	}
	function validateMultipartField(fieldName, fieldValue, boundary) {
		const boundaryDelimiter = `--${boundary}`;
		if (CR_OR_LF.test(fieldName)) throw new errors_1.HttpProxyMiddlewareError(`[HPM] invalid multipart field name "${fieldName}" detected.`, `${ERROR_CODE_PREFIX}_FIELD_NAME`);
		if (CR_OR_LF.test(fieldValue) || fieldValue.includes(boundaryDelimiter)) throw new errors_1.HttpProxyMiddlewareError(`[HPM] invalid multipart field value for "${fieldName}" detected.`, `${ERROR_CODE_PREFIX}_FIELD_VALUE`);
	}
	function escapeMultipartFieldName(fieldName) {
		return fieldName.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/handlers/fix-request-body.js
var require_fix_request_body = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.fixRequestBody = fixRequestBody;
	const querystring = __require("node:querystring");
	const stringify_form_data_1 = require_stringify_form_data();
	/**
	* Fix proxied body if bodyParser is involved.
	*/
	function fixRequestBody(proxyReq, req) {
		if (req.readableLength !== 0) return;
		const requestBody = req.body;
		if (!requestBody) return;
		const contentType = proxyReq.getHeader("Content-Type");
		if (!contentType) return;
		const writeBody = (bodyData) => {
			proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
			proxyReq.write(bodyData);
		};
		try {
			if (contentType.includes("application/json") || contentType.includes("+json")) writeBody(JSON.stringify(requestBody));
			else if (contentType.includes("application/x-www-form-urlencoded")) writeBody(querystring.stringify(requestBody));
			else if (contentType.includes("multipart/form-data")) writeBody((0, stringify_form_data_1.stringifyFormData)(contentType, requestBody));
			else if (contentType.includes("text/plain")) writeBody(requestBody);
		} catch (error) {
			proxyReq.destroy(toError(error));
		}
	}
	function toError(error) {
		return error instanceof Error ? error : new Error(String(error));
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/handlers/public.js
var require_public$1 = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.fixRequestBody = exports.responseInterceptor = void 0;
	var response_interceptor_1 = require_response_interceptor();
	Object.defineProperty(exports, "responseInterceptor", {
		enumerable: true,
		get: function() {
			return response_interceptor_1.responseInterceptor;
		}
	});
	var fix_request_body_1 = require_fix_request_body();
	Object.defineProperty(exports, "fixRequestBody", {
		enumerable: true,
		get: function() {
			return fix_request_body_1.fixRequestBody;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/handlers/index.js
var require_handlers = /* @__PURE__ */ __commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$3) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$3, p)) __createBinding(exports$3, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_public$1(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/legacy/options-adapter.js
var require_options_adapter = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.legacyOptionsAdapter = legacyOptionsAdapter;
	const url = __require("node:url");
	const debug_1 = require_debug();
	const logger_1 = require_logger();
	const debug = debug_1.Debug.extend("legacy-options-adapter");
	const proxyEventMap = {
		onError: "error",
		onProxyReq: "proxyReq",
		onProxyRes: "proxyRes",
		onProxyReqWs: "proxyReqWs",
		onOpen: "open",
		onClose: "close"
	};
	/**
	* Convert {@link LegacyOptions legacy Options} to new {@link Options}
	*/
	function legacyOptionsAdapter(legacyContext, legacyOptions) {
		let options = {};
		let logger;
		if (typeof legacyContext === "string" && !!url.parse(legacyContext).host) throw new Error(`Shorthand syntax is removed from legacyCreateProxyMiddleware().
      Please use "legacyCreateProxyMiddleware({ target: 'http://www.example.org' })" instead.

      More details: https://github.com/chimurai/http-proxy-middleware/blob/master/MIGRATION.md#removed-shorthand-usage
      `);
		if (legacyContext && legacyOptions) {
			debug("map legacy context/filter to options.pathFilter");
			options = {
				...legacyOptions,
				pathFilter: legacyContext
			};
			logger = getLegacyLogger(options);
			logger.warn(`[http-proxy-middleware] Legacy "context" argument is deprecated. Migrate your "context" to "options.pathFilter":

      const options = {
        pathFilter: '${legacyContext}',
      }

      More details: https://github.com/chimurai/http-proxy-middleware/blob/master/MIGRATION.md#removed-context-argument
      `);
		} else if (legacyContext && !legacyOptions) {
			options = { ...legacyContext };
			logger = getLegacyLogger(options);
		} else logger = getLegacyLogger({});
		Object.entries(proxyEventMap).forEach(([legacyEventName, proxyEventName]) => {
			if (options[legacyEventName]) {
				options.on = { ...options.on };
				options.on[proxyEventName] = options[legacyEventName];
				debug("map legacy event \"%s\" to \"on.%s\"", legacyEventName, proxyEventName);
				logger.warn(`[http-proxy-middleware] Legacy "${legacyEventName}" is deprecated. Migrate to "options.on.${proxyEventName}":

        const options = {
          on: {
            ${proxyEventName}: () => {},
          },
        }

        More details: https://github.com/chimurai/http-proxy-middleware/blob/master/MIGRATION.md#refactored-proxy-events
        `);
			}
		});
		const logProvider = options.logProvider && options.logProvider();
		const logLevel = options.logLevel;
		debug("legacy logLevel", logLevel);
		debug("legacy logProvider: %O", logProvider);
		if (typeof logLevel === "string" && logLevel !== "silent") {
			debug("map \"logProvider\" to \"logger\"");
			logger.warn(`[http-proxy-middleware] Legacy "logLevel" and "logProvider" are deprecated. Migrate to "options.logger":

      const options = {
        logger: console,
      }

      More details: https://github.com/chimurai/http-proxy-middleware/blob/master/MIGRATION.md#removed-logprovider-and-loglevel-options
      `);
		}
		return options;
	}
	function getLegacyLogger(options) {
		const legacyLogger = options.logProvider && options.logProvider();
		if (legacyLogger) options.logger = legacyLogger;
		return (0, logger_1.getLogger)(options);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/legacy/create-proxy-middleware.js
var require_create_proxy_middleware = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.legacyCreateProxyMiddleware = legacyCreateProxyMiddleware;
	const debug_1 = require_debug();
	const factory_1 = require_factory();
	const options_adapter_1 = require_options_adapter();
	const debug = debug_1.Debug.extend("legacy-create-proxy-middleware");
	function legacyCreateProxyMiddleware(legacyContext, legacyOptions) {
		debug("init");
		const options = (0, options_adapter_1.legacyOptionsAdapter)(legacyContext, legacyOptions);
		const proxyMiddleware = (0, factory_1.createProxyMiddleware)(options);
		debug("add marker for patching req.url (old behavior)");
		proxyMiddleware.__LEGACY_HTTP_PROXY_MIDDLEWARE__ = true;
		return proxyMiddleware;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/legacy/public.js
var require_public = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.legacyCreateProxyMiddleware = void 0;
	var create_proxy_middleware_1 = require_create_proxy_middleware();
	Object.defineProperty(exports, "legacyCreateProxyMiddleware", {
		enumerable: true,
		get: function() {
			return create_proxy_middleware_1.legacyCreateProxyMiddleware;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/http-proxy-middleware@3.0.7/node_modules/http-proxy-middleware/dist/legacy/index.js
var require_legacy = /* @__PURE__ */ __commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$2) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$2, p)) __createBinding(exports$2, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_public(), exports);
}));
//#endregion
//#region src/constants.ts
var import_dist = (/* @__PURE__ */ __commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$1) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$1, p)) __createBinding(exports$1, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_factory(), exports);
	__exportStar(require_handlers(), exports);
	/**
	* Default plugins
	*/
	__exportStar(require_default(), exports);
	/**
	* Legacy exports
	*/
	__exportStar(require_legacy(), exports);
})))();
const HOP_BY_HOP_HEADERS = /* @__PURE__ */ new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade"
]);
const BAD_GATEWAY_MESSAGE = "DeepSeek Harness gateway proxy error";
//#endregion
//#region src/middleware/request-headers.ts
function applyLoopbackHeaders(headers, ctx) {
	headers.host = `${ctx.host}:${ctx.port}`;
	delete headers.origin;
	delete headers["sec-fetch-site"];
	return headers;
}
function copyRequestHeaders(req, ctx) {
	const headers = { ...req.headers };
	for (const header of HOP_BY_HOP_HEADERS) delete headers[header];
	headers["accept-encoding"] = "identity";
	return applyLoopbackHeaders(headers, ctx);
}
//#endregion
//#region src/middleware/response-headers.ts
function copyResponseHeaders(headers, options) {
	const result = {};
	for (const [name, value] of Object.entries(headers)) {
		if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
		if (name.toLowerCase() === "content-length" && (options.rewriteBody || options.eventStream)) continue;
		if (name.toLowerCase() === "location" && typeof value === "string") result[name] = rewriteLocation(value, options.gatewayPrefix);
		else if (value !== void 0) result[name] = value;
	}
	if (options.eventStream) {
		result["cache-control"] = "no-cache, no-transform";
		result["x-accel-buffering"] = "no";
	}
	return result;
}
//#endregion
//#region src/middleware/content-rewrite.ts
function gatewayBaseHref(gatewayPrefix) {
	return gatewayPrefix ? gatewayPrefix + "/" : "/";
}
function rewriteHtml(body, gatewayPrefix, bridgeScript) {
	let html = body.toString("utf8");
	html = html.replace(/(\b(?:src|href|action)=["'])(\/(?!\/)[^"']*)/gi, (_, prefix, path) => prefix + addGatewayPrefix(path, gatewayPrefix));
	const base = "<base href=\"" + gatewayBaseHref(gatewayPrefix) + "\">";
	if (!/<base\b[^>]*>/i.test(html)) html = /<head\b[^>]*>/i.test(html) ? html.replace(/(<head\b[^>]*>)/i, "$1" + base) : base + html;
	return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (head) => head + bridgeScript) : bridgeScript + html;
}
function rewriteCss(body, gatewayPrefix) {
	return body.toString("utf8").replace(/url\(\s*(["']?)\/(assets\/[^)"']+)\1\s*\)/gi, (_, quote, path) => "url(" + quote + addGatewayPrefix("/" + path, gatewayPrefix) + quote + ")");
}
function rewriteJavaScript(body, upstreamPath, gatewayPrefix) {
	let source = body.toString("utf8");
	if (!upstreamPath.startsWith("/assets/")) return source;
	const lastSlash = upstreamPath.lastIndexOf("/");
	const currentDirectory = upstreamPath.slice(0, lastSlash + 1) || "/";
	const parentDirectory = currentDirectory.replace(/[^/]+\/$/, "") || "/";
	const currentImportBase = addGatewayPrefix(currentDirectory, gatewayPrefix);
	const parentImportBase = addGatewayPrefix(parentDirectory, gatewayPrefix);
	source = source.replace(/(["'])assets\/(?=(?:langs\/|vendor-|fonts\/))/g, (_, quote) => quote + addGatewayPrefix("/assets/", gatewayPrefix));
	source = source.replace(/(\bfrom\s*["'])\.\.\//g, (_, prefix) => prefix + parentImportBase);
	source = source.replace(/(\bfrom\s*["'])\.\//g, (_, prefix) => prefix + currentImportBase);
	source = source.replace(/(\bimport\s*\(\s*["'])\.\//g, (_, prefix) => prefix + currentImportBase);
	return source;
}
//#endregion
//#region src/bridge-script.ts
const BRIDGE_SCRIPT_BODY = String.raw`
(function (prefix) {
  const connectionModuleId = "@deepseek-ai/dsh-client-connection";
  const markFnOSHostConnection = function (ctx) {
    let connection;
    try { connection = typeof ctx?.get === "function" ? ctx.get("connection", false) : null; }
    catch (_) { return; }
    if (!connection || (typeof connection !== "object" && typeof connection !== "function")) return;
    try {
      Object.defineProperty(connection, "isLoopback", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: true
      });
    } catch (_) {
      try { connection.isLoopback = true; } catch (_) {}
    }
  };
  const wrapConnectionFactory = function (factory) {
    return function (require) {
      const moduleExports = factory(require);
      const apply = moduleExports && moduleExports.apply;
      if (typeof apply !== "function") return moduleExports;
      try {
        moduleExports.apply = function (ctx, config) {
          const result = apply.call(this, ctx, config);
          markFnOSHostConnection(ctx);
          return result;
        };
      } catch (_) {}
      return moduleExports;
    };
  };
  const wrapModuleLoader = function (loader) {
    if (!loader || typeof loader.load !== "function") return loader;
    const load = loader.load;
    if (load.__fnosSettingsBridge !== true) {
      const bridgedLoad = function (handoff) {
        if (handoff && handoff.id === connectionModuleId && typeof handoff.factory === "function") {
          handoff = Object.assign({}, handoff, { factory: wrapConnectionFactory(handoff.factory) });
        }
        return load.call(this, handoff);
      };
      try { Object.defineProperty(bridgedLoad, "__fnosSettingsBridge", { value: true }); } catch (_) {}
      try { loader.load = bridgedLoad; } catch (_) {}
    }
    const create = loader.create;
    if (typeof create === "function" && create.__fnosSettingsBridge !== true) {
      const bridgedCreate = function () {
        const result = create.apply(this, arguments);
        wrapModuleLoader(this);
        return result;
      };
      try { Object.defineProperty(bridgedCreate, "__fnosSettingsBridge", { value: true }); } catch (_) {}
      try { loader.create = bridgedCreate; } catch (_) {}
    }
    return loader;
  };
  let moduleLoader;
  try {
    Object.defineProperty(window, "__ModuleLoader__", {
      configurable: true,
      get: function () { return moduleLoader; },
      set: function (value) { moduleLoader = wrapModuleLoader(value); }
    });
  } catch (_) {}
  const cryptoObject = window.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID !== "function" && typeof cryptoObject.getRandomValues === "function") {
    const getRandomValues = cryptoObject.getRandomValues.bind(cryptoObject);
    const randomUUID = function () {
      const bytes = new Uint8Array(16);
      getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, function (byte) { return ("0" + byte.toString(16)).slice(-2); }).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    };
    const installRandomUUID = function (target) {
      try {
        Object.defineProperty(target, "randomUUID", { configurable: true, writable: true, value: randomUUID });
        return typeof target.randomUUID === "function";
      } catch (_) { return false; }
    };
    if (!installRandomUUID(cryptoObject) && Object.getPrototypeOf(cryptoObject)) installRandomUUID(Object.getPrototypeOf(cryptoObject));
  }
  const isAlreadyPrefixed = function (pathname) {
    return prefix !== "" && (pathname === prefix || pathname.indexOf(prefix + "/") === 0);
  };
  const isApiPath = function (pathname) {
    return pathname === "/api" || pathname.indexOf("/api/") === 0;
  };
  const isGatewayPath = function (pathname) {
    return isApiPath(pathname) || pathname === "/plugins" || pathname.indexOf("/plugins/") === 0;
  };
  const toGatewayUrl = function (value) {
    let url;
    try { url = new URL(String(value), window.location.href); }
    catch (_) { return null; }
    if (url.origin !== window.location.origin || !isGatewayPath(url.pathname) || isAlreadyPrefixed(url.pathname)) return null;
    url.pathname = prefix + url.pathname;
    return url;
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof Request !== "undefined" && input instanceof Request) {
      const mapped = toGatewayUrl(input.url);
      if (mapped !== null) input = new Request(mapped, input);
    } else {
      const mapped = toGatewayUrl(input);
      if (mapped !== null) input = mapped;
    }
    return nativeFetch(input, init);
  };
  const rewriteScriptNode = function (node) {
    if (!node || node.nodeType !== 1 || node.tagName !== "SCRIPT") return;
    const mapped = toGatewayUrl(node.getAttribute("src") || node.src);
    if (mapped !== null) node.setAttribute("src", mapped.toString());
  };
  const nativeAppend = Element.prototype.append;
  if (nativeAppend) {
    Element.prototype.append = function () {
      for (const node of arguments) rewriteScriptNode(node);
      return nativeAppend.apply(this, arguments);
    };
  }
  const nativeAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    rewriteScriptNode(node);
    return nativeAppendChild.call(this, node);
  };
  const nativeInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, reference) {
    rewriteScriptNode(node);
    return nativeInsertBefore.call(this, node, reference);
  };
  const nativeEventSource = window.EventSource;
  if (nativeEventSource) {
    window.EventSource = new Proxy(nativeEventSource, {
      construct: function (target, args, newTarget) {
        const mapped = toGatewayUrl(args[0]);
        if (mapped !== null) args = [mapped.toString()].concat(args.slice(1));
        return Reflect.construct(target, args, newTarget);
      }
    });
  }
  const nativeWebSocket = window.WebSocket;
  if (nativeWebSocket) {
    const page = new URL(window.location.href);
    const pagePort = page.port || (page.protocol === "https:" ? "443" : "80");
    window.WebSocket = new Proxy(nativeWebSocket, {
      construct: function (target, args, newTarget) {
        let url;
        try { url = new URL(String(args[0]), window.location.href); }
        catch (_) { return Reflect.construct(target, args, newTarget); }
        const socketPort = url.port || (url.protocol === "wss:" ? "443" : "80");
        if ((url.protocol === "ws:" || url.protocol === "wss:") &&
            url.hostname === page.hostname && socketPort === pagePort &&
            isApiPath(url.pathname)) {
          url.pathname = prefix + url.pathname;
          args = [url.toString()].concat(args.slice(1));
        }
        return Reflect.construct(target, args, newTarget);
      }
    });
  }
})(__PREFIX__);
`;
function gatewayBridgeScript(gatewayPrefix) {
	return "<script>\n" + BRIDGE_SCRIPT_BODY.replace("__PREFIX__", JSON.stringify(gatewayPrefix)) + "\n<\/script>";
}
//#endregion
//#region src/middleware/sse-keepalive.ts
function attachSseKeepalive(res, options) {
	const comment = options.comment ?? "fn-deepseek-harness keep-alive";
	const keepAlive = setInterval(() => {
		if (!res.destroyed && !res.writableEnded) res.write(`: ${comment}\n\n`);
	}, options.interval);
	const clearKeepAlive = () => clearInterval(keepAlive);
	res.once("close", clearKeepAlive);
	res.once("error", clearKeepAlive);
	return clearKeepAlive;
}
//#endregion
//#region src/proxy.ts
function sendBadGateway(res, error) {
	if (res.headersSent) {
		res.destroy();
		return;
	}
	res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
	const message = error instanceof Error ? error.message : String(error);
	res.end(`${BAD_GATEWAY_MESSAGE}: ${message}`);
}
function createProxyHandler(options) {
	const { upstreamHost, upstreamPort, gatewayPrefix, sseKeepaliveInterval = 15e3 } = options;
	const bridgeScript = gatewayBridgeScript(gatewayPrefix);
	return (0, import_dist.createProxyMiddleware)({
		target: `http://${upstreamHost}:${upstreamPort}`,
		ws: true,
		changeOrigin: false,
		selfHandleResponse: true,
		on: {
			proxyReq: (proxyReq, req) => {
				const headers = copyRequestHeaders(req, {
					host: upstreamHost,
					port: upstreamPort
				});
				for (const [name, value] of Object.entries(headers)) {
					if (value === void 0) continue;
					if (Array.isArray(value)) for (const item of value) proxyReq.appendHeader(name, item);
					else proxyReq.setHeader(name, value);
				}
			},
			proxyRes: (proxyRes, req, res) => {
				const contentType = String(proxyRes.headers["content-type"] || "").toLowerCase();
				const eventStream = contentType.startsWith("text/event-stream");
				const rewriteBody = !eventStream && (contentType.includes("text/html") || contentType.includes("text/css") || contentType.includes("javascript"));
				const headers = copyResponseHeaders(proxyRes.headers, {
					rewriteBody,
					eventStream,
					gatewayPrefix
				});
				if (!rewriteBody) {
					res.writeHead(proxyRes.statusCode || 502, proxyRes.statusMessage, headers);
					if (eventStream) {
						res.flushHeaders();
						attachSseKeepalive(res, { interval: sseKeepaliveInterval });
					}
					proxyRes.pipe(res);
					return;
				}
				const chunks = [];
				proxyRes.on("data", (chunk) => chunks.push(chunk));
				proxyRes.on("error", (error) => sendBadGateway(res, error));
				proxyRes.on("end", () => {
					const rawBody = Buffer.concat(chunks);
					let rewrittenBody;
					if (contentType.includes("text/html")) rewrittenBody = rewriteHtml(rawBody, gatewayPrefix, bridgeScript);
					else if (contentType.includes("text/css")) rewrittenBody = rewriteCss(rawBody, gatewayPrefix);
					else rewrittenBody = rewriteJavaScript(rawBody, req.url || "/", gatewayPrefix);
					const body = Buffer.from(rewrittenBody);
					headers["content-length"] = String(body.length);
					res.writeHead(proxyRes.statusCode || 502, proxyRes.statusMessage, headers);
					res.end(body);
				});
			},
			error: (err, _req, res) => {
				const target = res;
				if (target && typeof target.writeHead === "function") sendBadGateway(target, err);
			}
		}
	});
}
//#endregion
//#region src/server.ts
function removeSocket(socketPath) {
	try {
		unlinkSync(socketPath);
	} catch (error) {
		if (error?.code !== "ENOENT") throw error;
	}
}
function createGateway(options) {
	const { socketPath, gatewayPrefix } = options;
	const app = (0, import_connect.default)();
	app.use(pathRewriteMiddleware(gatewayPrefix));
	app.use(createProxyHandler(options));
	const openSockets = /* @__PURE__ */ new Set();
	let stopping = false;
	const server = createServer(app);
	server.on("connection", (socket) => {
		openSockets.add(socket);
		socket.once("close", () => openSockets.delete(socket));
	});
	server.on("clientError", (_err, socket) => socket.destroy());
	const close = () => new Promise((resolve) => {
		if (stopping) {
			resolve();
			return;
		}
		stopping = true;
		for (const socket of openSockets) socket.destroy();
		server.close(() => {
			removeSocket(socketPath);
			resolve();
		});
		setTimeout(() => {
			removeSocket(socketPath);
			resolve();
		}, 5e3).unref();
	});
	removeSocket(socketPath);
	server.listen(socketPath, () => {
		console.log(`fnOS gateway listening on ${socketPath}`);
	});
	return {
		server,
		close
	};
}
//#endregion
//#region src/cli.ts
const SOCKET_PATH = process.env.GATEWAY_SOCKET || "/var/apps/fn-deepseek-harness/target/app.sock";
const UPSTREAM_HOST = process.env.DSH_UPSTREAM_HOST || "127.0.0.1";
const UPSTREAM_PORT = Number.parseInt(process.env.DSH_UPSTREAM_PORT || "3080", 10);
const GATEWAY_PREFIX = normalizePrefix(process.env.GATEWAY_PREFIX || "/app/fn-deepseek-harness");
if (!Number.isInteger(UPSTREAM_PORT) || UPSTREAM_PORT < 1 || UPSTREAM_PORT > 65535) {
	console.error("Invalid dsh upstream port: " + (process.env.DSH_UPSTREAM_PORT || ""));
	process.exit(1);
}
const { close } = createGateway({
	socketPath: SOCKET_PATH,
	gatewayPrefix: GATEWAY_PREFIX,
	upstreamHost: UPSTREAM_HOST,
	upstreamPort: UPSTREAM_PORT
});
const shutdown = () => {
	close().then(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
//#endregion
export {};
