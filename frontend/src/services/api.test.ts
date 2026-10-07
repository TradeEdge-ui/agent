import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { apiErrorMessage } from './api'

describe('apiErrorMessage', () => {
  it('extracts a string detail from an API error response', () => {
    const err = new AxiosError('Request failed')
    err.response = { data: { detail: 'Invalid email or password' } } as never
    expect(apiErrorMessage(err)).toBe('Invalid email or password')
  })

  it('joins structured validation error details into a readable message', () => {
    const err = new AxiosError('Request failed')
    err.response = {
      data: { detail: [{ msg: 'field required' }, { msg: 'value is not a valid email' }] },
    } as never
    expect(apiErrorMessage(err)).toBe('field required, value is not a valid email')
  })

  it('falls back to the raw error message for non-axios errors', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('Error: boom')
  })
})
