export function flattenToNested(obj: Record<string, any>): any {
  const result: any = {};

  const entries = Object.entries(obj);

  for (let e = 0; e < entries.length; e++) {
    const [key, value] = entries[e];

    const parts = key.split(/\]\[|\[|\]/).filter(Boolean);

    let temp: any = result;

    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];

      if (i === len - 1) {
        temp[part] = value;
      } else {
        if (!temp[part]) {
          temp[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
        }

        temp = temp[part];
      }
    }
  }

  return result;
}
