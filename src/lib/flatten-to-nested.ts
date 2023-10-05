export function flattenToNested(obj: Record<string, any>): any {
  const result: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split(/\]\[|\[|\]/).filter((p) => p.length);
    let temp: any = result;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (i === parts.length - 1) {
        temp[part] = value;
      } else {
        if (!temp[part]) {
          temp[part] = parts[i + 1].match(/^\d+$/) ? [] : {};
        }
        temp = temp[part];
      }
    }
  }

  return result;
}
