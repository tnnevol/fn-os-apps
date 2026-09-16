export type LogLevel = 'INFO' | 'ERROR'

export type Logger = {
  info(message: string): void
  error(message: string): void
}

export class InstallHelperError extends Error {
  constructor(
    readonly scope: string,
    message: string,
  ) {
    super(message)
    this.name = 'InstallHelperError'
  }
}

export function fail(scope: string, message: string): never {
  throw new InstallHelperError(scope, message)
}

function localTimestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatLogMessage(scope: string, level: LogLevel, message: string): string {
  return `[${localTimestamp()}] [${scope}] [${level}] ${message}`
}

export function createLogger(scope: string): Logger {
  const write = (level: LogLevel, message: string): void => {
    const output = `${formatLogMessage(scope, level, message)}\n`
    if (level === 'ERROR') process.stderr.write(output)
    else process.stdout.write(output)
  }

  return {
    info: message => write('INFO', message),
    error: message => write('ERROR', message),
  }
}
