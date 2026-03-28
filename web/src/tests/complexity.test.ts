import { describe, it, expect } from 'vitest'
import { calculateComplexity } from '@core/ast/complexity'

describe('calculateComplexity', () => {
  it('должен считать базовую сложность равной 0', () => {
    const code = `
      function hello() {
        return "world"
      }
    `
    
    expect(calculateComplexity(code)).toBe(0)
  })

  it('должен добавлять +1 за if', () => {
    const code = `
      function test() {
        if (condition) {
          return true
        }
        return false
      }
    `
    
    expect(calculateComplexity(code)).toBe(1)
  })

  it('должен добавлять +1 за циклы', () => {
    const code = `
      function test() {
        for (let i = 0; i < 10; i++) {
          console.log(i)
        }
        while (condition) {
          break
        }
      }
    `
    
    expect(calculateComplexity(code)).toBe(2)
  })

  it('должен добавлять +2 за глубину вложенности > 2', () => {
    const code = `
      function test() {
        if (a) {
          if (b) {
            if (c) {
              return true
            }
          }
        }
      }
    `
    
    // 3 if = 3, глубина > 2 = +2, итого 5
    expect(calculateComplexity(code)).toBe(5)
  })

  it('должен считать сложность с логическими операторами', () => {
    const code = `
      function test() {
        if (a && b || c) {
          return true
        }
      }
    `
    
    // 1 if + 1 && + 1 || = 3
    expect(calculateComplexity(code)).toBe(3)
  })
})
