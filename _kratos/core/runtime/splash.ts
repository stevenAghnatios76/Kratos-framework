const VERSION = '2.2.0';

const HELMET = [
  '        ▄▄▄▄▄▄▄▄▄        ',
  '      ▄█████████████▄      ',
  '     ██▀▀▀▀▀▀▀▀▀▀▀██     ',
  '    ██   ▄███████▄   ██    ',
  '    █  ▐███████████▌  █    ',
  '    █   ▀▀▀▀▀▀▀▀▀▀   █    ',
  '    ██  ═══════════  ██    ',
  '     █▌  ▐       ▌  ▐█     ',
  '      █▄▄▄▄▄▄▄▄▄▄▄▄▄█      ',
];

export async function showSplash(): Promise<void> {
  const chalk = (await import('chalk')).default;
  const accent = chalk.cyan;
  const dim = chalk.dim.gray;
  const bold = chalk.bold.white;

  console.log('');
  for (const line of HELMET) {
    console.log(`  ${accent(line)}`);
  }
  console.log('');
  console.log(`  ${bold('KRATOS')} ${dim(`v${VERSION}`)}`);
  console.log(`  ${dim('Generative Agile Intelligence Architecture')}`);
  console.log(`  ${dim('15 agents · 64 workflows · 8 skills')}`);
  console.log('');
}
