import http from 'node:http'
import net from 'node:net'
import fs from 'node:fs'

const SOCKET_PATH = process.env.GATEWAY_SOCKET || '/var/apps/fn-deepseek-harness/target/app.sock'
const UPSTREAM_HOST = process.env.DSH_UPSTREAM_HOST || '127.0.0.1'
const UPSTREAM_PORT = Number.parseInt(process.env.DSH_UPSTREAM_PORT || '3080', 10)
const GATEWAY_PREFIX = normalizePrefix(process.env.GATEWAY_PREFIX || '/app/fn-deepseek-harness')
const SSE_KEEPALIVE_INTERVAL = 15_000
const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade'
])
const openSockets = new Set()
let stopping = false

if (!Number.isInteger(UPSTREAM_PORT) || UPSTREAM_PORT < 1 || UPSTREAM_PORT > 65535) {
    console.error('Invalid dsh upstream port: ' + (process.env.DSH_UPSTREAM_PORT || ''))
    process.exit(1)
}

function normalizePrefix(value) {
    const prefix = String(value || '').trim()
    if (prefix === '' || prefix === '/') return ''
    return '/' + prefix.replace(/^\/+|\/+$/g, '')
}

function removeSocket() {
    try {
        fs.unlinkSync(SOCKET_PATH)
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error
    }
}

function rewritePath(rawUrl) {
    if (!rawUrl || rawUrl === '*') return rawUrl || '/'

    let parsed
    try {
        parsed = new URL(rawUrl, 'http://dsh-gateway.invalid')
    } catch {
        return rawUrl
    }

    const pathname = parsed.pathname || '/'
    if (GATEWAY_PREFIX && (pathname === GATEWAY_PREFIX || pathname === GATEWAY_PREFIX + '/')) {
        parsed.pathname = '/'
    } else if (GATEWAY_PREFIX && pathname.startsWith(GATEWAY_PREFIX + '/')) {
        parsed.pathname = pathname.slice(GATEWAY_PREFIX.length) || '/'
    }

    return (parsed.pathname || '/') + parsed.search
}

function addGatewayPrefix(path) {
    if (!GATEWAY_PREFIX || !path || !path.startsWith('/') || path.startsWith('//')) return path
    if (path === GATEWAY_PREFIX || path.startsWith(GATEWAY_PREFIX + '/')) return path
    return GATEWAY_PREFIX + path
}

function rewriteLocation(value) {
    if (typeof value !== 'string') return value
    return value.startsWith('/') && !value.startsWith('//') ? addGatewayPrefix(value) : value
}

