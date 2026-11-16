import { randomInt } from 'node:crypto'

// A small local word list keeps suggestions free and avoids another dependency.
const adjectives = ['Brave', 'Bright', 'Calm', 'Clever', 'Curious', 'Daring', 'Gentle', 'Golden', 'Happy', 'Jolly', 'Kind', 'Lucky', 'Merry', 'Nimble', 'Quiet', 'Quick', 'Silver', 'Sunny', 'Swift', 'Wise']
const nouns = ['Badger', 'Bear', 'Crane', 'Deer', 'Dolphin', 'Eagle', 'Falcon', 'Finch', 'Fox', 'Heron', 'Koala', 'Lark', 'Lynx', 'Otter', 'Owl', 'Panda', 'Robin', 'Tiger', 'Whale', 'Wolf']

export function suggestNickname(taken: string[]) {
  const unavailable = new Set(taken.map(name => name.toLowerCase()))
  const start = randomInt(adjectives.length * nouns.length)
  // Walk the combinations after a random start: at most 50 can be occupied.
  for (let offset = 0; offset < adjectives.length * nouns.length; offset++) {
    const index = (start + offset) % (adjectives.length * nouns.length)
    const name = `${adjectives[Math.floor(index / nouns.length)]} ${nouns[index % nouns.length]}`
    if (!unavailable.has(name.toLowerCase())) return name
  }
  return `Guest ${randomInt(1000, 10000)}`
}
