import { roomScenario } from './helpers/room-scenario.js'

// Any unexpected response or invariant fails the command.
for (const count of [30, 50]) console.log(JSON.stringify(await roomScenario(count), null, 2))
