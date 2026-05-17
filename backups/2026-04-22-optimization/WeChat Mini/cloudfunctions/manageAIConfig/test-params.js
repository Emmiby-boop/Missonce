
// 模拟 getType 函数（来自 type_1.getType）
function getType(input) {
  if (input === null) return 'null';
  if (typeof input === 'undefined') return 'undefined';
  if (typeof input === 'string') return 'string';
  if (typeof input === 'number') return 'number';
  if (typeof input === 'boolean') return 'boolean';
  if (Array.isArray(input)) return 'array';
  if (typeof input === 'object') return 'object';
  return typeof input;
}

// 模拟 validType 函数
function validType(input, ref, name = 'parameter') {
  function validTypeImpl(input, ref, name) {
    const inputType = getType(input);
    const refType = getType(ref);
    console.log(`[validTypeImpl] name=${name}, inputType=${inputType}, refType=${refType}`);
    console.log(`  input:`, input);
    console.log(`  ref:`, ref);

    if (refType === 'string') {
      if (inputType !== ref) {
        return `${name} should be ${ref} instead of ${inputType};`;
      }
      return '';
    } else {
      if (inputType !== refType) {
        return `${name} should be ${refType} instead of ${inputType}; `;
      }
      let errors = '';
      switch (inputType) {
        case 'object': {
          for (const key in ref) {
            errors += validTypeImpl(input[key], ref[key], `${name}.${key}`);
          }
          break;
        }
        case 'array': {
          for (let i = 0; i < ref.length; i++) {
            errors += validTypeImpl(input[i], ref[i], `${name}[${i}]`);
          }
          break;
        }
        default: {
          break;
        }
      }
      return errors;
    }
  }
  const error = validTypeImpl(input, ref, name);
  return {
    passed: !error,
    reason: error,
  };
}

// 测试数据
const saveData = {
  API_KEY: 'test-key',
  API_URL: 'test-url',
  MODEL: 'test-model',
  SYSTEM_PROMPT: 'test-prompt'
};

console.log('========== 测试用例1：直接传 saveData ==========');
const test1Options = saveData;
const result1 = validType(test1Options, { data: 'object' }, 'parameter');
console.log('结果:', result1);
console.log();

console.log('========== 测试用例2：传 { data: saveData } ==========');
const test2Options = { data: saveData };
const result2 = validType(test2Options, { data: 'object' }, 'parameter');
console.log('结果:', result2);
console.log();

console.log('========== 测试用例3：传 { data: undefined } ==========');
const test3Options = { data: undefined };
const result3 = validType(test3Options, { data: 'object' }, 'parameter');
console.log('结果:', result3);
console.log();

console.log('========== 测试用例4：看看我们实际数据 ==========');
console.log('saveData:', saveData);
console.log('getType(saveData):', getType(saveData));
const test4Options = { data: saveData };
console.log('test4Options:', test4Options);
console.log('getType(test4Options.data):', getType(test4Options.data));
const result4 = validType(test4Options, { data: 'object' }, 'parameter');
console.log('结果:', result4);
