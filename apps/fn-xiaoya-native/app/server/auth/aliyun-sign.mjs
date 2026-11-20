/**
 * 阿里云盘 API 签名。
 *
 * ## 为什么需要签名
 *
 * 新版阿里云盘 Web/App 接口（`api.alipan.com`、`adrive/v3/file/list`）在
 * Refresh Token 之外还要求请求级签名，否则一律返回 AccessTokenInvalid。
 * OpenList 的 `drivers/aliyundrive` 实现里这一步是强制的，缺了它列不出目录。
 *
 * ## 算法（与 OpenList 的 util.go 对齐）
 *
 * 1. `deviceID  = SHA256(userId)`（十六进制）
 * 2. 私钥      = deviceID 的字节作为 secp256k1 标量
 * 3. 公钥      = X(32) || Y(32)，共 64 字节（不含 04 前缀）
 * 4. 待签数据  = `${secpAppID}:${deviceID}:${userId}:0` 的 SHA256
 * 5. 签名      = secp256k1 ECDSA，输出 64 字节 `r || s`（LowerS）
 * 6. 请求头    = X-Signature / X-Device-Id / X-Canary
 *
 * ## 一个前提
 *
 * 还需要一次 `device/create_session` 上报公钥，服务端才认这套签名。
 * 该步骤在首次签名前自动完成，结果按 userId 缓存。
 */
import { createECDH, createHash, createPrivateKey, sign as cryptoSign } from 'node:crypto'

/** 固定 app id，与 OpenList 一致；由客户端类型决定，不是用户凭据。 */
const SECP_APP_ID = '5dde4e1bdf9e4966b387ba58f4b3fdc3'

/** 设备信息：用于 create_session，值本身无意义，只需稳定。 */
const DEVICE_NAME = 'samsung'
const DEVICE_MODEL = 'SM-G9810'

/** 上报设备公钥的端点 */
const CREATE_SESSION_URL = 'https://api.alipan.com/users/v1/users/device/create_session'

/** 上游超时 */
const FETCH_TIMEOUT_MS = 15_000

/** 已初始化签名状态的 userId 集合（create_session 成功过）。 */
const initialized = new Set()

/** 每个 userId 的签名材料。 */
const materials = new Map()

/** SHA256 → hex。 */
function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** SHA256 → Buffer。 */
function sha256Buf(text) {
  return createHash('sha256').update(text).digest()
}

/**
 * 从 userId 派生签名材料。
 *
 * @param {string} userId 阿里云盘用户 id（token 响应里的 user_id）
 * @returns {{deviceId: string, privateKeyHex: string, publicKeyHex: string}} 签名材料
 */
function deriveMaterial(userId) {
  const deviceId = sha256Hex(userId)
  const ecdh = createECDH('secp256k1')
  // deviceID 本身就是 32 字节的十六进制，可直接当私钥标量
  ecdh.setPrivateKey(Buffer.from(deviceId, 'hex'))

  // uncompressed 公钥是 04 || X(32) || Y(32)，去掉 04 后正好 64 字节
  const raw = ecdh.getPublicKey('hex', 'uncompressed')
  const publicKeyHex = raw.slice(2)

  return { deviceId, privateKeyHex: deviceId, publicKeyHex }
}

/** 取（并缓存）签名材料。 */
function materialFor(userId) {
  const cached = materials.get(userId)
  if (cached !== undefined) return cached
  const material = deriveMaterial(userId)
  materials.set(userId, material)
  return material
}

/**
 * 确保该 userId 已上报过设备公钥。
 *
 * 同一 userId 只做一次；失败时抛错由调用方决定是否重试。
 *
 * @param {string} userId 用户 id
 * @param {string} refreshToken 用于会话创建
 */
export async function ensureSession(userId, refreshToken) {
  if (initialized.has(userId)) return

  const material = materialFor(userId)
  let payload = null
  try {
    const response = await fetch(CREATE_SESSION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)',
        'X-Canary': 'client=Android,app=adrive,version=v4.1.0',
      },
      body: JSON.stringify({
        deviceName: DEVICE_NAME,
        modelName: DEVICE_MODEL,
        nonce: 0,
        pubKey: material.publicKeyHex,
        refreshToken,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    payload = await response.json().catch(() => null)
  }
  catch {
    // 网络失败：不标记已初始化，下次调用会重试
    return
  }

  // 已经建过会话时上游会返回对应错误码，视为成功
  const alreadyExists = typeof payload?.code === 'string' && /exist|Already/i.test(payload.code)
  if (payload?.result === true || alreadyExists) {
    initialized.add(userId)
  }
}

/**
 * 生成一次请求所需的签名头。
 *
 * @param {string} userId 用户 id
 * @returns {Promise<Record<string, string>>} 可直接展开到请求头的对象
 */
export async function signHeaders(userId) {
  const material = materialFor(userId)

  // 与 OpenList 完全一致的拼接方式，末尾的 0 是 nonce
  const data = `${SECP_APP_ID}:${material.deviceId}:${userId}:0`
  const digest = sha256Buf(data)

  /**
   * 用 DER 私钥签名后转成 64 字节 r||s。
   *
   * OpenList 用的是自研 ecc 包，输出 r||s + 低 S；Node 的 crypto.sign
   * 支持 dsaEncoding: 'ieee-p1363'，正好就是 r||s 的定长格式，
   * 且 Node（OpenSSL）默认已做低 S 归一化。
   */
  const keyObject = privateKeyObject(material.privateKeyHex)
  const signature = cryptoSign('sha256', digest, {
    key: keyObject,
    dsaEncoding: 'ieee-p1363',
  })

  return {
    'X-Signature': signature.toString('hex'),
    'X-Device-Id': material.deviceId,
    'X-Canary': 'client=Android,app=adrive,version=v4.1.0',
  }
}

/** 缓存私钥对象，避免每次签名都重建。 */
const keyObjects = new Map()

/**
 * 由裸私钥构造 Node KeyObject。
 *
 * Node 没有「从裸私钥构造」的直接 API，用 JWK 最省事：
 * 先由 secp256k1 曲线算出对应公钥坐标，再拼成 JWK 交给 createPrivateKey。
 */
function privateKeyObject(privateKeyHex) {
  const cached = keyObjects.get(privateKeyHex)
  if (cached !== undefined) return cached

  const raw = Buffer.from(privateKeyHex, 'hex')
  const ecdh = createECDH('secp256k1')
  ecdh.setPrivateKey(raw)
  // uncompressed 形如 04 || X(32) || Y(32)
  const publicKey = ecdh.getPublicKey(null, 'uncompressed')

  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'secp256k1',
      x: publicKey.subarray(1, 33).toString('base64url'),
      y: publicKey.subarray(33, 65).toString('base64url'),
      d: raw.toString('base64url'),
    },
    format: 'jwk',
  })

  keyObjects.set(privateKeyHex, key)
  return key
}
