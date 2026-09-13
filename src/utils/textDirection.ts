/** First strong character determines paragraph direction, independent of UI language. */
export function textDirection(text: string): 'rtl' | 'ltr' {
  for (const char of text) {
    if (!/\p{Letter}/u.test(char)) continue
    if (/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(char)) return 'rtl'
    if (/\p{Letter}/u.test(char)) return 'ltr'
  }
  return 'ltr'
}

/** Arabic joining must survive even inside an English-led mixed paragraph. */
export function hasJoiningScript(text: string): boolean {
  return /\p{Script=Arabic}/u.test(text)
}