function gatewayBridgeScript() {
    return [
        '<script>',
        '(function (prefix) {',
        '  // The browser is opened through the fnOS app gateway, so its page',
        '  // authority is a NAS IP/domain even though every DSH request is',
        '  // terminated and forwarded to the local DSH process. DSH normally',
        '  // uses that visible authority to select memory settings mode. Wrap',
        '  // the connection module before the client boot graph materializes',
        '  // it, and mark only this gateway page as a trusted Host connection.',
        '  const connectionModuleId = "@deepseek-ai/dsh-client-connection";',
        '  const markFnOSHostConnection = function (ctx) {',
        '    let connection;',
        '    try { connection = typeof ctx?.get === "function" ? ctx.get("connection") : null; }',
        '    catch (_) { return; }',
        '    if (!connection || (typeof connection !== "object" && typeof connection !== "function")) return;',
        '    try {',
        '      Object.defineProperty(connection, "isLoopback", {',
        '        configurable: true,',
        '        enumerable: true,',
        '        writable: true,',
        '        value: true',
        '      });',
        '    } catch (_) {',
        '      try { connection.isLoopback = true; } catch (_) {}',
        '    }',
        '  };',
        '  const wrapConnectionFactory = function (factory) {',
        '    return function (require) {',
        '      const moduleExports = factory(require);',
        '      const apply = moduleExports && moduleExports.apply;',
        '      if (typeof apply !== "function") return moduleExports;',
        '      try {',
        '        moduleExports.apply = function (ctx, config) {',
        '          const result = apply.call(this, ctx, config);',
        '          markFnOSHostConnection(ctx);',
        '          return result;',
        '        };',
        '      } catch (_) {}',
        '      return moduleExports;',
        '    };',
        '  };',
        '  const wrapModuleLoader = function (loader) {',
        '    if (!loader || typeof loader.load !== "function") return loader;',
        '    const load = loader.load;',
        '    if (load.__fnosSettingsBridge === true) return loader;',
        '    const bridgedLoad = function (handoff) {',
        '      if (handoff && handoff.id === connectionModuleId && typeof handoff.factory === "function") {',
        '        handoff = Object.assign({}, handoff, { factory: wrapConnectionFactory(handoff.factory) });',
        '      }',
        '      return load.call(this, handoff);',
        '    };',
        '    try { Object.defineProperty(bridgedLoad, "__fnosSettingsBridge", { value: true }); } catch (_) {}',
        '    try { loader.load = bridgedLoad; return loader; }',
        '    catch (_) { return Object.assign({}, loader, { load: bridgedLoad }); }',
        '  };',
        '  // ClientModuleSystem installs __ModuleLoader__ after this script is',
        '  // evaluated. A setter lets the bridge wrap it before any bundle can',
        '  // register or materialize the connection module.',
        '  let moduleLoader;',
        '  try {',
        '    Object.defineProperty(window, "__ModuleLoader__", {',
        '      configurable: true,',
        '      get: function () { return moduleLoader; },',
        '      set: function (value) { moduleLoader = wrapModuleLoader(value); }',
        '    });',
        '  } catch (_) {}',
        '  const cryptoObject = window.crypto;',
        '  if (cryptoObject && typeof cryptoObject.randomUUID !== "function" && typeof cryptoObject.getRandomValues === "function") {',
        '    const getRandomValues = cryptoObject.getRandomValues.bind(cryptoObject);',
        '    const randomUUID = function () {',
        '      const bytes = new Uint8Array(16);',
        '      getRandomValues(bytes);',
        '      bytes[6] = (bytes[6] & 15) | 64;',
        '      bytes[8] = (bytes[8] & 63) | 128;',
        '      const hex = Array.from(bytes, function (byte) { return ("0" + byte.toString(16)).slice(-2); }).join("");',
        '      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);',
        '    };',
        '    const installRandomUUID = function (target) {',
        '      try {',
        '        Object.defineProperty(target, "randomUUID", { configurable: true, writable: true, value: randomUUID });',
        '        return typeof target.randomUUID === "function";',
        '      } catch (_) { return false; }',
        '    };',
        '    if (!installRandomUUID(cryptoObject) && Object.getPrototypeOf(cryptoObject)) installRandomUUID(Object.getPrototypeOf(cryptoObject));',
        '  }',
        '  const isAlreadyPrefixed = function (pathname) {',
        '    return prefix !== "" && (pathname === prefix || pathname.indexOf(prefix + "/") === 0);',
        '  };',
        '  const isApiPath = function (pathname) {',
        '    return pathname === "/api" || pathname.indexOf("/api/") === 0;',
        '  };',
        '  const isGatewayPath = function (pathname) {',
        '    return isApiPath(pathname) || pathname === "/plugins" || pathname.indexOf("/plugins/") === 0;',
        '  };',
        '  const toGatewayUrl = function (value) {',
        '    let url;',
        '    try { url = new URL(String(value), window.location.href); }',
        '    catch (_) { return null; }',
        '    if (url.origin !== window.location.origin || !isGatewayPath(url.pathname) || isAlreadyPrefixed(url.pathname)) return null;',
        '    url.pathname = prefix + url.pathname;',
        '    return url;',
        '  };',
        '  const nativeFetch = window.fetch.bind(window);',
        '  window.fetch = function (input, init) {',
        '    if (typeof Request !== "undefined" && input instanceof Request) {',
        '      const mapped = toGatewayUrl(input.url);',
        '      if (mapped !== null) input = new Request(mapped, input);',
        '    } else {',
        '      const mapped = toGatewayUrl(input);',
        '      if (mapped !== null) input = mapped;',
        '    }',
        '    return nativeFetch(input, init);',
        '  };',
        '  const rewriteScriptNode = function (node) {',
        '    if (!node || node.nodeType !== 1 || node.tagName !== "SCRIPT") return;',
        '    const mapped = toGatewayUrl(node.getAttribute("src") || node.src);',
        '    if (mapped !== null) node.setAttribute("src", mapped.toString());',
        '  };',
        '  const nativeAppend = Element.prototype.append;',
        '  if (nativeAppend) {',
        '    Element.prototype.append = function () {',
        '      for (const node of arguments) rewriteScriptNode(node);',
        '      return nativeAppend.apply(this, arguments);',
        '    };',
        '  }',
        '  const nativeAppendChild = Node.prototype.appendChild;',
        '  Node.prototype.appendChild = function (node) {',
        '    rewriteScriptNode(node);',
        '    return nativeAppendChild.call(this, node);',
        '  };',
        '  const nativeInsertBefore = Node.prototype.insertBefore;',
        '  Node.prototype.insertBefore = function (node, reference) {',
        '    rewriteScriptNode(node);',
        '    return nativeInsertBefore.call(this, node, reference);',
        '  };',
        '  const nativeEventSource = window.EventSource;',
        '  if (nativeEventSource) {',
        '    window.EventSource = new Proxy(nativeEventSource, {',
        '      construct: function (target, args, newTarget) {',
        '        const mapped = toGatewayUrl(args[0]);',
        '        if (mapped !== null) args = [mapped.toString()].concat(args.slice(1));',
        '        return Reflect.construct(target, args, newTarget);',
        '      }',
        '    });',
        '  }',
        '  const nativeWebSocket = window.WebSocket;',
        '  if (nativeWebSocket) {',
        '    const page = new URL(window.location.href);',
        '    const pagePort = page.port || (page.protocol === "https:" ? "443" : "80");',
        '    window.WebSocket = new Proxy(nativeWebSocket, {',
        '      construct: function (target, args, newTarget) {',
        '        let url;',
        '        try { url = new URL(String(args[0]), window.location.href); }',
        '        catch (_) { return Reflect.construct(target, args, newTarget); }',
        '        const socketPort = url.port || (url.protocol === "wss:" ? "443" : "80");',
        '        if ((url.protocol === "ws:" || url.protocol === "wss:") &&',
        '            url.hostname === page.hostname && socketPort === pagePort &&',
        '            isApiPath(url.pathname)) {',
        '          url.pathname = prefix + url.pathname;',
        '          args = [url.toString()].concat(args.slice(1));',
        '        }',
        '        return Reflect.construct(target, args, newTarget);',
        '      }',
        '    });',
        '  }',
        '})( ' + JSON.stringify(GATEWAY_PREFIX) + ' );',
        '</script>'
    ].join('\n')
}

