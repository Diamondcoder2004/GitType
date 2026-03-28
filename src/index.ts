#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import * as readline from 'readline';
import { GitHubService } from './github.js';
import { TypingTrainer, displayCode, displayStats } from './trainer.js';

const program = new Command();

program
  .name('gittype')
  .description('Тренажёр слепой печати на коде из GitHub')
  .version('1.0.0');

async function runTraining(options: { token?: string; repo?: string; file?: string }) {
  const token = options.token || process.env.GITHUB_TOKEN;

  if (!token) {
    console.error(chalk.red('Ошибка: Не указан GitHub токен!'));
    console.error('Установите токен в .env файле или используйте флаг --token');
    console.error('Создайте токен на: https://github.com/settings/tokens');
    process.exit(1);
  }

  const github = new GitHubService(token);

  try {
    const spinner = ora('Подключение к GitHub...').start();
    const username = await github.getCurrentUser();
    spinner.succeed(`Подключено как ${chalk.cyan(username)}`);

    let repoFullName = options.repo;
    let filePath = options.file;

    if (!repoFullName) {
      const repos = await github.getRepos();
      const { selectedRepo } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedRepo',
          message: 'Выберите репозиторий:',
          choices: repos.map(r => ({ name: r.name, value: r.full_name })),
          pageSize: 15
        }
      ]);
      repoFullName = selectedRepo;
    }

    const [owner, repo] = repoFullName!.split('/');

    if (!filePath) {
      const files = await github.getFilesInRepo(owner, repo);
      const codeFiles = files.filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ['ts', 'js', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'sql', 'html', 'css', 'json', 'md', 'yaml', 'yml', 'sh', 'bash'].includes(ext || '');
      });

      if (codeFiles.length === 0) {
        console.error(chalk.red('В репозитории нет файлов с кодом'));
        process.exit(1);
      }

      const { selectedFile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFile',
          message: 'Выберите файл для тренировки:',
          choices: codeFiles.map(f => ({ name: f.path, value: f.path })),
          pageSize: 15
        }
      ]);
      filePath = selectedFile;
    }

    const spinner2 = ora('Загрузка файла...').start();
    const code = await github.getFileContent(owner, repo, filePath!);
    spinner2.succeed('Файл загружен');

    console.log('\n' + chalk.bgBlue.white('  НАЧАЛО ТРЕНИРОВКИ  ') + '\n');
    console.log(chalk.gray('Файл:') + ` ${filePath}`);
    console.log(chalk.gray('Символов:') + ` ${code.length}`);
    console.log('\n' + chalk.yellow('Печатайте код. Нажмите Enter когда закончите.') + '\n');
    console.log(chalk.gray('Для выхода нажмите Ctrl+C') + '\n');

    const trainer = new TypingTrainer(code);
    trainer.start();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let lastRender = '';

    const render = () => {
      const progress = trainer.getProgress();
      const stats = trainer.getStats();
      const codeDisplay = displayCode(code, trainer.userInput, trainer.currentCharIndex);
      const statsDisplay = displayStats(stats, progress);

      const output = `\r\x1b[K${codeDisplay}${statsDisplay}`;
      
      if (output !== lastRender) {
        process.stdout.write(output);
        lastRender = output;
      }
    };

    const onKeyPress = (str: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKeyPress);
        console.log('\n\n' + chalk.yellow('Тренировка прервана'));
        process.exit(0);
      }

      trainer.handleInput(str);
      render();

      if (trainer.isComplete()) {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKeyPress);
        
        const finalStats = trainer.getStats();
        console.log('\n\n' + chalk.bgGreen.white('  ТРЕНИРОВКА ЗАВЕРШЕНА  '));
        console.log('\n' + chalk.cyan('Результаты:') + 
          `\n  WPM: ${chalk.yellow(finalStats.wpm.toString())}` +
          `\n  Точность: ${chalk.green(finalStats.accuracy + '%')}` +
          `\n  Ошибки: ${chalk.red(finalStats.errors.toString())}` +
          `\n  Время: ${chalk.blue(finalStats.timeElapsed + 'с')}` +
          `\n  Символов: ${chalk.gray(finalStats.totalChars.toString())}`
        );
        console.log('\n' + chalk.gray('Запустить ещё раз? npm start') + '\n');
        process.exit(0);
      }
    };

    process.stdin.on('keypress', onKeyPress);
    render();

  } catch (error: any) {
    console.error(chalk.red('Ошибка:'), error.message);
    process.exit(1);
  }
}

program
  .command('start')
  .description('Запустить тренировку печати')
  .option('-t, --token <token>', 'GitHub токен')
  .option('-r, --repo <repo>', 'Репозиторий (owner/repo)')
  .option('-f, --file <file>', 'Путь к файлу')
  .action(async (options) => {
    await runTraining(options);
  });

// Команда по умолчанию
program
  .argument('[command]', 'Команда (start по умолчанию)')
  .option('-t, --token <token>', 'GitHub токен')
  .option('-r, --repo <repo>', 'Репозиторий (owner/repo)')
  .option('-f, --file <file>', 'Путь к файлу')
  .action(async (command, options) => {
    if (!command || command === 'start') {
      await runTraining(options);
    } else {
      program.outputHelp();
    }
  });

program.parse();
