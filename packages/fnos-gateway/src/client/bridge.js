(function (config) {
  "use strict";
  var prefix = config.prefix || "";
  var customPaths = new Set(config.customPaths || []);
  function boundary(pathname, candidate) { return pathname === candidate || pathname.indexOf(candidate + "/") === 0; }
  function gatewayPath(pathname) {
    if (boundary(pathname, "/api") || boundary(pathname, "/plugins")) return true;
    for (var candidate of customPaths) if (boundary(pathname, candidate)) return true;
    return false;
  }
  function mapUrl(value) {
    var url;
    try { url = new URL(String(value), window.location.href); } catch (_) { return null; }
    var page = new URL(window.location.href);
    var sameWebSocketOrigin = (url.protocol === "ws:" || url.protocol === "wss:") && url.hostname === page.hostname && (url.port || (url.protocol === "wss:" ? "443" : "80")) === (page.port || (page.protocol === "https:" ? "443" : "80"));
    if ((url.origin !== window.location.origin && !sameWebSocketOrigin) || boundary(url.pathname, prefix) || !gatewayPath(url.pathname)) return null;
    url.pathname = prefix + url.pathname;
    return url;
  }

  var connectionId = "@deepseek-ai/dsh-client-connection";
  function wrapLoader(loader) {
    if (!loader || typeof loader.load !== "function" || loader.load.__fnosBridge) return loader;
    var load = loader.load;
    var bridged = function (handoff) {
      if (handoff && handoff.id === connectionId && typeof handoff.factory === "function") {
        var factory = handoff.factory;
        handoff = Object.assign({}, handoff, { factory: function (require) {
          var exports = factory(require);
          if (exports && typeof exports.apply === "function") {
            var apply = exports.apply;
            exports.apply = function (ctx, value) {
              var result = apply.call(this, ctx, value);
              try { var connection = ctx.get("connection", false); Object.defineProperty(connection, "isLoopback", { configurable: true, value: true }); } catch (_) {}
              return result;
            };
          }
          return exports;
        }});
      }
      return load.call(this, handoff);
    };
    Object.defineProperty(bridged, "__fnosBridge", { value: true });
    try { loader.load = bridged; } catch (_) {}
    return loader;
  }
  var moduleLoader;
  try { Object.defineProperty(window, "__ModuleLoader__", { configurable: true, get: function () { return moduleLoader; }, set: function (value) { moduleLoader = wrapLoader(value); } }); } catch (_) {}

  if (window.crypto && typeof window.crypto.randomUUID !== "function" && typeof window.crypto.getRandomValues === "function") {
    try { Object.defineProperty(window.crypto, "randomUUID", { configurable: true, value: function () {
      var bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      var hex = Array.from(bytes, function (byte) { return ("0" + byte.toString(16)).slice(-2); }).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    }}); } catch (_) {}
  }

  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var mapped;
    if (typeof Request !== "undefined" && input instanceof Request) { mapped = mapUrl(input.url); if (mapped) input = new Request(mapped, input); }
    else { mapped = mapUrl(input); if (mapped) input = mapped; }
    return nativeFetch(input, init);
  };
  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () { var args = Array.prototype.slice.call(arguments); var mapped = mapUrl(args[1]); if (mapped) args[1] = mapped.toString(); return nativeOpen.apply(this, args); };
  function scriptNode(node) { if (!node || node.nodeType !== 1 || node.tagName !== "SCRIPT") return; var mapped = mapUrl(node.getAttribute("src") || node.src); if (mapped) node.setAttribute("src", mapped.toString()); }
  var appendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) { scriptNode(node); return appendChild.call(this, node); };
  var append = Element.prototype.append;
  if (append) Element.prototype.append = function () { for (var node of arguments) scriptNode(node); return append.apply(this, arguments); };
  var insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, reference) { scriptNode(node); return insertBefore.call(this, node, reference); };
  if (window.EventSource) window.EventSource = new Proxy(window.EventSource, { construct: function (target, args, receiver) { var mapped = mapUrl(args[0]); if (mapped) args[0] = mapped.toString(); return Reflect.construct(target, args, receiver); } });
  if (window.WebSocket) window.WebSocket = new Proxy(window.WebSocket, { construct: function (target, args, receiver) { var mapped = mapUrl(args[0]); if (mapped) { mapped.protocol = mapped.protocol === "https:" ? "wss:" : "ws:"; args[0] = mapped.toString(); } return Reflect.construct(target, args, receiver); } });

  try {
    var events = new EventSource(prefix + config.eventsPath);
    events.addEventListener("paths", function (event) { try { var value = JSON.parse(event.data); customPaths = new Set(Array.isArray(value.paths) ? value.paths : []); } catch (_) {} });
  } catch (_) {}
})(window.__FNOS_GATEWAY_CONFIG__);
