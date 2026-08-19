window.__ModuleLoader__.load({
	id: "@tnnevol/dsh-fnos",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/picker-result.ts
		/**
		* Detect the result shapes used by different fnOS hosts when a file picker is
		* closed without confirming a selection.
		*
		* The SDK type allows `undefined`, while some host versions return a bridge
		* response with a cancel status/message or an empty result. Keep this helper
		* separate from the card so those host variations can be tested without a
		* browser or React runtime.
		*/
		const cancellationStatusPattern = /^(?:cancel(?:led|ed)?|abort(?:ed)?)$/iu;
		const cancellationMessagePattern = /(?:用户\s*)?(?:已\s*)?取消(?:选择|操作|授权)?(?:$|[\s,，。!！])|\b(?:cancel(?:led|ed)?|abort(?:ed)?|user[_ -]?cancel(?:led|ed)?)\b/iu;
		const adminOnlyPickerMessagePattern = /(?:只有|仅)\s*(?:NAS|fnOS|飞牛)?\s*管理员.*(?:授权|操作|目录)/iu;
		function asRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function textFields(record) {
			return [
				record.msg,
				record.message,
				record.error
			].filter((value) => typeof value === "string").join(" ").trim();
		}
		function hasCancellationStatus(record) {
			const data = asRecord(record.data);
			return [record.status, data?.status].some((status) => typeof status === "string" && cancellationStatusPattern.test(status.trim()));
		}
		/** Return true when the fnOS picker was closed without a confirmed selection. */
		function isPickerCancellation(value) {
			if (value === void 0 || value === null) return true;
			if (value instanceof Error) {
				if (value.name === "AbortError" || value.name === "CanceledError") return true;
				if (adminOnlyPickerMessagePattern.test(value.message)) return true;
			}
			const record = asRecord(value);
			if (!record) return false;
			if (hasCancellationStatus(record)) return true;
			const message = textFields(record);
			if (cancellationMessagePattern.test(message)) return true;
			if (!Array.isArray(record.data)) return adminOnlyPickerMessagePattern.test(message);
			if (record.data.length !== 0) return false;
			if (message.length === 0) return true;
			return record.code === 1 && adminOnlyPickerMessagePattern.test(message);
		}
		//#endregion
		//#region ../../node_modules/.pnpm/@trimjs+web-app@0.4.2/node_modules/@trimjs/web-app/dist/index.js
		function e(t) {
			return e = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
				return typeof e;
			} : function(e) {
				return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
			}, e(t);
		}
		function t(t) {
			var r = function(t, r) {
				if ("object" != e(t) || !t) return t;
				var n = t[Symbol.toPrimitive];
				if (void 0 !== n) {
					var i = n.call(t, r || "default");
					if ("object" != e(i)) return i;
					throw new TypeError("@@toPrimitive must return a primitive value.");
				}
				return ("string" === r ? String : Number)(t);
			}(t, "string");
			return "symbol" == e(r) ? r : r + "";
		}
		function r(e, r, n) {
			return (r = t(r)) in e ? Object.defineProperty(e, r, {
				value: n,
				enumerable: !0,
				configurable: !0,
				writable: !0
			}) : e[r] = n, e;
		}
		var n = new class {
			constructor() {
				r(this, "debug", !1);
			}
			setDebug(e) {
				this.debug = e;
			}
			isDebug() {
				return this.debug;
			}
			log() {
				if (this.debug) {
					for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
					console.log("[Trim App]", ...t);
				}
			}
			warn() {
				if (this.debug) {
					for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
					console.warn("[Trim App]", ...t);
				}
			}
			error() {
				if (this.debug) {
					for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
					console.error("[Trim App]", ...t);
				}
			}
			info() {
				if (this.debug) {
					for (var e = arguments.length, t = new Array(e), r = 0; r < e; r++) t[r] = arguments[r];
					console.info("[Trim App]", ...t);
				}
			}
		}();
		var i = () => function(e) {
			const t = /FNOS\/([\d.]+)|FNAppType\/(\w+)|FNAppVer\/([\d.]+)/g, r = {};
			let n;
			for (; null !== (n = t.exec(e));) n[1] && (r.fnOSVersion = n[1]), n[2] && (r.fnAppType = n[2]), n[3] && (r.fnAppVersion = n[3]);
			return r;
		}(navigator.userAgent).fnAppVersion;
		function o(e, t, r, n, i, o, s) {
			try {
				var l = e[o](s), a = l.value;
			} catch (e) {
				r(e);
				return;
			}
			l.done ? t(a) : Promise.resolve(a).then(n, i);
		}
		function s(e) {
			return function() {
				var t = this, r = arguments;
				return new Promise(function(n, i) {
					var s = e.apply(t, r);
					function l(e) {
						o(s, n, i, l, a, "next", e);
					}
					function a(e) {
						o(s, n, i, l, a, "throw", e);
					}
					l(void 0);
				});
			};
		}
		function l(e, t) {
			var r = Object.keys(e);
			if (Object.getOwnPropertySymbols) {
				var n = Object.getOwnPropertySymbols(e);
				t && (n = n.filter(function(t) {
					return Object.getOwnPropertyDescriptor(e, t).enumerable;
				})), r.push.apply(r, n);
			}
			return r;
		}
		function a(e) {
			for (var t = 1; t < arguments.length; t++) {
				var n = null != arguments[t] ? arguments[t] : {};
				t % 2 ? l(Object(n), !0).forEach(function(t) {
					r(e, t, n[t]);
				}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : l(Object(n)).forEach(function(t) {
					Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
				});
			}
			return e;
		}
		var u = !1;
		window.addEventListener("flutterInAppWebViewPlatformReady", () => {
			u = !0;
		});
		var p = /(iPad|iPhone|iPod|Macintosh|Mac OS X)/i.test(navigator.userAgent);
		var c = /* @__PURE__ */ function() {
			var e = s(function* (e, t) {
				for (var r = arguments.length, i = new Array(r > 2 ? r - 2 : 0), o = 2; o < r; o++) i[o - 2] = arguments[o];
				n.log(`callHandler: ${t}, params: ${i.map((e) => String(e)).join(", ")}`);
				const s = yield e.callHandler(t, ...i);
				if (s) try {
					const e = JSON.parse(s);
					n.log(`messageData: ${JSON.stringify(e)}`);
					const t = JSON.parse(e.result);
					return n.log(`appMessage: ${JSON.stringify(t)}`), t;
				} catch (l) {
					return n.error(`error: ${l}`), null;
				}
				return null;
			});
			return function(t, r) {
				return e.apply(this, arguments);
			};
		}();
		var d = /* @__PURE__ */ new Map();
		var f = class {
			constructor(e) {
				r(this, "subscribeFn", void 0), this.subscribeFn = e;
			}
			subscribe(e, t, r) {
				var n;
				const i = "function" == typeof e ? {
					next: e,
					error: t,
					complete: r
				} : null != e ? e : {};
				let o = !1;
				const s = null !== (n = this.subscribeFn({
					next: (e) => {
						var t;
						o || null === (t = i.next) || void 0 === t || t.call(i, e);
					},
					error: (e) => {
						var t;
						o || (o = !0, null === (t = i.error) || void 0 === t || t.call(i, e));
					},
					complete: () => {
						var e;
						o || (o = !0, null === (e = i.complete) || void 0 === e || e.call(i));
					}
				})) && void 0 !== n ? n : () => {};
				return { unsubscribe: () => {
					o || (o = !0, s());
				} };
			}
		};
		var h = /* @__PURE__ */ new Map();
		function v() {
			window._flutter_onAppObservableQueryResult = (e) => {
				n.log("_flutter_onAppObservableQueryResult", e);
				const t = function(e) {
					var t, r;
					const n = "string" == typeof e ? JSON.parse(e) : e, i = null !== (t = n.reqid) && void 0 !== t ? t : n.reqId;
					return a(a({}, n), {}, {
						reqId: null !== (r = n.reqId) && void 0 !== r ? r : i,
						reqid: i
					});
				}(e), r = h.get(t.reqId);
				if (r) if (t.result && "doing" !== t.result) {
					if ("succ" === t.result) return r.next(t), r.complete(), void h.delete(t.reqId);
					r.error(t), h.delete(t.reqId);
				} else r.next(t);
				else n.log("_flutter_onAppObservableQueryResult observer not found", t);
			};
		}
		function y() {
			return (y = s(function* (e, t) {
				return new Promise((r, i) => {
					e?.callHandler("openFolder", JSON.stringify(t)).then((e) => {
						if (n.log("pickFilePromise callback registered", {
							reqId: e,
							params: t
						}), e) {
							function o(e) {
								r(e.result);
							}
							d.set(e, o);
						} else i(/* @__PURE__ */ new Error("openFolder failed"));
					});
				});
			})).apply(this, arguments);
		}
		i() && (window.fnAppMessage = (e) => {
			n.log("app-message", e);
			const t = JSON.parse(e), r = d.get(t.reqId);
			r && (r(t), d.delete(t.reqId));
		}), i() && v();
		var g = /* @__PURE__ */ function(e) {
			return e.Call = "call", e.Reply = "reply", e.Syn = "syn", e.SynAck = "synAck", e.Ack = "ack", e;
		}({});
		var b = /* @__PURE__ */ function(e) {
			return e.Fulfilled = "fulfilled", e.Rejected = "rejected", e;
		}({});
		var m = /* @__PURE__ */ function(e) {
			return e.ConnectionDestroyed = "ConnectionDestroyed", e.ConnectionTimeout = "ConnectionTimeout", e.NoIframeSrc = "NoIframeSrc", e;
		}({});
		var w = /* @__PURE__ */ function(e) {
			return e.DataCloneError = "DataCloneError", e;
		}({});
		var A = /* @__PURE__ */ function(e) {
			return e.Message = "message", e;
		}({});
		var S = ({ name: e, message: t, stack: r }) => ({
			name: e,
			message: t,
			stack: r
		});
		var P = (e, t, r) => {
			let { localName: n, local: i, remote: o, originForSending: s, originForReceiving: l } = e, a = !1, u = (e) => {
				if (e.source !== o || e.data.penpal !== g.Call) return;
				if ("*" !== l && e.origin !== l) return void r(`${n} received message from origin ${e.origin} which did not match expected origin ${l}`);
				let { methodName: i, args: u, id: p } = e.data;
				r(`${n}: Received ${i}() call`);
				let c = (e) => (t) => {
					if (r(`${n}: Sending ${i}() reply`), a) return void r(`${n}: Unable to send ${i}() reply due to destroyed connection`);
					let l = {
						penpal: g.Reply,
						id: p,
						resolution: e,
						returnValue: t
					};
					e === b.Rejected && t instanceof Error && (l.returnValue = S(t), l.returnValueIsError = !0);
					try {
						o.postMessage(l, s);
					} catch (e) {
						let r = e instanceof Error ? e : Error(String(e));
						if (r.name === w.DataCloneError) {
							let e = {
								penpal: g.Reply,
								id: p,
								resolution: b.Rejected,
								returnValue: S(r),
								returnValueIsError: !0
							};
							o.postMessage(e, s);
						}
						throw e;
					}
				};
				new Promise((e) => e(t[i].apply(t, u))).then(c(b.Fulfilled), c(b.Rejected));
			};
			return i.addEventListener(A.Message, u), () => {
				a = !0, i.removeEventListener(A.Message, u);
			};
		};
		var O = 0;
		var M = () => ++O;
		var E = (e) => e ? e.split(".") : [];
		var F = (e, t, r) => {
			let n = E(t);
			return n.reduce((e, t, i) => (void 0 === e[t] && (e[t] = {}), i === n.length - 1 && (e[t] = r), e[t]), e), e;
		};
		var $ = (e, t) => {
			let r = {};
			return Object.keys(e).forEach((n) => {
				let i = e[n], o = ((e, t) => {
					let r = E(t || "");
					return r.push(e), ((e) => e.join("."))(r);
				})(n, t);
				"object" == typeof i && Object.assign(r, $(i, o)), "function" == typeof i && (r[o] = i);
			}), r;
		};
		var _ = (e, t, r, n, i) => {
			let { localName: o, local: s, remote: l, originForSending: a, originForReceiving: u } = t, p = !1;
			i(`${o}: Connecting call sender`);
			let c = (e) => (...t) => {
				let r;
				i(`${o}: Sending ${e}() call`);
				try {
					l.closed && (r = !0);
				} catch (g) {
					r = !0;
				}
				if (r && n(), p) {
					let t = /* @__PURE__ */ Error(`Unable to send ${e}() call due to destroyed connection`);
					throw t.code = m.ConnectionDestroyed, t;
				}
				return new Promise((r, n) => {
					let p = M(), c = (t) => {
						if (t.source !== l || t.data.penpal !== g.Reply || t.data.id !== p) return;
						if ("*" !== u && t.origin !== u) return void i(`${o} received message from origin ${t.origin} which did not match expected origin ${u}`);
						let a = t.data;
						i(`${o}: Received ${e}() reply`), s.removeEventListener(A.Message, c);
						let d = a.returnValue;
						a.returnValueIsError && (d = ((e) => {
							let t = /* @__PURE__ */ Error();
							return Object.assign(t, e), t;
						})(d)), (a.resolution === b.Fulfilled ? r : n)(d);
					};
					s.addEventListener(A.Message, c);
					let d = {
						penpal: g.Call,
						id: p,
						methodName: e,
						args: t
					};
					l.postMessage(d, a);
				});
			}, d = r.reduce((e, t) => (e[t] = c(t), e), {});
			return Object.assign(e, ((e) => {
				let t = {};
				for (let r in e) F(t, r, e[r]);
				return t;
			})(d)), () => {
				p = !0;
			};
		};
		var j = (e, t) => {
			let r;
			return void 0 !== e && (r = window.setTimeout(() => {
				let r = /* @__PURE__ */ Error(`Connection timed out after ${e}ms`);
				r.code = m.ConnectionTimeout, t(r);
			}, e)), () => {
				clearTimeout(r);
			};
		};
		function k(e) {
			return k = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
				return typeof e;
			} : function(e) {
				return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
			}, k(e);
		}
		function W(e) {
			var t = function(e, t) {
				if ("object" != k(e) || !e) return e;
				var r = e[Symbol.toPrimitive];
				if (void 0 !== r) {
					var n = r.call(e, t || "default");
					if ("object" != k(n)) return n;
					throw TypeError("@@toPrimitive must return a primitive value.");
				}
				return ("string" === t ? String : Number)(e);
			}(e, "string");
			return "symbol" == k(t) ? t : t + "";
		}
		function q(e, t, r) {
			return (t = W(t)) in e ? Object.defineProperty(e, t, {
				value: r,
				enumerable: !0,
				configurable: !0,
				writable: !0
			}) : e[t] = r, e;
		}
		function x(e, t) {
			var r = Object.keys(e);
			if (Object.getOwnPropertySymbols) {
				var n = Object.getOwnPropertySymbols(e);
				t && (n = n.filter(function(t) {
					return Object.getOwnPropertyDescriptor(e, t).enumerable;
				})), r.push.apply(r, n);
			}
			return r;
		}
		function N(e) {
			for (var t = 1; t < arguments.length; t++) {
				var r = null == arguments[t] ? {} : arguments[t];
				t % 2 ? x(Object(r), !0).forEach(function(t) {
					q(e, t, r[t]);
				}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r)) : x(Object(r)).forEach(function(t) {
					Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(r, t));
				});
			}
			return e;
		}
		var T = (e, t, r, n, i) => {
			let { destroy: o, onDestroy: s } = n;
			return (n) => {
				if (!(e instanceof RegExp ? e.test(n.origin) : "*" === e || e === n.origin)) return void i(`Child: Handshake - Received SYN-ACK from origin ${n.origin} which did not match expected origin ${e}`);
				i("Child: Handshake - Received SYN-ACK, responding with ACK");
				let l = "null" === n.origin ? "*" : n.origin, a = {
					penpal: g.Ack,
					methodNames: Object.keys(t),
					config: r
				};
				window.parent.postMessage(a, l);
				let u = {
					localName: "Child",
					local: window,
					remote: window.parent,
					originForSending: l,
					originForReceiving: n.origin
				}, p = P(u, t, i);
				s(p);
				let c = {}, d = _(c, u, n.data.methodNames, o, i);
				return s(d), c;
			};
		};
		function I(e, t) {
			var r;
			null == (r = console) || r.warn(`[fnApp warn]: ${e}`, t);
		}
		function C(e, t) {
			var r;
			null == (r = console) || r.error(`[fnApp error]: ${e}`, t);
		}
		var V = "_fn_all_event";
		var U = "事件订阅数量为空";
		function R(e) {
			return R = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
				return typeof e;
			} : function(e) {
				return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
			}, R(e);
		}
		function D(e) {
			var t = function(e, t) {
				if ("object" != R(e) || !e) return e;
				var r = e[Symbol.toPrimitive];
				if (void 0 !== r) {
					var n = r.call(e, t || "default");
					if ("object" != R(n)) return n;
					throw TypeError("@@toPrimitive must return a primitive value.");
				}
				return ("string" === t ? String : Number)(e);
			}(e, "string");
			return "symbol" == R(t) ? t : t + "";
		}
		function z(e, t, r) {
			return (t = D(t)) in e ? Object.defineProperty(e, t, {
				value: r,
				enumerable: !0,
				configurable: !0,
				writable: !0
			}) : e[t] = r, e;
		}
		var L = window.__POWERED_BY_FNAPP__ ? window.__FNAPP.inject.appEventObjMap : /* @__PURE__ */ new Map();
		var J = class {
			constructor(e, t) {
				z(this, "id", void 0), z(this, "appName", void 0), z(this, "eventObj", void 0), z(this, "getEventCallBackLength", (e) => {
					var t;
					return (null == (t = this.eventObj[e]) ? void 0 : t.length) || 0;
				}), this.id = e, this.appName = t, this.$clear(), L.get(this.id) || L.set(this.id, {}), this.eventObj = L.get(this.id);
			}
			$on(e, t) {
				let r = this.eventObj[e];
				return r ? (r.includes(t) || r.push(t), this) : (this.eventObj[e] = [t], this);
			}
			$onAll(e) {
				return this.$on(V, e);
			}
			$once(e, t) {
				t.$__once = !0, this.$on(e, t);
			}
			$off(e, t) {
				let r = this.eventObj[e];
				if (!e || !r || !r.length) return I(`${e} ${U}`), this;
				let n, i = r.length;
				for (; i--;) if (n = r[i], n === t) {
					r.splice(i, 1);
					break;
				}
				return this;
			}
			$offAll(e) {
				return this.$off(V, e);
			}
			$emit(e, ...t) {
				return e = `${this.appName}/${e}`, this.$pureEmit(e, ...t);
			}
			$pureEmit(e, ...t) {
				let r = 0;
				return L.forEach((n) => {
					if (n[e]) for (let i = n[e].length - 1; i >= 0; i--) {
						r++;
						let o = n[e][i];
						o.$__once && n[e].splice(i, 1);
						try {
							o(...t);
						} catch (e) {
							C(e);
						}
					}
					if (n._fn_all_event) for (let i = n[V].length - 1; i >= 0; i--) {
						r++;
						let o = n[V][i];
						o.$__once && n[V].splice(i, 1);
						try {
							o(...t);
						} catch (e) {
							C(e);
						}
					}
				}), (!e || 0 === r) && I(`${e} ${U}`), this;
			}
			$clear() {
				var e;
				let t = null == (e = L.get(this.id)) ? {} : e;
				return Object.keys(t).forEach((e) => delete t[e]), this;
			}
		};
		var H = function(e, t) {
			return H = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e, t) {
				e.__proto__ = t;
			} || function(e, t) {
				for (var r in t) Object.prototype.hasOwnProperty.call(t, r) && (e[r] = t[r]);
			}, H(e, t);
		};
		function Q(e, t) {
			if ("function" != typeof t && null !== t) throw TypeError("Class extends value " + String(t) + " is not a constructor or null");
			function r() {
				this.constructor = e;
			}
			H(e, t), e.prototype = null === t ? Object.create(t) : (r.prototype = t.prototype, new r());
		}
		function B(e) {
			var t = "function" == typeof Symbol && Symbol.iterator, r = t && e[t], n = 0;
			if (r) return r.call(e);
			if (e && "number" == typeof e.length) return { next: function() {
				return e && n >= e.length && (e = void 0), {
					value: e && e[n++],
					done: !e
				};
			} };
			throw TypeError(t ? "Object is not iterable." : "Symbol.iterator is not defined.");
		}
		function Y(e, t) {
			var r = "function" == typeof Symbol && e[Symbol.iterator];
			if (!r) return e;
			var n, i, o = r.call(e), s = [];
			try {
				for (; (void 0 === t || t-- > 0) && !(n = o.next()).done;) s.push(n.value);
			} catch (e) {
				i = { error: e };
			} finally {
				try {
					n && !n.done && (r = o.return) && r.call(o);
				} finally {
					if (i) throw i.error;
				}
			}
			return s;
		}
		function G(e, t, r) {
			if (r || 2 === arguments.length) for (var n, i = 0, o = t.length; i < o; i++) (n || !(i in t)) && (n || (n = Array.prototype.slice.call(t, 0, i)), n[i] = t[i]);
			return e.concat(n || Array.prototype.slice.call(t));
		}
		function K(e) {
			return "function" == typeof e;
		}
		var X = function(e) {
			var t = e(function(e) {
				Error.call(e), e.stack = (/* @__PURE__ */ Error()).stack;
			});
			return t.prototype = Object.create(Error.prototype), t.prototype.constructor = t, t;
		}(function(e) {
			return function(t) {
				e(this), this.message = t ? t.length + " errors occurred during unsubscription:\n" + t.map(function(e, t) {
					return t + 1 + ") " + e.toString();
				}).join("\n  ") : "", this.name = "UnsubscriptionError", this.errors = t;
			};
		});
		function Z(e, t) {
			if (e) {
				var r = e.indexOf(t);
				0 <= r && e.splice(r, 1);
			}
		}
		var ee = function() {
			function e(e) {
				this.initialTeardown = e, this.closed = !1, this._parentage = null, this._finalizers = null;
			}
			return e.prototype.unsubscribe = function() {
				var e, t, r, n, i;
				if (!this.closed) {
					this.closed = !0;
					var o = this._parentage;
					if (o) if (this._parentage = null, Array.isArray(o)) try {
						for (var s = B(o), l = s.next(); !l.done; l = s.next()) l.value.remove(this);
					} catch (t) {
						e = { error: t };
					} finally {
						try {
							l && !l.done && (t = s.return) && t.call(s);
						} finally {
							if (e) throw e.error;
						}
					}
					else o.remove(this);
					var a = this.initialTeardown;
					if (K(a)) try {
						a();
					} catch (e) {
						i = e instanceof X ? e.errors : [e];
					}
					var u = this._finalizers;
					if (u) {
						this._finalizers = null;
						try {
							for (var p = B(u), c = p.next(); !c.done; c = p.next()) {
								var d = c.value;
								try {
									re(d);
								} catch (e) {
									i = null == i ? [] : i, e instanceof X ? i = G(G([], Y(i)), Y(e.errors)) : i.push(e);
								}
							}
						} catch (e) {
							r = { error: e };
						} finally {
							try {
								c && !c.done && (n = p.return) && n.call(p);
							} finally {
								if (r) throw r.error;
							}
						}
					}
					if (i) throw new X(i);
				}
			}, e.prototype.add = function(t) {
				var r;
				if (t && t !== this) if (this.closed) re(t);
				else {
					if (t instanceof e) {
						if (t.closed || t._hasParent(this)) return;
						t._addParent(this);
					}
					(this._finalizers = null == (r = this._finalizers) ? [] : r).push(t);
				}
			}, e.prototype._hasParent = function(e) {
				var t = this._parentage;
				return t === e || Array.isArray(t) && t.includes(e);
			}, e.prototype._addParent = function(e) {
				var t = this._parentage;
				this._parentage = Array.isArray(t) ? (t.push(e), t) : t ? [t, e] : e;
			}, e.prototype._removeParent = function(e) {
				var t = this._parentage;
				t === e ? this._parentage = null : Array.isArray(t) && Z(t, e);
			}, e.prototype.remove = function(t) {
				var r = this._finalizers;
				r && Z(r, t), t instanceof e && t._removeParent(this);
			}, e.EMPTY = function() {
				var t = new e();
				return t.closed = !0, t;
			}(), e;
		}();
		function te(e) {
			return e instanceof ee || e && "closed" in e && K(e.remove) && K(e.add) && K(e.unsubscribe);
		}
		function re(e) {
			K(e) ? e() : e.unsubscribe();
		}
		ee.EMPTY;
		var ne = null;
		var ie = null;
		var oe = void 0;
		var se = !1;
		var le = !1;
		var ae = {
			setTimeout: function(e, t) {
				var r = [...arguments].slice(2), n = ae.delegate;
				return null != n && n.setTimeout ? n.setTimeout.apply(n, G([e, t], Y(r))) : setTimeout.apply(void 0, G([e, t], Y(r)));
			},
			clearTimeout: function(e) {
				var t = ae.delegate;
				return ((null == t ? void 0 : t.clearTimeout) || clearTimeout)(e);
			},
			delegate: void 0
		};
		function ue() {}
		var pe = ce("C", void 0, void 0);
		function ce(e, t, r) {
			return {
				kind: e,
				value: t,
				error: r
			};
		}
		var de = null;
		var fe = function(e) {
			function t(t) {
				var r = e.call(this) || this;
				return r.isStopped = !1, t ? (r.destination = t, te(t) && t.add(r)) : r.destination = we, r;
			}
			return Q(t, e), t.create = function(e, t, r) {
				return new ge(e, t, r);
			}, t.prototype.next = function(e) {
				this.isStopped ? me(function(e) {
					return ce("N", e, void 0);
				}(e), this) : this._next(e);
			}, t.prototype.error = function(e) {
				this.isStopped ? me(function(e) {
					return ce("E", void 0, e);
				}(e), this) : (this.isStopped = !0, this._error(e));
			}, t.prototype.complete = function() {
				this.isStopped ? me(pe, this) : (this.isStopped = !0, this._complete());
			}, t.prototype.unsubscribe = function() {
				this.closed || (this.isStopped = !0, e.prototype.unsubscribe.call(this), this.destination = null);
			}, t.prototype._next = function(e) {
				this.destination.next(e);
			}, t.prototype._error = function(e) {
				try {
					this.destination.error(e);
				} finally {
					this.unsubscribe();
				}
			}, t.prototype._complete = function() {
				try {
					this.destination.complete();
				} finally {
					this.unsubscribe();
				}
			}, t;
		}(ee);
		var he = Function.prototype.bind;
		function ve(e, t) {
			return he.call(e, t);
		}
		var ye = function() {
			function e(e) {
				this.partialObserver = e;
			}
			return e.prototype.next = function(e) {
				var t = this.partialObserver;
				if (t.next) try {
					t.next(e);
				} catch (e) {
					be(e);
				}
			}, e.prototype.error = function(e) {
				var t = this.partialObserver;
				if (t.error) try {
					t.error(e);
				} catch (e) {
					be(e);
				}
				else be(e);
			}, e.prototype.complete = function() {
				var e = this.partialObserver;
				if (e.complete) try {
					e.complete();
				} catch (e) {
					be(e);
				}
			}, e;
		}();
		var ge = function(e) {
			function t(t, r, n) {
				var i, o, s = e.call(this) || this;
				K(t) || !t ? i = {
					next: null == t ? void 0 : t,
					error: null == r ? void 0 : r,
					complete: null == n ? void 0 : n
				} : s && le ? ((o = Object.create(t)).unsubscribe = function() {
					return s.unsubscribe();
				}, i = {
					next: t.next && ve(t.next, o),
					error: t.error && ve(t.error, o),
					complete: t.complete && ve(t.complete, o)
				}) : i = t;
				return s.destination = new ye(i), s;
			}
			return Q(t, e), t;
		}(fe);
		function be(e) {
			(function(e) {
				ae.setTimeout(function() {
					if (!ne) throw e;
					ne(e);
				});
			})(e);
		}
		function me(e, t) {
			var r = ie;
			r && ae.setTimeout(function() {
				return r(e, t);
			});
		}
		var we = {
			closed: !0,
			next: ue,
			error: function(e) {
				throw e;
			},
			complete: ue
		};
		var Ae = "function" == typeof Symbol && Symbol.observable || "@@observable";
		function Se(e) {
			return e;
		}
		var Pe = function() {
			function e(e) {
				e && (this._subscribe = e);
			}
			return e.prototype.lift = function(t) {
				var r = new e();
				return r.source = this, r.operator = t, r;
			}, e.prototype.subscribe = function(e, t, r) {
				var n = this, i = function(e) {
					return e && e instanceof fe || function(e) {
						return e && K(e.next) && K(e.error) && K(e.complete);
					}(e) && te(e);
				}(e) ? e : new ge(e, t, r);
				return function(e) {
					if (se) {
						var t = !de;
						if (t && (de = {
							errorThrown: !1,
							error: null
						}), e(), t) {
							var r = de, n = r.errorThrown, i = r.error;
							if (de = null, n) throw i;
						}
					} else e();
				}(function() {
					var e = n, t = e.operator, r = e.source;
					i.add(t ? t.call(i, r) : r ? n._subscribe(i) : n._trySubscribe(i));
				}), i;
			}, e.prototype._trySubscribe = function(e) {
				try {
					return this._subscribe(e);
				} catch (b) {
					e.error(b);
				}
			}, e.prototype.forEach = function(e, t) {
				var r = this;
				return new (t = (Oe(t)))(function(t, n) {
					var i = new ge({
						next: function(t) {
							try {
								e(t);
							} catch (e) {
								n(e), i.unsubscribe();
							}
						},
						error: n,
						complete: t
					});
					r.subscribe(i);
				});
			}, e.prototype._subscribe = function(e) {
				var t;
				return null == (t = this.source) ? void 0 : t.subscribe(e);
			}, e.prototype[Ae] = function() {
				return this;
			}, e.prototype.pipe = function() {
				return function(e) {
					return 0 === e.length ? Se : 1 === e.length ? e[0] : function(t) {
						return e.reduce(function(e, t) {
							return t(e);
						}, t);
					};
				}([...arguments])(this);
			}, e.prototype.toPromise = function(e) {
				var t = this;
				return new (e = (Oe(e)))(function(e, r) {
					var n;
					t.subscribe(function(e) {
						return n = e;
					}, function(e) {
						return r(e);
					}, function() {
						return e(n);
					});
				});
			}, e.create = function(t) {
				return new e(t);
			}, e;
		}();
		function Oe(e) {
			var t;
			return null == (t = null == e ? oe : e) ? Promise : t;
		}
		function Me(e, t, r, n, i, o, s) {
			try {
				var l = e[o](s), a = l.value;
			} catch (e) {
				r(e);
				return;
			}
			l.done ? t(a) : Promise.resolve(a).then(n, i);
		}
		function Ee(e) {
			return function() {
				var t = this, r = arguments;
				return new Promise(function(n, i) {
					var o = e.apply(t, r);
					function s(e) {
						Me(o, n, i, s, l, "next", e);
					}
					function l(e) {
						Me(o, n, i, s, l, "throw", e);
					}
					s(void 0);
				});
			};
		}
		var Fe = (e = {}) => {
			let { parentOrigin: t = "*", timeout: r, debug: n = !1, config: i = {} } = e, o = ((e) => (...t) => {
				e && console.log("[Penpal]", ...t);
			})(n), s = ((e, t) => {
				let r = [], n = !1;
				return {
					destroy(i) {
						n || (n = !0, t(`${e}: Destroying connection`), r.forEach((e) => {
							e(i);
						}));
					},
					onDestroy(e) {
						n ? e() : r.push(e);
					}
				};
			})("App", o), { destroy: l, onDestroy: a } = s;
			return {
				promise: new Promise((e, n) => {
					let u = j(r, l), p = (r) => {
						if ((() => {
							try {
								clearTimeout(void 0);
							} catch (g) {
								return !1;
							}
							return !0;
						})() && r.source === parent && r.data && r.data.penpal === g.SynAck) {
							let n = r.data, l = new J(n.id, n.appName), a = new J(n.id + "/api", n.appName), c = n.id, d = {}, f = (e) => "api/" + e, h = {
								$emit: (e, ...t) => {
									l.getEventCallBackLength(e) > 0 ? l.$pureEmit(e, ...t) : d?.$off(e, () => {}, !0);
								},
								onQueryResult: (e) => {
									a.$pureEmit(f(e.reqid), e);
								},
								onOsNotify: (e) => {}
							}, v = (e) => function(t) {
								let r = f(e);
								a.$on(r, function e(n) {
									t.next(n), n.reqid && "succ" === n.result && (t.complete(), a.$off(r, e));
								});
							}, y = $(h), g = T(t, y, N(N({}, i), {}, { postmateVersion: "0.1.3" }), s, o)(r), b = {}, m = g.bus;
							if (m) {
								let e = (e, t, r) => {
									r ? (t.$__once = !0, l.$once(e, t)) : l.$on(e, t), b[e] ? b[e].push(t) : (b[e] = [t], m.$on(e, c));
								};
								Object.assign(d, m, {
									$on: e,
									$off: (e, t, r) => {
										var n;
										if (b[e]) {
											let r = b[e].indexOf(t);
											r > -1 && (b[e].splice(r, 1), l.$off(e, t));
										}
										r && delete b[e], null != (n = b[e]) && n.length || (m.$off(e, c), delete b[e]);
									},
									$once: (t, r) => {
										e(t, r, !0);
									}
								});
							}
							let w = N(N({}, g), {}, {
								bus: d,
								query: function() {
									var e = Ee(function* (e, t) {
										let r = (null == e ? void 0 : e.reqid) || (yield g.genReqId());
										return new Promise((n, i) => {
											g.query(N(N({}, e), {}, { reqid: r }), t).then((e) => {
												"succ" === (null == e ? void 0 : e.result) ? n(e) : i(e);
											});
										});
									});
									return function(t, r) {
										return e.apply(this, arguments);
									};
								}(),
								createObservableQuery: function() {
									var e = Ee(function* (e, t = {}) {
										let r = (null == e ? void 0 : e.reqid) || (yield g.genReqId()), n = new Pe(v(r));
										return g.query(N(N({}, e), {}, { reqid: r }), N(N({}, t), {}, { observable: !0 })), n;
									});
									return function(t) {
										return e.apply(this, arguments);
									};
								}()
							});
							g && (window.removeEventListener(A.Message, p), u(), e({
								methods: w,
								config: r.data.config
							}));
						}
					};
					window.addEventListener(A.Message, p), (() => {
						o("Child: Handshake - Sending SYN");
						let e = { penpal: g.Syn }, r = t instanceof RegExp ? "*" : t;
						window.parent.postMessage(e, r);
					})(), a((e) => {
						window.removeEventListener(A.Message, p), e && n(e);
					});
				}),
				destroy() {
					l();
				}
			};
		};
		var $e = "trimjs-extension-host";
		function _e() {
			return "undefined" != typeof crypto && "function" == typeof crypto.randomUUID ? crypto.randomUUID() : `web-ext-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		}
		function je(e) {
			if (!e || "object" != typeof e) return !1;
			const t = e;
			return t.source === $e && 1 === t.version && "string" == typeof t.requestId && ("request" === t.kind || "response" === t.kind || "event" === t.kind);
		}
		function ke(e) {
			const t = /* @__PURE__ */ new Error(`NotSupportedInExtensionHost: ${e}`);
			throw t.code = "NotSupportedInExtensionHost", t;
		}
		function We(e) {
			var t;
			const r = null !== (t = null == e ? void 0 : e.timeoutMs) && void 0 !== t ? t : 1500, n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set(), o = (e) => {
				if (je(t = e.data) && "response" === t.kind) {
					const t = n.get(e.data.requestId);
					if (!t) return;
					n.delete(e.data.requestId), clearTimeout(t.timeoutId), t.resolve(e.data);
					return;
				}
				var t;
				(function(e) {
					return je(e) && "event" === e.kind;
				})(e.data) && i.forEach((t) => {
					t(e.data);
				});
			};
			return window.addEventListener("message", o), {
				request: (e, t, i) => s(function* () {
					const o = function(e, t) {
						return {
							source: $e,
							version: 1,
							kind: "request",
							requestId: _e(),
							payload: {
								method: e,
								params: t
							}
						};
					}(e, t), s = yield new Promise((t, s) => {
						let l;
						const a = i && "timeoutMs" in i ? i.timeoutMs : r;
						"number" == typeof a && a >= 0 && (l = setTimeout(() => {
							n.delete(o.requestId), s(/* @__PURE__ */ new Error(`Extension host timeout while calling ${e}`));
						}, a)), n.set(o.requestId, {
							resolve: t,
							reject: s,
							timeoutId: l
						}), window.postMessage(o, "*");
					});
					var l, a;
					if (!s.payload.ok) throw new Error(null !== (l = null === (a = s.payload.error) || void 0 === a ? void 0 : a.message) && void 0 !== l ? l : `Extension host request failed: ${e}`);
					return s.payload.result;
				})(),
				onEvent: (e) => (i.add(e), () => {
					i.delete(e);
				}),
				destroy() {
					window.removeEventListener("message", o), n.forEach((e) => {
						clearTimeout(e.timeoutId), e.reject(/* @__PURE__ */ new Error("Extension bridge destroyed"));
					}), n.clear(), i.clear();
				}
			};
		}
		function qe() {
			return (qe = s(function* (e) {
				const t = We();
				try {
					var r;
					const i = yield t.request("handshake", { debug: null !== (r = null == e ? void 0 : e.debug) && void 0 !== r && r }, { timeoutMs: 5e3 });
					return n.log("Extension host probe response:", i), !0 === i.available;
				} catch (i) {
					return n.log("Extension host probe failed:", i), !1;
				} finally {
					t.destroy();
				}
			})).apply(this, arguments);
		}
		function xe() {
			return xe = s(function* () {
				const e = We(), t = /* @__PURE__ */ new Map();
				e.onEvent((e) => {
					t.get(e.payload.event)?.forEach((t) => {
						t(e.payload.data);
					});
				}), yield e.request("handshake", {}, { timeoutMs: 5e3 });
				const r = yield e.request("getPlatformConfig", {}), n = {
					bus: {
						$on(r, n) {
							var i;
							const o = null !== (i = t.get(r)) && void 0 !== i ? i : /* @__PURE__ */ new Set(), s = 0 === o.size;
							o.add(n), t.set(r, o), s && e.request("subscribe", { event: r });
						},
						$off(r, n) {
							const i = t.get(r);
							i && (i.delete(n), 0 === i.size && (t.delete(r), e.request("unsubscribe", { event: r })));
						},
						$once(e, t) {
							const r = function() {
								n.bus.$off(e, r), t(...arguments);
							};
							n.bus.$on(e, r);
						},
						$emit() {
							ke("bus.$emit");
						}
					},
					genReqId: () => _e(),
					query: (t, r) => e.request("query", {
						params: t,
						config: r
					}),
					createObservableQuery: (o = s(function* () {
						return ke("createObservableQuery");
					}), function() {
						return o.apply(this, arguments);
					}),
					openApp: () => ke("openApp"),
					openAppSetting: () => ke("openAppSetting"),
					openCustomApp: () => ke("openCustomApp"),
					setTitle: () => ke("setTitle"),
					pickFile: (t) => e.request("pickFile", t, { timeoutMs: null }),
					pickUserFile: () => ke("pickUserFile"),
					pickSharedFile: () => ke("pickSharedFile"),
					showFileDetails: (e, t) => ke("showFileDetails"),
					authorizeUserFile: (e) => ke("authorizeUserFile"),
					authorizeSharedFile: (e) => ke("authorizeSharedFile"),
					close: (i = s(function* () {
						e.destroy();
					}), function() {
						return i.apply(this, arguments);
					}),
					refreshToken: () => e.request("refreshToken", {}),
					setExitPageTips: () => ke("setExitPageTips"),
					openFileManagerApp: () => ke("openFileManagerApp"),
					openFileManager: () => ke("openFileManager"),
					openFile: () => ke("openFile"),
					getPlatformConfig: () => Promise.resolve(r),
					getHostSnapshot: () => e.request("getHostSnapshot", {})
				};
				var i, o, l;
				return {
					methods: n,
					config: (l = r, {
						appName: "extension-host",
						os: {
							version: l.systemVersion,
							theme: l.theme,
							language: l.language,
							format: { date: {
								date: l.format.date,
								time: l.format.time
							} }
						}
					})
				};
			}), xe.apply(this, arguments);
		}
		var Ne = null;
		function Te() {
			return (Te = s(function* (e) {
				const t = Fe({
					debug: null == e ? void 0 : e.debug,
					timeout: 1500
				});
				try {
					return yield t.promise;
				} catch (r) {
					return t.destroy(), n.log("Native OS connection probe failed:", r), null;
				}
			})).apply(this, arguments);
		}
		var Ie = (e) => Ne || (Ne = s(function* () {
			if ("undefined" != typeof window && window.parent !== window) {
				const t = yield function(e) {
					return Te.apply(this, arguments);
				}(e);
				if (t) return t;
			}
			return (yield function(e) {
				return qe.apply(this, arguments);
			}(e)) ? function() {
				return xe.apply(this, arguments);
			}() : Fe({ debug: null == e ? void 0 : e.debug }).promise;
		})());
		var Ce = {
			pickFile: "pick-file",
			pickUserFile: "pick-user-file",
			pickSharedFile: "pick-shared-file",
			authorizeUserFile: "authorize-user-file",
			authorizeSharedFile: "authorize-shared-file"
		};
		var Ve = class {
			constructor() {
				r(this, "options", void 0), r(this, "flutterInAppWebView", null), r(this, "osConnector", null), r(this, "initPromise", void 0), r(this, "appApiVersion", void 0), r(this, "isWeb", !0), r(this, "isStandaloneWeb", !1);
				let e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
				this.options = e, e.debug && (n.setDebug(!0), n.log("Trim App initialized with debug mode")), n.log("Options:", e), this.initPromise = this.init();
			}
			init() {
				var e = this;
				return s(function* () {
					return n.log("Starting initialization..."), new Promise((t) => {
						if (i()) e.isWeb = !1, n.log("Initializing mobile platform..."), new Promise((e) => {
							var t;
							(p ? window.flutter_inappwebview : u || (null === (t = window.flutter_inappwebview) || void 0 === t ? void 0 : t._platformReady)) ? (n.log("flutter_inappwebview is ready"), e(window.flutter_inappwebview)) : window.addEventListener("flutterInAppWebViewPlatformReady", () => {
								n.log("flutter_inappwebview is ready"), e(window.flutter_inappwebview);
							});
						}).then((r = s(function* (r) {
							yield e.initMobileAppApi(r), n.log("Mobile platform initialized"), t();
						}), function(e) {
							return r.apply(this, arguments);
						}));
						else {
							if (e.isWeb = !0, e.isStandaloneWeb = "undefined" != typeof window && window.parent === window, e.isStandaloneWeb) return n.log("Standalone web platform detected; host bridge initialization skipped"), void t();
							n.log("Initializing web platform..."), Ie().then((r) => {
								e.osConnector = r, n.log("Web platform initialized"), t();
							});
						}
						var r;
					});
				})();
			}
			getWebMethods() {
				var e;
				const t = null === (e = this.osConnector) || void 0 === e ? void 0 : e.methods;
				if (!t) throw new Error("Host bridge is not available outside iframe or app runtime");
				return t;
			}
			loadAppMessage() {
				var e = this;
				return s(function* () {
					return e.callAppMethod("getAppMessage");
				})();
			}
			initMobileAppApi(e) {
				var t = this;
				return s(function* () {
					t.flutterInAppWebView = e;
					try {
						const e = yield t.loadAppMessage();
						t.appApiVersion = null == e ? void 0 : e.appApi;
					} catch (r) {
						n.log("Failed to load mobile appApi version:", r), t.appApiVersion = void 0;
					}
				})();
			}
			assertMobileAppApi(e) {
				let t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "v1.0";
				if (!this.isAtLeastVersion(this.appApiVersion, t)) throw new Error(`${e} requires appApi >= ${t}`);
			}
			isAtLeastVersion(e, t) {
				if (!e) return !1;
				const r = this.parseVersion(e), n = this.parseVersion(t), i = Math.max(r.length, n.length);
				for (let l = 0; l < i; l += 1) {
					var o, s;
					const e = null !== (o = r[l]) && void 0 !== o ? o : 0, t = null !== (s = n[l]) && void 0 !== s ? s : 0;
					if (e > t) return !0;
					if (e < t) return !1;
				}
				return !0;
			}
			parseVersion(e) {
				return e.replace(/^v/i, "").split(".").map((e) => Number.parseInt(e, 10) || 0);
			}
			callAppMethod(e) {
				var t = arguments, r = this;
				return s(function* () {
					if (!r.flutterInAppWebView) return null;
					for (var n = t.length, i = new Array(n > 1 ? n - 1 : 0), o = 1; o < n; o++) i[o - 1] = t[o];
					return c(r.flutterInAppWebView, e, ...i);
				})();
			}
			ready() {
				var e = this;
				return s(function* () {
					return e.initPromise;
				})();
			}
			getOptions() {
				return this.options;
			}
			setOptions(e) {
				this.options = a(a({}, this.options), e), void 0 !== e.debug && n.setDebug(e.debug), n.log("Options updated:", this.options);
			}
			getPlatformConfig() {
				var e = this;
				return s(function* () {
					if (yield e.initPromise, e.isWeb) {
						const t = yield e.getWebMethods().getPlatformConfig();
						if (!t) throw new Error("Failed to get platform config");
						return t;
					}
					if (e.appApiVersion) {
						const t = yield e.callAppMethod("getPlatformConfig");
						if (!t) throw new Error("Failed to get platform config");
						return t;
					}
					const t = yield e.loadAppMessage();
					if (!t) throw new Error("Failed to get platform config");
					return e.appApiVersion = t.appApi, {
						theme: t.nightMode,
						language: t.language,
						appVersion: t.appVersion,
						systemVersion: t.systemVersion,
						format: {
							date: t.dateFormat,
							time: t.timeFormat
						}
					};
				})();
			}
			getHostSnapshot() {
				var e = this;
				return s(function* () {
					if (yield e.initPromise, !e.isWeb) throw new Error("getHostSnapshot is not supported on mobile platform");
					const t = yield e.getWebMethods().getHostSnapshot();
					if (!t) throw new Error("Failed to get host snapshot");
					return t;
				})();
			}
			getAppAuthBaseUrl() {
				var e = this;
				return s(function* () {
					if ("undefined" != typeof window && window.parent !== window) {
						const e = document.referrer;
						if (e) try {
							return new URL(e).origin;
						} catch (t) {
							n.log("Failed to derive app auth base url from document.referrer:", t);
						}
					}
					if ("undefined" != typeof window) return window.location.origin;
					if (yield e.initPromise, e.isWeb) try {
						const t = yield e.getHostSnapshot();
						if (t.host) return t.host;
					} catch (t) {
						n.log("Failed to derive app auth host snapshot:", t);
					}
					throw new Error("Failed to derive app auth base url");
				})();
			}
			buildAppAuthUrl(e, t) {
				var r = this;
				return s(function* () {
					return function(e, t, r, n) {
						var i, o;
						const s = new URL(e, null !== (i = null != n ? n : null === (o = globalThis.location) || void 0 === o ? void 0 : o.origin) && void 0 !== i ? i : "http://localhost");
						if (s.pathname = function(e) {
							return `/app-auth/${e}`;
						}(Ce[t]), s.searchParams.set("appName", r.appName), r.redirectUri && s.searchParams.set("redirectUri", r.redirectUri), r.state && s.searchParams.set("state", r.state), "pickFile" === t || "pickUserFile" === t || "pickSharedFile" === t) {
							var a;
							const e = r;
							"pickSharedFile" !== t && e.directory && s.searchParams.set("directory", "true");
							const n = "pickSharedFile" !== t ? e.accept : void 0;
							null != n && n.length && s.searchParams.set("accept", n.join(",")), null !== (a = e.sidebarGroup) && void 0 !== a && a.length && s.searchParams.set("sidebarGroup", e.sidebarGroup.join(","));
						} else s.searchParams.set("path", r.path);
						return s.toString();
					}(yield r.getAppAuthBaseUrl(), e, t, window.location.origin);
				})();
			}
			openAppAuth(e, t, r) {
				var n = this;
				return s(function* () {
					const i = yield n.buildAppAuthUrl(e, t);
					return "_self" === (null == r ? void 0 : r.target) && "undefined" != typeof window ? (window.location.assign(i), i) : (yield n.openURL(i, null == r ? void 0 : r.target, null == r ? void 0 : r.features), i);
				})();
			}
			parseAppAuthCallback(e) {
				return function(e) {
					var t, r, n, i;
					const o = e instanceof URLSearchParams ? e : e instanceof URL ? e.searchParams : "string" == typeof e ? new URL(e, null !== (t = null === (r = globalThis.location) || void 0 === r ? void 0 : r.origin) && void 0 !== t ? t : "http://localhost").searchParams : new URLSearchParams(null !== (n = null === (i = globalThis.location) || void 0 === i ? void 0 : i.search) && void 0 !== n ? n : ""), s = o.get("method"), l = s && Object.prototype.hasOwnProperty.call(Ce, s) ? s : void 0, a = o.get("path");
					let u;
					if (a) try {
						const e = JSON.parse(a);
						Array.isArray(e) && e.every((e) => "string" == typeof e) && (u = e);
					} catch (p) {
						u = void 0;
					}
					return {
						status: o.get("status") || void 0,
						error: o.get("error") || void 0,
						method: l,
						appName: o.get("appName") || void 0,
						state: o.get("state") || void 0,
						path: u
					};
				}(e);
			}
			setTitle(e) {
				var t = this;
				return s(function* () {
					if (yield t.initPromise, n.log("Setting title:", e), document.title = e, t.isWeb) return t.getWebMethods().setTitle(e);
				})();
			}
			setExitPageTips(e) {
				var t = this;
				return s(function* () {
					return yield t.initPromise, t.isWeb ? t.getWebMethods().setExitPageTips(e) : t.callAppMethod("setExitPageTips", e ? JSON.stringify(e) : "");
				})();
			}
			openFile(e) {
				var t = this;
				return s(function* () {
					return yield t.initPromise, n.log("Opening file:", e), t.isWeb ? t.getWebMethods().openFile(e) : t.callAppMethod("openFile", e);
				})();
			}
			openFileManager(e) {
				var t = this;
				return s(function* () {
					if (yield t.initPromise, n.log("Opening file manager:", e), t.isWeb) {
						const r = t.getWebMethods();
						return (r.openFileManager || r.openFileManagerApp)(e);
					}
					return t.assertMobileAppApi("openFileManager"), t.callAppMethod("openFileManager", e);
				})();
			}
			showFileDetails(e, t) {
				var r = this;
				return s(function* () {
					return yield r.initPromise, r.isWeb ? r.getWebMethods().showFileDetails(e, t) : (r.assertMobileAppApi("showFileDetails"), r.callAppMethod("showFileDetails", JSON.stringify({
						paths: e,
						options: t
					})));
				})();
			}
			authorizeUserFile(e) {
				var t = this;
				return s(function* () {
					var r;
					return yield t.initPromise, t.isWeb ? t.getWebMethods().authorizeUserFile(e) : (t.assertMobileAppApi("authorizeUserFile"), null !== (r = yield t.callAppMethod("authorizeUserFile", JSON.stringify({ path: e }))) && void 0 !== r ? r : void 0);
				})();
			}
			authorizeSharedFile(e) {
				var t = this;
				return s(function* () {
					var r;
					return yield t.initPromise, t.isWeb ? t.getWebMethods().authorizeSharedFile(e) : (t.assertMobileAppApi("authorizeSharedFile"), null !== (r = yield t.callAppMethod("authorizeSharedFile", JSON.stringify({ path: e }))) && void 0 !== r ? r : void 0);
				})();
			}
			openAppSetting() {
				var e = this;
				return s(function* () {
					return yield e.initPromise, n.log("Opening app setting"), e.isWeb ? e.getWebMethods().openAppSetting() : (e.assertMobileAppApi("openAppSetting"), e.callAppMethod("openAppSetting"));
				})();
			}
			openApp(e) {
				var t = this;
				return s(function* () {
					return yield t.initPromise, n.log("Opening app:", e), t.isWeb ? t.getWebMethods().openApp(e) : !!i() && t.callAppMethod("openAppPage", e);
				})();
			}
			openCustomApp(e, t) {
				var r = this;
				return s(function* () {
					if (yield r.initPromise, n.log("Opening custom app:", e, t), r.isWeb) return r.getWebMethods().openCustomApp(e, t);
					throw new Error("openCustomApp is not supported on mobile platform");
				})();
			}
			openURL(e, t, r) {
				var i = this;
				return s(function* () {
					if (yield i.initPromise, n.log("Opening URL:", e, t, r), !i.isWeb) return i.callAppMethod("openSystemBrowser", e);
					if ("_self" === t) return void window.location.assign(e);
					if (!r) return void window.open(e, t, r);
					const o = window.open("", t, r);
					o && (o.location.href = e);
				})();
			}
			close() {
				var e = this;
				return s(function* () {
					return yield e.initPromise, e.isWeb ? e.getWebMethods().close() : e.callAppMethod("exitPage");
				})();
			}
			query(e, t) {
				var r = this;
				return s(function* () {
					if (yield r.initPromise, r.isWeb) {
						if (null == t ? void 0 : t.observable) return r.getWebMethods().createObservableQuery(e, t);
						const n = yield r.getWebMethods().query(e, t);
						if (!n) throw new Error("Failed to query");
						return n;
					}
					if (r.assertMobileAppApi("query"), null == t ? void 0 : t.observable) {
						if (!r.flutterInAppWebView) throw new Error("Failed to start observable query");
						return function(e, t, r) {
							return v(), new f((n) => {
								let i, o = !1;
								return c(e, "wsQuery", null == t ? void 0 : t.req, JSON.stringify(t), void 0 === r ? void 0 : JSON.stringify(r)).then((e) => {
									(null == e ? void 0 : e.reqId) ? (i = e.reqId, o || h.set(i, n)) : n.error(/* @__PURE__ */ new Error("Failed to start observable query"));
								}, (e) => {
									n.error(e);
								}), () => {
									o = !0, i && h.delete(i);
								};
							});
						}(r.flutterInAppWebView, e, t);
					}
					const n = yield r.callAppMethod("wsQuery", null == e ? void 0 : e.req, JSON.stringify(e), void 0 === t ? void 0 : JSON.stringify(t));
					if (!n) throw new Error("Failed to query");
					if ("succ" !== n.result) throw n;
					return n;
				})();
			}
			refreshToken() {
				var e = this;
				return s(function* () {
					if (yield e.initPromise, !e.isWeb) throw new Error("refreshToken is not supported on mobile platform");
					return e.getWebMethods().refreshToken();
				})();
			}
			$on(e, t) {
				var r = this;
				return s(function* () {
					if (yield r.initPromise, !r.isWeb) throw new Error("$on is not supported on mobile platform");
					const n = r.getWebMethods().bus;
					if (!n) throw new Error("bus is not available");
					n.$on(e, t);
				})();
			}
			$off(e, t) {
				var r = this;
				return s(function* () {
					if (yield r.initPromise, !r.isWeb) throw new Error("$off is not supported on mobile platform");
					const n = r.getWebMethods().bus;
					if (!n) throw new Error("bus is not available");
					n.$off(e, t);
				})();
			}
			$once(e, t) {
				var r = this;
				return s(function* () {
					if (yield r.initPromise, !r.isWeb) throw new Error("$once is not supported on mobile platform");
					const n = r.getWebMethods().bus;
					if (!n) throw new Error("bus is not available");
					n.$once(e, t);
				})();
			}
			pickFile(e) {
				var t = this;
				return s(function* () {
					var r, n;
					return yield t.initPromise, t.isWeb ? null === (r = t.osConnector) || void 0 === r ? void 0 : r.methods.pickFile(e) : t.isAtLeastVersion(t.appApiVersion, "v1.0") ? null !== (n = yield t.callAppMethod("pickFile", JSON.stringify(e))) && void 0 !== n ? n : void 0 : t.flutterInAppWebView ? function(e, t) {
						return y.apply(this, arguments);
					}(t.flutterInAppWebView, e) : void 0;
				})();
			}
			pickUserFile() {
				var e = arguments, t = this;
				return s(function* () {
					var r;
					let n = e.length > 0 && void 0 !== e[0] ? e[0] : {};
					return yield t.initPromise, t.isWeb ? t.getWebMethods().pickUserFile(n) : (t.assertMobileAppApi("pickUserFile"), null !== (r = yield t.callAppMethod("pickUserFile", JSON.stringify(n))) && void 0 !== r ? r : void 0);
				})();
			}
			pickSharedFile() {
				var e = arguments, t = this;
				return s(function* () {
					var r;
					let n = e.length > 0 && void 0 !== e[0] ? e[0] : {};
					return yield t.initPromise, t.isWeb ? t.getWebMethods().pickSharedFile(n) : (t.assertMobileAppApi("pickSharedFile"), null !== (r = yield t.callAppMethod("pickSharedFile", JSON.stringify(n))) && void 0 !== r ? r : void 0);
				})();
			}
		};
		//#endregion
		//#region src/client/sdk.ts
		/** Shared access to the fnOS SDK bundled into the plugin client. */
		function createTrimApp() {
			return new Ve();
		}
		//#endregion
		//#region src/authorized-directories-contract.ts
		/** Same-origin route that lists the directories currently authorized for the app. */
		const FNOS_AUTHORIZED_DIRECTORIES_PATH = "/plugins/dsh-fnos/authorized-directories";
		/** Same-origin route that removes one application directory ACL. */
		const FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH = "/plugins/dsh-fnos/authorized-directories/delete";
		/** Same-origin route that converts internal fnOS paths to readable paths. */
		const FNOS_PATH_CONVERSION_PATH = "/plugins/dsh-fnos/paths/convert";
		//#endregion
		//#region src/client/authorized-directories-client.ts
		/** Browser-side API helpers for the fnOS authorized-directory route. */
		var DirectoryRequestError = class extends Error {
			code;
			constructor(code, message = code) {
				super(message);
				this.code = code;
				this.name = "DirectoryRequestError";
			}
		};
		function requestHeaders() {
			const headers = { accept: "application/json" };
			if (typeof navigator === "object" && typeof navigator.language === "string" && navigator.language.length > 0) headers["accept-language"] = navigator.language;
			return headers;
		}
		/** De-duplicate paths while keeping the Host response order. */
		function directoriesFromResponse(value) {
			const entries = Array.isArray(value.directories) ? value.directories : Array.isArray(value.paths) ? value.paths : [];
			const seen = /* @__PURE__ */ new Set();
			return entries.flatMap((entry) => {
				if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
					const path = typeof entry.path === "string" ? entry.path : "";
					const semanticPath = typeof entry.semanticPath === "string" ? entry.semanticPath : path;
					const removable = entry.removable !== false;
					if (path.length === 0 || semanticPath.length === 0 || seen.has(path)) return [];
					seen.add(path);
					return [{
						path,
						semanticPath,
						removable
					}];
				}
				if (typeof entry !== "string" || entry.length === 0 || seen.has(entry)) return [];
				seen.add(entry);
				return [{
					path: entry,
					semanticPath: entry,
					removable: true
				}];
			});
		}
		async function requestAuthorizedDirectories() {
			const response = await fetch(FNOS_AUTHORIZED_DIRECTORIES_PATH, {
				headers: requestHeaders(),
				credentials: "same-origin"
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) throw new DirectoryRequestError(typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
			if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
			return directoriesFromResponse(value);
		}
		function readablePathsFromResponse(value) {
			if (!Array.isArray(value.paths)) return [];
			const seen = /* @__PURE__ */ new Set();
			return value.paths.flatMap((entry) => {
				if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
				const path = typeof entry.path === "string" ? entry.path : "";
				const semanticPath = typeof entry.semanticPath === "string" ? entry.semanticPath : path;
				if (path.length === 0 || semanticPath.length === 0 || seen.has(path)) return [];
				seen.add(path);
				return [{
					path,
					semanticPath
				}];
			});
		}
		async function requestReadablePaths(paths) {
			const response = await fetch(FNOS_PATH_CONVERSION_PATH, {
				method: "POST",
				headers: {
					...requestHeaders(),
					"content-type": "application/json"
				},
				credentials: "same-origin",
				body: JSON.stringify({ paths })
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) throw new DirectoryRequestError(typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
			if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
			return readablePathsFromResponse(value);
		}
		//#endregion
		//#region src/client/AuthorizedDirectoriesCard.tsx
		/** Settings card for the fnOS shared-directory authorization list. */
		const cardStyle = {
			overflow: "hidden",
			listStyle: "none",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-3)",
			transition: "border-color 160ms ease, background 160ms ease"
		};
		const cardOpenStyle = {
			background: "var(--dsw-alias-bg-layer-2)",
			borderColor: "var(--dsw-alias-label-dimmed)"
		};
		const headerStyle = {
			boxSizing: "border-box",
			width: "100%",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			border: 0,
			padding: "14px 16px",
			borderRadius: 12,
			background: "none",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		const headTextStyle = {
			display: "flex",
			minWidth: 0,
			flexDirection: "column",
			gap: 4
		};
		const nameStyle = {
			fontSize: 15,
			lineHeight: "1.4",
			fontWeight: 600
		};
		const descriptionStyle = {
			fontSize: 13,
			lineHeight: "1.5",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const bodyStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle = {
			...bodyStyle,
			color: "var(--dsw-alias-state-error-primary, #d92d20)"
		};
		const cardBodyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			margin: "0 16px",
			padding: "12px 0 8px"
		};
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: 12
		};
		const buttonStyle = {
			boxSizing: "border-box",
			minHeight: 30,
			padding: "4px 12px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 16,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			...buttonStyle,
			border: 0,
			background: "var(--dsw-alias-label-primary)",
			color: "var(--dsw-alias-bg-layer-3)"
		};
		const pathListStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 8,
			margin: 0,
			padding: 0,
			listStyle: "none"
		};
		const pathRowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			padding: "10px 12px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 9,
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const pathStyle = {
			minWidth: 0,
			overflow: "hidden",
			color: "var(--dsw-alias-label-primary)",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: 13,
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		const readOnlyStyle = {
			flex: "0 0 auto",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			whiteSpace: "nowrap"
		};
		const dangerButtonStyle = {
			...buttonStyle,
			minHeight: 28,
			padding: "3px 9px",
			color: "var(--dsw-alias-state-error-primary, #d92d20)",
			flex: "0 0 auto"
		};
		function Chevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				style: {
					color: "var(--dsw-alias-label-tertiary)",
					transform: open ? "rotate(180deg)" : "none",
					transition: "transform 160ms ease"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					width: "14",
					height: "14",
					viewBox: "0 0 14 14",
					fill: "none",
					xmlns: "http://www.w3.org/2000/svg",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M2.15 5.5 3 4.65l3.73 3.73a.38.38 0 0 0 .54 0L11 4.65l.85.85-2.73 2.73c-.58.58-.9.9-1.4 1.03a2.1 2.1 0 0 1-.94 0c-.5-.13-.82-.45-1.4-1.03L2.15 5.5Z",
						fill: "currentColor"
					})
				})
			});
		}
		async function jsonRequest(path, method = "GET", body) {
			const headers = { accept: "application/json" };
			if (typeof navigator === "object" && typeof navigator.language === "string" && navigator.language.length > 0) headers["accept-language"] = navigator.language;
			if (body !== void 0) headers["content-type"] = "application/json";
			const response = await fetch(path, {
				method,
				headers,
				...body === void 0 ? {} : { body: JSON.stringify(body) },
				credentials: "same-origin"
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) throw new DirectoryRequestError(typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`);
			return value;
		}
		function errorMessage(error, t, action) {
			if (error instanceof DirectoryRequestError) {
				if (error.code === "fnos-authorized-directory-permission-denied") return t("permissionDenied");
				if (error.code === "remote-web-origin-not-trusted") return t("originNotTrusted");
				if (error.code === "fnos-authorized-directory-request-failed") return t("unavailable");
			}
			if (action === "pick") return t("pickFailed");
			if (action === "delete") return t("deleteFailed");
			return t("loadFailed");
		}
		/** Render the fnOS authorization card in the DSH Plugins settings tab. */
		function AuthorizedDirectoriesCard({ t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [state, setState] = (0, react.useState)({
				status: "idle",
				directories: []
			});
			const [busy, setBusy] = (0, react.useState)(false);
			const refresh = (0, react.useCallback)(async () => {
				setState((current) => ({
					status: "loading",
					directories: current.directories
				}));
				try {
					setState({
						status: "ready",
						directories: await requestAuthorizedDirectories()
					});
				} catch (error) {
					setState((current) => ({
						status: "error",
						directories: current.directories,
						code: errorMessage(error, t, "load")
					}));
				}
			}, [t]);
			(0, react.useEffect)(() => {
				if (open) refresh();
			}, [open, refresh]);
			const addDirectory = (0, react.useCallback)(async () => {
				setBusy(true);
				try {
					const result = await createTrimApp().pickSharedFile({
						title: t("add"),
						okText: t("confirm"),
						sidebarGroup: [
							"myFiles",
							"otherShare",
							"external",
							"remote",
							"favorites"
						]
					});
					if (isPickerCancellation(result)) return;
					if (result?.code !== void 0 && result.code !== 0) throw new DirectoryRequestError(result.code === 1 ? "fnos-authorized-directory-permission-denied" : "fnos-authorized-directory-request-failed", result.msg);
					await refresh();
				} catch (error) {
					if (isPickerCancellation(error)) return;
					setState((current) => ({
						status: "error",
						directories: current.directories,
						code: errorMessage(error, t, "pick")
					}));
				} finally {
					setBusy(false);
				}
			}, [refresh, t]);
			const removeDirectory = (0, react.useCallback)(async (path) => {
				if (!window.confirm(t("deleteConfirm"))) return;
				setBusy(true);
				try {
					await jsonRequest(FNOS_AUTHORIZED_DIRECTORIES_DELETE_PATH, "POST", { path });
					await refresh();
				} catch (error) {
					setState((current) => ({
						status: "error",
						directories: current.directories,
						code: errorMessage(error, t, "delete")
					}));
				} finally {
					setBusy(false);
				}
			}, [refresh, t]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: open ? {
					...cardStyle,
					...cardOpenStyle
				} : cardStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-expanded": open,
					"aria-controls": "dsh-fnos-authorized-directories-body",
					style: headerStyle,
					onClick: () => setOpen((value) => !value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: headTextStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: nameStyle,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: descriptionStyle,
							children: t("intro")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					id: "dsh-fnos-authorized-directories-body",
					style: cardBodyStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primaryButtonStyle,
								disabled: busy || state.status === "loading",
								onClick: () => {
									addDirectory();
								},
								children: t("add")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle,
								disabled: busy || state.status === "loading",
								onClick: () => {
									refresh();
								},
								children: t("refresh")
							})]
						}),
						state.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: bodyStyle,
							children: t("loading")
						}) : null,
						state.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							children: state.code ?? t("loadFailed")
						}) : null,
						state.status !== "loading" && state.directories.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: bodyStyle,
							children: t("empty")
						}) : null,
						state.directories.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							style: pathListStyle,
							children: state.directories.map((directory) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								style: pathRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									title: directory.semanticPath,
									style: pathStyle,
									children: directory.semanticPath
								}), directory.removable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: dangerButtonStyle,
									disabled: busy,
									onClick: () => {
										removeDirectory(directory.path);
									},
									children: busy ? t("deleting") : t("delete")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: readOnlyStyle,
									children: t("sharedDirectory")
								})]
							}, directory.path))
						}) : null
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/FnosLogo.tsx
		/** Compact colour mark used by fnOS actions inside DSH. */
		function FnosColorLogo() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				"aria-hidden": "true",
				width: "17",
				height: "17",
				viewBox: "0 0 17 17",
				fill: "none",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1",
						y: "1",
						width: "6.5",
						height: "6.5",
						rx: "1.8",
						fill: "#4F83FF"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "9.5",
						y: "1",
						width: "6.5",
						height: "6.5",
						rx: "1.8",
						fill: "#23C4A3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1",
						y: "9.5",
						width: "6.5",
						height: "6.5",
						rx: "1.8",
						fill: "#FFB344"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "9.5",
						y: "9.5",
						width: "6.5",
						height: "6.5",
						rx: "1.8",
						fill: "#F06483"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M5.2 5.05h6.6v1.55H9.88v5.35H8.12V6.6H5.2V5.05Z",
						fill: "white"
					})
				]
			});
		}
		//#endregion
		//#region src/client/input-references.ts
		/** fnOS file/directory references carried by DSH's native input machine. */
		const FNOS_REFERENCE_SOURCE = "fnos-file";
		/** Keep only absolute, NUL-free paths that can be passed to the Host route. */
		function normalizeFnosPath(value) {
			if (typeof value !== "string") return void 0;
			const path = value.trim();
			if (path.length === 0 || !path.startsWith("/") || path.includes("\0")) return void 0;
			if (path === "/") return path;
			return path.replace(/\/+$/u, "");
		}
		/** Serialize an internal NAS path as a harmless file URL for clipboard/model text. */
		function fileUrlForPath(value) {
			const encoded = (normalizeFnosPath(value) ?? value).split("/").map((segment) => encodeURIComponent(segment)).join("/");
			return `file://${encoded.startsWith("/") ? encoded : `/${encoded}`}`;
		}
		function fnosReferenceId(kind, path) {
			return `${kind}:${encodeURIComponent(path)}`;
		}
		function createFnosInputReference(kind, pathValue, semanticPathValue) {
			const path = normalizeFnosPath(pathValue);
			if (path === void 0) return void 0;
			const semanticPath = typeof semanticPathValue === "string" && semanticPathValue.trim().length > 0 ? semanticPathValue.trim() : path;
			const clipboardText = fileUrlForPath(path);
			return {
				kind,
				path,
				semanticPath,
				ref: fnosReferenceId(kind, path),
				clipboardText
			};
		}
		/** Decode only references produced by this plugin. */
		function decodeFnosReference(ref) {
			const separator = ref.indexOf(":");
			if (separator <= 0) return void 0;
			const kind = ref.slice(0, separator);
			if (kind !== "file" && kind !== "directory") return void 0;
			let path;
			try {
				path = decodeURIComponent(ref.slice(separator + 1));
			} catch {
				return;
			}
			const normalized = normalizeFnosPath(path);
			return normalized === void 0 ? void 0 : {
				kind,
				path: normalized
			};
		}
		/** De-duplicate picker output by normalized internal path, keeping first-seen order. */
		function uniqueFnosInputReferences(values) {
			const seen = /* @__PURE__ */ new Set();
			return values.flatMap((value) => {
				if (value === void 0 || seen.has(value.path)) return [];
				seen.add(value.path);
				return [value];
			});
		}
		//#endregion
		//#region src/client/FnosInputPickerButton.tsx
		/** fnOS picker affordance mounted in DSH's conversation input toolbar. */
		function pickerPaths$1(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
			const data = value.data;
			return Array.isArray(data) ? data.filter((entry) => typeof entry === "string") : [];
		}
		function isSuccessfulResponse(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const code = value.code;
			return code === void 0 || code === 0 || code === "0";
		}
		function responseMessage(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
			const message = value.msg ?? value.message;
			return typeof message === "string" && message.length > 0 ? message : void 0;
		}
		function FnosPickerOption({ kind, label, onClick, disabled }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "menuitem",
				disabled,
				onMouseDown: (event) => event.preventDefault(),
				onClick,
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					width: "100%",
					padding: "8px 10px",
					border: 0,
					borderRadius: 8,
					background: "transparent",
					color: "var(--dsw-alias-label-primary)",
					font: "inherit",
					textAlign: "left",
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? .45 : 1
				},
				children: [kind === "directory" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 16 }), label]
			});
		}
		function FnosInputPickerButton({ input, insertReferences, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)();
			const disabled = input.phase === "adjudicating" || input.phase === "submitting";
			const choose = async (kind) => {
				setBusy(true);
				setError(void 0);
				try {
					const sdk = createTrimApp();
					await sdk.ready();
					if (sdk.isStandaloneWeb) {
						setError(t("inputPickerUnavailable"));
						return;
					}
					const result = await sdk.pickUserFile({
						directory: kind === "directory",
						multiple: kind === "file"
					});
					if (isPickerCancellation(result)) {
						setOpen(false);
						return;
					}
					if (!isSuccessfulResponse(result)) {
						setError(responseMessage(result) ?? t("inputPickerFailed"));
						return;
					}
					const paths = pickerPaths$1(result);
					if (paths.length === 0) return;
					let readable = [];
					try {
						readable = await requestReadablePaths(paths);
					} catch (conversionError) {
						console.debug("[dsh-fnos] selected path conversion unavailable", conversionError);
					}
					const byPath = new Map(readable.map((entry) => [entry.path, entry.semanticPath]));
					const references = uniqueFnosInputReferences(paths.map((path) => createFnosInputReference(kind, path, byPath.get(path) ?? path)));
					if (references.length > 0 && insertReferences({
						draft: input.draft,
						draftRev: input.draftRev
					}, references)) setOpen(kind === "directory");
					else setError(t("inputPickerFailed"));
				} catch (pickerError) {
					if (!isPickerCancellation(pickerError)) setError(t("inputPickerFailed"));
					else setOpen(false);
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					position: "relative",
					display: "inline-flex"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": t("inputPicker"),
					"aria-expanded": open,
					disabled: disabled || busy,
					title: t("inputPicker"),
					onMouseDown: (event) => event.preventDefault(),
					onClick: () => {
						setError(void 0);
						setOpen((value) => !value);
					},
					style: {
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						width: 30,
						height: 30,
						padding: 0,
						border: 0,
						borderRadius: 8,
						background: "var(--dsw-alias-button-tool-bar-fill)",
						cursor: disabled || busy ? "not-allowed" : "pointer",
						opacity: disabled || busy ? .45 : 1
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FnosColorLogo, {})
				}), open && !disabled && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "menu",
					"aria-label": t("inputPicker"),
					style: {
						position: "absolute",
						right: 0,
						bottom: "calc(100% + 8px)",
						zIndex: 20,
						minWidth: 150,
						padding: 5,
						border: "1px solid var(--dsw-alias-border-l2)",
						borderRadius: 10,
						background: "var(--dsw-alias-surface-l1)",
						boxShadow: "var(--dsw-alias-shadow-l2)"
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FnosPickerOption, {
							kind: "file",
							label: t("selectFile"),
							disabled: busy,
							onClick: () => {
								choose("file");
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FnosPickerOption, {
							kind: "directory",
							label: t("selectDirectory"),
							disabled: busy,
							onClick: () => {
								choose("directory");
							}
						}),
						error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "alert",
							style: {
								padding: "6px 10px",
								color: "var(--dsw-alias-label-danger)",
								fontSize: 12,
								lineHeight: 1.4
							},
							children: error
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/FnosInputReferencesDock.tsx
		/** Collapsible native DSH reference chips for selected fnOS files/directories. */
		function FnosInputReferencesDock({ input, inputActions, t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const occurrences = input.occurrences.filter((occurrence) => occurrence.source === FNOS_REFERENCE_SOURCE);
			if (occurrences.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				"aria-label": t("selectedReferences"),
				onMouseEnter: () => setExpanded(true),
				onMouseLeave: () => setExpanded(false),
				onFocus: () => setExpanded(true),
				onBlur: (event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
				},
				style: {
					display: "flex",
					alignItems: "center",
					gap: expanded ? 6 : 0,
					maxWidth: "100%",
					maxHeight: expanded ? 40 : 28,
					overflowX: expanded ? "auto" : "hidden",
					overflowY: "hidden",
					padding: expanded ? "3px 2px" : "2px 0",
					whiteSpace: "nowrap",
					transition: "max-height 120ms ease, gap 120ms ease"
				},
				children: occurrences.map((occurrence, index) => {
					const isDirectory = decodeFnosReference(occurrence.ref)?.kind === "directory";
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						title: occurrence.label,
						style: {
							display: "inline-flex",
							alignItems: "center",
							flex: "0 0 auto",
							gap: 5,
							maxWidth: expanded ? 320 : 210,
							minHeight: 24,
							padding: "2px 5px 2px 7px",
							marginLeft: expanded || index === 0 ? 0 : -5,
							border: "1px solid var(--dsw-alias-border-l2)",
							borderRadius: 7,
							background: "var(--dsw-alias-interactive-bg-hover)",
							color: "var(--dsw-alias-label-secondary)",
							fontSize: 12,
							lineHeight: "18px"
						},
						children: [
							isDirectory ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutline16, { size: 14 }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									overflow: "hidden",
									textOverflow: "ellipsis"
								},
								children: occurrence.label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-label": `${t("removeReference")}: ${occurrence.label}`,
								title: t("removeReference"),
								onMouseDown: (event) => event.preventDefault(),
								onClick: () => {
									inputActions.setDraft(input.draft.slice(0, occurrence.offset) + input.draft.slice(occurrence.offset + 1));
								},
								style: {
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									width: 18,
									height: 18,
									padding: 0,
									border: 0,
									borderRadius: 5,
									background: "transparent",
									color: "var(--dsw-alias-label-tertiary)",
									cursor: "pointer",
									fontSize: 15,
									lineHeight: 1
								},
								children: "×"
							})
						]
					}, occurrence.occurrenceId);
				})
			});
		}
		//#endregion
		//#region src/client/FnosWorkspaceDirectoryFlow.tsx
		/** fnOS-aware directory flow rendered inside DSH's native workspace picker. */
		function pickerPaths(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
			const data = value.data;
			return Array.isArray(data) ? data.filter((entry) => typeof entry === "string" && entry.length > 0) : [];
		}
		function pickerSucceeded(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const code = value.code;
			return code === void 0 || code === 0 || code === "0";
		}
		function pickerMessage(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
			const record = value;
			const message = record.msg ?? record.message;
			return typeof message === "string" && message.length > 0 ? message : void 0;
		}
		function errorText(error, t) {
			if (error instanceof DirectoryRequestError) {
				if (error.code === "fnos-authorized-directory-permission-denied") return t("permissionDenied");
				if (error.code === "remote-web-origin-not-trusted") return t("originNotTrusted");
			}
			return t("workspaceLoadFailed");
		}
		function WorkspaceDirectoryRow({ directory, disabled, onPick }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				disabled,
				title: directory.semanticPath,
				onMouseDown: (event) => event.preventDefault(),
				onClick: () => {
					onPick(directory.path);
				},
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10,
					width: "100%",
					minWidth: 0,
					padding: "10px 12px",
					border: "1px solid var(--dsw-alias-border-l2)",
					borderRadius: 10,
					background: "var(--dsw-alias-bg-layer-1)",
					color: "var(--dsw-alias-label-primary)",
					font: "inherit",
					textAlign: "left",
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? .45 : 1,
					transition: "background 150ms ease, border-color 150ms ease, transform 100ms ease"
				},
				onMouseEnter: (event) => {
					if (disabled) return;
					event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover)";
					event.currentTarget.style.borderColor = "var(--dsw-alias-brand-primary)";
				},
				onMouseLeave: (event) => {
					event.currentTarget.style.background = "var(--dsw-alias-bg-layer-1)";
					event.currentTarget.style.borderColor = "var(--dsw-alias-border-l2)";
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						display: "inline-flex",
						flex: "0 0 auto",
						color: "var(--dsw-alias-label-secondary)"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpen16, { size: 16 })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						minWidth: 0,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap"
					},
					children: directory.semanticPath
				})]
			});
		}
		/**
		* Occupy DSH's directory-flow child slot. The parent workspace picker keeps
		* ownership of adoption, closing and error recovery; this component only
		* supplies fnOS-authorized path choices.
		*/
		function FnosWorkspaceDirectoryFlow({ open, busy, onPicked, onCancel, t }) {
			const [state, setState] = (0, react.useState)({
				status: "idle",
				directories: []
			});
			const [query, setQuery] = (0, react.useState)("");
			const [pickerBusy, setPickerBusy] = (0, react.useState)(false);
			const settled = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (!open) {
					settled.current = false;
					return;
				}
				let cancelled = false;
				settled.current = false;
				setQuery("");
				setState((current) => ({
					status: "loading",
					directories: current.directories
				}));
				requestAuthorizedDirectories().then((directories) => {
					if (!cancelled) setState({
						status: "ready",
						directories
					});
				}, (error) => {
					if (!cancelled) setState((current) => ({
						status: "error",
						directories: current.directories,
						message: errorText(error, t)
					}));
				});
				return () => {
					cancelled = true;
				};
			}, [open, t]);
			const visibleDirectories = (0, react.useMemo)(() => {
				const normalized = query.trim().toLocaleLowerCase();
				if (normalized.length === 0) return state.directories;
				return state.directories.filter((directory) => directory.semanticPath.toLocaleLowerCase().includes(normalized) || directory.path.toLocaleLowerCase().includes(normalized));
			}, [query, state.directories]);
			const pickPath = (path) => {
				if (busy || pickerBusy || settled.current) return;
				settled.current = true;
				onPicked(path);
			};
			const chooseAnotherDirectory = async () => {
				if (busy || pickerBusy || settled.current) return;
				setPickerBusy(true);
				setState((current) => current.status === "error" ? current : {
					status: current.status,
					directories: current.directories
				});
				try {
					const sdk = createTrimApp();
					await sdk.ready();
					if (sdk.isStandaloneWeb) {
						setState((current) => ({
							status: "error",
							directories: current.directories,
							message: t("workspacePickerUnavailable")
						}));
						return;
					}
					const result = await sdk.pickUserFile({
						directory: true,
						multiple: false,
						title: t("workspaceOther"),
						okText: t("workspaceSelect")
					});
					if (isPickerCancellation(result)) return;
					if (!pickerSucceeded(result)) {
						setState((current) => ({
							status: "error",
							directories: current.directories,
							message: pickerMessage(result) ?? t("workspacePickerFailed")
						}));
						return;
					}
					const path = pickerPaths(result)[0];
					if (path !== void 0) pickPath(path);
				} catch (error) {
					if (!isPickerCancellation(error)) setState((current) => ({
						status: "error",
						directories: current.directories,
						message: t("workspacePickerFailed")
					}));
				} finally {
					setPickerBusy(false);
				}
			};
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open,
				onClose: () => {
					if (!busy && !pickerBusy) onCancel();
				},
				title: t("workspaceTitle"),
				description: t("workspaceDescription"),
				closeLabel: t("cancel"),
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FnosColorLogo, {}),
					disabled: busy || pickerBusy,
					onClick: () => {
						chooseAnotherDirectory();
					},
					children: t("workspaceOther")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					disabled: busy || pickerBusy,
					onClick: onCancel,
					children: t("cancel")
				})] }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 10,
						minWidth: 0
					},
					children: [
						state.directories.length > 10 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							value: query,
							"aria-label": t("workspaceSearch"),
							placeholder: t("workspaceSearchPlaceholder"),
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, { size: 16 }),
							disabled: busy || pickerBusy,
							onChange: (event) => {
								setQuery(event.target.value);
							},
							style: {
								width: "100%",
								boxSizing: "border-box"
							}
						}),
						state.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							style: {
								margin: 0,
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("workspaceLoading")
						}),
						state.status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							style: {
								margin: 0,
								color: "var(--dsw-alias-state-error-primary, #d92d20)"
							},
							children: state.message
						}),
						state.status !== "loading" && state.directories.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								margin: 0,
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("workspaceEmpty")
						}),
						state.directories.length > 0 && visibleDirectories.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: {
								margin: 0,
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("workspaceNoMatch")
						}),
						visibleDirectories.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 8,
								maxHeight: 300,
								overflowY: "auto",
								padding: 1
							},
							children: visibleDirectories.map((directory) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceDirectoryRow, {
								directory,
								disabled: busy || pickerBusy,
								onPick: pickPath
							}, directory.path))
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/input-reference-actions.ts
		function insertText(ctx, sessionId, text, span) {
			const actx = ctx.sessions.scope(sessionId);
			if (actx === void 0) return false;
			return actx.bail(actx, "slash/input-insert-text", {
				text,
				span
			}) === true;
		}
		function insertReference(ctx, sessionId, reference, span) {
			const actx = ctx.sessions.scope(sessionId);
			if (actx === void 0) return false;
			const value = {
				source: FNOS_REFERENCE_SOURCE,
				ref: reference.ref,
				label: reference.semanticPath,
				clipboardText: reference.clipboardText
			};
			return actx.bail(actx, "slash/input-insert-reference", {
				reference: value,
				span
			}) === true;
		}
		/** Append selected references while preserving DSH's native chip/serializer path. */
		function insertFnosReferences(ctx, sessionId, references, input) {
			if (references.length === 0) return false;
			let offset = input.draft.length;
			let draftRev = input.draftRev;
			let inserted = false;
			const appendText = (text) => {
				if (!insertText(ctx, sessionId, text, {
					start: offset,
					end: offset,
					draftRev
				})) return false;
				offset += text.length;
				draftRev += 1;
				return true;
			};
			for (const [index, reference] of references.entries()) {
				if (index === 0 ? offset > 0 && !/\s/u.test(input.draft.at(-1) ?? "") : true) {
					if (!appendText(" ")) return inserted;
				}
				if (index > 0 && !appendText(" ")) return inserted;
				if (!insertReference(ctx, sessionId, reference, {
					start: offset,
					end: offset,
					draftRev
				})) return inserted;
				offset += 1;
				draftRev += 1;
				inserted = true;
			}
			return inserted;
		}
		//#endregion
		//#region src/client/locales.ts
		/** Browser copy for the fnOS settings card. */
		const en = {
			title: "fnos",
			intro: "Manage the NAS directories that DeepSeek Harness can access.",
			expand: "Expand authorized directories",
			collapse: "Collapse authorized directories",
			refresh: "Refresh",
			add: "Add authorized directory",
			confirm: "Confirm authorization",
			cancel: "Cancel",
			loading: "Loading authorized directories…",
			empty: "No NAS directories have been authorized for this app.",
			delete: "Remove authorization",
			deleting: "Removing…",
			deleteConfirm: "Only the app access permission will be removed. Files and directories will not be deleted. Continue?",
			deleteFailed: "Unable to remove this directory authorization.",
			loadFailed: "Unable to load authorized directories.",
			pickFailed: "Unable to open the fnOS directory picker.",
			permissionDenied: "Unable to complete this authorized-directory operation.",
			sharedDirectory: "App shared directory",
			originNotTrusted: "This browser origin is not trusted by the DSH Web server.",
			unavailable: "The fnOS authorization API is unavailable in this environment.",
			authorizedDirectories: "Authorized directories",
			inputPicker: "Insert NAS file or directory",
			selectFile: "Select file",
			selectDirectory: "Select directory",
			inputPickerUnavailable: "The fnOS picker is available only inside the NAS app.",
			inputPickerFailed: "Unable to select or insert this NAS path.",
			selectedReferences: "Selected NAS paths",
			removeReference: "Remove reference",
			workspaceTitle: "Select workspace directory",
			workspaceDescription: "Choose an authorized NAS directory to open in the original DSH workspace flow.",
			workspaceSearch: "Search authorized directories",
			workspaceSearchPlaceholder: "Search by readable path",
			workspaceLoading: "Loading authorized directories…",
			workspaceEmpty: "No authorized directories are available.",
			workspaceNoMatch: "No matching authorized directories.",
			workspaceLoadFailed: "Unable to load authorized directories.",
			workspaceOther: "Choose another directory",
			workspaceSelect: "Select directory",
			workspacePickerUnavailable: "The fnOS directory picker is available only inside the NAS app.",
			workspacePickerFailed: "Unable to choose another NAS directory."
		};
		const zh = {
			title: "fnos",
			intro: "管理 DeepSeek Harness 可以访问的 NAS 目录。",
			expand: "展开授权目录",
			collapse: "折叠授权目录",
			refresh: "刷新",
			add: "添加授权目录",
			confirm: "确认授权",
			cancel: "取消",
			loading: "正在加载授权目录…",
			empty: "当前应用尚未授权 NAS 目录。",
			delete: "取消授权",
			deleting: "正在取消…",
			deleteConfirm: "此操作只会移除应用访问权限，不会删除目录或文件。确定继续吗？",
			deleteFailed: "无法取消该目录的应用授权。",
			loadFailed: "无法加载授权目录。",
			pickFailed: "无法打开 fnOS 目录选择器。",
			permissionDenied: "当前无法完成授权目录操作。",
			sharedDirectory: "应用共享目录",
			originNotTrusted: "当前浏览器来源未被 DSH Web 服务信任。",
			unavailable: "当前环境无法使用 fnOS 授权接口。",
			authorizedDirectories: "授权目录",
			inputPicker: "插入 NAS 文件或目录",
			selectFile: "选择文件",
			selectDirectory: "选择目录",
			inputPickerUnavailable: "fnOS 选择器只能在 NAS 应用内使用。",
			inputPickerFailed: "无法选择或插入该 NAS 路径。",
			selectedReferences: "已选择的 NAS 路径",
			removeReference: "移除引用",
			workspaceTitle: "选择工作区目录",
			workspaceDescription: "选择已授权的 NAS 目录，继续使用 DSH 原生工作区流程打开。",
			workspaceSearch: "搜索授权目录",
			workspaceSearchPlaceholder: "按可读路径搜索",
			workspaceLoading: "正在加载授权目录…",
			workspaceEmpty: "当前没有可用的授权目录。",
			workspaceNoMatch: "没有匹配的授权目录。",
			workspaceLoadFailed: "无法加载授权目录。",
			workspaceOther: "选择其他目录",
			workspaceSelect: "选择目录",
			workspacePickerUnavailable: "fnOS 目录选择器只能在 NAS 应用内使用。",
			workspacePickerFailed: "无法选择其他 NAS 目录。"
		};
		//#endregion
		//#region src/client/theme-bridge.ts
		function normalizeTheme(value) {
			if (value === "dark" || value === "light") return value;
			if (Array.isArray(value)) return normalizeTheme(value[0]);
			if (!value || typeof value !== "object") return null;
			const config = value;
			return normalizeTheme(config.theme ?? config.nightMode ?? config.mode ?? config.value ?? config.detail ?? config.data);
		}
		function themeFromConfig(config) {
			return normalizeTheme(config);
		}
		/**
		* Create a bridge without changing the browser's native theme state during
		* module loading. DSH owns the first render; the plugin applies fnOS's theme
		* to the document only after the SDK connection has supplied its real state.
		*/
		function createThemeBridge() {
			const themeSubscribers = /* @__PURE__ */ new Set();
			let activeTheme = null;
			let connectionStarted = false;
			let connectionStop = null;
			let connectionGeneration = 0;
			function setTheme(...values) {
				const theme = values.map(normalizeTheme).find(Boolean) ?? null;
				if (theme === null || activeTheme === theme) return theme !== null;
				activeTheme = theme;
				for (const listener of [...themeSubscribers]) listener(activeTheme);
				return true;
			}
			async function connect() {
				if (connectionStarted) return connectionStop ?? (() => {});
				const generation = ++connectionGeneration;
				connectionStarted = true;
				try {
					const sdk = createTrimApp();
					await sdk.ready();
					if (!sdk.isWeb || sdk.isStandaloneWeb) {
						if (generation === connectionGeneration) connectionStarted = false;
						return () => {};
					}
					const config = await sdk.getPlatformConfig();
					if (generation !== connectionGeneration) return () => {};
					setTheme(themeFromConfig(config));
					const handleThemeEvent = (...values) => {
						if (generation === connectionGeneration) setTheme(...values);
					};
					await sdk.$on("os/theme", handleThemeEvent);
					if (generation !== connectionGeneration) {
						await sdk.$off("os/theme", handleThemeEvent);
						return () => {};
					}
					connectionStop = async () => {
						if (connectionStop === null) return;
						connectionStop = null;
						connectionStarted = false;
						connectionGeneration += 1;
						await sdk.$off("os/theme", handleThemeEvent);
					};
					return connectionStop;
				} catch (error) {
					if (generation === connectionGeneration) connectionStarted = false;
					console.debug("[dsh-fnos] fnOS theme bridge unavailable", error);
					return () => {};
				}
			}
			return {
				getTheme: () => activeTheme,
				subscribe(listener) {
					themeSubscribers.add(listener);
					return () => themeSubscribers.delete(listener);
				},
				connect,
				disconnect() {
					connectionGeneration += 1;
					if (connectionStop !== null) return connectionStop();
					connectionStarted = false;
					return Promise.resolve();
				}
			};
		}
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-fnos-plugin-client";
		const inject = [
			"theme",
			"slots",
			"locale",
			"sessions",
			"inputTriggers"
		];
		const DARK_ATTRIBUTE = "data-ds-dark-theme";
		/**
		* Keep DSH's saved preference unchanged. When it is set to "system", apply
		* the fnOS theme to the document after the SDK bridge has supplied the real
		* NAS state. For explicit light/dark preferences, DSH remains authoritative.
		*/
		function createThemeController(ctx, bridge) {
			let systemFallbackActive = false;
			let previousColorScheme;
			let previousDarkAttribute;
			const applySystemTheme = (theme) => {
				if (typeof document === "undefined") return;
				if (!systemFallbackActive) {
					previousColorScheme = document.documentElement.style.colorScheme;
					previousDarkAttribute = document.body?.hasAttribute(DARK_ATTRIBUTE);
				}
				const dark = theme === "dark";
				document.documentElement.style.colorScheme = dark ? "dark" : "light";
				document.body?.toggleAttribute(DARK_ATTRIBUTE, dark);
				systemFallbackActive = true;
			};
			const clearSystemTheme = () => {
				if (systemFallbackActive && typeof document !== "undefined") {
					if (previousColorScheme === "") document.documentElement.style.removeProperty("color-scheme");
					else if (previousColorScheme !== void 0) document.documentElement.style.colorScheme = previousColorScheme;
					if (previousDarkAttribute === true) document.body?.setAttribute(DARK_ATTRIBUTE, "");
					else if (previousDarkAttribute === false) document.body?.removeAttribute(DARK_ATTRIBUTE);
				}
				previousColorScheme = void 0;
				previousDarkAttribute = void 0;
				systemFallbackActive = false;
			};
			const refresh = () => {
				if (ctx.theme.getTheme().preference !== "system") {
					clearSystemTheme();
					return;
				}
				const fnosTheme = bridge.getTheme();
				if (fnosTheme === null) return;
				applySystemTheme(fnosTheme);
				queueMicrotask(() => {
					if (ctx.theme.getTheme().preference === "system" && bridge.getTheme() === fnosTheme) applySystemTheme(fnosTheme);
				});
			};
			return {
				refresh,
				dispose() {
					clearSystemTheme();
				}
			};
		}
		function apply(ctx) {
			const bridge = createThemeBridge();
			{
				const controller = createThemeController(ctx, bridge);
				ctx.effect(() => {
					const unsubscribe = bridge.subscribe(() => {
						controller.refresh();
					});
					const offThemeChange = ctx.on("theme/change", () => {
						controller.refresh();
					});
					controller.refresh();
					bridge.connect().catch((error) => {
						console.debug("[dsh-fnos] unable to connect to fnOS theme events", error);
					});
					return async () => {
						unsubscribe();
						offThemeChange();
						await bridge.disconnect();
						controller.dispose();
					};
				}, "dsh-fnos: fnOS theme bridge");
			}
			const namespace = "settings.dsh-fnos";
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "dsh-fnos: locale");
			const t = ctx.locale.bind(namespace);
			const source = {
				trigger: "@",
				name: FNOS_REFERENCE_SOURCE,
				candidates: async () => [],
				onPick: () => void 0,
				codec: {
					clipboardText: (ref) => {
						const decoded = decodeFnosReference(ref);
						return decoded === void 0 ? ref : fileUrlForPath(decoded.path);
					},
					serialize: async (ref) => {
						const decoded = decodeFnosReference(ref);
						return decoded === void 0 ? ref : fileUrlForPath(decoded.path);
					}
				}
			};
			const inputTriggers = ctx.get("inputTriggers");
			ctx.effect(() => {
				return inputTriggers.registerSource(source);
			}, "dsh-fnos: fnOS input reference source");
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: "dsh-fnos-authorized-directories",
				inject: () => ({ t })
			}, AuthorizedDirectoriesCard));
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "dsh-fnos-input-picker",
				order: 100,
				locale: namespace,
				inject: (sessionId) => ({ insertReferences: (input, references) => insertFnosReferences(ctx, sessionId, references, input) })
			}, FnosInputPickerButton));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "dsh-fnos-input-references",
				order: 100,
				locale: namespace
			}, FnosInputReferencesDock));
			ctx.slots.inject("conversation.hero.workspace.directoryFlow", () => ctx.slots.inject("sidebar.workspaces.directoryFlow", function* () {
				yield ctx.slots.register({
					name: "conversation.hero.workspace.directoryFlow",
					locale: namespace
				}, FnosWorkspaceDirectoryFlow);
				yield ctx.slots.register({
					name: "sidebar.workspaces.directoryFlow",
					locale: namespace
				}, FnosWorkspaceDirectoryFlow);
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map