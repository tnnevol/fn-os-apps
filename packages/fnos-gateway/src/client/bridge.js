(function (config) {
  "use strict";
  var prefix = config.prefix || "";
  var customPaths = new Set(config.customPaths || []);
  function boundary(pathname, candidate) { return pathname === candidate || pathname.indexOf(candidate + "/") === 0; }
  function isImageResource(pathname) { return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(pathname); }
  function gatewayPath(pathname) {
    if (boundary(pathname, "/api") || boundary(pathname, "/plugins") || isImageResource(pathname)) return true;
    for (var candidate of customPaths) if (boundary(pathname, candidate)) return true;
    return false;
  }
  function mapUrl(value) {
    var url;
    try { url = new URL(String(value), window.location.href); } catch (_) { return null; }
    var page = new URL(window.location.href);
    var sameWebSocketOrigin = false;
    if (url.protocol === "ws:" || url.protocol === "wss:") {
      var urlPort = url.port || (url.protocol === "wss:" ? "443" : "80");
      var pagePort = page.port || (page.protocol === "https:" ? "443" : "80");
      // DSH derives its WebSocket URL by changing the page origin scheme.
      // When the page is HTTPS, that produces ws://host/... without an
      // explicit port even though the browser must connect through WSS.
      sameWebSocketOrigin = url.hostname === page.hostname
        && (urlPort === pagePort || (!url.port && !page.port));
    }
    var alreadyPrefixed = prefix !== "" && boundary(url.pathname, prefix);
    var gatewayCandidate = alreadyPrefixed ? (url.pathname.slice(prefix.length) || "/") : url.pathname;
    if ((url.origin !== window.location.origin && !sameWebSocketOrigin) || !gatewayPath(gatewayCandidate)) return null;
    if (!alreadyPrefixed) url.pathname = prefix + url.pathname;
    return url;
  }

  function mapCssUrls(value) {
    if (typeof value !== "string" || value.indexOf("url(") < 0) return value;
    return value.replace(/url\(\s*(["']?)(\/(?!\/)[^"')]+)\1\s*\)/gi, function (match, quote, path) {
      var mapped = mapUrl(path);
      return mapped ? "url(" + quote + mapped.toString() + quote + ")" : match;
    });
  }

  function isResourceAttribute(node, name) {
    var tag = String(node && node.tagName || "").toUpperCase();
    var attribute = String(name || "").toLowerCase();
    return (attribute === "src" && (tag === "IMG" || tag === "SCRIPT" || tag === "IFRAME" || tag === "AUDIO" || tag === "VIDEO" || tag === "SOURCE" || tag === "TRACK"))
      || (attribute === "href" && tag === "LINK")
      || (attribute === "poster" && tag === "VIDEO")
      || (attribute === "data" && tag === "OBJECT");
  }
  function mapResourceAttribute(node, name, value) {
    if (String(name || "").toLowerCase() === "style") return mapCssUrls(value);
    if (!isResourceAttribute(node, name)) return value;
    var mapped = mapUrl(value);
    return mapped ? mapped.toString() : value;
  }

  var connectionId = "@deepseek-ai/dsh-client-connection";
  function wrapLoader(loader) {
    if (!loader || typeof loader.load !== "function") return loader;
    var load = loader.load;
    if (load.__fnosBridge !== true) {
      var bridged = function (handoff) {
        if (handoff && handoff.id === connectionId && typeof handoff.factory === "function") {
          var factory = handoff.factory;
          handoff = Object.assign({}, handoff, { factory: function (require) {
            var exports = factory(require);
            if (exports && typeof exports.apply === "function") {
              var apply = exports.apply;
              exports.apply = function (ctx, value) {
                var result = apply.call(this, ctx, value);
                var connection;
                try {
                  connection = ctx.get("connection", false);
                  Object.defineProperty(connection, "isLoopback", {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: true
                  });
                } catch (_) {
                  if (connection) try { connection.isLoopback = true; } catch (_) {}
                }
                return result;
              };
            }
            return exports;
          }});
        }
        return load.call(this, handoff);
      };
      try { Object.defineProperty(bridged, "__fnosBridge", { value: true }); } catch (_) {}
      try { loader.load = bridged; } catch (_) {}
    }
    var create = loader.create;
    if (typeof create === "function" && create.__fnosBridge !== true) {
      var bridgedCreate = function () {
        var result = create.apply(this, arguments);
        // ClientModuleSystem replaces the facade load method when create()
        // switches from the pending queue to the live registry. Re-wrap that
        // method before immediate bundles are prefetched and registered.
        wrapLoader(this);
        return result;
      };
      try { Object.defineProperty(bridgedCreate, "__fnosBridge", { value: true }); } catch (_) {}
      try { loader.create = bridgedCreate; } catch (_) {}
    }
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
  var nativeSetAttribute = Element.prototype.setAttribute;
  if (nativeSetAttribute) Element.prototype.setAttribute = function (name, value) { return nativeSetAttribute.call(this, name, mapResourceAttribute(this, name, value)); };
  function patchCssStyleDeclaration() {
    var constructor = window.CSSStyleDeclaration;
    var prototype = constructor && constructor.prototype;
    if (!prototype) return;
    var setProperty = prototype.setProperty;
    if (typeof setProperty === "function" && setProperty.__fnosBridge !== true) {
      var bridgedSetProperty = function (name, value, priority) {
        return setProperty.call(this, name, mapCssUrls(value), priority);
      };
      try { Object.defineProperty(bridgedSetProperty, "__fnosBridge", { value: true }); } catch (_) {}
      try { prototype.setProperty = bridgedSetProperty; } catch (_) {}
    }
    var cssText = Object.getOwnPropertyDescriptor(prototype, "cssText");
    if (cssText && typeof cssText.set === "function" && cssText.set.__fnosBridge !== true) {
      var cssTextSetter = cssText.set;
      var bridgedCssTextSetter = function (value) { cssTextSetter.call(this, mapCssUrls(value)); };
      try { Object.defineProperty(bridgedCssTextSetter, "__fnosBridge", { value: true }); } catch (_) {}
      try { Object.defineProperty(prototype, "cssText", { configurable: cssText.configurable, enumerable: cssText.enumerable, get: cssText.get, set: bridgedCssTextSetter }); } catch (_) {}
    }
    for (var property of Object.getOwnPropertyNames(prototype)) {
      if (property === "constructor" || property === "cssText" || property === "setProperty") continue;
      var descriptor = Object.getOwnPropertyDescriptor(prototype, property);
      if (!descriptor || typeof descriptor.set !== "function" || descriptor.set.__fnosBridge === true) continue;
      const setter = descriptor.set;
      const bridgedSetter = function (value) { setter.call(this, mapCssUrls(value)); };
      try { Object.defineProperty(bridgedSetter, "__fnosBridge", { value: true }); } catch (_) {}
      try { Object.defineProperty(prototype, property, { configurable: descriptor.configurable, enumerable: descriptor.enumerable, get: descriptor.get, set: bridgedSetter }); } catch (_) {}
    }
  }
  patchCssStyleDeclaration();
  function patchResourceProperty(owner, property) {
    var constructor = window[owner];
    var prototype = constructor && constructor.prototype;
    var descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor || typeof descriptor.set !== "function" || descriptor.set.__fnosBridge === true) return;
    var setter = descriptor.set;
    var bridgedSetter = function (value) { setter.call(this, mapResourceAttribute(this, property, value)); };
    try { Object.defineProperty(bridgedSetter, "__fnosBridge", { value: true }); } catch (_) {}
    try { Object.defineProperty(prototype, property, { configurable: descriptor.configurable, enumerable: descriptor.enumerable, get: descriptor.get, set: bridgedSetter }); } catch (_) {}
  }
  patchResourceProperty("HTMLImageElement", "src");
  patchResourceProperty("HTMLScriptElement", "src");
  patchResourceProperty("HTMLLinkElement", "href");
  patchResourceProperty("HTMLIFrameElement", "src");
  patchResourceProperty("HTMLMediaElement", "src");
  patchResourceProperty("HTMLSourceElement", "src");
  var textContent = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  if (textContent && typeof textContent.set === "function" && textContent.set.__fnosBridge !== true) {
    var textContentSetter = textContent.set;
    var bridgedTextContentSetter = function (value) {
      var mapped = this && this.nodeType === 1 && this.tagName === "STYLE" ? mapCssUrls(value) : value;
      textContentSetter.call(this, mapped);
    };
    try { Object.defineProperty(bridgedTextContentSetter, "__fnosBridge", { value: true }); } catch (_) {}
    try { Object.defineProperty(Node.prototype, "textContent", { configurable: textContent.configurable, enumerable: textContent.enumerable, get: textContent.get, set: bridgedTextContentSetter }); } catch (_) {}
  }
  if (window.CSSStyleSheet) {
    var styleSheetPrototype = window.CSSStyleSheet.prototype;
    var insertRule = styleSheetPrototype.insertRule;
    if (typeof insertRule === "function" && insertRule.__fnosBridge !== true) {
      var bridgedInsertRule = function (rule, index) { return insertRule.call(this, mapCssUrls(rule), index); };
      try { Object.defineProperty(bridgedInsertRule, "__fnosBridge", { value: true }); } catch (_) {}
      try { styleSheetPrototype.insertRule = bridgedInsertRule; } catch (_) {}
    }
    var replaceSync = styleSheetPrototype.replaceSync;
    if (typeof replaceSync === "function" && replaceSync.__fnosBridge !== true) {
      var bridgedReplaceSync = function (text) { return replaceSync.call(this, mapCssUrls(text)); };
      try { Object.defineProperty(bridgedReplaceSync, "__fnosBridge", { value: true }); } catch (_) {}
      try { styleSheetPrototype.replaceSync = bridgedReplaceSync; } catch (_) {}
    }
    var replace = styleSheetPrototype.replace;
    if (typeof replace === "function" && replace.__fnosBridge !== true) {
      var bridgedReplace = function (text) { return replace.call(this, mapCssUrls(text)); };
      try { Object.defineProperty(bridgedReplace, "__fnosBridge", { value: true }); } catch (_) {}
      try { styleSheetPrototype.replace = bridgedReplace; } catch (_) {}
    }
  }
  function scriptNode(node) {
    if (!node || node.nodeType !== 1) return;
    var attributes = ["src", "href", "poster", "data"];
    for (var attribute of attributes) {
      if (!isResourceAttribute(node, attribute)) continue;
      var value = node.getAttribute && node.getAttribute(attribute);
      var mapped = mapResourceAttribute(node, attribute, value);
      if (mapped !== value && node.setAttribute) node.setAttribute(attribute, mapped);
    }
  }
  var appendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (this && this.tagName === "STYLE" && node && node.nodeType === 3) node.nodeValue = mapCssUrls(node.nodeValue);
    scriptNode(node);
    return appendChild.call(this, node);
  };
  var append = Element.prototype.append;
  if (append) Element.prototype.append = function () { for (var node of arguments) scriptNode(node); return append.apply(this, arguments); };
  var insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, reference) { scriptNode(node); return insertBefore.call(this, node, reference); };
  if (window.EventSource) window.EventSource = new Proxy(window.EventSource, { construct: function (target, args, receiver) { var mapped = mapUrl(args[0]); if (mapped) args[0] = mapped.toString(); return Reflect.construct(target, args, receiver); } });
  if (window.WebSocket) window.WebSocket = new Proxy(window.WebSocket, { construct: function (target, args, receiver) { var mapped = mapUrl(args[0]); if (mapped) { var page = new URL(window.location.href); if (mapped.protocol === "https:" || (mapped.protocol === "ws:" && page.protocol === "https:")) mapped.protocol = "wss:"; else if (mapped.protocol === "http:" || mapped.protocol === "ws:") mapped.protocol = "ws:"; args[0] = mapped.toString(); } return Reflect.construct(target, args, receiver); } });

  try {
    var events = new EventSource(prefix + config.eventsPath);
    events.addEventListener("paths", function (event) { try { var value = JSON.parse(event.data); customPaths = new Set(Array.isArray(value.paths) ? value.paths : []); } catch (_) {} });
  } catch (_) {}
})(window.__FNOS_GATEWAY_CONFIG__);
