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
`

export function gatewayBridgeScript(gatewayPrefix: string): string {
  const body = BRIDGE_SCRIPT_BODY.replace('__PREFIX__', JSON.stringify(gatewayPrefix))
  return '<script>\n' + body + '\n</' + 'script>'
}
