import { program } from '../program.js'

program
  .command('help')
  .description('Display command help')
  .action(() => console.log(program.helpInformation()))
