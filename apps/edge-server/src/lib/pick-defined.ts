type DefinedValues<T extends Record<string, unknown>> = {
  [K in keyof T as undefined extends T[K] ? never : K]: Exclude<T[K], undefined>
}

export function pickDefined<T extends Record<string, unknown>>(
  input: T,
): DefinedValues<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as DefinedValues<T>
}
