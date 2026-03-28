import * as readline from 'readline';
import chalk from 'chalk';

export interface TypingStats {
  wpm: number;
  accuracy: number;
  errors: number;
  totalChars: number;
  correctChars: number;
  timeElapsed: number;
}

export class TypingTrainer {
  private code: string;
  public userInput: string = '';
  private errors: number = 0;
  private startTime: number = 0;
  private endTime: number | null = null;
  private isFinished: boolean = false;
  public currentCharIndex: number = 0;

  constructor(code: string) {
    this.code = code;
  }

  start(): void {
    this.startTime = Date.now();
  }

  handleInput(key: string): boolean {
    if (this.isFinished) {
      return false;
    }

    // Обработка Ctrl+C
    if (key === '\u0003') {
      return false;
    }

    // Обработка Backspace
    if (key === '\u0008' || key === '\u007f') {
      if (this.currentCharIndex > 0) {
        this.currentCharIndex--;
        this.userInput = this.userInput.slice(0, -1);
      }
      return true;
    }

    // Обработка Enter (завершение)
    if (key === '\r' || key === '\n') {
      if (this.currentCharIndex >= this.code.length) {
        this.finish();
      }
      return true;
    }

    // Проверка символа
    if (this.currentCharIndex < this.code.length) {
      const expectedChar = this.code[this.currentCharIndex];
      
      if (key === expectedChar) {
        this.userInput += key;
        this.currentCharIndex++;
      } else {
        this.errors++;
        this.userInput += key;
        this.currentCharIndex++;
      }

      // Проверка завершения
      if (this.currentCharIndex >= this.code.length) {
        this.finish();
      }
    }

    return true;
  }

  private finish(): void {
    this.isFinished = true;
    this.endTime = Date.now();
  }

  getStats(): TypingStats {
    const endTime = this.endTime || Date.now();
    const timeElapsed = (endTime - this.startTime) / 1000 / 60; // в минутах
    
    const correctChars = this.getCodeProgress().correct;
    const accuracy = this.currentCharIndex > 0 
      ? (correctChars / this.currentCharIndex) * 100 
      : 100;
    
    // WPM: (символы / 5) / минуты
    const wpm = timeElapsed > 0 ? Math.round((correctChars / 5) / timeElapsed) : 0;

    return {
      wpm,
      accuracy: Math.round(accuracy * 100) / 100,
      errors: this.errors,
      totalChars: this.currentCharIndex,
      correctChars,
      timeElapsed: Math.round((endTime - this.startTime) / 1000)
    };
  }

  getCodeProgress(): { correct: number; incorrect: number; remaining: number } {
    let correct = 0;
    let incorrect = 0;

    for (let i = 0; i < this.currentCharIndex; i++) {
      if (this.code[i] === this.userInput[i]) {
        correct++;
      } else {
        incorrect++;
      }
    }

    return {
      correct,
      incorrect,
      remaining: this.code.length - this.currentCharIndex
    };
  }

  isComplete(): boolean {
    return this.isFinished;
  }

  getProgress(): number {
    return (this.currentCharIndex / this.code.length) * 100;
  }
}

export function displayCode(code: string, userInput: string, currentIndex: number): string {
  const windowSize = 15; // количество символов для отображения
  let display = '';

  // Показываем код с подсветкой
  for (let i = 0; i < code.length; i++) {
    let char = code[i];
    
    // Замена специальных символов для отображения
    if (char === '\n') {
      char = '↵\n';
    } else if (char === '\t') {
      char = '→   ';
    } else if (char === ' ') {
      char = '·';
    }

    if (i < currentIndex) {
      // Уже напечатано
      if (userInput[i] === code[i]) {
        display += chalk.green(char);
      } else {
        display += chalk.red.bgRed(char);
      }
    } else if (i === currentIndex) {
      // Текущий символ
      display += chalk.bgWhite.black(char);
    } else {
      // Ещё не напечатано
      display += chalk.gray(char);
    }
  }

  return display;
}

export function displayStats(stats: TypingStats, progress: number): string {
  const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
  
  return `\n${chalk.cyan('Прогресс:')} [${progressBar}] ${Math.round(progress)}%
${chalk.yellow('WPM:')} ${stats.wpm}  ${chalk.green('Точность:')} ${stats.accuracy}%  ${chalk.red('Ошибки:')} ${stats.errors}  ${chalk.blue('Время:')} ${stats.timeElapsed}с`;
}
