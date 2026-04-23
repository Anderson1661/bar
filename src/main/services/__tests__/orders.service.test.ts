import { OrdersService } from '../orders.service'

const queryMock = jest.fn()
const queryOneMock = jest.fn()
const executeMock = jest.fn()
const withTransactionMock = jest.fn()

jest.mock('../../database/connection', () => ({
  asNullableTrimmed: (value: unknown) => {
    if (value === undefined || value === null) return null
    const normalized = String(value).trim()
    return normalized.length ? normalized : null
  },
  query: (...args: unknown[]) => queryMock(...args),
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  execute: (...args: unknown[]) => executeMock(...args),
  withTransaction: (...args: unknown[]) => withTransactionMock(...args),
}))

const auditLogMock = jest.fn()
jest.mock('../../utils/audit', () => ({
  auditLog: (...args: unknown[]) => auditLogMock(...args),
}))

describe('OrdersService#create', () => {
  let service: OrdersService

  beforeEach(() => {
    service = new OrdersService()
    jest.spyOn(service, 'getById').mockResolvedValue({ id: 101 } as never)
  })

  it('convierte error de constraint a TABLE_BUSY', async () => {
    const duplicateError = new Error("Duplicate entry '1-1' for key 'uq_orders_table_open'") as Error & { code: string }
    duplicateError.code = 'ER_DUP_ENTRY'
    withTransactionMock.mockRejectedValue(duplicateError)

    const result = await service.create({ tableId: 1, waiterId: 7 })

    expect(result).toEqual({
      success: false,
      error: 'La mesa ya tiene una cuenta abierta',
      code: 'TABLE_BUSY',
    })
    expect(auditLogMock).not.toHaveBeenCalled()
  })

  it('permite una creación y rechaza la concurrente para la misma mesa', async () => {
    const dto = { tableId: 1, waiterId: 7 }
    let call = 0

    withTransactionMock.mockImplementation(async () => {
      call += 1
      if (call === 1) {
        await new Promise((resolve) => setTimeout(resolve, 20))
        return 101
      }

      const duplicateError = new Error("Duplicate entry '1-1' for key 'uq_orders_table_open'") as Error & { code: string }
      duplicateError.code = 'ER_DUP_ENTRY'
      throw duplicateError
    })

    const [first, second] = await Promise.all([service.create(dto), service.create(dto)])

    expect(first.success).toBe(true)
    expect(second).toEqual({
      success: false,
      error: 'La mesa ya tiene una cuenta abierta',
      code: 'TABLE_BUSY',
    })
    expect(auditLogMock).toHaveBeenCalledTimes(1)
  })
})
