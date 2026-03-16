export const wait = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

export const simulate = async <T>(payload: T, ms = 600, failRate = 0) => {
  await wait(ms)
  if (failRate > 0 && Math.random() < failRate) {
    throw new Error('Mock request failed')
  }
  return payload
}
