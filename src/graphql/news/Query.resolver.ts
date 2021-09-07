import { AuthenticationError, UserInputError } from 'apollo-server-express'
import type { ApolloContext } from 'src/apollo/server'
import { NewsOptions, QueryResolvers } from '../../graphql/generated/graphql'
import { encodeCategory, buildBasicNewsQuery, newsORM } from './ORM'
import { importSQL } from '../../utils/commons'
import { poolQuery } from '../../database/postgres'
import { spliceSQL } from '../../utils/ORM'

const byId = importSQL(__dirname, 'sql/byId.sql')
const byStoreId = importSQL(__dirname, 'sql/byStoreId.sql')
const byStoreIdAndCategories = importSQL(__dirname, 'sql/byStoreIdAndCategories.sql')
const joinLikedStore = importSQL(__dirname, 'sql/joinLikedStore.sql')
const joinStoreOnTown = importSQL(__dirname, 'sql/joinStoreOnTown.sql')

export const Query: QueryResolvers<ApolloContext> = {
  news: async (_, { id }, { user }, info) => {
    let [sql, columns, values] = await buildBasicNewsQuery(info, user)

    sql = spliceSQL(sql, await byId, 'GROUP BY')
    values.push(id)

    const { rowCount, rows } = await poolQuery({ text: sql, values, rowMode: 'array' })

    if (rowCount === 0) return null

    return newsORM(rows, columns)[0]
  },

  newsListByStore: async (_, { storeId, categories }, { user }, info) => {
    let encodedCategories

    if (categories) {
      if (categories?.length === 0) throw new UserInputError('Invalid categories value')

      encodedCategories = categories.map((category) => encodeCategory(category))

      if (encodedCategories.some((encodeCategory) => encodeCategory === null))
        throw new UserInputError('Invalid categories value')
    }

    let [sql, columns, values] = await buildBasicNewsQuery(info, user)

    if (categories) {
      sql = spliceSQL(sql, await byStoreIdAndCategories, 'GROUP BY')
      values.push(storeId, encodedCategories)
    } else {
      sql = spliceSQL(sql, await byStoreId, 'GROUP BY')
      values.push(storeId)
    }

    const { rowCount, rows } = await poolQuery({ text: sql, values, rowMode: 'array' })

    if (rowCount === 0) return null

    return newsORM(rows, columns)
  },

  newsListByTown: async (_, { town, option }, { user }, info) => {
    let [sql, columns, values] = await buildBasicNewsQuery(info, user)

    if (town) {
      sql = spliceSQL(sql, await joinStoreOnTown, 'WHERE')
      values.push(town)
    }

    if (option === NewsOptions.LikedStore) {
      if (!user) throw new AuthenticationError('로그인되어 있지 않습니다. 로그인 후 시도해주세요.')

      sql = spliceSQL(sql, await joinLikedStore, 'WHERE')
      values.push(user.id)
    }

    const { rowCount, rows } = await poolQuery({ text: sql, values, rowMode: 'array' })

    if (rowCount === 0) return null

    return newsORM(rows, columns)
  },
}
