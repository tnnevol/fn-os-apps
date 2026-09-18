import { Command } from 'commander'

export const program = new Command()
  .name('fn-apps-cli')
  .description('fn-os-apps repository CLI')
  .version('0.0.0')
  .showSuggestionAfterError()
  .exitOverride()
  .configureOutput({ outputError: () => {} })

program.addHelpText('after', `
Examples:
  fn-apps-cli build
  fn-apps-cli build --fpk --app fn-memos
  fn-apps-cli build --docs
  fn-apps-cli start --docs
  fn-apps-cli check --all
  fn-apps-cli check --sdd --docs
  fn-apps-cli version patch
`)