function rewriteHtml(body) {
    let html = body.toString('utf8')
    html = html.replace(
        /(\b(?:src|href|action)=["'])(\/(?!\/)[^"']*)/gi,
        (_, prefix, path) => prefix + addGatewayPrefix(path)
    )
    const bridge = gatewayBridgeScript()
    return /<head\b[^>]*>/i.test(html)
        ? html.replace(/<head\b[^>]*>/i, (head) => head + bridge)
        : bridge + html
}

function applyLoopbackHeaders(headers) {
    // The fnOS gateway already provides the external access boundary. This
    // proxy owns the complete application path, so every dsh request must see
    // the second hop as loopback. Otherwise the browser's external Origin and
    // Fetch Metadata can fail dsh's trust fence on pages, APIs, or plugins.
    headers.host = `127.0.0.1:${UPSTREAM_PORT}`
    delete headers.origin
    delete headers['sec-fetch-site']
    return headers
}

function copyRequestHeaders(req) {
    const headers = { ...req.headers }
    for (const header of HOP_BY_HOP_HEADERS) delete headers[header]
    headers['accept-encoding'] = 'identity'
    return applyLoopbackHeaders(headers)
}

function copyResponseHeaders(headers, rewriteBody, eventStream) {
    const result = {}
    for (const [name, value] of Object.entries(headers)) {
        if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue
        if (name.toLowerCase() === 'content-length' && (rewriteBody || eventStream)) continue
        if (name.toLowerCase() === 'location' && typeof value === 'string') {
            result[name] = rewriteLocation(value)
        } else {
            result[name] = value
        }
    }
    if (eventStream) {
        // SSE must pass through the fnOS/nginx gateway as an unbuffered,
        // indefinite response. The comment heartbeat below also prevents an
        // otherwise idle HMR channel from being reset by an upstream timeout.
        result['cache-control'] = 'no-cache, no-transform'
        result['x-accel-buffering'] = 'no'
    }
    return result
}

function sendBadGateway(res, error) {
    if (res.headersSent) {
        res.destroy()
        return
    }
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('DeepSeek Harness gateway proxy error: ' + (error?.message || error))
}

function proxyRequest(req, res) {
    const upstreamPath = rewritePath(req.url)
    const upstream = http.request({
        host: UPSTREAM_HOST,
        port: UPSTREAM_PORT,
        method: req.method,
        path: upstreamPath,
        headers: copyRequestHeaders(req)
    }, (response) => {
        const contentType = String(response.headers['content-type'] || '').toLowerCase()
        const eventStream = contentType.startsWith('text/event-stream')
        const rewriteBody = contentType.includes('text/html') && !eventStream
        const headers = copyResponseHeaders(response.headers, rewriteBody, eventStream)

        if (!rewriteBody) {
            res.writeHead(response.statusCode || 502, response.statusMessage, headers)
            if (eventStream) {
                res.flushHeaders()
                const keepAlive = setInterval(() => {
                    if (!res.destroyed && !res.writableEnded) res.write(': fn-deepseek-harness keep-alive\n\n')
                }, SSE_KEEPALIVE_INTERVAL)
                const clearKeepAlive = () => clearInterval(keepAlive)
                response.once('close', clearKeepAlive)
                response.once('error', clearKeepAlive)
                res.once('close', clearKeepAlive)
            }
            response.pipe(res)
            return
        }

        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('error', (error) => sendBadGateway(res, error))
        response.on('end', () => {
            const body = Buffer.from(rewriteHtml(Buffer.concat(chunks)))
            headers['content-length'] = String(body.length)
            res.writeHead(response.statusCode || 502, response.statusMessage, headers)
            res.end(body)
        })
    })

    upstream.on('error', (error) => sendBadGateway(res, error))
    req.on('aborted', () => upstream.destroy())
    res.on('close', () => {
        if (!res.writableEnded) upstream.destroy()
    })
    req.pipe(upstream)
}

function proxyUpgrade(req, clientSocket, head) {
    const upstreamPath = rewritePath(req.url)
    const upstreamSocket = net.connect({ host: UPSTREAM_HOST, port: UPSTREAM_PORT }, () => {
        const forwardedHeaders = applyLoopbackHeaders({ ...req.headers })
        const lines = [
            req.method + ' ' + upstreamPath + ' HTTP/' + req.httpVersion
        ]
        for (const [name, value] of Object.entries(forwardedHeaders)) {
            if (Array.isArray(value)) {
                for (const item of value) lines.push(name + ': ' + item)
            } else if (value !== undefined) {
                lines.push(name + ': ' + value)
            }
        }
        lines.push('', '')
        upstreamSocket.write(lines.join('\r\n'))
        if (head.length > 0) upstreamSocket.write(head)
        clientSocket.pipe(upstreamSocket)
        upstreamSocket.pipe(clientSocket)
    })

    const closeBoth = () => {
        clientSocket.destroy()
        upstreamSocket.destroy()
    }
    upstreamSocket.on('error', closeBoth)
    clientSocket.on('error', () => upstreamSocket.destroy())
}

const server = http.createServer(proxyRequest)
server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.once('close', () => openSockets.delete(socket))
})
server.on('upgrade', proxyUpgrade)
server.on('clientError', (_, socket) => socket.destroy())

function shutdown() {
    if (stopping) return
    stopping = true
    for (const socket of openSockets) socket.destroy()
    server.close(() => {
        removeSocket()
        process.exit(0)
    })
    setTimeout(() => {
        removeSocket()
        process.exit(0)
    }, 5000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

removeSocket()
server.listen(SOCKET_PATH, () => {
    console.log('DeepSeek Harness gateway listening on ' + SOCKET_PATH)
})
