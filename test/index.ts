import { connectDatabase, poolQuery } from '../src/database/postgres'
import { importSQL } from '../src/utils/commons'

const test from './sql/test.sql')

;(async () => {
  await connectDatabase()
  const { rows } = await poolQuery(await test, [null, 1])

  console.log(rows)
})()
