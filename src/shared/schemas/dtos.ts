import { z } from 'zod'

const idSchema = z.number().int().positive()
const optionalIdSchema = idSchema.optional()
const nonEmptyString = z.string().trim().min(1)

export const loginDTOSchema = z.object({ username: nonEmptyString, password: nonEmptyString })
export const changePasswordDTOSchema = z.object({ currentPassword: nonEmptyString, newPassword: z.string().min(6) })

export const createOrderDTOSchema = z.object({ tableId: idSchema, waiterId: idSchema, notes: z.string().optional() })
export const createSubOrderDTOSchema = z.object({ orderId: idSchema, label: z.string().optional() })
export const addOrderItemDTOSchema = z.object({
  orderId: idSchema,
  subOrderId: optionalIdSchema,
  productId: idSchema,
  quantity: z.number().positive(),
  notes: z.string().optional(),
})
export const cancelOrderItemDTOSchema = z.object({ orderItemId: idSchema, reason: nonEmptyString })
export const sendToBarDTOSchema = z.object({ orderId: idSchema, itemIds: z.array(idSchema).optional() })

export const registerPaymentDTOSchema = z.object({
  orderId: idSchema,
  subOrderId: optionalIdSchema,
  paymentMethodId: idSchema,
  amount: z.number().positive(),
  serviceAccepted: z.boolean().nullable().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
})
export const closeOrderDTOSchema = z.object({ orderId: idSchema, serviceAccepted: z.boolean() })

export const adjustInventoryDTOSchema = z.object({
  productId: idSchema,
  type: z.enum(['adjustment_in', 'adjustment_out', 'waste', 'purchase', 'return']),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  reason: nonEmptyString,
  adminUsername: nonEmptyString,
  adminPassword: nonEmptyString,
})

export const openCashSessionDTOSchema = z.object({ openingAmount: z.number().nonnegative() })
export const closeCashSessionDTOSchema = z.object({
  sessionId: idSchema,
  closingAmountReal: z.number().nonnegative(),
  detailsByMethod: z.array(z.object({ paymentMethodId: idSchema, realAmount: z.number().nonnegative() })),
  notes: z.string().optional(),
})

export const createProductDTOSchema = z.object({
  categoryId: idSchema,
  supplierId: optionalIdSchema,
  sku: z.string().optional(),
  name: nonEmptyString,
  description: z.string().optional(),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  stock: z.number().nonnegative().optional(),
  minStock: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  trackInventory: z.boolean().optional(),
})
export const updateProductDTOSchema = createProductDTOSchema.partial().extend({ id: idSchema, isActive: z.boolean().optional() })

export const createUserDTOSchema = z.object({
  username: nonEmptyString,
  fullName: nonEmptyString,
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(6),
  roleId: idSchema,
})
export const updateUserDTOSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  roleId: idSchema.optional(),
  isActive: z.boolean().optional(),
})

export const createExpenseDTOSchema = z.object({
  categoryId: idSchema,
  cashSessionId: optionalIdSchema,
  description: nonEmptyString,
  amount: z.number().positive(),
  notes: z.string().optional(),
  expenseDate: nonEmptyString,
})

export const reportFiltersSchema = z.object({
  from: nonEmptyString,
  to: nonEmptyString,
  waiterId: optionalIdSchema,
  tableId: optionalIdSchema,
  categoryId: optionalIdSchema,
  paymentMethodId: optionalIdSchema,
})

export const wrappedDto = <T extends z.ZodTypeAny>(schema: T) => z.object({ dto: schema })
export const idParamSchema = idSchema
export const optionalBooleanSchema = z.boolean().optional()
export const searchTermSchema = z.string().trim()

export const auditListFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  module: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
})

export const expenseListFiltersSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: optionalIdSchema,
})
