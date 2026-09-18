import type { OptionValues } from 'commander'

export function addBooleanArgs(args: string[], options: OptionValues, names: string[]): void {
  for (const name of names) {
    if (options[name]) args.push(`--${name}`)
  }
}

export function addNegatedArgs(args: string[], options: OptionValues, values: Array<[string, string]>): void {
  for (const [property, flag] of values) {
    if (options[property] === false) args.push(flag)
  }
}
