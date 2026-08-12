const parseNumber = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    let str = val;
    if (str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

console.log(parseNumber("1.500,00")); // 1500
console.log(parseNumber("1500,00")); // 1500
console.log(parseNumber("100.50")); // 100.5
console.log(parseNumber(1200)); // 1200
console.log(parseNumber(null)); // 0
console.log(parseNumber(undefined)); // 0
